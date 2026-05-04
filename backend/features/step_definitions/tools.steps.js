const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { executeMathTool } = require('../../utils/mathTool');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ollamaToolCall = (toolName, args) => ({
  data: {
    message: {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: toolName, arguments: args } }]
    }
  }
});

const ollamaPlain = (content) => ({
  data: { message: { role: 'assistant', content, tool_calls: [] } }
});

const groqToolCall = (toolName, argsObj, id = 'call_1') => ({
  data: {
    choices: [{
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [{ id, function: { name: toolName, arguments: JSON.stringify(argsObj) } }]
      }
    }]
  }
});

const groqPlain = (content) => ({
  data: { choices: [{ message: { content, tool_calls: null } }] }
});

const geoOk = (name) => ({
  data: { results: [{ latitude: 40.71, longitude: -74.01, name }] }
});

const forecastOk = (city) => ({
  data: {
    current: {
      temperature_2m: 72, apparent_temperature: 70,
      relative_humidity_2m: 55, wind_speed_10m: 10, weather_code: 0
    },
    daily: {
      time: ['2026-05-04'],
      temperature_2m_max: [75], temperature_2m_min: [60],
      precipitation_sum: [0], weather_code: [0]
    },
    _resolvedCity: city
  }
});

// ─── Shared helper: send a message to the active chat ─────────────────────────

async function sendMessage(world, message, model) {
  assert.ok(world.activeChatId, 'No active chat — use "Given I have an active chat" first');
  world.lastResponse = await world.request(world.app)
    .post(`/api/chat/${world.activeChatId}`)
    .set('Authorization', `Bearer ${world.token}`)
    .send({ message, models: [model], documentIds: [] });
}

// ─── When: plain message (payload capture only) ───────────────────────────────

When('I send a plain message using Ollama', async function () {
  const self = this;
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url, data) => {
    if (url.includes('11434')) self.capturedLLMPayload = data;
    return Promise.resolve(ollamaPlain('ok'));
  });
  await sendMessage(this, 'Hello', 'ollama:llama3.2:latest');
});

When('I send a plain message using Groq', async function () {
  const self = this;
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url, data) => {
    if (url.includes('groq.com')) self.capturedGroqPayload = data;
    return Promise.resolve(groqPlain('ok'));
  });
  await sendMessage(this, 'Hello', 'groq:llama-3.3-70b-versatile');
});

// ─── When: math questions ──────────────────────────────────────────────────────

When('I send the math question {string} using Ollama', async function (question) {
  let n = 0;
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url) => {
    if (!url.includes('11434')) return Promise.resolve({});
    n++;
    return Promise.resolve(
      n === 1
        ? ollamaToolCall('solve_math', { expression: 'sqrt(144)' })
        : ollamaPlain('The answer is 12.')
    );
  });
  await sendMessage(this, question, 'ollama:llama3.2:latest');
});

When('I send the math question {string} using Groq', async function (question) {
  let n = 0;
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url) => {
    if (!url.includes('groq.com')) return Promise.resolve({});
    n++;
    return Promise.resolve(
      n === 1
        ? groqToolCall('solve_math', { expression: '2 + 2' })
        : groqPlain('The answer is 4.')
    );
  });
  await sendMessage(this, question, 'groq:llama-3.3-70b-versatile');
});

// ─── When: direct tool invocation ────────────────────────────────────────────

When('the solve_math tool is called directly with expression {string}', function (expression) {
  this.toolResult = executeMathTool(expression);
});

// ─── When: weather questions ──────────────────────────────────────────────────

When('I ask about the weather in {string} using Ollama', async function (city) {
  let n = 0;
  this.axiosGetStub = this.sinon.stub(this.axios, 'get').callsFake((url) => {
    if (url.includes('geocoding')) return Promise.resolve(geoOk(city));
    return Promise.resolve(forecastOk(city));
  });
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url) => {
    if (!url.includes('11434')) return Promise.resolve({});
    n++;
    return Promise.resolve(
      n === 1
        ? ollamaToolCall('get_weather', { city, days: 1 })
        : ollamaPlain(`It is 72°F in ${city}.`)
    );
  });
  await sendMessage(this, `What is the weather in ${city}?`, 'ollama:llama3.2:latest');
});

