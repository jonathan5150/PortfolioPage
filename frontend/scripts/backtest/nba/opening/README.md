# NBA at the opening line (November 2026)

1. `node collect.js 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025 2026 2027`
   writes `data/games-<season>.json`: every regular-season game's closing line,
   plus the opening line and opening prices where ESPN kept them (2016-17 and
   2024 on).
2. `node features.js` writes `rows.json` (walk-forward ratings, rest, travel...
   for every game, from earlier games only) and `public/models/nba-od-prior.json`
   (the final offence / defence ratings of the season before the one being bet:
   change the `season === 2026` check to roll it forward a season).
3. `node final.js` scores the two bets at the opening prices.

What it found: against the closing line nothing beat the market over 12
seasons (every game, and every rule that looked good on 2016-2024 lost on
2025-2027). Against the OPENING line two spots did, and the lines then moved
toward them about two times in three:

| | 2016 | 2017 | 2024 | 2025 | 2026 | all |
|---|---|---|---|---|---|---|
| total: our ratings 6+ off the opener | +4.0% | +15.9% | +4.9% | +6.3% | +5.8% | 524-401, +6.7% |
| spread: 2+ more days of rest | +1.9% | +3.4% | +3.6% | +14.2% | +5.1% | 319-266, +4.3% |

The 6-point cut was chosen after seeing these seasons (3+: +0.6%, 4+: +2.5%,
5+: +3.5%, 6+: +6.7%), so expect the real edge to be smaller. 2016-17 opening
prices weren't kept and are taken at -110. The app makes and grades these bets
at the opener (`atOpen`).

## Every game, all three markets (`node every-game.js`)

The app now bets every game's moneyline, spread and total at the opener. No
every-game rule beat the market over these seasons (betting one side blindly
loses about 4.5%); these lost the least of the ~40 tried:

- spread: the 2+ rest-edge side, else the opening favourite: -1.6%
- moneyline: the same team: -2.3% (2024 on)
- total: the under when our ratings are 2+ under the opener, else the over: -1.5%

All together -1.8% a bet over 16,204 (2016-17, 2024-2026 all negative, 2024
-0.6% the best), and +0.2% this season (2026-27) through mid-November.
