// Kickoff conditions for the top of each game card: stadium, sky, temperature
// and wind. Weather comes from Open-Meteo (open-meteo.com: free, no API key,
// browser-friendly): the stadium's city is geocoded once, then the hourly
// forecast is read at the kickoff hour. Indoor stadiums skip the weather.
import { fetchJson } from './http';

const HOUR = 60 * 60 * 1000;
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';

const STATES = {
  AL: 'Alabama', AZ: 'Arizona', CA: 'California', CO: 'Colorado', FL: 'Florida', GA: 'Georgia',
  IL: 'Illinois', IN: 'Indiana', LA: 'Louisiana', MA: 'Massachusetts', MD: 'Maryland', MI: 'Michigan',
  MN: 'Minnesota', MO: 'Missouri', NC: 'North Carolina', NJ: 'New Jersey', NV: 'Nevada', NY: 'New York',
  OH: 'Ohio', PA: 'Pennsylvania', TN: 'Tennessee', TX: 'Texas', WA: 'Washington', WI: 'Wisconsin',
  DC: 'District of Columbia', VA: 'Virginia',
};

// WMO weather codes -> short label and icon.
export const describeWeatherCode = (code) => {
  if (code === null || code === undefined) return null;
  if (code === 0) return { text: 'Clear', icon: '☀️' };
  if (code <= 2) return { text: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { text: 'Cloudy', icon: '☁️' };
  if (code <= 48) return { text: 'Fog', icon: '🌫️' };
  if (code <= 57) return { text: 'Drizzle', icon: '🌦️' };
  if (code <= 67) return { text: 'Rain', icon: '🌧️' };
  if (code <= 77) return { text: 'Snow', icon: '❄️' };
  if (code <= 82) return { text: 'Showers', icon: '🌧️' };
  if (code <= 86) return { text: 'Snow showers', icon: '🌨️' };
  return { text: 'Storms', icon: '⛈️' };
};

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (degrees) =>
  degrees === null || degrees === undefined ? '' : COMPASS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];

const geocodeCache = new Map();

// "Kansas City", "MO" -> { latitude, longitude }
const locate = (city, state) => {
  const key = `${city}|${state || ''}`;
  if (!geocodeCache.has(key)) {
    const query = new URLSearchParams({ name: city, count: '10', language: 'en', format: 'json', countryCode: 'US' });
    geocodeCache.set(
      key,
      fetchJson(`${GEOCODE}?${query}`, { ttlMs: 24 * HOUR }).then((json) => {
        const results = json?.results || [];
        const stateName = STATES[state] || state;
        const match = results.find((r) => !stateName || r.admin1 === stateName) || results[0];
        return match ? { latitude: match.latitude, longitude: match.longitude } : null;
      })
    );
  }
  return geocodeCache.get(key);
};

// Picks the forecast hour closest to kickoff.
export const conditionsAtKickoff = (json, kickoff) => {
  const times = json?.hourly?.time || [];
  if (!times.length) return null;
  const target = new Date(kickoff).getTime();
  let best = 0;
  times.forEach((t, i) => {
    if (Math.abs(new Date(`${t}Z`).getTime() - target) < Math.abs(new Date(`${times[best]}Z`).getTime() - target)) best = i;
  });
  const h = json.hourly;
  const sky = describeWeatherCode(h.weather_code?.[best]);
  return {
    temperature: h.temperature_2m?.[best] ?? null,
    wind: h.wind_speed_10m?.[best] ?? null,
    windFrom: compass(h.wind_direction_10m?.[best]),
    sky: sky?.text || null,
    icon: sky?.icon || null,
  };
};

// { stadium, indoor, weather: { temperature, wind, windFrom, sky, icon } | null }
export const getGameConditions = async (game) => {
  const base = { stadium: game.venue || null, indoor: Boolean(game.indoor), weather: null };
  if (base.indoor || !game.venueCity || !game.date) return base;

  const kickoff = new Date(game.date);
  // The forecast covers about the last 3 months and the next 16 days.
  const days = (kickoff.getTime() - Date.now()) / (24 * HOUR);
  if (days > 15 || days < -85) return base;

  try {
    const place = await locate(game.venueCity, game.venueState);
    if (!place) return base;
    const day = kickoff.toISOString().slice(0, 10);
    const query = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,weather_code',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      timezone: 'UTC',
      start_date: day,
      end_date: day,
    });
    const json = await fetchJson(`${FORECAST}?${query}`, { ttlMs: game.status?.state === 'post' ? 24 * HOUR : HOUR });
    return { ...base, weather: conditionsAtKickoff(json, kickoff) };
  } catch (error) {
    console.warn('Weather unavailable:', error.message);
    return base;
  }
};
