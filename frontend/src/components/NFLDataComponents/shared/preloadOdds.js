// The team cells' moneylines, fetched while the loading screen is still up, so
// the games appear with their odds already in place instead of popping in a
// moment later. Each page calls preloadOdds before swapping the loading
// screen for its games, and each card starts from peekOdds.
//
// Keys: 'nfl:<gameId>', '<league>:<gameId>' (NBA / MLB), 'ufc:<eventId>:<fightId>'.

const ready = new Map();

export const peekOdds = (key) => ready.get(key);

// Never keeps the loading screen up longer than this, even if the odds
// service is slow; any odds still missing then load in each card as before.
const MAX_WAIT_MS = 6000;

// entries: [{ key, load }] where load() resolves to that game's odds
export const preloadOdds = (entries) => {
  const todo = entries.filter((e) => !ready.has(e.key));
  if (!todo.length) return Promise.resolve();
  const all = Promise.all(
    todo.map(({ key, load }) =>
      Promise.resolve()
        .then(load)
        .then((data) => {
          if (data) ready.set(key, data);
        })
        .catch(() => {}),
    ),
  );
  return Promise.race([all, new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS))]);
};
