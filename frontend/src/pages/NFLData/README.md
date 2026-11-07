# NFL Stats Wizard

NFL counterpart to the MLB Stats Wizard, served at `/nfldata`. It is fully separate from the MLB app: its own page, components, styles (all scoped under `.nfl-data-container`) and preferences (localStorage keys prefixed `nflStatsWizard:`).

## Structure

```
pages/NFLData/
  NFLData.js            page container: week/season selection, team filter, live polling
  NFLData.scss          scoped styles
  NFLDataApi/           all data access (no React in here)
    endpoints.js        every external URL
    http.js             fetch + TTL cache + in-flight dedupe + concurrency limiter
    espnParsers.js      raw ESPN JSON -> small stable shapes
    espnService.js      ESPN calls (scoreboard, summary, roster, game logs, team stats)
    nflverseParsers.js  nflverse CSV -> same shapes
    nflverseService.js  nflverse season files (local copy first, then GitHub)
    teamRankings.js     offense/defense rank computation
    nflDataService.js   the one module the UI imports; picks a source and falls back
    parsers.test.js     Jest tests (run with npm test)
components/NFLDataComponents/
  NFLDataNavbar/        TEAMS menu, week picker with prev/next, season picker
  GameList/             card list + SET/OPEN/CLOSE sync
  GameCard/             expandable card, box score polling hook
  ScoreBug/             pre-game, live and final score bugs + quarter linescore
  GameCardSelections/   BOX SCORE, TEAM RANKINGS, SEASON STATS, PLAYER GAME LOG
  shared/               StatTable, SwipeTeamPanel, colors, persistent-state hooks
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

ESPN's API is unofficial and can change without notice; all URLs live in `endpoints.js` and all parsing in `espnParsers.js`.

## Same-origin proxy (CORS)

Some ESPN endpoints don't allow browser requests from other domains, so the app requests `/espn/site/...`, `/espn/web/...` and `/nflverse/...` on its own domain:

- **Production:** Cloudflare Pages Functions in `frontend/functions/` fetch from ESPN/GitHub server-side (only ESPN `apis/` paths and nflverse season CSVs are allowed). `functions/` at the repo root re-exports them, so they deploy whichever folder the Pages project uses as its root.
- **`npm start`:** `src/setupProxy.js` serves the same paths from the dev server.

`http.js` tries the proxy first and falls back to calling the host directly if the proxy isn't available.

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
