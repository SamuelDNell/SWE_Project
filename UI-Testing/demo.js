const puppeteer = require('puppeteer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const RUN_ID = Date.now();
const DEMO_USERNAME = process.env.DEMO_USERNAME || `group16_demo_${RUN_ID}`; // generate some random run_id
const DEMO_EMAIL = process.env.DEMO_EMAIL || process.env.TEST_EMAIL || `group16_demo_${RUN_ID}@flownue.com`;//every time you do a test, you create a new account every time
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || process.env.TEST_PASSWORD || 'SWEGroup16';

async function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickByText(page, selector, text) {
  const elements = await page.$$(selector);
  for (const element of elements) {
    const content = await page.evaluate((node) => node.textContent || '', element);
    if (content.trim().toLowerCase().includes(text.toLowerCase())) {
      await element.click();
      return;
    }
  }

  throw new Error(`Could not find ${selector} containing "${text}"`);
}

async function clearAndType(page, selector, value) {
  await page.waitForSelector(selector);
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
}

async function waitForText(page, text, timeout = 30000) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    { timeout },
    text
  );
}

async function waitForTextGone(page, text, timeout = 30000) {
  await page.waitForFunction(
    (expected) => !document.body.innerText.includes(expected),
    { timeout },
    text
  );
}

async function loginWithDemoAccount(page) {
  console.log('Logging back in with the same demo account...');
  await clearAndType(page, '#email', DEMO_EMAIL);
  await clearAndType(page, '#password', DEMO_PASSWORD);
  await clickByText(page, 'button', 'Log In');
  await page.waitForFunction(
    () => window.location.pathname === '/home',
    { timeout: 15000 }
  );
}

async function createAccount(page) {
  console.log('Creating a demo account...');
  await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle2' });
  await clickByText(page, 'button', 'Create an account');
  await clearAndType(page, '#username', DEMO_USERNAME);
  await clearAndType(page, '#email', DEMO_EMAIL);
  await clearAndType(page, '#password', DEMO_PASSWORD);
  await clearAndType(page, '#confirm', DEMO_PASSWORD);
  await clickByText(page, 'button', 'Sign Up');

  await page.waitForFunction(
    () => window.location.pathname === '/home',
    { timeout: 15000 }
  );
}

async function runDemo() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 60
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    console.log(`Using demo account ${DEMO_EMAIL}`);
    await createAccount(page);

    console.log('Starting a fresh comparison chat...');
    await clickByText(page, 'button', 'New Chat');
    await page.waitForSelector('textarea');
    await clearAndType(page, 'textarea', 'What is software engineering?');
    await clickByText(page, 'button', 'Send');

    console.log('Waiting for the three model responses...');
    await waitForText(page, 'Model comparison', 120000);
    await waitForText(page, 'llama3.2:latest', 120000);
    await waitForText(page, 'qwen3:latest', 120000);
    await waitForText(page, 'gemma3:4b', 120000);

    const responseButtons = await page.$$eval('button', (buttons) =>
      buttons.filter((button) => button.textContent.includes('Continue with this response')).length
    );

    if (responseButtons === 0) {
      throw new Error('No selectable model response was rendered.');
    }

    console.log('Selecting one model response...');
    await clickByText(page, 'button', 'Continue with this response');
    await waitForText(page, 'Active model:');

    console.log('Sending a follow-up message to the selected model...');
    await clearAndType(page, 'textarea', 'Describe the software development lifecycle.');
    await clickByText(page, 'button', 'Send');
    await waitForText(page, 'Describe the software development lifecycle.', 15000);
    await waitForText(page, 'Thinking with', 15000);
    await waitForTextGone(page, 'Thinking with', 120000);
    await pause(3000);

    console.log('Checking chat history...');
    await clickByText(page, 'button', 'History');
    await page.waitForFunction(
      () => window.location.pathname === '/history',
      { timeout: 10000 }
    );
    await waitForText(page, 'Chat History');
    await waitForText(page, 'Last updated:');

    console.log('Searching chat history for software...');
    await clearAndType(page, 'input[placeholder="Search chats..."]', 'software');
    await clickByText(page, 'button', 'Search');
    await waitForText(page, 'software', 15000);

    console.log('Returning to chat, logging out, and logging back in...');
    await clickByText(page, 'button', 'Back to Chat');
    await page.waitForFunction(
      () => window.location.pathname === '/home',
      { timeout: 15000 }
    );
    await clickByText(page, 'button', 'Logout');
    await page.waitForFunction(
      () => window.location.pathname === '/login',
      { timeout: 15000 }
    );
    await loginWithDemoAccount(page);

    console.log('Demo complete.');
    await pause(2500);
  } finally {
    await browser.close();
  }
}

runDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});
