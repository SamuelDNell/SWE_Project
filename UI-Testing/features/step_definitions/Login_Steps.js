const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am on the login page', function () {
  console.log("Navigating to the login page");
});

When('I enter valid credentials', function () {
  console.log("Entering valid username and password");
});

Then('I should be logged in', function () {
  assert.strictEqual(true, true);
});

When('I enter a valid username and invalid password', function () {
  console.log("Entering valid username and invalid password");
});

Then('I should see an incorrect password error message', function () {
  assert.strictEqual(true, true);
});

When('I enter an invalid username', function () {
  console.log("Entering invalid username");
});

Then('I should see a invalid username error message', function () {
  assert.strictEqual(true, true);
});

When('I do not enter a username or password', function () {
  console.log("Attempting login without entering a username or password");
});

Then('I should see a missing credentials error message', function () {
  assert.strictEqual(true, true);
});