import { readCookie, writeCookie } from '../components/NFLDataComponents/shared/cookies';

// The sports data project: one hub (/sports) with a page per sport.
export const SPORTS = [
  { key: 'nfl', label: 'NFL', name: 'Football' },
  { key: 'nba', label: 'NBA', name: 'Basketball' },
  { key: 'mlb', label: 'MLB', name: 'Baseball' },
  { key: 'ufc', label: 'UFC', name: 'MMA' },
];
export const sportPath = (key) => `/sports/${key}`;
export const isSport = (key) => SPORTS.some((s) => s.key === key);

// Which sport a first-time visitor lands on, by the calendar:
//   NFL while football is on (September through mid-February, Super Bowl)
//   MLB from Opening Day (late March) through the World Series (early November),
//     except that NFL wins the September-October overlap
//   NBA in the gap between them (mid-February to late March, and any other
//     time neither is on)
const md = (date) => (date.getMonth() + 1) * 100 + date.getDate(); // March 20 -> 320
export const defaultSport = (date = new Date()) => {
  const d = md(date);
  if (d >= 901 || d <= 215) return 'nfl';
  if (d >= 320 && d <= 1105) return 'mlb';
  return 'nba';
};

// A visitor's own choice (from the sport switcher), remembered for a year.
const COOKIE = 'sportsPref';
export const readPreferredSport = () => {
  const value = readCookie(COOKIE);
  return isSport(value) ? value : null;
};
export const savePreferredSport = (key) => {
  if (isSport(key)) writeCookie(COOKIE, key, 365);
};
export const startingSport = (date = new Date()) => readPreferredSport() || defaultSport(date);
