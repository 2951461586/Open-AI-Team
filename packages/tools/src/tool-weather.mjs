import { buildToolDefinition, getProviderConfig, isProviderEnabled, loadToolsConfig, normalizeText } from './tool-common.mjs';

async function geocodeLocation(baseUrl, name) {
  const url = new URL(baseUrl);
  url.searchParams.set('name', name);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`weather_geocode_failed:${response.status}`);
  const data = await response.json();
  const row = Array.isArray(data?.results) ? data.results[0] : null;
  if (!row) throw new Error(`weather_location_not_found:${name}`);
  return row;
}

function mapCurrentWeather(code = 0) {
  const table = { 0: 'clear', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'depositing rime fog', 51: 'light drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'snow', 80: 'rain showers', 95: 'thunderstorm' };
  return table[code] || `code:${code}`;
}

export async function createWeatherProvider({ rootDir = process.cwd(), configPath = 'config/team/tools.json', ...overrides } = {}) {
  const config = await loadToolsConfig({ rootDir, configPath });
  if (!isProviderEnabled(config, 'weather', overrides)) return [];
  const providerConfig = getProviderConfig(config, 'weather', overrides);
  const source = { type: 'provider', name: 'weather-provider' };

  return [
    buildToolDefinition({ id: 'weather.current', title: 'Current weather', description: 'Get current weather via Open-Meteo or wttr.in fallback.', source, permissions: { public: true, capabilities: ['weather.read', 'network.egress'] }, inputSchema: { type: 'object', properties: { location: { type: 'string', minLength: 1 } }, required: ['location'], additionalProperties: false }, outputSchema: { type: 'object', properties: { provider: { type: 'string' }, location: { type: 'string' }, temperatureC: { type: 'number' }, windKph: { type: 'number' }, summary: { type: 'string' } }, required: ['provider', 'location', 'temperatureC', 'windKph', 'summary'], additionalProperties: true } }, async ({ location = '' } = {}) => {
      if ((providerConfig.provider || 'open-meteo') === 'wttr') {
        const url = `${providerConfig.wttrBaseUrl || 'https://wttr.in'}/${encodeURIComponent(location)}?format=j1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`weather_fetch_failed:${response.status}`);
        const data = await response.json();
        const current = Array.isArray(data?.current_condition) ? data.current_condition[0] : {};
        return { provider: 'wttr.in', location: normalizeText(location), temperatureC: Number(current?.temp_C || 0), windKph: Number(current?.windspeedKmph || 0), summary: normalizeText(current?.weatherDesc?.[0]?.value || 'unknown') };
      }
      const geo = await geocodeLocation(providerConfig.geocodeBaseUrl || 'https://geocoding-api.open-meteo.com/v1/search', location);
      const url = new URL(providerConfig.forecastBaseUrl || 'https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(geo.latitude));
      url.searchParams.set('longitude', String(geo.longitude));
      url.searchParams.set('current', 'temperature_2m,wind_speed_10m,weather_code');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`weather_fetch_failed:${response.status}`);
      const data = await response.json();
      return { provider: 'open-meteo', location: `${geo.name}, ${geo.country_code || geo.country || ''}`.replace(/, $/, ''), temperatureC: Number(data?.current?.temperature_2m || 0), windKph: Number(data?.current?.wind_speed_10m || 0), summary: mapCurrentWeather(Number(data?.current?.weather_code || 0)) };
    }),
    buildToolDefinition({ id: 'weather.forecast', title: 'Weather forecast', description: 'Get up to 7 days of forecast data.', source, permissions: { public: true, capabilities: ['weather.read', 'network.egress'] }, inputSchema: { type: 'object', properties: { location: { type: 'string', minLength: 1 }, days: { type: 'integer', minimum: 1, maximum: 7 } }, required: ['location'], additionalProperties: false }, outputSchema: { type: 'object', properties: { provider: { type: 'string' }, location: { type: 'string' }, days: { type: 'array' }, count: { type: 'integer' } }, required: ['provider', 'location', 'days', 'count'], additionalProperties: true } }, async ({ location = '', days = 3 } = {}) => {
      const finalDays = Math.max(1, Math.min(7, Number(days || 3)));
      if ((providerConfig.provider || 'open-meteo') === 'wttr') {
        const url = `${providerConfig.wttrBaseUrl || 'https://wttr.in'}/${encodeURIComponent(location)}?format=j1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`weather_fetch_failed:${response.status}`);
        const data = await response.json();
        const rows = (Array.isArray(data?.weather) ? data.weather : []).slice(0, finalDays).map((row) => ({ date: row.date, tempMaxC: Number(row?.maxtempC || 0), tempMinC: Number(row?.mintempC || 0), summary: normalizeText(row?.hourly?.[4]?.weatherDesc?.[0]?.value || '') }));
        return { provider: 'wttr.in', location: normalizeText(location), days: rows, count: rows.length };
      }
      const geo = await geocodeLocation(providerConfig.geocodeBaseUrl || 'https://geocoding-api.open-meteo.com/v1/search', location);
      const url = new URL(providerConfig.forecastBaseUrl || 'https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(geo.latitude));
      url.searchParams.set('longitude', String(geo.longitude));
      url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
      url.searchParams.set('forecast_days', String(finalDays));
      const response = await fetch(url);
      if (!response.ok) throw new Error(`weather_fetch_failed:${response.status}`);
      const data = await response.json();
      const time = Array.isArray(data?.daily?.time) ? data.daily.time : [];
      const rows = time.map((date, index) => ({ date, tempMaxC: Number(data?.daily?.temperature_2m_max?.[index] || 0), tempMinC: Number(data?.daily?.temperature_2m_min?.[index] || 0), summary: mapCurrentWeather(Number(data?.daily?.weather_code?.[index] || 0)) }));
      return { provider: 'open-meteo', location: `${geo.name}, ${geo.country_code || geo.country || ''}`.replace(/, $/, ''), days: rows, count: rows.length };
    }),
  ];
}
