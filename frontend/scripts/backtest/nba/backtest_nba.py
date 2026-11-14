#!/usr/bin/env python3
"""
NBA betting model: build, walk-forward backtest, export.

Data: data/nba.csv from github.com/ethanbell528-cmd/fda-project-1 (one row
per team per game; closing spreads and totals 2007-08 to 2025-26 from
SportsbookReviewsOnline and hoopR/ESPN, moneylines 2007-08 to 2021-22).

Every feature comes from EARLIER games only:
  rest      days since each team's last game, back-to-backs, 3-in-4 nights
  h2h       the last 6 meetings in the last 3 seasons: wins, covers, overs;
            "revenge" (lost the last meeting by 15+)
  form      each team's last 5 results against the spread, and its season
            point margin vs the market's view (hot teams get over-bet)
  line      size of the spread / total

Models: winner (market chance + features), spread cover, total over.
Walk-forward: each season 2013-14 .. 2023-24 predicted by a model trained on
all earlier ones; thresholds chosen there. 2024-25 and 2025-26 are held out
(moneylines stop after 2021-22, so the winner model's money results are
walk-forward only; its pick accuracy is still scored on the holdout).

Usage: python3 backtest_nba.py --data nba.csv --out outdir
"""
import argparse
import json
import math
from collections import defaultdict, deque

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

FIRST = 2007
WF = range(2013, 2024)
TEST = (2024, 2025)


def implied(a):
    a = float(a)
    return 100.0 / (a + 100.0) if a > 0 else -a / (-a + 100.0)


def dec(a):
    a = float(a)
    return 1 + a / 100 if a > 0 else 1 + 100 / -a


def logit(p):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))


def shrink(h, n, k=3):
    return (h + k * 0.5) / (n + k)


def build(raw):
    d = raw[raw.game_type.fillna("regular").isin(["regular", "playoff", "playoffs"])].copy()
    d["date"] = pd.to_datetime(d["date"])
    home = d[d.home_away == "H"].copy()
    away = d[d.home_away == "A"][["game_id", "team", "moneyline", "line"]].rename(
        columns={"team": "away", "moneyline": "away_ml", "line": "away_line"})
    g = home.merge(away, on="game_id", how="inner").rename(columns={"team": "home", "moneyline": "home_ml", "line": "home_line"})
    g = g.sort_values("date").reset_index(drop=True)

    last_game = {}
    recent = defaultdict(lambda: deque(maxlen=4))   # team -> recent game dates
    form = defaultdict(lambda: deque(maxlen=5))     # team -> ATS results
    season_margin = defaultdict(list)               # (season, team) -> [margin - expected]
    meetings = defaultdict(list)
    rows = []
    for _, r in g.iterrows():
        h, a, s, dt = r.home, r.opponent, int(r.season), r.date
        def rest(t):
            return min((dt - last_game[t]).days, 7) if t in last_game else 7
        def three_in_four(t):
            return 1.0 if len([x for x in recent[t] if (dt - x).days <= 3]) >= 2 else 0.0
        key = frozenset((h, a))
        past = [m for m in meetings[key] if m["season"] >= s - 3][-6:]
        hw = sum(1 for m in past if m["winner"] == h)
        hc = sum(1 for m in past if m["cover"] == h)
        hcn = sum(1 for m in past if m["cover"] is not None)
        ho = sum(1 for m in past if m["ou"] == 1)
        hon = sum(1 for m in past if m["ou"] is not None)
        last = past[-1] if past else None
        hl = r.home_line  # home spread, negative = home favoured
        rh, ra = rest(h), rest(a)
        sm_h = season_margin[(s, h)]
        sm_a = season_margin[(s, a)]
        rows.append(dict(
            game_id=r.game_id, date=dt, season=s, home=h, away=a,
            margin=r.margin, total=r.total, line=hl, total_line=r.total_line,
            home_ml=r.home_ml, away_ml=r.away_ml,
            rest_diff=max(min(rh - ra, 3), -3) / 3,
            home_b2b=1.0 if rh == 1 else 0.0, away_b2b=1.0 if ra == 1 else 0.0,
            home_3in4=three_in_four(h), away_3in4=three_in_four(a),
            both_b2b=1.0 if rh == 1 and ra == 1 else 0.0,
            h2h_win=shrink(hw, len(past)) - 0.5, h2h_cov=shrink(hc, hcn) - 0.5, h2h_over=shrink(ho, hon) - 0.5,
            h2h_n=len(past), h2h_wins_home=hw, h2h_covers_home=hc, h2h_ats_n=hcn, h2h_overs=ho, h2h_ou_n=hon,
            revenge_home=1.0 if last and last["winner"] == a and last["margin"] >= 15 else 0.0,
            revenge_away=1.0 if last and last["winner"] == h and last["margin"] >= 15 else 0.0,
            form_home=sum(form[h]) / 5, form_away=sum(form[a]) / 5,
            # beating the market's expectations all season (a "hot" team)
            surprise_home=np.mean(sm_h[-15:]) / 10 if len(sm_h) >= 5 else 0.0,
            surprise_away=np.mean(sm_a[-15:]) / 10 if len(sm_a) >= 5 else 0.0,
            spread_abs=abs(hl) / 10 if pd.notna(hl) else 0.0,
            home_dog=1.0 if pd.notna(hl) and hl > 0 else 0.0,
            big_dog=1.0 if pd.notna(hl) and abs(hl) >= 10 else 0.0,
            tl=(r.total_line - 220) / 10 if pd.notna(r.total_line) else 0.0,
        ))
        # update after the game
        m = r.margin
        if pd.notna(m):
            winner = h if m > 0 else a
            cover = None
            if pd.notna(hl):
                ats = m + hl
                cover = h if ats > 0 else a if ats < 0 else None
                form[h].append(1 if cover == h else -1 if cover == a else 0)
                form[a].append(1 if cover == a else -1 if cover == h else 0)
                season_margin[(s, h)].append(ats)
                season_margin[(s, a)].append(-ats)
            ou = None
            if pd.notna(r.total_line) and pd.notna(r.total):
                ou = 1 if r.total > r.total_line else 0 if r.total < r.total_line else None
            meetings[key].append(dict(season=s, winner=winner, margin=abs(m), cover=cover, ou=ou, home=h, date=str(dt.date())))
        last_game[h] = dt
        last_game[a] = dt
        recent[h].append(dt)
        recent[a].append(dt)
    return pd.DataFrame(rows), meetings


