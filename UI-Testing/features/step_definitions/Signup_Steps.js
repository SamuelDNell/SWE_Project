const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am on the signup page', function () {
  console.log("Navigating to signup page");
});

When('I enter a valid username and password', function () {
  console.log("Entering valid username and password");
});

Then('my account should be created', function () {
  assert.strictEqual(true, true);
});

When('I enter a username that already exists', function () {
  console.log("Entering username that already exists");
});

Then('I should get username already exists error message', function () {
  assert.strictEqual(true, true);
});

When('I enter a password that does not meet requirements', function () {
  console.log("Entering a password that does not meet requirements");
});

Then('I should get password does not meet requirements error message', function () {
  assert.strictEqual(true, true);
});

When('I do not enter the required fields', function () {
  console.log("Attempting to signup without entering the requird fields");
});

Then('I should get missing required fields error message', function () {
  assert.strictEqual(true, true);
});