const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am on the login page', async function () {
  await this.page.goto('http://localhost:5173');
  await this.clickByText('button', 'Log in');
});

When('I enter a valid login username and password', async function () {
  const uniqueId = "login_" + Date.now();
  const email = `${uniqueId}@test.com`;
  
  // Create user first via API or UI to ensure they exist
  await this.page.goto('http://localhost:5173');
  await this.clickByText('button', 'Create an account');
  await this.page.waitForSelector('#email');
  await this.page.type('#username', uniqueId);
  await this.page.type('#email', email);
  await this.page.type('#password', 'Password123');
  await this.page.type('#confirm', 'Password123');
  await this.clickByText('button', 'Sign Up');
  await this.page.waitForSelector('input[placeholder="Type your message..."]');

  // Now logout and go back to login page to perform the actual login test
  await this.clickByText('button', 'Logout');
  await this.page.waitForSelector('button');
  await this.clickByText('button', 'Log in');
  await this.page.waitForSelector('#email');
  await this.page.type('#email', email);
  await this.page.type('#password', 'Password123');
});

// Then('I should be logged in', async function () {
//   // Logic to verify success would go here
//   assert.ok(true);
// });

Then('I should be logged in', async function () {
  await this.clickByText('button', 'Log In');

  // wait for home page to load
  await this.page.waitForSelector('input[placeholder="Type your message..."]', { timeout: 10000 });

  // check that we are no longer on the login page (email field should be gone)
  const emailExists = await this.page.$('#email') !== null;

  if (emailExists) {
    throw new Error('Still on login page');
  }
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
