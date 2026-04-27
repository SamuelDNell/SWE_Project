const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

const chatModels = [
  { name: 'llama3.2:latest' },
  { name: 'llama3.1:latest' }
];

const createMockChat = (chatId, message, models) => {
  const responses = models.map((modelName, index) => ({
    model: modelName,
    content: `Mocked response ${index + 1} from ${modelName}`
  }));

  const chat = {
    _id: chatId,
    title: 'Compare models',
    model: models[0],
    models,
    messages: [
      { role: 'user', content: message },
      ...responses.map((response) => ({
        role: 'assistant',
        content: response.content,
        model: response.model
      }))
    ]
  };

  return {
    responses,
    chat
  };
};

const clickButtonByText = async (page, buttonText) => {
  await page.$$eval('button', (buttons, text) => {
    const button = buttons.find((el) => el.textContent.trim() === text);
    if (!button) {
      throw new Error(`Button with text '${text}' not found`);
    }
    button.click();
  }, buttonText);
};

const clickLabelByText = async (page, labelText) => {
  await page.$$eval('label', (labels, text) => {
    const label = labels.find((el) => el.textContent.trim() === text);
    if (!label) {
      throw new Error(`Label with text '${text}' not found`);
    }
    label.click();
  }, labelText);
};

Given('I am on the home page', async function () {
  this.chatId = 'mock-chat-1';
  this.currentModels = chatModels.map((model) => model.name);

  await this.page.route('**/api/chat/models', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: chatModels })
    });
  });

  await this.page.route('**/api/chat/*/select-output', async (route) => {
    const request = route.request();
    const body = JSON.parse(request.postData() || '{}');
    const modelName = body.model;

    const selectedChat = {
      _id: this.chatId,
      title: 'Compare models',
      model: modelName,
      models: [modelName],
      messages: [
        { role: 'user', content: 'What is software engineering?' },
        { role: 'assistant', content: `Mocked response 2 from ${modelName}`, model: modelName }
      ]
    };

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(selectedChat)
    });
  });

  await this.page.route('**/api/chat', async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (method === 'GET' && url.endsWith('/api/chat')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
      return;
    }

    if (method === 'POST' && url.endsWith('/api/chat/new')) {
      const mockChat = {
        _id: this.chatId,
        title: 'New Chat',
        model: 'llama3.2:latest',
        models: ['llama3.2:latest', 'llama3.1:latest'],
        messages: []
      };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChat)
      });
      return;
    }

    if (method === 'POST' && url.includes(`/api/chat/${this.chatId}`)) {
      const payload = JSON.parse(request.postData() || '{}');
      const { message, models } = payload;
      const mockResult = createMockChat(this.chatId, message, models || ['llama3.2:latest']);

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          responses: mockResult.responses,
          chat: mockResult.chat
        })
      });
      return;
    }

    route.continue();
  });

  await this.page.goto('http://localhost:5173');
  await this.page.evaluate(() => localStorage.setItem('token', 'fake-token'));
  await this.page.reload({ waitUntil: 'networkidle0' });
  await this.page.waitForFunction(() => document.body.innerText.includes('Model selection'));
});

When('I select the following models:', async function (table) {
  const models = table.rows().flat();
  this.currentModels = models;
  for (const model of models) {
    await clickLabelByText(this.page, model);
  }
});

When('I send the message {string}', async function (message) {
  await this.page.waitForSelector('input[placeholder="Type your message..."]');
  await this.page.type('input[placeholder="Type your message..."]', message);
  await clickButtonByText(this.page, 'Send');
  await this.page.waitForFunction(() => document.body.innerText.includes('Mocked response 1'), { timeout: 10000 });
});

Then('I should see model outputs for:', async function (table) {
  const models = table.rows().flat();
  const pageText = await this.page.evaluate(() => document.body.innerText);
  for (const model of models) {
    assert.ok(pageText.includes(model), `Expected page to contain model label ${model}`);
  }
});

Then('I should see a {string} button for each model output', async function (buttonText) {
  const count = await this.page.$$eval('button', (buttons, text) => {
    return buttons.filter((button) => button.textContent.trim() === text).length;
  }, buttonText);

  assert.strictEqual(count, this.currentModels.length, `Expected ${this.currentModels.length} buttons labeled ${buttonText}`);
});

When('I choose the response from {string}', async function (modelName) {
  await this.page.evaluate((modelName) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find((btn) => btn.textContent.trim() === 'Use this answer' && btn.closest('div').innerText.includes(modelName));
    if (!button) {
      throw new Error(`Could not find response button for model ${modelName}`);
    }
    button.click();
  }, modelName);
  await this.page.waitForFunction((name) => document.body.innerText.includes(name) && document.body.innerText.includes('Use a single model response'), {}, modelName);
});

Then('only that model output remains', async function () {
  const messageTexts = await this.page.$$eval('div', (nodes) => {
    return nodes
      .map((node) => node.textContent || '')
      .filter((text) => text.includes('Mocked response'));
  });

  assert.ok(messageTexts.some((text) => text.includes('llama3.1:latest')),
    'Expected selected model label to still appear in chat response');
  assert.ok(messageTexts.every((text) => !text.includes('llama3.2:latest')),
    'Expected other model labels to be removed from chat responses');
});

Then('I should be in single model mode', async function () {
  const dropdownExists = await this.page.$('select#model-select') !== null;
  assert.ok(dropdownExists, 'Expected single model dropdown to be visible');
});
