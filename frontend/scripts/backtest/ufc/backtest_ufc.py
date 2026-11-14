#!/usr/bin/env python3
"""
UFC betting model: build, backtest, export.

Data: "UFC Data" by nlbair (CC BY 4.0), https://github.com/nlbair/ufc-data
  every UFC fight 2013-02-16 .. 2026-10-10 with BestFightOdds opening and
  closing moneylines, results (method, round, time) and per-fight stats.

What it does
  1. Walks every fight in date order and, for each fighter, keeps a running
     record built only from their EARLIER UFC fights: Elo rating, finishes won
     and lost, strikes landed / absorbed per minute, takedowns, layoff, streak.
  2. Fits three models on fights before the test window:
       winner  - logistic regression: the closing market's no-vig chance plus
                 the fighter-history features (does it beat the market?)
       rounds  - chance the fight goes past the standard rounds line
                 (2.5 for 3-round fights, 4.5 for 5-round fights)
       method  - KO/TKO vs submission vs decision (multinomial)
  3. Chooses the winner betting rule (minimum edge over the price) on a
     validation window, then scores everything ONCE on the held-out last year.
  4. Writes the fitted coefficients (and a per-fighter history table the app
     looks fighters up in) as JSON.

Usage:
  python3 backtest_ufc.py --data path/to/ufc_all_fights_wide.csv --out outdir
"""
import argparse
import json
import math
import unicodedata
from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

TRAIN_START = "2015-01-01"  # 2013-14 only warm up the fighter histories
VALID_START = "2024-01-01"  # threshold chosen on 2024-01-01 .. TEST_START
TEST_START = "2025-10-11"   # held out: the last year of data
ELO_K = 36.0
DIV_WEIGHT = {  # pounds, for a "heavier = more knockouts" feature
    "strawweight": 115, "flyweight": 125, "bantamweight": 135, "featherweight": 145,
    "lightweight": 155, "welterweight": 170, "middleweight": 185, "lightheavyweight": 205,
    "heavyweight": 245, "catchweight": 160, "openweight": 205,
}


def norm_name(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in s).split())


def implied(american):
    a = float(american)
    return 100.0 / (a + 100.0) if a > 0 else -a / (-a + 100.0)


def logit(p):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))


def division_info(div):
    div = str(div or "")
    women = div.startswith("womens")
    base = div.replace("womens", "")
    return DIV_WEIGHT.get(base, 165), women


def new_history():
    return dict(
        fights=0, wins=0, losses=0, ko_w=0, sub_w=0, dec_w=0, ko_l=0, sub_l=0, dec_l=0,
        secs=0.0, sig_l=0.0, sig_a=0.0, sig_abs=0.0, td_l=0.0, kd=0.0,
        elo=1500.0, last=None, last_loss_ko=False, streak=0, finishes_in=0,
    )


def snapshot(h, date):
    """Features for a fighter as of `date` (from earlier fights only)."""
    n = h["fights"]
    mins = h["secs"] / 60.0
    layoff = (date - h["last"]).days if h["last"] is not None else 365
    return dict(
        n=n,
        elo=h["elo"],
        win_rate=(h["wins"] + 1) / (n + 2),
        ko_w=(h["ko_w"] + 0.3) / (n + 1),
        sub_w=(h["sub_w"] + 0.15) / (n + 1),
        ko_l=(h["ko_l"] + 0.2) / (n + 1),
        sub_l=(h["sub_l"] + 0.1) / (n + 1),
        dec_rate=(h["dec_w"] + h["dec_l"] + 0.45) / (n + 1),
        slpm=(h["sig_l"] + 3.5 * 5) / (mins + 5),
        sapm=(h["sig_abs"] + 3.5 * 5) / (mins + 5),
        acc=(h["sig_l"] + 20) / (h["sig_a"] + 45),
        tdpm=(h["td_l"] + 0.25) / (mins + 5),
        layoff=min(layoff, 1500),
        last_loss_ko=1.0 if h["last_loss_ko"] else 0.0,
        streak=max(min(h["streak"], 5), -5),
        avg_min=(mins / n) if n else 10.0,
    )


