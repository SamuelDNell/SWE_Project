const { Before, After, setWorldConstructor, setDefaultTimeout } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');

setDefaultTimeout(90000);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const TEST_EMAIL = process.env.TEST_EMAIL || 'yapowag860@flownue.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SWEGroup16';

class CustomWorld {
  constructor() {
    this.browser = null;
    this.page = null;
    this.frontendUrl = FRONTEND_URL;
    this.testEmail = TEST_EMAIL;
    this.testPassword = TEST_PASSWORD;
    this.lastPrompt = '';
    this.lastSelectedModel = '';
  }

  async clickByText(tag, text) {
    const elements = await this.page.$$(tag);
    for (const element of elements) {
      const content = await this.page.evaluate((node) => node.textContent || '', element);
      if (content.trim().toLowerCase().includes(text.toLowerCase())) {
        await element.click();
        return;
      }
    }

    throw new Error(`Could not find <${tag}> containing text "${text}"`);
  }

  async clearAndType(selector, value) {
    await this.page.waitForSelector(selector);
    await this.page.click(selector, { clickCount: 3 });
    await this.page.type(selector, value);
  }

  async waitForText(text, timeout = 60000) {
    await this.page.waitForFunction(
      (expected) => document.body.innerText.includes(expected),
      { timeout },
      text
    );
  }

  async waitForAnyText(textOptions, timeout = 60000) {
    await this.page.waitForFunction(
      (expectedOptions) => expectedOptions.some((expected) => document.body.innerText.includes(expected)),
      { timeout },
      textOptions
    );
  }

  async gotoPath(path) {
    await this.page.goto(`${this.frontendUrl}${path}`, { waitUntil: 'networkidle2' });
  }

  async loginAsDefaultUser() {
    await this.gotoPath('/login');
    await this.clearAndType('#email', this.testEmail);
    await this.clearAndType('#password', this.testPassword);
    await this.clickByText('button', 'Log In');
    await this.page.waitForFunction(
      () => window.location.pathname === '/home',
      { timeout: 60000 }
    );
  }
}

setWorldConstructor(CustomWorld);

Before(async function () {
  this.browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  this.page = await this.browser.newPage();
  await this.page.setViewport({ width: 1440, height: 900 });
});

After(async function () {
  if (this.browser) {
    await this.browser.close();
  }
});
