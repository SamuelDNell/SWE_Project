process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/chatbot_test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Chat = require('../models/Chat');
const axios = require('axios');
const { ollamaMathChat } = require('../utils/ollamaMathChat');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toolResponse = (expression) => ({
  data: {
    message: {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'solve_math', arguments: { expression } } }]
    }
  }
});

const plainResponse = (content) => ({
  data: { message: { role: 'assistant', content, tool_calls: [] } }
});

// ─── ollamaMathChat unit-level tests (mocked axios, no DB) ────────────────────

describe('ollamaMathChat()', () => {
  const base = 'http://localhost:11434';
  const model = 'llama3.2:latest';
  const sysPrompt = 'You are a math assistant.';
  const msgs = [{ role: 'user', content: 'What is sqrt(144)?' }];

  it('returns content directly when Ollama sends no tool calls', async () => {
    spyOn(axios, 'post').and.returnValue(Promise.resolve(plainResponse('The answer is 12.')));
    const result = await ollamaMathChat(msgs, sysPrompt, base, model);
    expect(result).toBe('The answer is 12.');
  });

  it('makes exactly two HTTP calls when one tool round is needed', async () => {
    let n = 0;
    spyOn(axios, 'post').and.callFake(() => {
      n++;
      return Promise.resolve(n === 1 ? toolResponse('sqrt(144)') : plainResponse('It is $12$.'));
    });
    await ollamaMathChat(msgs, sysPrompt, base, model);
    expect(n).toBe(2);
  });

  it('sends the system prompt as the first message in every request', async () => {
    const payloads = [];
    spyOn(axios, 'post').and.callFake((url, data) => {
      payloads.push(data);
      return Promise.resolve(plainResponse('ok'));
    });
    await ollamaMathChat(msgs, sysPrompt, base, model);
    expect(payloads[0].messages[0].role).toBe('system');
    expect(payloads[0].messages[0].content).toBe(sysPrompt);
  });

  it('includes the solve_math tool definition in the first request', async () => {
    let captured = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      captured = data;
      return Promise.resolve(plainResponse('ok'));
    });
    await ollamaMathChat(msgs, sysPrompt, base, model);
    expect(captured.tools).toBeDefined();
    expect(captured.tools[0].function.name).toBe('solve_math');
  });

  it('appends a tool role message with the math result after a tool call', async () => {
    const payloads = [];
    spyOn(axios, 'post').and.callFake((url, data) => {
      payloads.push(data);
      return Promise.resolve(payloads.length === 1 ? toolResponse('2 + 2') : plainResponse('4'));
    });
    await ollamaMathChat(msgs, sysPrompt, base, model);
    const toolMsg = payloads[1].messages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toContain('"result":"4"');
  });

  it('processes multiple tool calls returned in a single response', async () => {
    let n = 0;
    spyOn(axios, 'post').and.callFake(() => {
      n++;
      if (n === 1) {
        return Promise.resolve({
          data: {
            message: {
              role: 'assistant', content: '',
              tool_calls: [
                { function: { name: 'solve_math', arguments: { expression: 'sqrt(16)' } } },
                { function: { name: 'solve_math', arguments: { expression: 'sqrt(25)' } } }
              ]
            }
          }
        });
      }
      return Promise.resolve(plainResponse('They are 4 and 5.'));
    });
    const result = await ollamaMathChat(msgs, sysPrompt, base, model);
    expect(result).toBe('They are 4 and 5.');
    expect(n).toBe(2);
  });

  it('handles sequential tool call rounds', async () => {
    let n = 0;
    spyOn(axios, 'post').and.callFake(() => {
      n++;
      if (n === 1) return Promise.resolve(toolResponse('sqrt(9)'));
      if (n === 2) return Promise.resolve(toolResponse('sqrt(16)'));
      return Promise.resolve(plainResponse('3 and 4'));
    });
    const result = await ollamaMathChat(msgs, sysPrompt, base, model);
    expect(result).toBe('3 and 4');
    expect(n).toBe(3);
  });

  it('returns a response after hitting the max tool round limit', async () => {
    spyOn(axios, 'post').and.returnValue(Promise.resolve(toolResponse('1 + 1')));
    // Will loop until limit then make a final call — just check it doesn't hang/throw
    const result = await ollamaMathChat(msgs, sysPrompt, base, model);
    expect(typeof result).toBe('string');
  });
});

// ─── Full chat route integration tests ────────────────────────────────────────

