const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am on the forgot password page', async function () {
  await this.gotoPath('/login');
  await this.clickByText('button', 'Forgot Password');
  await this.page.waitForSelector('#email');
});

When('I enter my registered email address', async function () {
  await this.clearAndType('#email', this.testEmail);
  await this.clickByText('button', 'Send Reset Link');
});

Then('I should see a confirmation that a reset email was sent', async function () {
  await this.waitForText('Password reset email sent');
  const bodyText = await this.page.evaluate(() => document.body.innerText);
  assert.ok(bodyText.includes('Password reset email sent'));
});

When('I enter an unregistered email address', async function () {
  await this.clearAndType('#email', 'nobody@nowhere.com');
  await this.clickByText('button', 'Send Reset Link');
});

Then('I should see an error that the email is not found', async function () {
  await this.waitForText('User with this email does not exist');
  const bodyText = await this.page.evaluate(() => document.body.innerText);
  assert.ok(bodyText.includes('User with this email does not exist'));
});
