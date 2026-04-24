const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

const MODEL_NAMES = ['llama3.2:latest', 'qwen3:latest', 'gemma3:4b'];

async function submitPrompt(world, prompt) {
  world.lastPrompt = prompt;
  await world.page.waitForSelector('textarea');
  await world.clearAndType('textarea', prompt);
  await world.clickByText('button', 'Send');
}

async function waitForMultiModelResponses(world) {
  await world.page.waitForFunction(
    (models) => {
      const pageText = document.body.innerText;
      const hasKnownError =
        pageText.includes('Could not send message') ||
        pageText.includes('Could not connect to server') ||
        pageText.includes('Chat request failed');

      if (hasKnownError) {
        return 'error';
      }

      const articles = Array.from(document.querySelectorAll('article'));
      if (articles.length < 3) {
        return false;
      }

      return models.every((model) => pageText.includes(model)) ? 'ready' : false;
    },
    { timeout: 60000 },
    MODEL_NAMES
  );

  const pageText = await world.page.evaluate(() => document.body.innerText);
  if (
    pageText.includes('Could not send message') ||
    pageText.includes('Could not connect to server') ||
    pageText.includes('Chat request failed')
  ) {
    throw new Error(`The chat UI showed an error instead of 3 response cards:\n${pageText}`);
  }
}

Given('I am logged in and on the home page', async function () {
  await this.loginAsDefaultUser();
});

When('I start a new comparison chat', async function () {
  await this.clickByText('button', 'New Chat');
  await this.page.waitForSelector('textarea');
});

When('I submit a prompt for comparison', async function () {
  const prompt = `Compare this prompt across models ${Date.now()}`;
  await submitPrompt(this, prompt);
});

Then('I should see three model response cards', async function () {
  await waitForMultiModelResponses(this);

  const articleCount = await this.page.$$eval('article', (articles) => articles.length);
  assert.strictEqual(articleCount, 3);
});

Then('each response card should be labeled with its model name', async function () {
  const bodyText = await this.page.evaluate(() => document.body.innerText);
  for (const model of MODEL_NAMES) {
    assert.ok(bodyText.includes(model));
  }
  assert.ok(bodyText.includes(this.lastPrompt));
});

Given('I am logged in and have created a conversation', async function () {
  await this.loginAsDefaultUser();
  await this.clickByText('button', 'New Chat');
  await submitPrompt(this, `History conversation ${Date.now()}`);
  await waitForMultiModelResponses(this);
});

When('I open the chat history page', async function () {
  await this.clickByText('button', 'History');
  await this.page.waitForFunction(
    () => window.location.pathname === '/history',
    { timeout: 15000 }
  );
});

Then('I should see my conversation listed with a title and updated timestamp', async function () {
  await this.waitForText('Chat History');
  await this.waitForText('Last updated:');

  const firstCard = await this.page.$('button[type="button"] h3');
  assert.ok(firstCard);

  const titleText = await this.page.evaluate((element) => element.textContent.trim(), firstCard);
  assert.ok(titleText.length > 0);
});

When('I reopen the conversation from history', async function () {
  await this.clearAndType('input[placeholder="Search chats..."]', this.lastPrompt);
  await this.clickByText('button', 'Search');
  await this.waitForText('Last updated:');

  const conversationButtons = await this.page.$$('button[type="button"]');
  for (const button of conversationButtons) {
    const text = await this.page.evaluate((element) => element.innerText || '', button);
    if (text.includes('Last updated:')) {
      await button.click();
      return;
    }
  }

  throw new Error('Could not find a conversation button to reopen from history.');
});

Then('I should be taken back to the full conversation', async function () {
  await this.page.waitForFunction(
    () => window.location.pathname === '/home',
    { timeout: 15000 }
  );

  const bodyText = await this.page.evaluate(() => document.body.innerText);
  assert.ok(bodyText.includes(this.lastPrompt));
});

Given('I am logged in and have received multiple model responses', async function () {
  await this.loginAsDefaultUser();
  await this.clickByText('button', 'New Chat');
  await submitPrompt(this, `Selected response prompt ${Date.now()}`);
  await waitForMultiModelResponses(this);
});

When('I select one of the successful model responses', async function () {
  const selectedModel = await this.page.$$eval('article', (articles) => {
    for (const article of articles) {
      const status = article.innerText;
      if (status.includes('Succeeded')) {
        const modelText = article.querySelector('p')?.textContent?.trim();
        const button = Array.from(article.querySelectorAll('button')).find((item) =>
          item.textContent.includes('Continue with this response')
        );

        if (modelText && button) {
          button.click();
          return modelText;
        }
      }
    }

    return '';
  });

  if (!selectedModel) {
    throw new Error('Could not select a successful model response.');
  }

  this.lastSelectedModel = selectedModel;
});

Then('the selected model should become active', async function () {
  await this.waitForText('Active model:');
  const bodyText = await this.page.evaluate(() => document.body.innerText);
  assert.ok(bodyText.includes(`Active model: ${this.lastSelectedModel}`));
  await this.waitForText('Selected');
});

When('I send a follow-up message in the selected chat', async function () {
  await submitPrompt(this, `Follow-up after selection ${Date.now()}`);
});

Then('the conversation should continue in single-model mode', async function () {
  await this.waitForText(`Active model: ${this.lastSelectedModel}`);
  await this.waitForText(this.lastPrompt);

  const bodyText = await this.page.evaluate(() => document.body.innerText);
  assert.ok(bodyText.includes(this.lastSelectedModel));

  const responseCardCount = await this.page.$$eval('article', (items) => items.length);
  assert.strictEqual(responseCardCount, 3);
});