SPREAD_F = ["spread_abs", "home_dog", "big_dog", "rest_diff", "home_b2b", "away_b2b", "home_3in4", "away_3in4",
            "h2h_cov", "h2h_win", "revenge_home", "revenge_away", "form_home", "form_away", "surprise_home", "surprise_away"]
TOTAL_F = ["tl", "both_b2b", "home_b2b", "away_b2b", "home_3in4", "away_3in4", "h2h_over", "spread_abs"]
WIN_F = ["mkt", "rest_diff", "home_b2b", "away_b2b", "home_3in4", "away_3in4", "h2h_win", "revenge_home", "revenge_away",
         "form_home", "form_away", "surprise_home", "surprise_away"]


def fit(X, y, C=0.3):
    return LogisticRegression(C=C, max_iter=3000).fit(X, y)


def side_bets(d, p, thr, price=1.909):
    pick = (p >= 0.5).astype(int)
    keep = np.maximum(p, 1 - p) >= thr
    won = (pick == d.y.values)[keep]
    n = int(keep.sum())
    if not n:
        return dict(bets=0)
    profit = np.where(won, price - 1, -1.0)
    return dict(bets=n, wins=int(won.sum()), hit=float(won.mean()), roi=float(profit.mean()))


def ev_bets(d, p, edge, max_price=4.5):
    out = []
    for (_, r), ph in zip(d.iterrows(), p):
        evh, eva = ph * r.hp - 1, (1 - ph) * r.ap - 1
        if max(evh, eva) < edge:
            continue
        side = 1 if evh >= eva else 0
        price = r.hp if side else r.ap
        if price > max_price:
            continue
        won = r.y == side
        out.append(dict(won=won, profit=price - 1 if won else -1.0, dog=(r.p_mkt < 0.5) == bool(side)))
    o = pd.DataFrame(out)
    if o.empty:
        return dict(bets=0)
    dogs = o[o.dog]
    return dict(bets=len(o), wins=int(o.won.sum()), roi=float(o.profit.mean()), dogs=len(dogs),
                dog_wins=int(dogs.won.sum()), dog_roi=float(dogs.profit.mean()) if len(dogs) else 0.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    raw = pd.read_csv(args.data, low_memory=False)
    D, meetings = build(raw)
    report = {}

    # spread
    S = D[D.line.notna() & D.margin.notna()].copy()
    S["ats"] = S.margin + S.line
    S = S[S.ats != 0]
    S["y"] = (S.ats > 0).astype(int)
    grid = [0.5, 0.52, 0.53, 0.54, 0.55, 0.56]
    def wf(frame, feats):
        parts = []
        for s in WF:
            tr = frame[(frame.season >= FIRST) & (frame.season < s)]
            te = frame[frame.season == s]
            m = fit(tr[feats].values, tr.y.values)
            parts.append(te.assign(p=m.predict_proba(te[feats].values)[:, 1]))
        return pd.concat(parts)
    def ho(frame, feats):
        tr = frame[(frame.season >= FIRST) & (frame.season < TEST[0])]
        te = frame[frame.season.isin(TEST)]
        m = fit(tr[feats].values, tr.y.values)
        return te.assign(p=m.predict_proba(te[feats].values)[:, 1]), m
    w = wf(S, SPREAD_F)
    curve = {str(t): side_bets(w, w.p.values, t) for t in grid}
    ok = {k: v for k, v in curve.items() if v["bets"] >= 400}
    t_s = float(max(ok, key=lambda k: ok[k]["roi"]))
    h, m_s = ho(S, SPREAD_F)
    report["spread"] = dict(walk_forward=curve, threshold=t_s, holdout_curve={str(t): side_bets(h, h.p.values, t) for t in grid},
                            baselines=dict(home_cover=float(h.y.mean()), road_cover=float(1 - h.y.mean())),
                            coef=dict(zip(SPREAD_F, m_s.coef_[0].round(3).tolist())))
    # the existing rule: home team with 2+ more days of rest
    rule = h[(h.rest_diff * 3) >= 2]
    report["spread"]["existing_rest_rule_holdout"] = dict(bets=len(rule), hit=float(rule.y.mean()) if len(rule) else None)

    # total
    T = D[D.total_line.notna() & D.total.notna()].copy()
    T = T[T.total != T.total_line]
    T["y"] = (T.total > T.total_line).astype(int)
    w = wf(T, TOTAL_F)
    curve = {str(t): side_bets(w, w.p.values, t) for t in grid}
    ok = {k: v for k, v in curve.items() if v["bets"] >= 400}
    t_t = float(max(ok, key=lambda k: ok[k]["roi"]))
    h, m_t = ho(T, TOTAL_F)
    report["total"] = dict(walk_forward=curve, threshold=t_t, holdout_curve={str(t): side_bets(h, h.p.values, t) for t in grid},
                           baselines=dict(over=float(h.y.mean())), coef=dict(zip(TOTAL_F, m_t.coef_[0].round(3).tolist())))

    # winner: market chance from moneylines (spread-implied where there are none)
    Wd = D[D.margin.notna() & D.line.notna()].copy()
    has_ml = Wd.home_ml.notna() & Wd.away_ml.notna()
    ph = Wd.loc[has_ml, "home_ml"].apply(implied)
    pa = Wd.loc[has_ml, "away_ml"].apply(implied)
    Wd.loc[has_ml, "p_ml"] = ph / (ph + pa)
    # spread -> chance fit on games with both (used for 2022-23 on, where moneylines are missing)
    both = Wd[has_ml]
    k = np.polyfit(both.line.values, both.p_ml.apply(logit).values, 1)
    Wd["p_mkt"] = np.where(has_ml, Wd.p_ml, 1 / (1 + np.exp(-(k[0] * Wd.line + k[1]))))
    Wd["mkt"] = Wd.p_mkt.apply(logit)
    Wd["y"] = (Wd.margin > 0).astype(int)
    Wd["hp"] = np.where(has_ml, Wd.home_ml.apply(lambda a: dec(a) if pd.notna(a) else np.nan), np.nan)
    Wd["ap"] = np.where(has_ml, Wd.away_ml.apply(lambda a: dec(a) if pd.notna(a) else np.nan), np.nan)
    wml = Wd[has_ml]
    parts = []
    for s in range(2012, 2022):
        tr = Wd[(Wd.season >= FIRST) & (Wd.season < s)]
        te = wml[wml.season == s]
        m = fit(tr[WIN_F].values, tr.y.values)
        parts.append(te.assign(p=m.predict_proba(te[WIN_F].values)[:, 1]))
    w = pd.concat(parts)
    egrid = [0.0, 0.01, 0.02, 0.03, 0.04, 0.06]
    curve = {str(e): ev_bets(w, w.p.values, e) for e in egrid}
    ok = {k2: v for k2, v in curve.items() if v["bets"] >= 400}
    e_w = float(max(ok, key=lambda k2: ok[k2]["roi"]))
    fav = w.p_mkt > 0.5
    fav_won = np.where(fav, w.y == 1, w.y == 0)
    report["winner"] = dict(walk_forward_2012_2021=curve, edge=e_w,
                            baselines=dict(every_favorite_roi=float(np.where(fav_won, np.where(fav, w.hp, w.ap) - 1, -1).mean()),
                                           every_dog_roi=float(np.where(~fav_won, np.where(fav, w.ap, w.hp) - 1, -1).mean())),
                            spread_to_logit=k.tolist())
    tr = Wd[(Wd.season >= FIRST) & (Wd.season < TEST[0])]
    te = Wd[Wd.season.isin(TEST)]
    m_w = fit(tr[WIN_F].values, tr.y.values)
    pte = m_w.predict_proba(te[WIN_F].values)[:, 1]
    report["winner"]["holdout_accuracy"] = dict(model=float(((pte > 0.5) == (te.y == 1)).mean()), market=float(((te.p_mkt > 0.5) == (te.y == 1)).mean()),
                                                dog_picks_share=float(((pte > 0.5) != (te.p_mkt > 0.5)).mean()))
    report["winner"]["coef"] = dict(zip(WIN_F, m_w.coef_[0].round(3).tolist()))

    def ship(frame, feats):
        m = fit(frame[frame.season >= FIRST][feats].values, frame[frame.season >= FIRST].y.values)
        return dict(features=feats, coef=m.coef_[0].tolist(), intercept=float(m.intercept_[0]))

    model = dict(
        source="data/nba.csv, github.com/ethanbell528-cmd/fda-project-1 (SportsbookReviewsOnline, hoopR/ESPN)",
        spread={**ship(S, SPREAD_F), "threshold": t_s},
        total={**ship(T, TOTAL_F), "threshold": t_t},
        winner={**ship(Wd, WIN_F), "min_edge": e_w, "max_price": 4.5},
        backtest=dict(
            holdout_seasons=["2024-25", "2025-26"],
            spread=report["spread"]["holdout_curve"][str(t_s)], spread_wf=report["spread"]["walk_forward"][str(t_s)],
            total=report["total"]["holdout_curve"][str(t_t)], total_wf=report["total"]["walk_forward"][str(t_t)],
            winner_wf=report["winner"]["walk_forward_2012_2021"][str(e_w)], winner_baselines=report["winner"]["baselines"],
            winner_holdout_accuracy=report["winner"]["holdout_accuracy"],
        ),
    )
    last = int(D.season.max())
    h2h = {}
    for key, ms in meetings.items():
        a, b = sorted(key)
        keep = [m for m in ms if m["season"] >= last - 3][-8:]
        if keep:
            h2h[f"{a}|{b}"] = [[m["season"], m["home"], m["winner"], m["margin"], m["cover"] or "", -1 if m["ou"] is None else m["ou"], m["date"]] for m in keep]
    with open(f"{args.out}/nba-model.json", "w") as fh:
        json.dump(model, fh, separators=(",", ":"))
    with open(f"{args.out}/nba-history.json", "w") as fh:
        json.dump(dict(through=str(D.date.max().date()), h2h=h2h), fh, separators=(",", ":"))
    with open(f"{args.out}/nba-backtest-report.json", "w") as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
