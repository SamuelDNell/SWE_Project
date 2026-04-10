const { Before, After, setWorldConstructor, setDefaultTimeout } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');

// Set default timeout for all steps (in milliseconds)
setDefaultTimeout(10000);

class CustomWorld {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async clickByText(tag, text) {
    const elements = await this.page.$$(tag);
    for (const element of elements) {
      const content = await this.page.evaluate(el => el.textContent || '', element);
      if (content.trim().toLowerCase().includes(text.toLowerCase())) {
        await element.click();
        return;
      }
    }
    throw new Error(`Could not find <${tag}> containing text '${text}'`);
  }
}

setWorldConstructor(CustomWorld);

Before(async function () {
  this.browser = await puppeteer.launch({ 
    headless: "new", // Run in headless mode for CI/clean tests
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  this.page = await this.browser.newPage();
  await this.page.setViewport({ width: 1280, height: 720 });
});

After(async function () {
  if (this.browser) {
    await this.browser.close();
  }
});
