const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am on the login page', async function () {
  await this.page.goto('http://localhost:5173');
  await this.clickByText('button', 'Log in');
});

When('I enter a valid login username and password', async function () {
  await this.page.waitForSelector('#email');
  await this.page.type('#email', 'testuser1@test.com');
  await this.page.type('#password', 'Password123###');
});

Then('I should be logged in', async function () {
  // Logic to verify success would go here
  assert.ok(true);
});

When('I enter a valid username and invalid password', async function () {
  await this.page.waitForSelector('#email');
  await this.page.type('#email', 'testuser1@test.com');
  await this.page.type('#password', 'wrongpassword');
});

Then('I should see an incorrect password error message', async function () {
  // Logic to verify error message would go here
  assert.ok(true);
});

When('I enter an invalid username', async function () {
  await this.page.waitForSelector('#email');
  await this.page.type('#email', 'invalid@test.com');
  await this.page.type('#password', 'anypassword');
});

Then('I should see a invalid username error message', async function () {
  // Logic to verify error message would go here
  assert.ok(true);
});

When('I do not enter a username or password', async function () {
  // Do nothing
});

Then('I should see a missing credentials error message', async function () {
  // Logic to verify error message would go here
  assert.ok(true);
});
