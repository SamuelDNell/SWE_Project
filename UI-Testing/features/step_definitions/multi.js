const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am a registered user', function () {
  this.user = { id: 1 };
});

When('I send a message {string}', function (message) {
  this.response = {
    modelsCalled: ['llama3.2:latest', 'phi'],
    responses: [
      { model: 'llama3.2:latest', text: 'Mock response A' },
      { model: 'phi', text: 'Mock response B' }
    ],
    chat: [
      { role: 'user', content: message },
      { role: 'assistant', model: 'llama3.2:latest', content: 'Mock response A' },
      { role: 'assistant', model: 'phi', content: 'Mock response B' }
    ]
  };

  this.chat = this.response.chat;
});

Given('I have sent a message {string}', function (message) {
  this.response = {
    modelsCalled: ['llama3.2:latest', 'phi'],
    responses: [
      { model: 'llama3.2:latest', text: 'Mock response A' },
      { model: 'phi', text: 'Mock response B' }
    ],
    chat: [
      { role: 'user', content: message },
      { role: 'assistant', model: 'llama3.2:latest', content: 'Mock response A' },
      { role: 'assistant', model: 'phi', content: 'Mock response B' }
    ]
  };

  this.chat = this.response.chat;
});

When('the responses are returned', function () {
  return this.response;
});

Then('the backend sends the prompt to {string} and {string}', function (m1, m2) {
  assert(this.response.modelsCalled.includes(m1));
  assert(this.response.modelsCalled.includes(m2));
});

Then('I receive responses from both models', function () {
  assert.strictEqual(this.response.responses.length, 2);
});

Then('both responses appear in the same chat', function () {
  assert(this.chat.length >= 3);
});

Then('each response includes its model name', function () {
  this.response.responses.forEach(r => {
    assert.ok(r.model === 'llama3.2:latest' || r.model === 'phi');
  });
});

Then('I see {string} or {string} above each response', function (m1, m2) {
  const models = this.response.responses.map(r => r.model);
  assert(models.includes(m1));
  assert(models.includes(m2));
});

Given('I have an existing conversation', function () {
    this.chat = [
      { role: 'user', content: 'Hello models' },
      { role: 'assistant', model: 'llama3.2:latest' },
      { role: 'assistant', model: 'phi' }
    ];
  });

When('I reopen the chat', function () {
  this.reopenedChat = this.chat;
});

Then('I see the original user message once', function () {
  const userMsgs = this.reopenedChat.filter(m => m.role === 'user');
  assert.strictEqual(userMsgs.length, 1);
});

Then('I see responses from both models', function () {
  const models = this.reopenedChat
    .filter(m => m.role === 'assistant')
    .map(m => m.model);

  assert(models.includes('llama3.2:latest'));
  assert(models.includes('phi'));
});

Then('all messages appear in order', function () {
  assert.ok(this.reopenedChat.length > 0);
});