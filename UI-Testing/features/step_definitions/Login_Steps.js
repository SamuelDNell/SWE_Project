const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am on the login page', async function () {
  await this.gotoPath('/login');
});

When('I enter a valid login username and password', async function () {
  await this.clearAndType('#email', this.testEmail);
  await this.clearAndType('#password', this.testPassword);
});

Then('I should be logged in', async function () {
  await this.clickByText('button', 'Log In');
  await this.page.waitForFunction(
    () => window.location.pathname === '/home',
    { timeout: 60000 }
  );

  const bodyText = await this.page.evaluate(() => document.body.innerText);
  assert.ok(bodyText.includes('Knightly AI Assistant'));
});

When('I enter a valid username and invalid password', async function () {
  await this.clearAndType('#email', this.testEmail);
  await this.clearAndType('#password', 'definitely-wrong-password');
  this.dialogPromise = new Promise((resolve) => this.page.once('dialog', resolve));
  await this.clickByText('button', 'Log In');
});

Then('I should see an incorrect password error message', async function () {
  const dialog = await this.dialogPromise;
  assert.ok(dialog.message().toLowerCase().includes('invalid credentials'));
  await dialog.accept();
});

When('I enter an invalid username', async function () {
  await this.clearAndType('#email', 'invalid@example.com');
  await this.clearAndType('#password', this.testPassword);
  this.dialogPromise = new Promise((resolve) => this.page.once('dialog', resolve));
  await this.clickByText('button', 'Log In');
});

Then('I should see a invalid username error message', async function () {
  const dialog = await this.dialogPromise;
  assert.ok(dialog.message().toLowerCase().includes('invalid credentials'));
  await dialog.accept();
});

When('I do not enter a username or password', async function () {
  this.dialogPromise = new Promise((resolve) => this.page.once('dialog', resolve));
  await this.clickByText('button', 'Log In');
});

Then('I should see a missing credentials error message', async function () {
  const dialog = await this.dialogPromise;
  assert.ok(dialog.message().toLowerCase().includes('invalid credentials'));
  await dialog.accept();
});
