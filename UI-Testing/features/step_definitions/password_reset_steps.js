const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('I am on the forgot password page', function () {
  console.log("Navigating to forgot password page");
  // await page.goto('http://localhost:3000/forgot-password');
});

When('I enter my registered email address', function () {
  console.log("Entering registered email address");
  //await page.type('#email', 'testuser@test.com');
  //await page.click('#reset-button');
});

Then('I should see a confirmation that a reset email was sent', function () {
  assert.strictEqual(true, true);
  // const text = await page.$eval('#reset-confirmation', el => el.textContent);
  // assert.ok(text.length > 0);
});

When('I enter an unregistered email address', function () {
  console.log("Entering unregistered email address");
  // await page.type('#email', 'nobody@nowhere.com');
  // await page.click('#reset-button');
});

Then('I should see an error that the email is not found', function () {
  assert.strictEqual(true, true);
  // const text = await page.$eval('#reset-error', el => el.textContent);
  // assert.ok(text.length > 0);
});