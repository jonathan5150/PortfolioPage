#!/usr/bin/env python3
"""
NFL betting model: build, walk-forward backtest, export.

Data: nflverse games.csv (github.com/nflverse/nfldata, data/games.csv): every
NFL game 1999-today with closing moneylines, spreads, totals and their prices,
rest days, roof, temperature, wind, referee, coaches and QBs.

For each game, every feature is built only from EARLIER games:
  rest        home rest minus away rest; short weeks; coming off a bye
  schedule    division game, primetime (Thu/Mon/night)
  weather     wind, cold, heat, dome
  totals      the size of the total (big totals go under), its square
  head-to-head  the last 6 meetings in the last 6 seasons: who won, who
              covered, how often it went over; "revenge" (lost the last
              meeting by 14+)
  form        each team's last 3 results against the spread
  referee     the crew chief's over/under and home-cover rates in his
              previous 3 seasons (shrunk toward 50%)

Models (logistic regressions):
  spread  chance the home team covers
  total   chance the game goes over
  winner  the market's no-vig chance plus the features above
Walk-forward: each season 2015-2024 is predicted by a model trained on every
earlier season; the betting thresholds are chosen on those 10 seasons
together. 2025 and 2026-to-date are held out and scored once at the end.

Usage: python3 backtest_nfl.py --games games.csv --out outdir
"""
import argparse
import json
import math
from collections import defaultdict, deque

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

FIRST_SEASON = 2006       # moneylines start here
WF_SEASONS = range(2015, 2025)
TEST_SEASONS = (2025, 2026)
H2H_N = 6
H2H_YEARS = 6


def implied(a):
    a = float(a)
    return 100.0 / (a + 100.0) if a > 0 else -a / (-a + 100.0)


def dec(a):
    a = float(a)
    return 1 + a / 100 if a > 0 else 1 + 100 / -a


def logit(p):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))


def shrink(hits, n, k=4, prior=0.5):
    return (hits + k * prior) / (n + k)


def primetime(row):
    day = str(row["weekday"])
    hour = int(str(row["gametime"]).split(":")[0]) if isinstance(row["gametime"], str) else 13
    return 1.0 if day in ("Monday", "Thursday") or hour >= 19 else 0.0


