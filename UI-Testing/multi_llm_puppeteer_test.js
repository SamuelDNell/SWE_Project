const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false }); // Set to true for headless mode
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', msg => {
    console.log('PAGE LOG:', msg.text());
  });

  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/chat/') && response.request().method() === 'POST') {
      console.log('API RESPONSE:', response.status(), url);
      if (!response.ok()) {
        const text = await response.text();
        console.log('API ERROR BODY:', text.substring(0, 1000));
      }
    }
  });

  const clickByText = async (tag, text) => {
    const elements = await page.$$(tag);
    for (const element of elements) {
      const content = await page.evaluate(el => el.textContent || '', element);
      if (content.trim().toLowerCase().includes(text.toLowerCase())) {
        await element.click();
        return;
      }
    }
    throw new Error(`Could not find <${tag}> containing text '${text}'`);
  };

  try {
    // Navigate to the landing page
    await page.goto('http://localhost:5173');
    await clickByText('button', 'Log in');

    // Wait for login form
    await page.waitForSelector('#email');
    await page.type('#email', 'puppeteer@gmail.com');
    await page.type('#password', 'password');
    await clickByText('button', 'Log In');

    // Wait for navigation to home page
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Check if login succeeded
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    if (!currentUrl.includes('/home') && !currentUrl.includes('localhost:5173') && !page.url().endsWith('/')) {
      throw new Error('Login failed, not redirected to home page');
    }

    // Take screenshot to see current state
    await page.screenshot({ path: 'after_login.png' });
    console.log('Screenshot saved: after_login.png');

    // Check for error or security messages
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('Page content after login:', pageText.substring(0, 500));
    
    if (pageText.includes('Error') || pageText.includes('error') || pageText.includes('security') || pageText.includes('Security')) {
      console.log('Potential error/security message detected:', pageText);
      await page.screenshot({ path: 'security_message.png' });
    }

    // Wait a bit for page to fully load
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    // Ensure we're on the home page and model selector is visible
    try {
      await page.waitForFunction(() => document.body.innerText.includes('Model selection'), { timeout: 10000 });
    } catch (error) {
      console.log('Timeout waiting for Model selection');
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Current page text:', bodyText);
      throw error;
    }

    // Start a new chat to clear any previous state
    console.log('Starting new chat...');
    await clickByText('button', 'New Chat');
    console.log('New chat started');
    
    // Wait for page to update
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

    // Click "Switch to compare mode" button if needed
    console.log('Checking if we need to switch to compare mode...');
    const isInCompareMode = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent.includes('Switch to single model')
      );
      return !!button;
    });
    
    if (isInCompareMode) {
      console.log('Already in compare mode');
    } else {
      console.log('Switching to compare mode...');
      await clickByText('button', 'Switch to compare mode');
      console.log('Switched to compare mode');
    }

    // Wait for checkboxes to appear
    await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
    console.log('Checkboxes visible');

    const checkboxStatesBefore = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('label')).map(label => {
        const input = label.querySelector('input[type="checkbox"]');
        const text = label.textContent.replace(/\s+/g, ' ').trim();
        return { text, checked: !!input?.checked };
      });
    });
    console.log('Checkboxes before selection:', checkboxStatesBefore);

    // Ensure the target models are selected without toggling already-checked boxes
    const targetModels = ['tinyllama:latest', 'llama3.2:latest'];
    await page.$$eval('label', (labels, targetModels) => {
      const normalize = txt => txt.replace(/\s+/g, ' ').trim();
      labels.forEach(label => {
        const text = normalize(label.textContent);
        const input = label.querySelector('input[type="checkbox"]');
        if (!input) return;
        const shouldBeChecked = targetModels.some(target => text.includes(target));
        if (shouldBeChecked && !input.checked) {
          label.click();
        }
      });
    }, targetModels);

    const selectedLabels = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('label')).
        filter(label => {
          const input = label.querySelector('input[type="checkbox"]');
          return input && input.checked;
        }).
        map(label => label.textContent.replace(/\s+/g, ' ').trim());
    });
    console.log('Selected model labels:', selectedLabels);
    console.log('Models selected (tinyllama and llama3.2)');

    // Type the message
    await page.waitForSelector('input[placeholder="Type your message..."]');
    await page.type('input[placeholder="Type your message..."]', 'tell me about large language models.');

    // Send the message
    await clickByText('button', 'Send');
    console.log('Message sent');

    // Wait for the backend chat POST to complete and capture the response
    const chatResponse = await page.waitForResponse(response =>
      response.url().includes('/api/chat/') && response.request().method() === 'POST',
      { timeout: 60000 }
    );
    console.log('Chat response status:', chatResponse.status());
    const chatResponseBody = await chatResponse.text();
    console.log('Chat response body:', chatResponseBody.substring(0, 1000));
    if (!chatResponse.ok()) {
      await page.screenshot({ path: 'chat_api_error.png' });
      throw new Error(`Chat API failed with status ${chatResponse.status()}`);
    }

    // Wait for responses to appear in the UI
    try {
      await page.waitForFunction(() => {
        const text = document.body.innerText;
        const hasTinyllama = text.includes('tinyllama');
        const hasLlama3 = text.includes('llama3.2');
        const hasButton = text.includes('Use this answer');
        return hasTinyllama && hasLlama3 && hasButton;
      }, { timeout: 60000 });
      console.log('Test passed: Messages sent and responses received from both models.');
    } catch (error) {
      console.log('Error waiting for responses in UI');
      await page.screenshot({ path: 'waiting_for_responses_error.png' });
      throw error;
    }

    // Optional: Take a screenshot
    await page.screenshot({ path: 'multi_llm_test_result.png' });
    console.log('Final screenshot saved: multi_llm_test_result.png');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();