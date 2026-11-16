import { groupByDay } from './dayGroups';

const at = (iso, extra = {}) => ({ id: iso, date: iso, status: { state: 'pre', ...extra } });

describe('groupByDay', () => {
  // local times so the test doesn't depend on the machine's time zone
  const local = (d, h, m) => new Date(2026, 10, d, h, m).toISOString();

  it('puts every game of a day in one group, each start time inside it', () => {
    const days = groupByDay([at(local(15, 15, 25)), at(local(15, 8, 30)), at(local(15, 12, 0)), at(local(16, 19, 15))]);
    expect(days).toHaveLength(2);
    expect(days[0].label).toMatch(/^SUN 11\/15$/);
    expect(days[0].slots.map((s) => s.games.length)).toEqual([1, 1, 1]);
    expect(days[1].label).toMatch(/^MON 11\/16$/);
  });

  it('merges starts inside the window into one time label', () => {
    const days = groupByDay([at(local(15, 15, 5)), at(local(15, 15, 25)), at(local(15, 15, 25))], {
      mergeWindowMs: 30 * 60 * 1000,
    });
    expect(days[0].slots).toHaveLength(1);
    expect(days[0].slots[0].label).toMatch(/3:05.*\/.*3:25/);
    expect(days[0].slots[0].games).toHaveLength(3);
  });

  it('keeps postponed games apart', () => {
    const days = groupByDay([at(local(15, 13, 0), { isPostponed: true, shortDetail: 'Postponed' }), at(local(15, 13, 0))]);
    expect(days.map((d) => d.label)).toEqual(['SUN 11/15', 'Postponed']);
  });
});
