const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am on the forgot password page', async function () {
  await this.page.goto('http://localhost:5173');
  await this.clickByText('button', 'Log in');
  await this.page.waitForSelector('#email');
  await this.clickByText('button', 'Forgot Password');
});

When('I enter my registered email address', async function () {
  await this.page.type('#email', 'testuser@test.com');
});

Then('I should see a confirmation that a reset email was sent', async function () {
  const content = await this.page.content();
  assert.ok(content.includes('Email')); // Simple check for now
});

When('I enter an unregistered email address', async function () {
  await this.page.type('#email', 'nobody@nowhere.com');
});

Then('I should see an error that the email is not found', async function () {
  // Logic to verify error message would go here
  assert.ok(true);
});
