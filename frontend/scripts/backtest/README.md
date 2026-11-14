# Betting model backtests

Each script builds its model from public historical data, tests it walk-forward
(every season or year predicted only by a model trained on earlier ones), scores
it on a held-out stretch it never saw, and writes the JSON the app loads from
`public/models/`. Every feature comes from games played *before* the one being
predicted.

Needs Python 3 with pandas, numpy and scikit-learn (tested with 3.0 / 2.5 / 1.9).

| Sport | Script | Data | Writes |
|---|---|---|---|
| NFL | `nfl/backtest_nfl.py --games games.csv --out DIR` | `data/games.csv` from [nflverse/nfldata](https://github.com/nflverse/nfldata) (closing lines, rest, roof, weather, referee) | `nfl-model.json`, `nfl-history.json`, `nfl-backtest-report.json` |
| NBA | `nba/backtest_nba.py --data nba.csv --out DIR` | `data/nba.csv` from [ethanbell528-cmd/fda-project-1](https://github.com/ethanbell528-cmd/fda-project-1) (SportsbookReviewsOnline and hoopR/ESPN lines, CC BY) | `nba-model.json`, `nba-history.json`, `nba-backtest-report.json` |
| UFC | `ufc/backtest_ufc.py --data ufc_all_fights_wide.csv --out DIR` | [nlbair/ufc-data](https://github.com/nlbair/ufc-data) (CC BY 4.0; BestFightOdds lines) | `ufc-model.json`, `ufc-fighters.json`, `ufc-backtest-report.json` |

Copy the `*-model.json`, `*-history.json` and `ufc-fighters.json` files into
`frontend/public/models/` and the reports next to their scripts. When a model
changes, bump the cached-grades keys (`gradedPicks:vN` in PredictionRecord.js,
`${lg}GradedPicks:vN` in TeamSportPage.js) so the model results regrade.

## What the backtests found (November 2026)

All three markets are close to efficient: always taking the favourite, the
underdog, the home team or the over loses roughly the bookmaker's margin.
The models are built to find the games where the price is off, which is
often on the underdog.

**NFL** (walk-forward 2015-2024, holdout 2025 + 2026 to date)
- Winner: the model's value side (chance x price >= 1) lost 0.7% per pick over
  1,309 picks, 60% of them underdogs; always taking the favourite lost 3.6%.
  Holdout: -1.7% over 99 picks. Shown as a lean; tagged UPSET when it's the dog.
- Head-to-head dominance (+0.14), a visitor off a bye (-0.18) and division
  games (-0.10) were the features the market under-weights most.
- Totals: wind lowers scoring (-0.19 per 10 mph) and cold games went over a
  little more, but adding weather to the existing total lean didn't improve it
  out of sample, so weather stays in the explanation only.
- Spread: the model's side did worse than the existing road-team lean, so the
  existing spread rules stay.

**NBA** (walk-forward 2012-13 to 2021-22 for moneylines, 2013-14 to 2023-24 for
spreads and totals; holdout 2024-25 and 2025-26)
- The existing rest rule (home team with 2+ more days of rest) covered 56.6%
  over 129 holdout games and stays the one BET.
- Winner value side: -4.7% over 2,359 picks (54% underdogs) vs -4.4% for every
  favourite. A lean.
- The spread and total models hit about 50-51% walk-forward and 49% in the
  holdout, short of the 52.4% a -110 price needs, so they aren't used.

**UFC** (walk-forward 2018-2025, holdout the last 12 months)
- Winner bets (edge >= 4%): +0.6% over 908 walk-forward bets, 54% underdogs;
  -0.3% over 82 holdout bets in a year when every favourite returned +2.7% and
  every underdog -18.1%.
- Rounds over/under: right 59.8% (60%+ confidence: 64.6%) vs 53.0% for the
  majority side. Method of victory: 49.3% vs 42.4% for always "decision".

None of this is betting advice: the edges are small and the samples noisy.
