# Sports data project

The sports pages at `/sports/nfl`, `/sports/nba`, `/sports/mlb` and `/sports/ufc` (`/sports` opens the saved or in-season sport). Styles are scoped under `.nfl-data-container`; preferences are kept in localStorage under keys prefixed `nflStatsWizard:`.

## Structure

Every sport has its own folder with the same layout: its page at the top, then
`api/` (data, no React), `components/`, `hooks/` and `styles/` as it needs them.
Anything used by more than one sport lives in `shared/`, laid out the same way.

```
sports/
  shared/               used by two or more sports
    api/                http (fetch + cache), ESPN endpoints and parsers, odds,
                        picks, team models, model grading (+ their tests)
    components/         model panel, settings, parlay slip, team cell, menus,
                        calendar, sport switcher, loaders...
    hooks/              useAsyncData, useGameFocus, useSwapPhase...
    utils/              colours, dates and day groups, cookies, timing...
    styles/             sports.scss (the base styles for every sport), calendar,
                        sport switcher, titles, loader
    league/             the page NBA and MLB share: page, game card, panels,
                        league api and picks, TeamSport.scss
  nfl/
    NflPage.js          week/season selection, team filter, live polling
    api/                nflDataService (what the UI imports), nflverse, team
                        rankings, kickoff conditions
    components/         game list and card, navbar, score bugs, linescore
      panels/           BOX SCORE, LINES, TD ODDS, rankings, player stats...
      table/            StatTable, SwipeTeamPanel, table styles
    hooks/              useGameSummary, useInView
  nba/
    NbaPage.js          the shared league page for the NBA
  mlb/
    MlbPage.js          the shared league page for MLB
  ufc/
    UfcPage.js
    api/                UFC data and the UFC pick model
    styles/             Ufc.scss
```

## Data sources

| Feature | Source |
|---|---|
| Weekly schedule, scores, live situation | ESPN `site.api.espn.com/.../nfl/scoreboard` |
| Box scores, scoring plays | ESPN `.../nfl/summary?event=` |
| Rosters, player game logs (last 5 / 10) | ESPN roster + `site.web.api.espn.com/.../athletes/{id}/gamelog` |
| Current-season player stats | ESPN game logs (season totals) |
| Past-season player stats | nflverse `stats_player_reg_{season}.csv` |
| Team offense/defense rankings | ESPN `statistics/byteam`, falling back to nflverse `stats_team_reg_{season}.csv` |

ESPN's API is unofficial and can change without notice; all URLs live in `shared/api/endpoints.js` and all parsing in `shared/api/espnParsers.js`.

## Same-origin proxy (CORS)

Some ESPN endpoints don't allow browser requests from other domains, so the app requests `/espn/site/...`, `/espn/web/...` and `/nflverse/...` on its own domain:

- **Production:** Cloudflare Pages Functions in `frontend/functions/` fetch from ESPN/GitHub server-side (only ESPN `apis/` paths and nflverse season CSVs are allowed). `functions/` at the repo root re-exports them, so they deploy whichever folder the Pages project uses as its root.
- **`npm start`:** `src/setupProxy.js` serves the same paths from the dev server.

`shared/api/http.js` tries the proxy first and falls back to calling the host directly if the proxy isn't available.

## nflverse files

Browsers may block nflverse's GitHub release downloads (CORS on the redirect). To serve them from your own domain instead:

```
cd frontend
node scripts/fetchNflverseData.js          # last 6 completed seasons
node scripts/fetchNflverseData.js 2020 2025
```

This writes trimmed CSVs to `public/nfl-data/`, which the app checks first.

## Live updates

The scoreboard refreshes every 15s while a game you're viewing is live (30s when kickoff is within 20 minutes); an open box score on a live game refreshes on the same cadence. Polling pauses while the tab is hidden.
