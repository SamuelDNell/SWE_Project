const puppeteer = require('puppeteer');

async function runDemo() {
  const browser = await puppeteer.launch({ 
    headless: false,  // shows the browser so you can see it for the video
    slowMo: 50       // slows down actions so they're visible
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

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

  //Step 1: Go to landing page
  console.log("Navigating to landing page...");
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));

  //Step 1.5: Click on "Create an account" button
  console.log("Clicking on 'Create an account' button...");
  await clickByText('button', 'Create an account');
  await new Promise(r => setTimeout(r, 1500));

  //Step 2: Fill in signup page

  console.log("Filling in signup form...");
  //await page.waitForSelector('#email');
  await page.type('#username', 'testuser1');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('#email', 'testuser1@test.com');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('#password', 'Password123###');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('#confirm', 'Password123###');
  await new Promise(r => setTimeout(r, 2000));

  //Step 2.5: Go back to landing page and click on "Log in" button
  console.log("Clicking the back button...");
  //await page.goto("http://localhost:5173");
  await clickByText('button', 'Back');
  await new Promise(r => setTimeout(r, 1500));
  console.log("Clicking on 'Log in' button...");
  await clickByText('button', 'Log in');
  await new Promise(r => setTimeout(r, 1500));

  //Step 3: Fill in login page

  console.log("Filling in login form...");
  //await page.waitForSelector('#email');
  await page.type('#email', 'testuser1@test.com');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('#password', 'Password123###');
  await new Promise(r => setTimeout(r, 2000));

  // Step 3.5: Click Forgot Password button from login page
  console.log("Clicking Forgot Password button...");
  await clickByText('button', 'Forgot Password');
  await new Promise(r => setTimeout(r, 1500));

  //Step 4: Fill out forgot password page
  await page.waitForSelector('#email');
  await page.type('#email', 'testuser1@test.com');
  await new Promise(r => setTimeout(r, 1500));

  //Step 5: Reset password page (with fake token to show the page exists)?
  console.log("Navigating to reset password page...");
  await page.goto('http://localhost:5173/reset-password/testtoken123');
  await new Promise(r => setTimeout(r, 1500));
  await page.waitForSelector('#password');
  await page.type('#password', 'NewPassword123###');
  await new Promise(r => setTimeout(r, 500));
  await page.type('#confirmPassword', 'NewPassword123###');
  await new Promise(r => setTimeout(r, 2000));


  console.log("Demo complete!");
  await browser.close();
}

runDemo();