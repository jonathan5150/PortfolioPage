import { defaultSport, readPreferredSport, savePreferredSport, startingSport } from './sports';

const at = (iso) => new Date(`${iso}T12:00:00`);

describe('default sport by season', () => {
  it('is NFL from September through mid-February', () => {
    expect(defaultSport(at('2026-09-01'))).toBe('nfl');
    expect(defaultSport(at('2026-11-11'))).toBe('nfl');
    expect(defaultSport(at('2027-01-20'))).toBe('nfl');
    expect(defaultSport(at('2027-02-15'))).toBe('nfl');
  });

  it('is NBA after the Super Bowl until baseball starts', () => {
    expect(defaultSport(at('2027-02-16'))).toBe('nba');
    expect(defaultSport(at('2027-03-19'))).toBe('nba');
  });

  it('is MLB from Opening Day until football starts', () => {
    expect(defaultSport(at('2027-03-20'))).toBe('mlb');
    expect(defaultSport(at('2027-06-10'))).toBe('mlb'); // NBA Finals, but baseball has started
    expect(defaultSport(at('2027-08-31'))).toBe('mlb');
  });
});

describe('saved sport', () => {
  beforeEach(() => {
    document.cookie = 'sportsPref=; path=/; max-age=0';
  });

  it('starts on the season default until the visitor picks a sport', () => {
    expect(readPreferredSport()).toBeNull();
    expect(startingSport(at('2027-06-10'))).toBe('mlb');
    savePreferredSport('ufc');
    expect(startingSport(at('2027-06-10'))).toBe('ufc');
  });

  it('ignores anything that is not a sport', () => {
    savePreferredSport('cricket');
    expect(readPreferredSport()).toBeNull();
  });
});