def build(games):
    g = games[games.game_type.isin(["REG", "WC", "DIV", "CON", "SB"])].copy()
    g = g.sort_values(["gameday", "gametime"]).reset_index(drop=True)
    meetings = defaultdict(list)          # frozenset(teams) -> past meetings
    form = defaultdict(lambda: deque(maxlen=3))  # team -> last 3 ATS results (+1 cover, -1 not, 0 push)
    ref_hist = defaultdict(list)          # referee -> [(season, over, home_cover)]
    rows = []
    for _, r in g.iterrows():
        home, away, season = r.home_team, r.away_team, int(r.season)
        played = pd.notna(r.result)
        key = frozenset((home, away))
        past = [m for m in meetings[key] if m["season"] >= season - H2H_YEARS][-H2H_N:]
        # head-to-head from the HOME team's point of view
        h_w = sum(1 for m in past if m["winner"] == home)
        h_cov = sum(1 for m in past if m["cover"] == home)
        h_ats_n = sum(1 for m in past if m["cover"] is not None)
        h_over = sum(1 for m in past if m["ou"] == 1)
        h_ou_n = sum(1 for m in past if m["ou"] is not None)
        last = past[-1] if past else None
        revenge_home = 1.0 if last and last["winner"] == away and last["margin"] >= 14 else 0.0
        revenge_away = 1.0 if last and last["winner"] == home and last["margin"] >= 14 else 0.0
        # referee: previous 3 seasons only
        refs = [x for x in ref_hist.get(r.referee, []) if season - 3 <= x[0] < season]
        ref_over = shrink(sum(x[1] for x in refs if x[1] is not None), sum(1 for x in refs if x[1] is not None), k=20)
        ref_home = shrink(sum(x[2] for x in refs if x[2] is not None), sum(1 for x in refs if x[2] is not None), k=20)

        indoor = r.roof in ("dome", "closed")
        wind = 0.0 if indoor or pd.isna(r.wind) else float(r.wind)
        temp = 65.0 if indoor or pd.isna(r.temp) else float(r.temp)
        hr, ar = (r.home_rest if pd.notna(r.home_rest) else 7), (r.away_rest if pd.notna(r.away_rest) else 7)
        feat = dict(
            game_id=r.game_id, season=season, week=r.week, home=home, away=away, referee=r.referee,
            spread=r.spread_line, total_line=r.total_line, result=r.result, total=r.total,
            home_ml=r.home_moneyline, away_ml=r.away_moneyline,
            home_spread_odds=r.home_spread_odds, away_spread_odds=r.away_spread_odds,
            over_odds=r.over_odds, under_odds=r.under_odds,
            # features
            rest=max(min((hr - ar) / 7, 1.5), -1.5),
            away_short=1.0 if ar <= 4 else 0.0, home_short=1.0 if hr <= 4 else 0.0,
            home_bye=1.0 if hr >= 13 else 0.0, away_bye=1.0 if ar >= 13 else 0.0,
            div=float(r.div_game or 0), prime=primetime(r),
            playoff=0.0 if r.game_type == "REG" else 1.0,
            wind=wind / 10, windy=1.0 if wind >= 15 else 0.0,
            cold=1.0 if temp <= 32 else 0.0, hot=1.0 if temp >= 85 else 0.0, dome=1.0 if indoor else 0.0,
            h2h_win=shrink(h_w, len(past)) - 0.5, h2h_cov=shrink(h_cov, h_ats_n) - 0.5, h2h_over=shrink(h_over, h_ou_n) - 0.5,
            h2h_n=len(past), h2h_wins_home=h_w, h2h_covers_home=h_cov, h2h_ats_n=h_ats_n, h2h_overs=h_over, h2h_ou_n=h_ou_n,
            revenge_home=revenge_home, revenge_away=revenge_away,
            form_home=sum(form[home]) / 3, form_away=sum(form[away]) / 3,
            ref_over=ref_over - 0.5, ref_home=ref_home - 0.5, ref_n=len(refs),
        )
        if pd.notna(r.spread_line):
            s = r.spread_line
            feat.update(
                spread_abs=abs(s) / 7,
                home_dog=1.0 if s < 0 else 0.0,
                big_home_dog=1.0 if s <= -6.5 else 0.0,
                big_fav=1.0 if abs(s) >= 10 else 0.0,
            )
        if pd.notna(r.total_line):
            t = r.total_line
            feat.update(tl=(t - 44) / 5, tl2=((t - 44) / 5) ** 2)
        rows.append(feat)

        if played:
            margin = r.result  # home minus away
            winner = home if margin > 0 else away if margin < 0 else None
            cover = None
            if pd.notna(r.spread_line):
                ats = margin - r.spread_line
                cover = home if ats > 0 else away if ats < 0 else None
                form[home].append(1 if cover == home else -1 if cover == away else 0)
                form[away].append(1 if cover == away else -1 if cover == home else 0)
            ou = None
            if pd.notna(r.total_line):
                d = r.total - r.total_line
                ou = 1 if d > 0 else 0 if d < 0 else None
            meetings[key].append(dict(season=season, winner=winner, margin=abs(margin), cover=cover, ou=ou, home=home, date=str(r.gameday)[:10]))
            ref_hist[r.referee].append((season, ou, None if cover is None else (1 if cover == home else 0)))
    return pd.DataFrame(rows), meetings, ref_hist


SPREAD_F = ["spread_abs", "home_dog", "big_home_dog", "big_fav", "rest", "away_short", "home_short", "home_bye", "away_bye",
            "div", "prime", "playoff", "h2h_cov", "h2h_win", "revenge_home", "revenge_away", "form_home", "form_away", "ref_home"]
TOTAL_F = ["tl", "tl2", "wind", "windy", "cold", "hot", "dome", "div", "prime", "playoff", "h2h_over", "ref_over"]
WIN_F = ["mkt", "rest", "away_short", "home_short", "home_bye", "away_bye", "div", "prime", "playoff",
         "h2h_win", "revenge_home", "revenge_away", "form_home", "form_away", "ref_home"]


def fit(X, y, C=0.3):
    return LogisticRegression(C=C, max_iter=3000).fit(X, y)


def spread_frame(D):
    d = D[D.spread.notna() & D.result.notna()].copy()
    d["ats"] = d.result - d.spread
    d = d[d.ats != 0]
    d["y"] = (d.ats > 0).astype(int)
    d["home_price"] = d.home_spread_odds.fillna(-110).apply(dec)
    d["away_price"] = d.away_spread_odds.fillna(-110).apply(dec)
    return d


def total_frame(D):
    d = D[D.total_line.notna() & D.total.notna()].copy()
    d["ou"] = d.total - d.total_line
    d = d[d.ou != 0]
    d["y"] = (d.ou > 0).astype(int)
    d["over_price"] = d.over_odds.fillna(-110).apply(dec)
    d["under_price"] = d.under_odds.fillna(-110).apply(dec)
    return d