def build_rows(df):
    """One row per fight, features from both fighters' prior UFC fights."""
    df = df.sort_values(["event_date", "card_position"], ascending=[True, False]).reset_index(drop=True)
    hist = defaultdict(new_history)
    rows = []
    for date, day in df.groupby("event_date", sort=True):
        updates = []
        for _, f in day.iterrows():
            a, b = f["f1_id"], f["f2_id"]
            sa, sb = snapshot(hist[a], date), snapshot(hist[b], date)
            rows.append(dict(f=f, a=sa, b=sb))
            updates.append(f)
        # update histories only after the whole card (no same-day leakage)
        for f in updates:
            a, b = f["f1_id"], f["f2_id"]
            ha, hb = hist[a], hist[b]
            secs = float(f.get("fight_duration_sec") or 0)
            for h, me, op in ((ha, "f1", "f2"), (hb, "f2", "f1")):
                h["fights"] += 1
                h["secs"] += secs
                h["sig_l"] += float(f.get(f"{me}_tot_sig_str_landed") or 0)
                h["sig_a"] += float(f.get(f"{me}_tot_sig_str_att") or 0)
                h["sig_abs"] += float(f.get(f"{op}_tot_sig_str_landed") or 0)
                h["td_l"] += float(f.get(f"{me}_tot_td_landed") or 0)
                h["kd"] += float(f.get(f"{me}_tot_kd") or 0)
                h["last"] = f["event_date"]
            w = f["winner"]
            ft = f["finish_type"]
            if w in (1, 2):
                win, lose = (ha, hb) if w == 1 else (hb, ha)
                win["wins"] += 1
                lose["losses"] += 1
                key = "ko" if ft == "ko_tko" else "sub" if ft == "submission" else "dec"
                win[f"{key}_w"] += 1
                lose[f"{key}_l"] += 1
                win["streak"] = max(win["streak"], 0) + 1
                lose["streak"] = min(lose["streak"], 0) - 1
                win["last_loss_ko"] = False
                lose["last_loss_ko"] = ft == "ko_tko"
                # Elo (finishes move it a little more)
                ea = 1 / (1 + 10 ** ((lose["elo"] - win["elo"]) / 400))
                k = ELO_K * (1.15 if ft in ("ko_tko", "submission") else 1.0)
                win["elo"] += k * (1 - ea)
                lose["elo"] -= k * (1 - ea)
    return rows, hist


def side_features(s, o, f, flip):
    """Feature vector for one fighter (s) against the other (o)."""
    me, op = ("f2", "f1") if flip else ("f1", "f2")
    age = lambda k: float(f[f"{k}_age"]) if pd.notna(f.get(f"{k}_age")) else 30.0
    cm = lambda k, col: f.get(f"{k}_{col}")
    reach = (float(cm(me, "reach_cm")) - float(cm(op, "reach_cm"))) / 10 if pd.notna(cm(me, "reach_cm")) and pd.notna(cm(op, "reach_cm")) else 0.0
    height = (float(cm(me, "height_cm")) - float(cm(op, "height_cm"))) / 10 if pd.notna(cm(me, "height_cm")) and pd.notna(cm(op, "height_cm")) else 0.0
    return dict(
        elo=(s["elo"] - o["elo"]) / 100,
        exp=math.log1p(s["n"]) - math.log1p(o["n"]),
        age=(age(me) - age(op)) / 5,
        age_old=max(age(me) - 33, 0) / 3 - max(age(op) - 33, 0) / 3,
        reach=reach,
        height=height,
        strike=(s["slpm"] - s["sapm"]) - (o["slpm"] - o["sapm"]),
        acc=(s["acc"] - o["acc"]) * 10,
        td=(s["tdpm"] - o["tdpm"]) * 10,
        layoff=(s["layoff"] - o["layoff"]) / 365,
        ko_chin=o["ko_w"] * s["ko_l"] - s["ko_w"] * o["ko_l"],  # their power vs my chin, minus mine vs theirs
        streak=(s["streak"] - o["streak"]) / 5,
        last_ko=s["last_loss_ko"] - o["last_loss_ko"],
    )


