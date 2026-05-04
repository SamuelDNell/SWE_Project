process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/chatbot_test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Chat = require('../models/Chat');
const axios = require('axios');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const weatherToolCall = (city = 'New York', days = 1) => ({
  data: {
    message: {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'get_weather', arguments: { city, days } } }]
    }
  }
});

const ollamaPlain = (content) => ({
  data: { message: { role: 'assistant', content, tool_calls: [] } }
});

const groqPlain = (content) => ({
  data: { choices: [{ message: { content, tool_calls: null } }] }
});

const groqToolCall = (city, id = 'call_1') => ({
  data: {
    choices: [{
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [{ id, function: { name: 'get_weather', arguments: JSON.stringify({ city, days: 1 }) } }]
      }
    }]
  }
});

const geoOk = (name = 'New York') => ({
  data: { results: [{ latitude: 40.71, longitude: -74.01, name }] }
});

const forecastOk = () => ({
  data: {
    current: {
      temperature_2m: 72, apparent_temperature: 70,
      relative_humidity_2m: 55, wind_speed_10m: 10, weather_code: 0
    },
    daily: {
      time: ['2026-05-04'],
      temperature_2m_max: [75], temperature_2m_min: [60],
      precipitation_sum: [0], weather_code: [0]
    }
  }
});

// ─── ollamaChat unit-level tests (weather, mocked axios) ──────────────────────

describe('ollamaChat() — weather tool routing', () => {
  const { ollamaChat } = require('../utils/ollamaChat');
  const base = 'http://localhost:11434';
  const model = 'llama3.2:latest';
  const sysPrompt = 'You are a helpful assistant.';
  const msgs = [{ role: 'user', content: 'Weather in New York?' }];

  it('returns content directly when no tool calls are requested', async () => {
    spyOn(axios, 'post').and.returnValue(Promise.resolve(ollamaPlain('No tool needed.')));
    const result = await ollamaChat(msgs, sysPrompt, base, model);
    expect(result).toBe('No tool needed.');
  });

  it('includes both solve_math and get_weather in the tools array', async () => {
    let captured = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      captured = data;
      return Promise.resolve(ollamaPlain('ok'));
    });
    await ollamaChat(msgs, sysPrompt, base, model);
    const names = captured.tools.map((t) => t.function.name);
    expect(names).toContain('solve_math');
    expect(names).toContain('get_weather');
  });

  it('appends a tool result message after a weather tool call', async () => {
    const payloads = [];
    spyOn(axios, 'get').and.callFake((url) =>
      Promise.resolve(url.includes('geocoding') ? geoOk() : forecastOk())
    );
    spyOn(axios, 'post').and.callFake((url, data) => {
      payloads.push(data);
      return Promise.resolve(
        payloads.length === 1 ? weatherToolCall('New York') : ollamaPlain('It is 72°F.')
      );
    });
    const result = await ollamaChat(msgs, sysPrompt, base, model);
    expect(result).toBe('It is 72°F.');
    const toolMsg = payloads[1].messages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toContain('"city"');
  });

  it('makes exactly two HTTP calls for one weather tool round', async () => {
    let n = 0;
    spyOn(axios, 'get').and.callFake((url) =>
      Promise.resolve(url.includes('geocoding') ? geoOk() : forecastOk())
    );
    spyOn(axios, 'post').and.callFake(() => {
      n++;
      return Promise.resolve(n === 1 ? weatherToolCall('Tokyo') : ollamaPlain('Done.'));
    });
    await ollamaChat(msgs, sysPrompt, base, model);
    expect(n).toBe(2);
  });

  it('routes an unknown tool name to an error result', async () => {
    const payloads = [];
    spyOn(axios, 'post').and.callFake((url, data) => {
      payloads.push(data);
      if (payloads.length === 1) {
        return Promise.resolve({
          data: {
            message: {
              role: 'assistant', content: '',
              tool_calls: [{ function: { name: 'unknown_tool', arguments: {} } }]
            }
          }
        });
      }
      return Promise.resolve(ollamaPlain('ok'));
    });
    await ollamaChat(msgs, sysPrompt, base, model);
    const toolMsg = payloads[1].messages.find((m) => m.role === 'tool');
    expect(toolMsg.content).toContain('Unknown tool');
  });

  it('sends the system prompt as the first message', async () => {
    const payloads = [];
    spyOn(axios, 'post').and.callFake((url, data) => {
      payloads.push(data);
      return Promise.resolve(ollamaPlain('ok'));
    });
    await ollamaChat(msgs, sysPrompt, base, model);
    expect(payloads[0].messages[0].role).toBe('system');
    expect(payloads[0].messages[0].content).toBe(sysPrompt);
  });
});