def winner_frame(D):
    d = D[D.home_ml.notna() & D.away_ml.notna() & D.result.notna() & (D.result != 0)].copy()
    ph = d.home_ml.apply(implied)
    pa = d.away_ml.apply(implied)
    d["p_mkt"] = ph / (ph + pa)
    d["mkt"] = d.p_mkt.apply(logit)
    d["y"] = (d.result > 0).astype(int)
    d["home_price"] = d.home_ml.apply(dec)
    d["away_price"] = d.away_ml.apply(dec)
    return d


def two_side(d, p, prices, threshold, kind):
    """Bet the side whose model chance clears `threshold` (spread / total: chance; winner: EV)."""
    first_price, second_price = prices
    out = []
    for (_, r), ph in zip(d.iterrows(), p):
        if kind == "ev":
            ev_h, ev_a = ph * r[first_price] - 1, (1 - ph) * r[second_price] - 1
            if max(ev_h, ev_a) < threshold:
                continue
            side = 1 if ev_h >= ev_a else 0
            if (r[first_price] if side else r[second_price]) > 4.5:  # no longshots past +350
                continue
        else:
            if max(ph, 1 - ph) < threshold:
                continue
            side = 1 if ph >= 0.5 else 0
        price = r[first_price] if side == 1 else r[second_price]
        won = r["y"] == side
        out.append(dict(side=side, won=won, profit=price - 1 if won else -1.0, price=price,
                        dog=(r["p_mkt"] < 0.5 if side == 1 else r["p_mkt"] > 0.5) if "p_mkt" in r else None))
    o = pd.DataFrame(out)
    if o.empty:
        return dict(bets=0)
    res = dict(bets=len(o), wins=int(o.won.sum()), hit=float(o.won.mean()), roi=float(o.profit.mean()), units=float(o.profit.sum()))
    if o["dog"].notna().any():
        dogs = o[o.dog == True]  # noqa: E712
        res.update(dogs=len(dogs), dog_wins=int(dogs.won.sum()), dog_roi=float(dogs.profit.mean()) if len(dogs) else 0.0)
    return res


def walk_forward(frame, feats, C):
    parts = []
    for s in WF_SEASONS:
        tr = frame[(frame.season >= FIRST_SEASON) & (frame.season < s)]
        te = frame[frame.season == s]
        m = fit(tr[feats].fillna(0).values, tr.y.values, C)
        parts.append(te.assign(p=m.predict_proba(te[feats].fillna(0).values)[:, 1]))
    return pd.concat(parts)


def holdout(frame, feats, C):
    tr = frame[(frame.season >= FIRST_SEASON) & (frame.season < TEST_SEASONS[0])]
    te = frame[frame.season.isin(TEST_SEASONS)]
    m = fit(tr[feats].fillna(0).values, tr.y.values, C)
    return te.assign(p=m.predict_proba(te[feats].fillna(0).values)[:, 1]), m