WIN_FEATURES = ["mkt", "move", "elo", "exp", "age", "age_old", "reach", "height", "strike", "acc", "td", "layoff", "ko_chin", "streak", "last_ko"]


def winner_table(rows):
    """Two rows per fight (one per fighter): features, market, prices, result."""
    out = []
    for r in rows:
        f = r["f"]
        if not f.get("has_odds") or pd.isna(f.get("f1_close_prob_novig")) or f["winner"] not in (1, 2):
            continue
        for flip in (False, True):
            me, op = ("f2", "f1") if flip else ("f1", "f2")
            s, o = (r["b"], r["a"]) if flip else (r["a"], r["b"])
            p_close = float(f[f"{me}_close_prob_novig"])
            p_open = float(f[f"{me}_open_prob_novig"]) if pd.notna(f.get(f"{me}_open_prob_novig")) else p_close
            # the price a typical book offered: midpoint of the closing range, in probability terms
            lo, hi = f[f"{me}_close_low"], f[f"{me}_close_high"]
            imp = (implied(lo) + implied(hi)) / 2
            row = dict(
                date=f["event_date"], fight=f["fight_id"], name=f[f"{me}_name"], opp=f[f"{op}_name"],
                mkt=logit(p_close), move=logit(p_close) - logit(p_open), p_mkt=p_close,
                dec_price=1 / imp, best_price=1 / implied(hi),
                won=1 if f["winner"] == (2 if flip else 1) else 0,
            )
            row.update(side_features(s, o, f, flip))
            out.append(row)
    out = pd.DataFrame(out)
    out[WIN_FEATURES] = out[WIN_FEATURES].fillna(0.0)
    return out


def fight_table(rows):
    """One row per fight for the rounds / method models (fighter order doesn't matter)."""
    out = []
    for r in rows:
        f = r["f"]
        if pd.isna(f.get("fight_duration_sec")) or f["finish_type"] in ("overturned",):
            continue
        a, b = r["a"], r["b"]
        weight, women = division_info(f["bout_division"])
        rounds = int(f["scheduled_rounds"] or 3)
        p = float(f["f1_close_prob_novig"]) if pd.notna(f.get("f1_close_prob_novig")) else 0.5
        line = 2.5 if rounds == 3 else 4.5
        ft = f["finish_type"]
        method = "KO" if ft == "ko_tko" else "SUB" if ft == "submission" else "DEC" if ft == "decision" else None
        out.append(dict(
            date=f["event_date"], fight=f["fight_id"], rounds=rounds, line=line,
            five=1.0 if rounds == 5 else 0.0,
            weight=(weight - 165) / 40, women=1.0 if women else 0.0,
            mismatch=abs(p - 0.5) * 2,
            ko_power=a["ko_w"] + b["ko_w"], chin=a["ko_l"] + b["ko_l"],
            sub_skill=a["sub_w"] + b["sub_w"], sub_def=a["sub_l"] + b["sub_l"],
            dec_hist=a["dec_rate"] + b["dec_rate"],
            avg_min=(a["avg_min"] + b["avg_min"]) / 10,
            pace=(a["slpm"] + b["slpm"]) / 5,
            td=(a["tdpm"] + b["tdpm"]) * 10,
            over=1 if float(f["fight_duration_sec"]) > line * 300 else 0,
            dur=float(f["fight_duration_sec"]),
            method=method,
        ))
    out = pd.DataFrame(out)
    out[ROUND_FEATURES] = out[ROUND_FEATURES].fillna(0.0)
    return out


ROUND_FEATURES = ["five", "weight", "women", "mismatch", "ko_power", "chin", "sub_skill", "sub_def", "dec_hist", "avg_min", "pace", "td"]
METHOD_FEATURES = ROUND_FEATURES


def fit_logit(X, y, C=1.0):
    m = LogisticRegression(C=C, max_iter=2000)
    m.fit(X, y)
    return m