// ─── groqChat unit-level tests (mocked axios) ─────────────────────────────────

describe('groqChat() — weather tool routing', () => {
  const { groqChat } = require('../utils/groqChat');
  const sysPrompt = 'You are a helpful assistant.';
  const msgs = [{ role: 'user', content: 'Weather in Tokyo?' }];

  beforeEach(() => { process.env.GROQ_API_KEY = 'test_key'; });
  afterEach(() => { delete process.env.GROQ_API_KEY; });

  it('returns content directly when no tool calls', async () => {
    spyOn(axios, 'post').and.returnValue(Promise.resolve(groqPlain('Hello!')));
    const result = await groqChat(msgs, sysPrompt);
    expect(result).toBe('Hello!');
  });

  it('includes both tools in the request body', async () => {
    let captured = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      captured = data;
      return Promise.resolve(groqPlain('ok'));
    });
    await groqChat(msgs, sysPrompt);
    const names = captured.tools.map((t) => t.function.name);
    expect(names).toContain('solve_math');
    expect(names).toContain('get_weather');
  });

  it('sets tool_choice to "auto"', async () => {
    let captured = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      captured = data;
      return Promise.resolve(groqPlain('ok'));
    });
    await groqChat(msgs, sysPrompt);
    expect(captured.tool_choice).toBe('auto');
  });

  it('handles a weather tool call and returns the final answer', async () => {
    let n = 0;
    spyOn(axios, 'get').and.callFake((url) =>
      Promise.resolve(url.includes('geocoding') ? geoOk('Tokyo') : forecastOk())
    );
    spyOn(axios, 'post').and.callFake(() => {
      n++;
      return Promise.resolve(n === 1 ? groqToolCall('Tokyo') : groqPlain('Tokyo is 72°F.'));
    });
    const result = await groqChat(msgs, sysPrompt);
    expect(result).toContain('72');
    expect(n).toBe(2);
  });

  it('appends a tool result with the matching tool_call_id', async () => {
    const payloads = [];
    spyOn(axios, 'get').and.callFake((url) =>
      Promise.resolve(url.includes('geocoding') ? geoOk('London') : forecastOk())
    );
    spyOn(axios, 'post').and.callFake((url, data) => {
      payloads.push(data);
      return Promise.resolve(
        payloads.length === 1 ? groqToolCall('London', 'call_abc') : groqPlain('Done.')
      );
    });
    await groqChat(msgs, sysPrompt);
    const toolMsg = payloads[1].messages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg.tool_call_id).toBe('call_abc');
  });

  it('throws when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY;
    await expectAsync(groqChat(msgs, sysPrompt)).toBeRejectedWithError(/Groq API key/);
  });

  it('sends the system prompt as the first message', async () => {
    let captured = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      captured = data;
      return Promise.resolve(groqPlain('ok'));
    });
    await groqChat(msgs, sysPrompt, 'llama-3.3-70b-versatile');
    expect(captured.messages[0].role).toBe('system');
    expect(captured.messages[0].content).toBe(sysPrompt);
  });
});

// ─── Chat route integration — weather via Ollama ──────────────────────────────

