// Model results: how each league's pick engine graded on finished games, and
// the picks for any game (finished, live or upcoming) as tickets.
//
// No React or styles here: scripts/model-results/precompute.js bundles this
// file at build time to grade the season's finished games ahead of time and
// writes them to /model-results/<league>.json. The page reads that file the
// first time it needs a grade and only grades games newer than it.
import { readPreference, writePreference } from '../../../components/NFLDataComponents/shared/usePersistentState';
import { fetchJson, runWithConcurrency } from './http';
import { getScoreboard } from './espnService';
import { gradeLinePicks, linePickBets, linePickTickets } from './picks';
import { getNflLinePicks } from './bettingService';
import { getEarlierGames, getLeagueOdds, getLeaguePredictor, getSeasonFinished } from '../../../sports/team/leagueApi';
import { buildLeaguePicks, restDays } from '../../../sports/team/leaguePicks';
import { loadTeamModel } from './teamModels';

// Bump a league's version when its pick rules or grading change: saved grades
// (this device's localStorage and the precomputed files) under an old version
// are ignored.
export const GRADES_KEYS = {
  nfl: 'gradedPicks:v8',
  nba: 'nbaGradedPicks:v3',
  mlb: 'mlbGradedPicks:v2',
};

// ---------- the picks behind each league's grades ----------

// { picks, lines } for an NBA / MLB game, from what was known before it started
const leagueLinePicks = async (lg, game) => {
  const started = game.status?.state !== 'pre';
  const [odds, predictor, earlier, teamModel] = await Promise.all([
    getLeagueOdds(lg, game.id, { final: started }).catch(() => null),
    getLeaguePredictor(lg, game.id).catch(() => null),
    lg === 'nba' ? getEarlierGames(lg, game).catch(() => []) : [],
    loadTeamModel(lg).catch(() => null),
  ]);
  if (!odds) return null;
  const rest = lg === 'nba' ? restDays(game, earlier) : null;
  const picks = buildLeaguePicks({ lg, game, odds, predictor, rest, teamModel });
  return picks ? { picks, lines: odds } : null;
};

const linePicksFor = (lg, game) => (lg === 'nfl' ? getNflLinePicks(game) : leagueLinePicks(lg, game));

// A finished game's grades: { winner, spread, total: 'W' | 'L' | 'P' | null, bets }
export const gradeGame = async (lg, game) => {
  const found = await linePicksFor(lg, game);
  if (!found) return null;
  return { ...gradeLinePicks(found.picks, game, found.lines), bets: linePickBets(found.picks, game, found.lines) };
};

// Any game's picks as tickets ({ key, label, price, result, bet }); result is
// null until the game is final.
export const gameTickets = async (lg, game) => {
  const found = await linePicksFor(lg, game);
  return found ? linePickTickets(found.picks, game, found.lines) : [];
};

// ---------- cached grading ----------

const precomputed = {};
const loadPrecomputed = (lg) => {
  if (!precomputed[lg]) {
    precomputed[lg] = fetchJson(`${process.env.PUBLIC_URL || ''}/model-results/${lg}.json`, { ttlMs: 60 * 60 * 1000 })
      .then((file) => (file?.key === GRADES_KEYS[lg] && file.grades ? file.grades : {}))
      .catch(() => ({}));
  }
  return precomputed[lg];
};

// Grade one game, remembering the result under `key` in localStorage. With a
// league, the build's precomputed grades are checked before grading.
export const cachedGrader =
  (key, grade, lg = null) =>
  async (game) => {
    const saved = readPreference(key, {});
    if (saved[game.id]) return saved[game.id];
    if (lg && game.status?.state === 'post') {
      const ready = (await loadPrecomputed(lg))[game.id];
      if (ready) return ready;
    }
    const grades = await grade(game);
    if (grades) writePreference(key, { ...readPreference(key, {}), [game.id]: grades });
    return grades;
  };

const graders = {};
export const graderFor = (lg) => {
  if (!graders[lg]) graders[lg] = cachedGrader(GRADES_KEYS[lg], (game) => gradeGame(lg, game), lg);
  return graders[lg];
};

// A game's tickets: finished games come from their (cached) grades, so the
// bets panel and the model results always agree.
export const ticketsFor = async (lg, game) => {
  if (game.status?.state === 'post') return (await graderFor(lg)(game))?.bets || [];
  return gameTickets(lg, game);
};

// ---------- the season's finished games ----------

const REGULAR_SEASON_WEEKS = 18;

// Every finished NFL game of the current season so far (regular season, plus
// the playoffs once they've started).
const nflSeasonGames = async () => {
  const current = await getScoreboard();
  const { season, seasonType, week } = current;
  const weeks = [];
  const regularThrough = seasonType === 3 ? REGULAR_SEASON_WEEKS : seasonType === 2 ? week : 0;
  for (let w = 1; w <= regularThrough; w += 1) weeks.push({ season, seasonType: 2, week: w });
  if (seasonType === 3) for (let w = 1; w <= week; w += 1) weeks.push({ season, seasonType: 3, week: w });
  const boards = await runWithConcurrency(
    weeks.map((params) => () => getScoreboard(params)),
    3,
  );
  const seen = new Set();
  return boards
    .flatMap((b) => (b.ok ? b.value.events : []))
    .filter((g) => g.status?.state === 'post' && !seen.has(g.id) && seen.add(g.id));
};

// a stable loader per league (the model results panel keys on it)
const seasonLoaders = {};
export const seasonLoaderFor = (lg) => {
  if (!seasonLoaders[lg]) seasonLoaders[lg] = lg === 'nfl' ? nflSeasonGames : () => getSeasonFinished(lg);
  return seasonLoaders[lg];
};