def winner_probs(model, df):
    # each fighter's raw model chance, then normalised so a fight's two sum to 1
    raw = model.predict_proba(df[WIN_FEATURES].values)[:, 1]
    df = df.assign(raw=raw)
    tot = df.groupby("fight")["raw"].transform("sum")
    return df.assign(p=df["raw"] / tot)


def bet_results(df, min_edge, max_price=6.0, price_col="dec_price"):
    """Flat 1-unit bets on every fighter whose model chance beats the price by min_edge (EV)."""
    ev = df["p"] * df[price_col] - 1
    picks = df[(ev >= min_edge) & (df[price_col] <= max_price)]
    # at most one side per fight: the bigger edge
    picks = picks.assign(ev=ev[picks.index]).sort_values("ev", ascending=False).drop_duplicates("fight")
    n = len(picks)
    if n == 0:
        return dict(bets=0, wins=0, roi=0.0, units=0.0, dogs=0, dog_wins=0)
    profit = np.where(picks["won"] == 1, picks[price_col] - 1, -1.0)
    dogs = picks[picks["p_mkt"] < 0.5]
    dog_profit = np.where(dogs["won"] == 1, dogs[price_col] - 1, -1.0)
    return dict(
        bets=n, wins=int(picks["won"].sum()), roi=float(profit.mean()), units=float(profit.sum()),
        dogs=len(dogs), dog_wins=int(dogs["won"].sum()), dog_roi=float(dog_profit.mean()) if len(dogs) else 0.0,
    )


def flat(df, mask, price_col="dec_price"):
    sub = df[mask]
    profit = np.where(sub["won"] == 1, sub[price_col] - 1, -1.0)
    return dict(bets=len(sub), wins=int(sub["won"].sum()), roi=float(profit.mean()) if len(sub) else 0.0)


