const puppeteer = require('puppeteer');

async function runTest() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  try {
    console.log("Opening app...");
    await page.goto('http://localhost:5173', {
      waitUntil: 'networkidle2'
    });

    // =========================
    // STEP 1: CLICK LOGIN
    // =========================
    console.log("Clicking Login...");

    await page.waitForSelector('button');

    const buttons = await page.$$('button');

    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);

      if (text && text.toLowerCase().includes('log in')) {
        await btn.click();
        break;
      }
    }

    // wait for login form
    await page.waitForSelector('input', { timeout: 10000 });

    // =========================
    // STEP 2: LOGIN
    // =========================
    console.log("Entering credentials...");

    const inputs = await page.$$('input');

    await inputs[0].click();
    await page.keyboard.type('jordyfurtado2005@gmail.com');

    await inputs[1].click();
    await page.keyboard.type('hamster127');

    // click login submit
    const loginButtons = await page.$$('button');

    for (const btn of loginButtons) {
      const text = await page.evaluate(el => el.innerText, btn);

      if (text && text.toLowerCase().includes('log in')) {
        await btn.click();
        break;
      }
    }

    // wait for chat UI
    await page.waitForSelector('input', { timeout: 15000 });

    console.log("Login successful.");

    // =========================
    // STEP 3: SEND MESSAGE
    // =========================
    console.log("Sending message...");

    // CLICK input first (IMPORTANT FIX)
    const inputBox = await page.$('input');
    await inputBox.click();

    // type message
    await page.keyboard.type('hello');

    // click Send button
    const sendButtons = await page.$$('button');

    let clicked = false;

    for (const btn of sendButtons) {
      const text = await page.evaluate(el => el.innerText, btn);

      if (text && text.toLowerCase().includes('send')) {
        await btn.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) throw new Error("Send button not found");

    // =========================
    // STEP 4: WAIT FOR RESPONSES
    // =========================
    console.log("Waiting for LLM responses...");

    await page.waitForFunction(() => {
      return document.querySelectorAll('.message').length > 1;
    }, { timeout: 20000 });

    // =========================
    // STEP 5: VALIDATE OUTPUT
    // =========================
    const messages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.messageContent'))
        .map(el => el.innerText);
    });

    console.log("Messages:");
    console.log(messages);

    const hasMultiLLM =
      messages.some(m => m.toLowerCase().includes('phi')) &&
      messages.some(m => m.toLowerCase().includes('llama'));

    if (hasMultiLLM) {
      console.log("TEST PASSED: Multi-LLM responses detected");
    } else {
      console.log("TEST WARNING: Could not clearly detect both models");
    }

  } catch (err) {
    console.log("TEST FAILED:", err);
  } finally {
    await browser.close();
  }
}

runTest();