When('I ask about the weather in {string} using Groq', async function (city) {
  let n = 0;
  this.axiosGetStub = this.sinon.stub(this.axios, 'get').callsFake((url) => {
    if (url.includes('geocoding')) return Promise.resolve(geoOk(city));
    return Promise.resolve(forecastOk(city));
  });
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url) => {
    if (!url.includes('groq.com')) return Promise.resolve({});
    n++;
    return Promise.resolve(
      n === 1
        ? groqToolCall('get_weather', { city, days: 1 })
        : groqPlain(`It is 72°F in ${city}.`)
    );
  });
  await sendMessage(this, `What is the weather in ${city}?`, 'groq:llama-3.3-70b-versatile');
});

When('I ask about the weather in an unknown city using Ollama', async function () {
  let n = 0;
  this.axiosGetStub = this.sinon.stub(this.axios, 'get').callsFake(() =>
    Promise.resolve({ data: {} })
  );
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url) => {
    if (!url.includes('11434')) return Promise.resolve({});
    n++;
    return Promise.resolve(
      n === 1
        ? ollamaToolCall('get_weather', { city: 'UnknownCity99999', days: 1 })
        : ollamaPlain('I could not find weather data for that city.')
    );
  });
  await sendMessage(this, 'What is the weather in UnknownCity99999?', 'ollama:llama3.2:latest');
});

// ─── Then: response content ───────────────────────────────────────────────────

Then('the chat response should contain {string}', function (text) {
  assert.ok(
    this.lastResponse,
    'No response was captured — did the When step complete?'
  );
  assert.strictEqual(
    this.lastResponse.status, 200,
    `Expected 200 but got ${this.lastResponse.status}: ${JSON.stringify(this.lastResponse.body)}`
  );
  const messages = this.lastResponse.body.chat?.messages || [];
  const assistantMsg = messages.find((m) => m.role === 'assistant');
  assert.ok(assistantMsg, 'No assistant message in response');
  assert.ok(
    assistantMsg.content.includes(text),
    `Expected response to contain "${text}" but got: "${assistantMsg.content}"`
  );
});

Then('the chat request should succeed', function () {
  assert.ok(this.lastResponse, 'No response was captured');
  assert.strictEqual(
    this.lastResponse.status, 200,
    `Expected 200 but got ${this.lastResponse.status}: ${JSON.stringify(this.lastResponse.body)}`
  );
});

// ─── Then: Ollama system prompt / tools ───────────────────────────────────────

Then('the Ollama system prompt should contain {string}', function (text) {
  assert.ok(this.capturedLLMPayload, 'No Ollama payload was captured — did the When step run?');
  const systemContent = this.capturedLLMPayload.messages[0].content;
  assert.ok(
    systemContent.includes(text),
    `Expected Ollama system prompt to contain "${text}" but got: "${systemContent.slice(0, 300)}..."`
  );
});

Then('the Ollama request tools should include {string}', function (toolName) {
  assert.ok(this.capturedLLMPayload, 'No Ollama payload was captured');
  const names = (this.capturedLLMPayload.tools || []).map((t) => t.function.name);
  assert.ok(
    names.includes(toolName),
    `Expected Ollama tools to include "${toolName}" but found: [${names.join(', ')}]`
  );
});

// ─── Then: Groq system prompt / tools ────────────────────────────────────────

Then('the Groq system prompt should contain {string}', function (text) {
  assert.ok(this.capturedGroqPayload, 'No Groq payload was captured — did the When step run?');
  const systemMsg = this.capturedGroqPayload.messages.find((m) => m.role === 'system');
  assert.ok(systemMsg, 'No system message found in Groq payload');
  assert.ok(
    systemMsg.content.includes(text),
    `Expected Groq system prompt to contain "${text}" but got: "${systemMsg.content.slice(0, 300)}..."`
  );
});

Then('the Groq request tools should include {string}', function (toolName) {
  assert.ok(this.capturedGroqPayload, 'No Groq payload was captured');
  const names = (this.capturedGroqPayload.tools || []).map((t) => t.function.name);
  assert.ok(
    names.includes(toolName),
    `Expected Groq tools to include "${toolName}" but found: [${names.join(', ')}]`
  );
});

// ─── Then: direct tool result ─────────────────────────────────────────────────

Then('the math tool result should have an error field', function () {
  assert.ok(this.toolResult, 'No tool result — did the When step run?');
  assert.ok(
    this.toolResult.error !== undefined,
    `Expected an error field but got: ${JSON.stringify(this.toolResult)}`
  );
});
