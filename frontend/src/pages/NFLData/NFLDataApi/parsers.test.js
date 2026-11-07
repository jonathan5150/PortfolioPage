import {
  parseTeamsResponse,
  parseScoreboard,
  parseSummary,
  parseGameLog,
  parseTeamStatsByTeam,
  parseRoster,
} from './espnParsers';
import { parsePlayerSeasonCsv, parseCsv } from './nflverseParsers';
import { buildRankings, rankValues, ESPN_METRICS } from './teamRankings';
import { seasonLineFromGameLog } from './espnService';
import { getPollInterval } from '../NFLData';
import {
  teamsResponse,
  scoreboardResponse,
  summaryResponse,
  gameLogResponse,
  byTeamResponse,
  rosterResponse,
  nflversePlayerCsv,
} from './testFixtures';

describe('ESPN parsers', () => {
  test('teams are normalized and sorted', () => {
    const teams = parseTeamsResponse(teamsResponse);
    expect(teams.map((t) => t.abbreviation)).toEqual(['BUF', 'KC']);
    expect(teams[1].color).toBe('#e31837');
    expect(teams[1].logo).toContain('kc.png');
  });

  test('scoreboard: sorting, live situation, records, calendar', () => {
    const board = parseScoreboard(scoreboardResponse);
    expect(board.season).toBe(2026);
    expect(board.week).toBe(10);
    expect(board.events.map((e) => e.id)).toEqual(['401800001', '401800002']);

    const live = board.events[1];
    expect(live.status.state).toBe('in');
    expect(live.away.team.abbreviation).toBe('BUF');
    expect(live.away.score).toBe(20);
    expect(live.home.linescores).toEqual([7, 3, 7]);
    expect(live.home.record).toBe('6-2');
    expect(live.situation.possessionAbbr).toBe('BUF');
    expect(live.situation.lastPlay).toMatch(/Shakir/);
    expect(live.broadcast).toBe('CBS');
    expect(live.away.leaders[0].athleteId).toBe('3918298');

    const final = board.events[0];
    expect(final.status.state).toBe('post');
    expect(final.situation).toBeNull();
    expect(final.home.winner).toBe(true);

    // off-season section dropped
    expect(board.calendar.map((c) => c.seasonType)).toEqual([1, 2]);
    expect(board.calendar[1].weeks[1]).toMatchObject({ week: 10, label: 'Week 10' });
  });

  test('summary: box score categories and split stat pairs', () => {
    const summary = parseSummary(summaryResponse);
    expect(summary.away.score).toBe(20);
    expect(summary.home.linescores).toEqual([7, 3, 7]);
    expect(summary.teamStats[0].homeAway).toBe('away');
    const passing = summary.players['2'].categories.passing;
    expect(passing.athletes[0].stats.completions).toBe('18');
    expect(passing.athletes[0].stats.passingAttempts).toBe('26');
    expect(passing.athletes[0].stats.sacks).toBe('1');
    expect(summary.hasPlayerStats).toBe(true);
    expect(summary.scoringPlays[0]).toMatchObject({ period: 1, type: 'TD', awayScore: 7 });
    expect(summary.situation.possessionTeamId).toBe('2');
  });

  test('game log: newest first, names mapped, season totals', () => {
    const log = parseGameLog(gameLogResponse);
    expect(log.games.map((g) => g.eventId)).toEqual(['401700010', '401700009']);
    expect(log.games[0]).toMatchObject({ opponentAbbr: 'MIA', atVs: 'vs', result: 'W', week: 9 });
    expect(log.games[0].stats.passingYards).toBe(301);
    expect(log.games[1].stats.rushingYards).toBe(31);
    expect(log.seasonTotals.passingYards).toBe(541);
  });

  test('season line from game log uses totals', () => {
    const line = seasonLineFromGameLog(
      { id: '3918298', name: 'Josh Allen', position: 'QB', teamAbbr: 'BUF' },
      parseGameLog(gameLogResponse)
    );
    expect(line.games).toBe(2);
    expect(line.passing).toMatchObject({ completions: 45, attempts: 67, yards: 541, touchdowns: 4, interceptions: 1 });
    expect(line.rushing.yards).toBe(53);
    expect(line.receiving.receptions).toBe(0);
  });

  test('team stats by team: own vs opponent splits', () => {
    const stats = parseTeamStatsByTeam(byTeamResponse);
    expect(stats['12'].own.totalPointsPerGame).toBe(27.5);
    expect(stats['12'].opp.totalPointsPerGame).toBe(19);
    expect(stats['12'].own.rushingYardsPerGame).toBe(120);
    expect(stats['12'].own.thirdDownConvPct).toBe(45.5);
  });

  test('roster flattens groups', () => {
    const roster = parseRoster(rosterResponse);
    expect(roster).toHaveLength(3);
    expect(roster[0]).toMatchObject({ id: '3918298', position: 'QB', side: 'offense' });
  });
});

describe('rankings', () => {
  test('ties share a rank', () => {
    expect(rankValues({ a: 10, b: 20, c: 20, d: 5 })).toEqual({ b: 1, c: 1, a: 3, d: 4 });
    expect(rankValues({ a: 10, b: 20 }, true)).toEqual({ a: 1, b: 2 });
  });

  test('ESPN metrics: offense higher is better, defense lower is better', () => {
    const r = buildRankings(parseTeamStatsByTeam(byTeamResponse), ESPN_METRICS);
    expect(r.ranks.ppg).toEqual({ 2: 1, 12: 2 });
    expect(r.ranks.oppPpg).toEqual({ 12: 1, 2: 2 });
    expect(r.teamCount).toBe(2);
  });
});

describe('nflverse parsers', () => {
  test('CSV parser handles quotes and commas', () => {
    const rows = parseCsv('a,b\n"x, y","say ""hi"""\n');
    expect(rows).toEqual([{ a: 'x, y', b: 'say "hi"' }]);
  });

  test('player season rows normalize and map abbreviations', () => {
    const rows = parsePlayerSeasonCsv(nflversePlayerCsv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'Josh Allen', team: 'BUF', games: 17 });
    expect(rows[0].passing.yards).toBe(3668);
    expect(rows[0].fumblesLost).toBe(3);
    expect(rows[1].team).toBe('LAR');
    expect(rows[1].receiving).toMatchObject({ receptions: 80, targets: 120, yards: 1100 });
  });
});

describe('live polling', () => {
  const ev = (state, date) => ({ status: { state }, date });
  test('fast when live, slower near kickoff, off otherwise', () => {
    const now = Date.parse('2026-11-08T17:50:00Z');
    expect(getPollInterval([ev('in')], now)).toBe(15000);
    expect(getPollInterval([ev('pre', '2026-11-08T18:00:00Z')], now)).toBe(30000);
    expect(getPollInterval([ev('pre', '2026-11-09T18:00:00Z')], now)).toBeNull();
    expect(getPollInterval([ev('post')], now)).toBeNull();
  });
});
