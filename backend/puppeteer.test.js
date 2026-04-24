const puppeteer = require('puppeteer');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: false, slowMo: 60 });
  const page = await browser.newPage();

  const email = `test${Date.now()}@example.com`;
  const username = `user${Date.now()}`;
  const password = "password123";

  console.log("Opening app...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

  await sleep(2000);

  // -------------------------
  // STEP 1: CLICK CREATE ACCOUNT
  // -------------------------
  console.log("Clicking Create Account...");

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.innerText.toLowerCase().includes('create'));
    if (btn) btn.click();
  });

  await page.waitForSelector('#username');

  // -------------------------
  // STEP 2: FILL SIGNUP FORM
  // -------------------------
  console.log("Filling signup...");

  await page.type('#username', username);
  await page.type('#email', email);
  await page.type('#password', password);
  await page.type('#confirm', password);

  // CLICK SIGN UP
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.innerText.toLowerCase().includes('sign up'));
    if (btn) btn.click();
  });

  // WAIT FOR NAVIGATION TO HOME (IMPORTANT)
  await sleep(4000);


  // -------------------------
  // STEP 5: SEND MESSAGE
  // -------------------------
  console.log("Sending message...");

  await page.waitForSelector('input[type="text"]');
  await page.type('input[type="text"]', 'Hello');
  await page.keyboard.press('Enter');

  console.log("Waiting for LLM responses...");

// wait up to 3 minutes for Model responses to appear
await page.waitForFunction(() => {
  return document.body.innerText.includes("Model 1") &&
         document.body.innerText.includes("Model 2") &&
         document.body.innerText.includes("Model 3");
}, { timeout: 180000 }); // 3 minutes

console.log("✅ LLM responses loaded");
await sleep(5000); // small buffer after responses load

  console.log("✅ FULL UI FLOW COMPLETE");
  await browser.close();
})();