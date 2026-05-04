const axios = require('axios');
const { toolDefinition, executeWeatherTool } = require('../utils/weatherTool');
const { buildSystemPrompt } = require('../utils/providerHelper');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const geoOk = (name = 'New York') => ({
  data: { results: [{ latitude: 40.71, longitude: -74.01, name }] }
});

const forecastOk = () => ({
  data: {
    current: {
      temperature_2m: 72,
      apparent_temperature: 70,
      relative_humidity_2m: 55,
      wind_speed_10m: 10,
      weather_code: 0
    },
    daily: {
      time: ['2026-05-04', '2026-05-05'],
      temperature_2m_max: [75, 68],
      temperature_2m_min: [60, 55],
      precipitation_sum: [0, 0.1],
      weather_code: [0, 61]
    }
  }
});

describe('Weather Tooling Unit Tests', () => {

  // ─── toolDefinition structure ──────────────────────────────────────────────

  describe('toolDefinition', () => {
    it('has type "function"', () => {
      expect(toolDefinition.type).toBe('function');
    });

    it('has the correct function name', () => {
      expect(toolDefinition.function.name).toBe('get_weather');
    });

    it('requires the city parameter', () => {
      expect(toolDefinition.function.parameters.required).toContain('city');
    });

    it('has a city property of type string', () => {
      expect(toolDefinition.function.parameters.properties.city.type).toBe('string');
    });

    it('has a days property of type number', () => {
      expect(toolDefinition.function.parameters.properties.days.type).toBe('number');
    });

    it('has a non-empty description', () => {
      expect(toolDefinition.function.description.length).toBeGreaterThan(10);
    });

    it('description mentions weather', () => {
      expect(toolDefinition.function.description.toLowerCase()).toContain('weather');
    });
  });

  // ─── executeWeatherTool ────────────────────────────────────────────────────

  describe('executeWeatherTool()', () => {
    it('returns structured weather data for a valid city', async () => {
      spyOn(axios, 'get').and.callFake((url) =>
        Promise.resolve(url.includes('geocoding') ? geoOk() : forecastOk())
      );
      const result = await executeWeatherTool('New York', 2);
      expect(result.city).toBe('New York');
      expect(result.current).toBeDefined();
      expect(result.forecast).toBeDefined();
    });

    it('returns current temperature, feels_like, humidity, wind_speed, and condition', async () => {
      spyOn(axios, 'get').and.callFake((url) =>
        Promise.resolve(url.includes('geocoding') ? geoOk() : forecastOk())
      );
      const result = await executeWeatherTool('New York');
      expect(result.current.temperature).toBe(72);
      expect(result.current.feels_like).toBe(70);
      expect(result.current.humidity).toBe(55);
      expect(result.current.wind_speed).toBe(10);
      expect(result.current.condition).toBe('Clear sky');
    });

    it('maps weather_code 0 to "Clear sky"', async () => {
      spyOn(axios, 'get').and.callFake((url) =>
        Promise.resolve(url.includes('geocoding') ? geoOk() : forecastOk())
      );
      const result = await executeWeatherTool('New York');
      expect(result.current.condition).toBe('Clear sky');
    });

    it('maps weather_code 61 to "Rain" in the forecast', async () => {
      spyOn(axios, 'get').and.callFake((url) =>
        Promise.resolve(url.includes('geocoding') ? geoOk() : forecastOk())
      );
      const result = await executeWeatherTool('New York', 2);
      expect(result.forecast[1].condition).toBe('Rain');
    });

    it('returns an error object when city is not found', async () => {
      spyOn(axios, 'get').and.returnValue(Promise.resolve({ data: {} }));
      const result = await executeWeatherTool('NonExistentXYZ');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('City not found');
    });

    it('returns an error object when the network request fails', async () => {
      spyOn(axios, 'get').and.returnValue(Promise.reject(new Error('Network Error')));
      const result = await executeWeatherTool('New York');
      expect(result.error).toBeDefined();
    });

    it('returns a forecast array with the correct fields', async () => {
      spyOn(axios, 'get').and.callFake((url) =>
        Promise.resolve(url.includes('geocoding') ? geoOk() : forecastOk())
      );
      const result = await executeWeatherTool('New York', 2);
      expect(Array.isArray(result.forecast)).toBe(true);
      const day = result.forecast[0];
      expect(day.date).toBeDefined();
      expect(day.high).toBeDefined();
      expect(day.low).toBeDefined();
      expect(day.precipitation).toBeDefined();
      expect(day.condition).toBeDefined();
    });

    it('caps forecast_days at 7', async () => {
      const captured = [];
      spyOn(axios, 'get').and.callFake((url, opts) => {
        if (url.includes('geocoding')) return Promise.resolve(geoOk());
        captured.push(opts.params);
        return Promise.resolve(forecastOk());
      });
      await executeWeatherTool('New York', 100);
      expect(captured[0].forecast_days).toBe(7);
    });

    it('defaults forecast_days to 1 when not specified', async () => {
      const captured = [];
      spyOn(axios, 'get').and.callFake((url, opts) => {
        if (url.includes('geocoding')) return Promise.resolve(geoOk());
        captured.push(opts.params);
        return Promise.resolve(forecastOk());
      });
      await executeWeatherTool('New York');
      expect(captured[0].forecast_days).toBe(1);
    });

    it('requests fahrenheit and mph units', async () => {
      const captured = [];
      spyOn(axios, 'get').and.callFake((url, opts) => {
        if (url.includes('geocoding')) return Promise.resolve(geoOk());
        captured.push(opts.params);
        return Promise.resolve(forecastOk());
      });
      await executeWeatherTool('London', 1);
      expect(captured[0].temperature_unit).toBe('fahrenheit');
      expect(captured[0].wind_speed_unit).toBe('mph');
    });

    it('uses the resolved city name from geocoding', async () => {
      spyOn(axios, 'get').and.callFake((url) =>
        Promise.resolve(url.includes('geocoding') ? geoOk('New York City') : forecastOk())
      );
      const result = await executeWeatherTool('New York');
      expect(result.city).toBe('New York City');
    });
  });

  // ─── buildSystemPrompt — weather instructions ─────────────────────────────

  describe('buildSystemPrompt() — weather tool instructions', () => {
    it('includes get_weather instructions for ollama', () => {
      expect(buildSystemPrompt(null, 'ollama')).toContain('get_weather');
    });

    it('includes get_weather instructions for groq', () => {
      expect(buildSystemPrompt(null, 'groq')).toContain('get_weather');
    });

    it('does NOT include weather instructions for openai', () => {
      expect(buildSystemPrompt(null, 'openai')).not.toContain('get_weather');
    });

    it('does NOT include weather instructions for anthropic', () => {
      expect(buildSystemPrompt(null, 'anthropic')).not.toContain('get_weather');
    });

    it('does NOT include weather instructions when no provider is given', () => {
      expect(buildSystemPrompt(null)).not.toContain('get_weather');
    });

    it('mentions °F for temperature units', () => {
      expect(buildSystemPrompt(null, 'groq')).toContain('°F');
      expect(buildSystemPrompt(null, 'ollama')).toContain('°F');
    });

    it('mentions mph for wind speed units', () => {
      expect(buildSystemPrompt(null, 'ollama')).toContain('mph');
      expect(buildSystemPrompt(null, 'groq')).toContain('mph');
    });

    it('includes both weather and math tool instructions for ollama', () => {
      const prompt = buildSystemPrompt(null, 'ollama');
      expect(prompt).toContain('get_weather');
      expect(prompt).toContain('solve_math');
    });

    it('includes both weather and math tool instructions for groq', () => {
      const prompt = buildSystemPrompt(null, 'groq');
      expect(prompt).toContain('get_weather');
      expect(prompt).toContain('solve_math');
    });

    it('still includes the Knightly preamble', () => {
      expect(buildSystemPrompt(null, 'ollama')).toContain('You are Knightly');
      expect(buildSystemPrompt(null, 'groq')).toContain('You are Knightly');
    });

    it('still includes the anti-hallucination warning', () => {
      expect(buildSystemPrompt(null, 'ollama')).toContain('do not invent file contents');
      expect(buildSystemPrompt(null, 'groq')).toContain('do not invent file contents');
    });

    it('includes document context alongside weather and math instructions', () => {
      const prompt = buildSystemPrompt('Lecture notes content', 'groq');
      expect(prompt).toContain('Lecture notes content');
      expect(prompt).toContain('get_weather');
      expect(prompt).toContain('solve_math');
    });

    it('includes LaTeX formatting instructions for ollama and groq', () => {
      expect(buildSystemPrompt(null, 'ollama')).toContain('LaTeX');
      expect(buildSystemPrompt(null, 'groq')).toContain('LaTeX');
    });
  });
});
