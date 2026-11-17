import { betweenPlaysText } from './ScoreBugs';

describe('top-left label between plays', () => {
  const td = 'O.Hampton left guard for 1 yard, TOUCHDOWN.';

  test('a touchdown whose try is still to come: PAT Attempt, with the team', () => {
    expect(betweenPlaysText({ down: -1, lastPlayType: 'Rushing Touchdown', lastPlay: td }, 'LAC')).toBe(
      'PAT Attempt · LAC',
    );
  });

  test('once the try is in the play text, a kickoff is next', () => {
    const s = { down: -1, lastPlayType: 'Rushing Touchdown', lastPlay: `${td} C.Dicker extra point is GOOD.` };
    expect(betweenPlaysText(s, 'LAC')).toBe('Kickoff');
    expect(betweenPlaysText({ down: -1, lastPlayType: 'Field Goal Good', lastPlay: '' })).toBe('Kickoff');
  });

  test('a real down, or anything else, adds nothing', () => {
    expect(betweenPlaysText({ down: 2, lastPlayType: 'Rushing Touchdown', lastPlay: td })).toBe('');
    expect(betweenPlaysText({ down: -1, lastPlayType: 'Timeout', lastPlay: 'Timeout #1' })).toBe('');
  });
});
