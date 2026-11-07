// Network side of the Betting panel. Pure math lives in ./betting.js.
import { fetchJson, runWithConcurrency } from './http';
import { espnUrls } from './endpoints';
import { getTeamSchedule, getPlayerGameLog } from './espnService';
import { parseEventOdds, parsePredictor, gradeGame, computeTeamTrends, computePlayerTrend } from './betting';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Closing lines for finished games never change, so cache those for hours.
export const getEventOdds = async (eventId, { final = false } = {}) =>
  parseEventOdds(await fetchJson(espnUrls.eventOdds(eventId), { ttlMs: final ? 6 * HOUR : MINUTE }));

export const getEventPredictor = async (eventId) =>
  parsePredictor(await fetchJson(espnUrls.eventPredictor(eventId), { ttlMs: 10 * MINUTE }));

const beforeGame = (game) => {
  const cutoff = game.date ? new Date(game.date).getTime() : Infinity;
  return (g) => g.id !== game.id && new Date(g.date).getTime() < cutoff;
};

// Every completed game this season before `game`, graded against its closing line.
export const getTeamBettingTrends = async (teamId, game) => {
  const requests = [getTeamSchedule(teamId, game.season, 2)];
  if (game.seasonType === 3) requests.push(getTeamSchedule(teamId, game.season, 3));
  const schedule = (await Promise.all(requests))
    .flat()
    .filter((g) => g.status.state === 'post')
    .filter(beforeGame(game))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const results = await runWithConcurrency(
    schedule.map((g) => async () => gradeGame(teamId, g, await getEventOdds(g.id, { final: true }))),
    4
  );

  // A game without a line still counts toward scoring and straight-up records.
  const graded = schedule.map((g, i) => (results[i].ok ? results[i].value : gradeGame(teamId, g, null)));
  return computeTeamTrends(graded);
};

const CATEGORIES = [
  { key: 'passing', match: /passing/i },
  { key: 'rushing', match: /rushing/i },
  { key: 'receiving', match: /receiving/i },
];

// The passing / rushing / receiving leaders ESPN lists for each team.
export const keyPlayersForGame = (game) =>
  ['away', 'home'].flatMap((side) => {
    const self = game[side];
    const opp = game[side === 'away' ? 'home' : 'away'];
    return CATEGORIES.map(({ key, match }) => {
      const leader = (self?.leaders || []).find((l) => match.test(l.category));
      if (!leader?.athleteId) return null;
      return {
        id: `${leader.athleteId}-${key}`,
        athleteId: leader.athleteId,
        name: leader.athleteFullName || leader.athleteName,
        category: key,
        teamAbbr: self?.team?.abbreviation,
        oppAbbr: opp?.team?.abbreviation,
        oppId: opp?.teamId,
      };
    }).filter(Boolean);
  });

const SEASONS_BACK = 3;

export const getPlayerBettingTrend = async (player, game) => {
  const seasons = Array.from({ length: SEASONS_BACK }, (_, i) => game.season - i);
  const logs = await runWithConcurrency(
    seasons.map((season) => async () => (await getPlayerGameLog(player.athleteId, season)).games.map((g) => ({ ...g, season }))),
    3
  );

  const seen = new Set();
  const games = logs
    .filter((r) => r.ok)
    .flatMap((r) => r.value)
    .filter(beforeGame({ id: game.id, date: game.date }))
    .filter((g) => (seen.has(g.eventId) ? false : seen.add(g.eventId)))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return computePlayerTrend({ games, season: game.season, opponentId: player.oppId, category: player.category });
};

export const getPlayersBettingTrends = async (game) => {
  const players = keyPlayersForGame(game);
  const results = await runWithConcurrency(
    players.map((p) => async () => ({ ...p, trend: await getPlayerBettingTrend(p, game) })),
    3
  );
  return results.filter((r) => r.ok).map((r) => r.value);
};