describe('Weather Tool — POST /api/chat/:chatId (Ollama)', () => {
  let token, userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});
    const reg = await request(app).post('/api/auth/register')
      .send({ username: 'weatheruser', email: 'weather@test.com', password: 'password123' });
    token = reg.body.token;
    userId = (await User.findOne({ email: 'weather@test.com' }))._id;
  });

  it('stores the final answer after a weather tool call round', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Weather Chat',
      model: 'ollama:llama3.2:latest', messages: []
    });
    let n = 0;
    spyOn(axios, 'get').and.callFake((url) =>
      Promise.resolve(url.includes('geocoding') ? geoOk() : forecastOk())
    );
    spyOn(axios, 'post').and.callFake((url) => {
      if (!url.includes('11434')) return Promise.resolve({});
      n++;
      return Promise.resolve(n === 1 ? weatherToolCall('New York') : ollamaPlain('It is 72°F in New York.'));
    });

    const res = await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Weather in New York?', models: ['ollama:llama3.2:latest'] })
      .expect(200);

    const assistantMsg = res.body.chat.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg.content).toContain('72');
  });

  it('includes get_weather in the system prompt sent to Ollama', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Prompt Check',
      model: 'ollama:llama3.2:latest', messages: []
    });
    let captured = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      if (url.includes('11434')) captured = data;
      return Promise.resolve(ollamaPlain('ok'));
    });

    await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', models: ['ollama:llama3.2:latest'] })
      .expect(200);

    expect(captured.messages[0].content).toContain('get_weather');
    expect(captured.messages[0].content).toContain('solve_math');
  });

  it('sends both tools to Ollama', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Tools Check',
      model: 'ollama:llama3.2:latest', messages: []
    });
    let capturedTools = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      if (url.includes('11434')) capturedTools = data.tools;
      return Promise.resolve(ollamaPlain('ok'));
    });

    await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', models: ['ollama:llama3.2:latest'] })
      .expect(200);

    const names = capturedTools.map((t) => t.function.name);
    expect(names).toContain('get_weather');
    expect(names).toContain('solve_math');
  });
});

// ─── Chat route integration — weather via Groq ───────────────────────────────

describe('Weather Tool — POST /api/chat/:chatId (Groq)', () => {
  let token, userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    process.env.GROQ_API_KEY = 'test_groq_key';
    await User.deleteMany({});
    await Chat.deleteMany({});
    const reg = await request(app).post('/api/auth/register')
      .send({ username: 'groqweather', email: 'groqweather@test.com', password: 'password123' });
    token = reg.body.token;
    userId = (await User.findOne({ email: 'groqweather@test.com' }))._id;
  });

  afterEach(() => { delete process.env.GROQ_API_KEY; });

  it('stores the weather answer after a Groq tool call', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Groq Weather',
      model: 'groq:llama-3.3-70b-versatile', messages: []
    });
    let n = 0;
    spyOn(axios, 'get').and.callFake((url) =>
      Promise.resolve(url.includes('geocoding') ? geoOk('London') : forecastOk())
    );
    spyOn(axios, 'post').and.callFake(() => {
      n++;
      return Promise.resolve(n === 1 ? groqToolCall('London') : groqPlain('London is 72°F and clear.'));
    });

    const res = await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Weather in London?', models: ['groq:llama-3.3-70b-versatile'] })
      .expect(200);

    const assistantMsg = res.body.chat.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg.content).toContain('London');
  });

  it('includes get_weather and solve_math in the Groq system prompt', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Groq Prompt Check',
      model: 'groq:llama-3.3-70b-versatile', messages: []
    });
    let captured = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      captured = data;
      return Promise.resolve(groqPlain('ok'));
    });

    await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', models: ['groq:llama-3.3-70b-versatile'] })
      .expect(200);

    const sys = captured.messages.find((m) => m.role === 'system');
    expect(sys.content).toContain('get_weather');
    expect(sys.content).toContain('solve_math');
  });

  it('does not route Groq calls through the Ollama endpoint', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Groq No Ollama',
      model: 'groq:llama-3.3-70b-versatile', messages: []
    });
    const ollamaCalls = [];
    spyOn(axios, 'post').and.callFake((url, data) => {
      if (url.includes('11434')) ollamaCalls.push(data);
      return Promise.resolve(groqPlain('ok'));
    });

    await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', models: ['groq:llama-3.3-70b-versatile'] });

    expect(ollamaCalls.length).toBe(0);
  });
});