def choose(curve, min_bets):
    ok = {k: v for k, v in curve.items() if v.get("bets", 0) >= min_bets}
    return max(ok, key=lambda k: ok[k]["roi"]) if ok else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    games = pd.read_csv(args.games, low_memory=False)
    D, meetings, ref_hist = build(games)
    report = {}

    # ---------- spread ----------
    S = spread_frame(D)
    wf = walk_forward(S, SPREAD_F, 0.3)
    grid = [0.5, 0.52, 0.53, 0.54, 0.55, 0.56, 0.58]
    curve = {str(t): two_side(wf, wf.p.values, ("home_price", "away_price"), t, "p") for t in grid}
    t_spread = float(choose(curve, 250))
    ho, m_s = holdout(S, SPREAD_F, 0.3)
    report["spread"] = dict(walk_forward=curve, threshold=t_spread,
                            holdout=two_side(ho, ho.p.values, ("home_price", "away_price"), t_spread, "p"),
                            holdout_curve={str(t): two_side(ho, ho.p.values, ("home_price", "away_price"), t, "p") for t in grid},
                            baselines=dict(home=float(ho.y.mean()), home_dogs=float(ho[ho.home_dog == 1].y.mean())),
                            coef=dict(zip(SPREAD_F, m_s.coef_[0].round(3).tolist())))

    # ---------- total ----------
    T = total_frame(D)
    wf = walk_forward(T, TOTAL_F, 0.3)
    curve = {str(t): two_side(wf, wf.p.values, ("over_price", "under_price"), t, "p") for t in grid}
    t_total = float(choose(curve, 250))
    ho, m_t = holdout(T, TOTAL_F, 0.3)
    report["total"] = dict(walk_forward=curve, threshold=t_total,
                           holdout=two_side(ho, ho.p.values, ("over_price", "under_price"), t_total, "p"),
                           holdout_curve={str(t): two_side(ho, ho.p.values, ("over_price", "under_price"), t, "p") for t in grid},
                           baselines=dict(over=float(ho.y.mean())),
                           coef=dict(zip(TOTAL_F, m_t.coef_[0].round(3).tolist())))

    # ---------- winner ----------
    Wf = winner_frame(D)
    wf = walk_forward(Wf, WIN_F, 0.3)
    egrid = [0.0, 0.01, 0.02, 0.03, 0.04, 0.06]
    curve = {str(e): two_side(wf, wf.p.values, ("home_price", "away_price"), e, "ev") for e in egrid}
    e_win = float(choose(curve, 250))
    ho, m_w = holdout(Wf, WIN_F, 0.3)
    fav_home = ho.p_mkt > 0.5
    fav_won = np.where(fav_home, ho.y == 1, ho.y == 0)
    fav_price = np.where(fav_home, ho.home_price, ho.away_price)
    dog_price = np.where(fav_home, ho.away_price, ho.home_price)
    report["winner"] = dict(walk_forward=curve, edge=e_win,
                            holdout=two_side(ho, ho.p.values, ("home_price", "away_price"), e_win, "ev"),
                            holdout_curve={str(e): two_side(ho, ho.p.values, ("home_price", "away_price"), e, "ev") for e in egrid},
                            baselines=dict(every_favorite_roi=float(np.where(fav_won, fav_price - 1, -1).mean()),
                                           every_dog_roi=float(np.where(~fav_won, dog_price - 1, -1).mean()),
                                           favorite_hit=float(fav_won.mean())),
                            coef=dict(zip(WIN_F, m_w.coef_[0].round(3).tolist())))

    # ---------- shipped models: fit on everything through the latest game ----------
    def ship(frame, feats):
        tr = frame[frame.season >= FIRST_SEASON]
        m = fit(tr[feats].fillna(0).values, tr.y.values, 0.3)
        return dict(features=feats, coef=m.coef_[0].tolist(), intercept=float(m.intercept_[0]))

    model = dict(
        source="nflverse games.csv (github.com/nflverse/nfldata)",
        data_through=str(games[games.result.notna()].gameday.max()),
        spread={**ship(S, SPREAD_F), "threshold": t_spread},
        total={**ship(T, TOTAL_F), "threshold": t_total},
        winner={**ship(Wf, WIN_F), "min_edge": e_win, "max_price": 4.5},
        h2h_n=H2H_N, h2h_years=H2H_YEARS,
        backtest=dict(holdout_seasons=list(TEST_SEASONS),
                      spread=report["spread"]["holdout"], total=report["total"]["holdout"], winner=report["winner"]["holdout"],
                      walk_forward=dict(seasons="2015-2024", spread=report["spread"]["walk_forward"][str(t_spread)],
                                        total=report["total"]["walk_forward"][str(t_total)], winner=report["winner"]["walk_forward"][str(e_win)]),
                      winner_baselines=report["winner"]["baselines"]),
    )

    # head-to-head table: last meetings per pair (newest last), for the app
    h2h = {}
    for key, ms in meetings.items():
        a, b = sorted(key)
        # two spare meetings, so a game graded after the fact can drop itself (rows carry their date)
        keep = [m for m in ms if m["season"] >= int(games.season.max()) - H2H_YEARS][-(H2H_N + 2):]
        if keep:
            h2h[f"{a}|{b}"] = [[m["season"], m["home"], m["winner"] or "", m["margin"], m["cover"] or "", -1 if m["ou"] is None else m["ou"], m["date"]] for m in keep]
    # referee table: previous 3 seasons' over and home-cover counts
    last_season = int(games.season.max())
    refs = {}
    for name, xs in ref_hist.items():
        xs = [x for x in xs if last_season - 3 <= x[0] <= last_season]
        if not xs or not isinstance(name, str):
            continue
        ou = [x[1] for x in xs if x[1] is not None]
        hc = [x[2] for x in xs if x[2] is not None]
        refs[name] = dict(overs=int(sum(ou)), ou_n=len(ou), home_covers=int(sum(hc)), ats_n=len(hc))

    with open(f"{args.out}/nfl-model.json", "w") as fh:
        json.dump(model, fh, separators=(",", ":"))
    with open(f"{args.out}/nfl-history.json", "w") as fh:
        json.dump(dict(through=model["data_through"], h2h=h2h, referees=refs), fh, separators=(",", ":"))
    with open(f"{args.out}/nfl-backtest-report.json", "w") as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
