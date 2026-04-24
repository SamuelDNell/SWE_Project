const puppeteer = require('puppeteer');

async function runDemo() {
  const browser = await puppeteer.launch({ 
    headless: false,  
    slowMo: 60       
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Generate a unique ID so we can create a fresh account every run
  const uniqueId = Date.now().toString().slice(-4);
  const testUser = `testuser_${uniqueId}`;
  const testEmail = `testuser_${uniqueId}@test.com`;
  const testPass = `Password123`;

  async function clickByText(tag, text) {
    const elements = await page.$$(tag);
    for (const element of elements) {
      const content = await page.evaluate(el => el.textContent || '', element);
      if (content.trim().toLowerCase().includes(text.toLowerCase())) {
        await element.click();
        return;
      }
    }
    throw new Error(`Could not find <${tag}> containing text '${text}'`);
  }

  // Step 1: Go to landing page
  console.log("Navigating to landing page...");
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 1500));

  // Step 2: Sign Up (New Account)
  console.log(`Creating new account: ${testUser}...`);
  await clickByText('button', 'Create an account');
  await page.waitForSelector('#username');
  
  await page.type('#username', testUser);
  await new Promise(r => setTimeout(r, 500));
  await page.type('#email', testEmail);
  await new Promise(r => setTimeout(r, 500));
  await page.type('#password', testPass);
  await new Promise(r => setTimeout(r, 500));
  await page.type('#confirm', testPass);
  await new Promise(r => setTimeout(r, 1000));
  
  console.log("Submitting registration...");
  await clickByText('button', 'Sign Up');
  
  // Wait for redirect to home
  console.log("Waiting for home page...");
  await page.waitForSelector('input[placeholder="Type your message..."]');
  await new Promise(r => setTimeout(r, 1500));

  // Step 3: Test Multi-Chat Comparison
  console.log("Switching to Compare Mode...");
  await page.select('select', 'compare');
  await new Promise(r => setTimeout(r, 1000));

  console.log("Typing message for comparison...");
  await page.type('input[placeholder="Type your message..."]', 'What are the three laws of robotics?');
  await new Promise(r => setTimeout(r, 1000));

  console.log("Sending message...");
  await clickByText('button', 'Send');

  console.log("Waiting for LLM comparisons (this may take a moment)...");
  await page.waitForSelector('h3', { timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));

  // Step 4: Select a response
  console.log("Selecting the first model's response...");
  await clickByText('button', 'Select this response');
  
  console.log("Verifying selection was added to chat...");
  await new Promise(r => setTimeout(r, 2000));

  const modelLabelExists = await page.evaluate(() => {
    return document.body.innerText.toLowerCase().includes('mistral') || 
           document.body.innerText.toLowerCase().includes('llama') ||
           document.body.innerText.toLowerCase().includes('phi');
  });

  if (modelLabelExists) {
    console.log("Multi-chat demo passed successfully!");
  } else {
    console.log("Demo finished, but model labels were not detected.");
  }

  console.log("Demo complete!");
  await browser.close();
}

runDemo();