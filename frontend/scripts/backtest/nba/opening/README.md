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

## Forward-chained models, and the 10-game rule (November 21)

Tried to beat the rules above with fitted models, each test season bet with a
ridge fit on earlier seasons only (2016-17, then 2024 onward):

- Spread (cover margin from rest, back-to-backs, travel, ratings, form, ATS):
  lost on every cut (-3% to -15% a bet at any threshold).
- Total (ratings gap, market-implied total, recent over/under form, rest): about
  +5.6% at a 2-point threshold (429 bets), the same as the 6-point ratings rule
  (594 bets, +5.6%), so no gain for the extra complexity. Every game: -2.0%.

The one finding that held up: the rest-edge spread is profitable only once
both teams have 10+ games in.

| games already played by the less-played team | 0-2 | 3-9 | 10+ |
|---|---|---|---|
| rest-edge spread at the opener | +3.5% (26) | -14.0% (83) | +7.4% (485) |

(The rest days are unreliable early in a season, and the biggest "edges", 4+
days, lost.) So the rest bets now need 10+ games, like the totals bet; the
spread and moneyline in earlier games go on the opening favourite. The
moneyline on the rested side is +10.0% over 267 bets but swings by season
(-9.6%, +20.4%, +19.0%).

App result (the app's own pick engine, 2024 to now, at opening prices): edge
bets 644-491, +77.5u over 1,135 bets (+6.8%; spread +6.8%, total +5.4%,
moneyline +10.0%); every pick together about -1.3% a bet. The thresholds were
chosen on these same seasons, so expect less.
