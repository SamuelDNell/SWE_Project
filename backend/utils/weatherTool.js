const axios = require('axios');

const toolDefinition = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Gets current weather and forecast for a city. Use for any question about weather, temperature, conditions, rain, wind, or climate in a specific location.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'The city name, e.g. \'New York\', \'London\', \'Tokyo\''
        },
        days: {
          type: 'number',
          description: 'Number of forecast days (1-7). Use 1 for current/today, up to 7 for future dates. Default to 1.'
        }
      },
      required: ['city']
    }
  }
};

const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Partly cloudy', 2: 'Partly cloudy', 3: 'Partly cloudy',
  45: 'Foggy', 48: 'Foggy',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Rain showers',
  95: 'Thunderstorm'
};

const getCondition = (code) => WEATHER_CODES[code] || 'Unknown';

const executeWeatherTool = async (city, days = 1) => {
  try {
    const geoRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: city, count: 1, language: 'en', format: 'json' }
    });

    const results = geoRes.data?.results;
    if (!results || results.length === 0) {
      return { error: `City not found: ${city}` };
    }

    const { latitude, longitude, name: resolvedCity } = results[0];
    const forecastDays = Math.min(Math.max(Number(days) || 1, 1), 7);

    const forecastRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude,
        longitude,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
        forecast_days: forecastDays,
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        timezone: 'auto'
      }
    });

    const { current, daily } = forecastRes.data;

    return {
      city: resolvedCity,
      current: {
        temperature: current.temperature_2m,
        feels_like: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        wind_speed: current.wind_speed_10m,
        condition: getCondition(current.weather_code)
      },
      forecast: daily.time.map((date, i) => ({
        date,
        high: daily.temperature_2m_max[i],
        low: daily.temperature_2m_min[i],
        precipitation: daily.precipitation_sum[i],
        condition: getCondition(daily.weather_code[i])
      }))
    };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = { toolDefinition, executeWeatherTool };
