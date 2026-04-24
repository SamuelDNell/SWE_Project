const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am logged in and on the home page', async function () {
  const uniqueId = Date.now() + Math.floor(Math.random() * 1000);
  const user = `user_${uniqueId}`;
  const email = `email_${uniqueId}@test.com`;

  await this.page.goto('http://localhost:5173');
  
  // Register a fresh user
  await this.clickByText('button', 'Create an account');
  await this.page.waitForSelector('#email');
  await this.page.type('#username', user);
  await this.page.type('#email', email);
  await this.page.type('#password', 'Password123');
  await this.page.type('#confirm', 'Password123');
  await this.clickByText('button', 'Sign Up');

  // Wait for redirect to home
  await this.page.waitForSelector('input[placeholder="Type your message..."]', { timeout: 30000 });
});

Given('I select "Compare 3 LLMs" from the model dropdown', async function () {
  await this.page.waitForSelector('select');
  await this.page.select('select', 'compare');
});

When('I enter {string} and press send', async function (message) {
  await this.page.waitForSelector('input[placeholder="Type your message..."]');
  await this.page.type('input[placeholder="Type your message..."]', message);
  // Use more specific selector for the send button
  await this.page.click('button[class*="sendBtn"]');
});

Then('I should see a generating message for multiple responses', async function () {
  // Wait for the text to actually appear in the DOM
  await this.page.waitForFunction(
    () => document.body.innerText.includes('Generating multiple responses...'),
    { timeout: 10000 } // Increased to 10s
  );
});

Then('I should eventually see three different response options', async function () {
  // Give it time to generate - 60s matching the global timeout
  await this.page.waitForSelector('h3', { timeout: 60000 });
  const content = await this.page.evaluate(() => document.body.innerText);
  assert.ok(content.includes('Choose the best response:'));
  
  const cards = await this.page.$$('[class*="optionCard"]');
  assert.strictEqual(cards.length, 3);
});

Then('each option should display its model name', async function () {
  const headers = await this.page.$$('[class*="optionHeader"]');
  assert.strictEqual(headers.length, 3);
  for (const header of headers) {
    const text = await this.page.evaluate(el => el.textContent, header);
    assert.ok(text.length > 0);
  }
});

Given('I have sent a message in Compare Mode', async function () {
  await this.page.waitForSelector('select');
  await this.page.select('select', 'compare');
  await this.page.type('input[placeholder="Type your message..."]', 'Test comparison');
  await this.page.click('button[class*="sendBtn"]');
});

Given('three response options are displayed', async function () {
  await this.page.waitForSelector('h3', { timeout: 60000 });
});

When('I click "Select this response" on the first option', async function () {
  const selectButtons = await this.page.$$('button');
  for (const btn of selectButtons) {
    const text = await this.page.evaluate(el => el.textContent, btn);
    if (text.includes('Select this response')) {
      await btn.click();
      return;
    }
  }
  throw new Error('Select button not found');
});

Then('the comparison grid should disappear', async function () {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const grid = await this.page.$('[class*="optionsGrid"]');
  assert.strictEqual(grid, null);
});

Then('the selected response should be added to the main chat history', async function () {
  // Wait for the assistant message to appear in the history
  // Use multiple attribute selectors to match hashed classes correctly
  await this.page.waitForSelector('[class*="message"][class*="assistant"]', { timeout: 10000 });
  const assistantMessages = await this.page.$$('[class*="message"][class*="assistant"]');
  assert.ok(assistantMessages.length > 0);
});

Then('the model name of the selected response should be visible above it', async function () {
  // Wait for the model label to appear
  await this.page.waitForSelector('[class*="messageModel"]', { timeout: 5000 });
  const modelLabel = await this.page.$('[class*="messageModel"]');
  assert.ok(modelLabel !== null);
});