def log_loss(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    df = pd.read_csv(args.data, low_memory=False)
    df["event_date"] = pd.to_datetime(df["event_date"])
    rows, hist = build_rows(df)

    W = winner_table(rows)
    F = fight_table(rows)
    tr = W[(W.date >= TRAIN_START) & (W.date < VALID_START)]
    va = W[(W.date >= VALID_START) & (W.date < TEST_START)]
    te = W[W.date >= TEST_START]
    report = {"windows": dict(train=[TRAIN_START, VALID_START], valid=[VALID_START, TEST_START], test=[TEST_START, str(W.date.max().date())])}

    # ---------- winner ----------
    # walk-forward: for each year before the test window, train on everything
    # earlier and predict that year; the edge threshold is chosen on all of
    # these out-of-sample years together (thousands of fights, not one window)
    grid = [0.0, 0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.10]
    wf_parts = []
    for year in range(2018, 2026):
        start, end = pd.Timestamp(f"{year}-01-01"), min(pd.Timestamp(f"{year + 1}-01-01"), pd.Timestamp(TEST_START))
        fit = W[(W.date >= TRAIN_START) & (W.date < start)]
        pred = W[(W.date >= start) & (W.date < end)]
        if len(pred) == 0:
            continue
        m = fit_logit(fit[WIN_FEATURES].values, fit["won"].values, C=0.5)
        wf_parts.append(winner_probs(m, pred.copy()).assign(year=year))
    wf = pd.concat(wf_parts)
    valid_curve = {str(e): bet_results(wf, e) for e in grid}
    by_year = {str(e): {str(y): round(bet_results(wf[wf.year == y], e)["roi"], 3) for y in sorted(wf.year.unique())} for e in grid}
    # best walk-forward ROI among rules that bet at least 300 times
    best_edge = max((e for e in grid if valid_curve[str(e)]["bets"] >= 300), key=lambda e: valid_curve[str(e)]["roi"])
    report["walk_forward_years_roi"] = by_year
    report["walk_forward_log_loss"] = dict(market=log_loss(wf["p_mkt"].values, wf["won"].values), model=log_loss(wf["p"].values, wf["won"].values))

    # refit on train + validation, then score the held-out year once
    trva = pd.concat([tr, va])
    m_final_test = fit_logit(trva[WIN_FEATURES].values, trva["won"].values, C=0.5)
    te_p = winner_probs(m_final_test, te.copy())
    fav = te_p["p_mkt"] > 0.5
    report["winner"] = dict(
        edge=best_edge,
        valid_curve=valid_curve,
        test=bet_results(te_p, best_edge),
        test_best_price=bet_results(te_p, best_edge, price_col="best_price"),
        test_curve={str(e): bet_results(te_p, e) for e in grid},
        baselines=dict(every_favorite=flat(te_p, fav), every_underdog=flat(te_p, ~fav & (te_p["p_mkt"] < 0.5))),
        accuracy=dict(
            market=float(((te_p["p_mkt"] > 0.5) == (te_p["won"] == 1)).mean()),
            model=float(((te_p["p"] > 0.5) == (te_p["won"] == 1)).mean()),
        ),
        log_loss=dict(market=log_loss(te_p["p_mkt"].values, te_p["won"].values), model=log_loss(te_p["p"].values, te_p["won"].values)),
        coefficients=dict(zip(WIN_FEATURES, m_final_test.coef_[0].round(4).tolist())),
    )

    # ---------- rounds over / under ----------
    ftr = F[(F.date >= TRAIN_START) & (F.date < TEST_START)]
    fte = F[F.date >= TEST_START]
    m_r = fit_logit(ftr[ROUND_FEATURES].values, ftr["over"].values, C=0.5)
    p_over = m_r.predict_proba(fte[ROUND_FEATURES].values)[:, 1]
    pick_over = p_over >= 0.5
    base_rate = ftr["over"].mean()
    report["rounds"] = dict(
        test_fights=len(fte),
        model_accuracy=float((pick_over == (fte["over"].values == 1)).mean()),
        always_majority_accuracy=float(max(fte["over"].mean(), 1 - fte["over"].mean())),
        train_over_rate=float(base_rate),
        test_over_rate=float(fte["over"].mean()),
        confident=dict(  # only when the model is 60%+ one way
            n=int(((p_over >= 0.6) | (p_over <= 0.4)).sum()),
            accuracy=float(((pick_over == (fte["over"].values == 1))[(p_over >= 0.6) | (p_over <= 0.4)]).mean()),
        ),
        log_loss=dict(model=log_loss(p_over, fte["over"].values), base_rate=log_loss(np.full(len(fte), base_rate), fte["over"].values)),
    )

    # ---------- method of victory ----------
    mtr = ftr[ftr.method.notna()]
    mte = fte[fte.method.notna()]
    m_m = LogisticRegression(C=0.5, max_iter=3000)
    m_m.fit(mtr[METHOD_FEATURES].values, mtr["method"].values)
    pred = m_m.predict(mte[METHOD_FEATURES].values)
    majority = mtr["method"].value_counts().idxmax()
    report["method"] = dict(
        test_fights=len(mte),
        model_accuracy=float((pred == mte["method"].values).mean()),
        always_majority=majority,
        always_majority_accuracy=float((mte["method"].values == majority).mean()),
        predicted_mix={k: int(v) for k, v in pd.Series(pred).value_counts().items()},
        actual_mix={k: int(v) for k, v in mte["method"].value_counts().items()},
    )

    # ---------- the shipped models: refit on everything ----------
    allw = W[W.date >= TRAIN_START]
    m_ship = fit_logit(allw[WIN_FEATURES].values, allw["won"].values, C=0.5)
    allf = F[F.date >= TRAIN_START]
    m_r_ship = fit_logit(allf[ROUND_FEATURES].values, allf["over"].values, C=0.5)
    # ESPN's rounds line isn't always the standard one: a model per common line
    rounds_by_line = {}
    for L in (1.5, 2.5, 3.5, 4.5):
        sub = allf if L <= 2.5 else allf[allf.rounds == 5]
        if L == 3.5:
            sub = allf[allf.rounds == 5]
        y = (sub["dur"] > L * 300).astype(int).values
        if y.min() == y.max():
            continue
        m = fit_logit(sub[ROUND_FEATURES].values, y, C=0.5)
        rounds_by_line[str(L)] = dict(coef=m.coef_[0].tolist(), intercept=float(m.intercept_[0]), n=int(len(sub)))
    allm = allf[allf.method.notna()]
    m_m_ship = LogisticRegression(C=0.5, max_iter=3000).fit(allm[METHOD_FEATURES].values, allm["method"].values)

    model = dict(
        source="UFC Data by nlbair (CC BY 4.0), github.com/nlbair/ufc-data",
        data_through=str(W.date.max().date()),
        winner=dict(features=WIN_FEATURES, coef=m_ship.coef_[0].tolist(), intercept=float(m_ship.intercept_[0]), min_edge=best_edge, max_price=6.0),
        rounds=dict(features=ROUND_FEATURES, coef=m_r_ship.coef_[0].tolist(), intercept=float(m_r_ship.intercept_[0]), by_line=rounds_by_line),
        method=dict(features=METHOD_FEATURES, classes=m_m_ship.classes_.tolist(), coef=m_m_ship.coef_.tolist(), intercept=m_m_ship.intercept_.tolist()),
        elo_k=ELO_K,
        backtest=dict(
            window=report["windows"]["test"],
            winner=report["winner"]["test"],
            winner_edge=best_edge,
            walk_forward=dict(years="2018-2025", **report["winner"]["valid_curve"][str(best_edge)]),
            winner_baselines=report["winner"]["baselines"],
            rounds=dict(accuracy=report["rounds"]["model_accuracy"], baseline=report["rounds"]["always_majority_accuracy"], fights=report["rounds"]["test_fights"]),
            method=dict(accuracy=report["method"]["model_accuracy"], baseline=report["method"]["always_majority_accuracy"], fights=report["method"]["test_fights"]),
        ),
    )

    # per-fighter history as of the last card, keyed by normalised name
    last_date = df["event_date"].max() + pd.Timedelta(days=1)
    names, phys = {}, {}
    for _, f in df.sort_values("event_date").iterrows():  # latest fight wins
        for k in ("f1", "f2"):
            names[f[f"{k}_id"]] = f[f"{k}_name"]
            phys[f[f"{k}_id"]] = dict(
                age=float(f[f"{k}_age"]) if pd.notna(f.get(f"{k}_age")) else None,
                reach=float(f[f"{k}_reach_cm"]) if pd.notna(f.get(f"{k}_reach_cm")) else None,
                height=float(f[f"{k}_height_cm"]) if pd.notna(f.get(f"{k}_height_cm")) else None,
            )
    fighters = {}
    active_since = pd.Timestamp("2021-01-01")
    for fid, h in hist.items():
        if h["last"] is None or h["last"] < active_since:
            continue
        s = snapshot(h, last_date)
        ph = phys.get(fid, {})
        fighters[norm_name(names.get(fid, fid))] = dict(
            n=s["n"], elo=round(s["elo"], 1), ko_w=round(s["ko_w"], 3), sub_w=round(s["sub_w"], 3),
            ko_l=round(s["ko_l"], 3), sub_l=round(s["sub_l"], 3), dec=round(s["dec_rate"], 3),
            slpm=round(s["slpm"], 2), sapm=round(s["sapm"], 2), acc=round(s["acc"], 3), tdpm=round(s["tdpm"], 3),
            last=str(h["last"].date()) if h["last"] is not None else None,
            lko=int(s["last_loss_ko"]), st=int(s["streak"]), am=round(s["avg_min"], 2),
            age=round(ph["age"], 2) if ph.get("age") else None,  # age on the `last` fight date
            reach=ph.get("reach"), height=ph.get("height"),
        )

    with open(f"{args.out}/ufc-model.json", "w") as fh:
        json.dump(model, fh, separators=(",", ":"))
    with open(f"{args.out}/ufc-fighters.json", "w") as fh:
        json.dump(dict(through=str(df["event_date"].max().date()), fighters=fighters), fh, separators=(",", ":"))
    with open(f"{args.out}/ufc-backtest-report.json", "w") as fh:
        json.dump(report, fh, indent=1, default=str)
    print(json.dumps(report, indent=1, default=str))


if __name__ == "__main__":
    main()
