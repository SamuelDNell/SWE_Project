const { Before, After, setWorldConstructor, setDefaultTimeout } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');

// Set default timeout for all steps (in milliseconds)
setDefaultTimeout(60000);

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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 50 // Add a small delay between actions
  });
  this.page = await this.browser.newPage();

  // Auto-dismiss alerts so they don't hang the tests
  this.page.on('dialog', async dialog => {
    try {
      await dialog.dismiss();
    } catch (e) {
      // Ignore errors if the page is already navigating or closed
    }
  });

  await this.page.setViewport({ width: 1280, height: 720 });
});

After(async function () {
  if (this.browser) {
    await this.browser.close();
  }
});