describe('Math Tooling — POST /api/chat/:chatId integration', () => {
  let token;
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
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

    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'mathuser', email: 'math@test.com', password: 'password123' });
    token = reg.body.token;
    const user = await User.findOne({ email: 'math@test.com' });
    userId = user._id;
  });

  it('stores the assistant response when Ollama returns a plain answer', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Math Chat',
      model: 'ollama:llama3.2:latest', messages: []
    });

    spyOn(axios, 'post').and.callFake((url) => {
      if (url.includes('11434')) return Promise.resolve(plainResponse('The answer is 12.'));
      return Promise.resolve({});
    });

    const res = await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What is sqrt(144)?', models: ['ollama:llama3.2:latest'] })
      .expect(200);

    const assistantMsg = res.body.chat.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg.content).toBe('The answer is 12.');
    expect(assistantMsg.model).toBe('ollama:llama3.2:latest');
  });

  it('stores the final answer after a tool call round', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Tool Call Chat',
      model: 'ollama:llama3.2:latest', messages: []
    });

    let n = 0;
    spyOn(axios, 'post').and.callFake((url) => {
      if (!url.includes('11434')) return Promise.resolve({});
      n++;
      return Promise.resolve(n === 1 ? toolResponse('sqrt(144)') : plainResponse('$\\sqrt{144} = 12$'));
    });

    const res = await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Compute sqrt(144)', models: ['ollama:llama3.2:latest'] })
      .expect(200);

    const assistantMsg = res.body.chat.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg.content).toContain('12');
  });

  it('sends the math tool instruction in the system prompt to Ollama', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Prompt Check Chat',
      model: 'ollama:llama3.2:latest', messages: []
    });

    let capturedPayload = null;
    spyOn(axios, 'post').and.callFake((url, data) => {
      if (url.includes('11434')) capturedPayload = data;
      return Promise.resolve(plainResponse('ok'));
    });

    await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', models: ['ollama:llama3.2:latest'] })
      .expect(200);

    const systemContent = capturedPayload.messages[0].content;
    expect(systemContent).toContain('solve_math tool');
    expect(systemContent).toContain('LaTeX');
  });

  it('does NOT send math tool instructions when using a non-Ollama model', async () => {
    const chat = await Chat.create({
      user: userId, title: 'Ollama check',
      model: 'groq:llama-3.3-70b-versatile', messages: []
    });

    const capturedOllamaCalls = [];
    spyOn(axios, 'post').and.callFake((url, data) => {
      if (url.includes('11434')) capturedOllamaCalls.push(data);
      return Promise.resolve(plainResponse('ok'));
    });

    // Groq will fail (no real key in test env) but Ollama must not be called
    await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', models: ['groq:llama-3.3-70b-versatile'] });

    expect(capturedOllamaCalls.length).toBe(0);
  });
});

// ─── Groq LaTeX integration tests ─────────────────────────────────────────────

describe('Groq LaTeX — buildSystemPrompt integration', () => {
  const { buildSystemPrompt } = require('../utils/providerHelper');

  it('groq system prompt contains LaTeX block math syntax', () => {
    const prompt = buildSystemPrompt(null, 'groq');
    expect(prompt).toContain('$$');
  });

  it('groq system prompt contains inline math syntax', () => {
    const prompt = buildSystemPrompt(null, 'groq');
    expect(prompt).toContain('$expression$');
  });

  it('groq system prompt contains solve_math tool instruction', () => {
    const prompt = buildSystemPrompt(null, 'groq');
    expect(prompt).toContain('solve_math');
  });

  it('ollama system prompt contains solve_math tool instruction', () => {
    const prompt = buildSystemPrompt(null, 'ollama');
    expect(prompt).toContain('solve_math');
  });

  it('groq provider is routed correctly and does not touch the Ollama endpoint', async () => {
    const User = require('../models/User');
    const Chat = require('../models/Chat');

    await User.deleteMany({});
    await Chat.deleteMany({});

    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'groqtest', email: 'groqtest@test.com', password: 'password123' });
    const testToken = reg.body.token;
    const user = await User.findOne({ email: 'groqtest@test.com' });

    const chat = await Chat.create({
      user: user._id, title: 'Groq Routing Test',
      model: 'groq:llama-3.3-70b-versatile', messages: []
    });

    const ollamaCalls = [];
    spyOn(axios, 'post').and.callFake((url, data) => {
      if (url.includes('11434')) ollamaCalls.push(data);
      return Promise.resolve(plainResponse('ok'));
    });

    await request(app)
      .post(`/api/chat/${chat._id}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ message: 'Hello', models: ['groq:llama-3.3-70b-versatile'] });

    // Groq should not route through Ollama
    expect(ollamaCalls.length).toBe(0);
  });
});
