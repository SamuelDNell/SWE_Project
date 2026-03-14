const puppeteer = require('puppeteer');

async function runDemo() {
  const browser = await puppeteer.launch({ 
    headless: false,  // shows the browser so you can see it for the video
    slowMo: 150       // slows down actions so they're visible
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  //Step 1: Go to landing page
  console.log("Navigating to landing page...");
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));

  //Step 2: Navigate to signup page
  console.log("Navigating to signup page...");
  await page.goto('http://localhost:5173/create-account');
  await new Promise(r => setTimeout(r, 2000));

  //Step 3: Fill in signup form
  console.log("Filling in signup form...");
  //await page.waitForSelector('#email');
  await page.type('#email', 'testuser1@test.com');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('#password', 'Password123');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('#confirm', 'Password123');
  await new Promise(r => setTimeout(r, 2000));

  //Step 4: Navigate to login page
  console.log("Navigating to login page...");
  await page.goto('http://localhost:5173/login');
  await new Promise(r => setTimeout(r, 2000));

  //Step 5: Fill in login form
  console.log("Filling in login form...");
  //await page.waitForSelector('#email');
  await page.type('#email', 'testuser1@test.com');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('#password', 'Password123');
  await new Promise(r => setTimeout(r, 2000));

  console.log("Demo complete!");
  await browser.close();
}

runDemo();