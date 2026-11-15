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

// The sport a visitor was last on, remembered for a year. Kept in
// localStorage as well as a cookie: Safari caps cookies set by the page at 7
// days, and a home-screen web app can keep its own cookies.
const COOKIE = 'sportsPref';
const STORAGE = 'nflStatsWizard:sportsPref';
export const readPreferredSport = () => {
  let stored = null;
  try {
    stored = window.localStorage.getItem(STORAGE);
  } catch {
    // storage blocked
  }
  if (isSport(stored)) return stored;
  const value = readCookie(COOKIE);
  return isSport(value) ? value : null;
};
export const savePreferredSport = (key) => {
  if (!isSport(key)) return;
  writeCookie(COOKIE, key, 365);
  try {
    window.localStorage.setItem(STORAGE, key);
  } catch {
    // storage blocked
  }
};
export const startingSport = (date = new Date()) => readPreferredSport() || defaultSport(date);
