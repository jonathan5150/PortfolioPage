import { weekAfterFinished } from './currentWeek';

const calendar = [
  { seasonType: 2, weeks: [{ week: 10 }, { week: 11 }, { week: 18 }] },
  { seasonType: 3, weeks: [{ week: 1 }, { week: 2 }] },
];
const game = (date, state = 'post') => ({ date, status: { state } });
// week 10: Sunday games, last one Monday night (local time)
const board = (events, week = 10, seasonType = 2) => ({ season: 2026, seasonType, week, calendar, events });
const week10 = [game(new Date(2026, 10, 15, 13, 0)), game(new Date(2026, 10, 16, 20, 15))];

describe('the week the NFL page opens on', () => {
  test('the day after the last game, the next week', () => {
    expect(weekAfterFinished(board(week10), new Date(2026, 10, 17, 9, 0))).toEqual({
      season: 2026,
      seasonType: 2,
      week: 11,
    });
  });

  test('the day of the last game, even after it ends, stays on the week', () => {
    expect(weekAfterFinished(board(week10), new Date(2026, 10, 16, 23, 50))).toBeNull();
  });

  test('a game still to finish keeps the week', () => {
    const live = [week10[0], game(new Date(2026, 10, 16, 20, 15), 'in')];
    expect(weekAfterFinished(board(live), new Date(2026, 10, 17, 9, 0))).toBeNull();
  });

  test('after week 18 comes the first playoff round; nothing after the last', () => {
    expect(weekAfterFinished(board(week10, 18), new Date(2026, 10, 17))).toEqual({
      season: 2026,
      seasonType: 3,
      week: 1,
    });
    expect(weekAfterFinished(board(week10, 2, 3), new Date(2026, 10, 17))).toBeNull();
    expect(weekAfterFinished(board([]), new Date(2026, 10, 17))).toBeNull();
  });
});
