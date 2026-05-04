const puppeteer = require('puppeteer');
const path = require('path');
const { spawnSync } = require('child_process');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 40,
    args: ['--window-size=1280,800', '--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // ── Recording ────────────────────────────────────────────────────────────────
  const recorder = await page.screencast({ path: 'demo_recording.webm' });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const delay = (ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);

  const clickByText = async (tag, text) => {
    const els = await page.$$(tag);
    for (const el of els) {
      const content = await page.evaluate((e) => e.textContent || '', el);
      if (content.trim().toLowerCase().includes(text.toLowerCase())) {
        await el.click();
        return;
      }
    }
    throw new Error(`Could not find <${tag}> containing "${text}"`);
  };

  const waitForResponse = (timeout = 120000) =>
    page.waitForResponse(
      (r) => r.url().includes('/api/chat/') && r.request().method() === 'POST',
      { timeout }
    );

  const typeMessage = async (text) => {
    const input = await page.waitForSelector('input[placeholder="Type your message..."]');
    await input.click({ clickCount: 3 });
    await input.type(text, { delay: 30 });
  };

  const sendAndWait = async () => {
    const responsePromise = waitForResponse();
    await clickByText('button', 'Send');
    console.log('Message sent — waiting for API response...');
    const response = await responsePromise;
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Chat API failed ${response.status()}: ${body.substring(0, 500)}`);
    }
    console.log('Response received:', response.status());
    await delay(2000);
  };

  // ── Ensure compare mode is active ────────────────────────────────────────────
  const ensureCompareMode = async () => {
    const inCompare = await page.evaluate(() =>
      !!Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Switch to single model')
      )
    );
    if (!inCompare) {
      await clickByText('button', 'Switch to compare mode');
      await delay(500);
      console.log('Switched to compare mode');
    } else {
      console.log('Already in compare mode');
    }
  };

  // ── Ensure single model mode is active ───────────────────────────────────────
  const ensureSingleMode = async () => {
    const inCompare = await page.evaluate(() =>
      !!Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Switch to single model')
      )
    );
    if (inCompare) {
      await clickByText('button', 'Switch to single model');
      await delay(500);
      console.log('Switched to single model mode');
    } else {
      console.log('Already in single model mode');
    }
  };

  // ── Set compare mode checkboxes to exactly the desired models ────────────────
  const selectCompareModels = async (targetLabels) => {
    await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
    await page.$$eval(
      'label',
      (labels, targets) => {
        labels.forEach((label) => {
          const input = label.querySelector('input[type="checkbox"]');
          if (!input) return;
          const text = label.textContent.replace(/\s+/g, ' ').trim();
          const shouldCheck = targets.some((t) => text.toLowerCase().includes(t.toLowerCase()));
          if (shouldCheck && !input.checked) label.click();
          if (!shouldCheck && input.checked) label.click();
        });
      },
      targetLabels
    );
    await delay(500);
    const selected = await page.evaluate(() =>
      Array.from(document.querySelectorAll('label'))
        .filter((l) => l.querySelector('input[type="checkbox"]')?.checked)
        .map((l) => l.textContent.replace(/\s+/g, ' ').trim())
    );
    console.log('Active compare models:', selected);
  };

  // ── Select a single model from the dropdown ───────────────────────────────────
  const selectSingleModel = async (modelValue) => {
    const select = await page.waitForSelector('select', { timeout: 5000 });
    await select.select(modelValue);
    await delay(400);
    console.log('Single model set to:', modelValue);
  };

  try {
    // ════════════════════════════════════════════════════════════════
    // LOGIN
    // ════════════════════════════════════════════════════════════════
    console.log('\n── Navigating to app ──');
    await page.goto('http://localhost:5173');
    await delay(1000);

    await clickByText('button', 'Log in');
    await page.waitForSelector('#email');
    await delay(500);

    await page.type('#email', 'test@gmail.com', { delay: 60 });
    await page.type('#password', 'password', { delay: 60 });
    await delay(400);

    await clickByText('button', 'Log In');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
    await delay(1500);

    await page.waitForFunction(
      () => document.body.innerText.includes('Model selection'),
      { timeout: 12000 }
    );
    console.log('Logged in — home page loaded');

    // ════════════════════════════════════════════════════════════════
    // CHAT 1 — COMPARE MODE: Groq vs Ollama llama3.2
    // ════════════════════════════════════════════════════════════════
    console.log('\n── Chat 1: Compare mode (Groq vs llama3.2) ──');

    await clickByText('button', '+ New Chat');
    await delay(1200);

    await ensureCompareMode();

    // Select exactly: Groq Llama 3.3 70B and llama3.2:latest
    await selectCompareModels(['Groq Llama 3.3 70B', 'llama3.2:latest']);

    await typeMessage('What is the difference between Python and JavaScript, and when would you use each one?');
    await sendAndWait();

    // Wait for both model labels to appear in the chat
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return (text.includes('Groq') || text.includes('Python')) && text.includes('Use this answer');
      },
      { timeout: 120000 }
    );
    console.log('Chat 1 complete — both model responses visible');
    await delay(3000);

    // ════════════════════════════════════════════════════════════════
    // CHAT 2 — Document question (llama3.2:latest)
    // ════════════════════════════════════════════════════════════════
    console.log('\n── Chat 2: Document upload + question (llama3.2) ──');

    await clickByText('button', '+ New Chat');
    await delay(1200);

    await ensureSingleMode();
    await selectSingleModel('ollama:llama3.2:latest');

    // Upload the sample document
    console.log('Uploading document...');
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(path.resolve(__dirname, 'sample_document.txt'));
    await delay(4000); // wait for upload + embedding

    const docVisible = await page.evaluate(() =>
      document.body.innerText.includes('sample_document.txt')
    );
    console.log('Document visible in UI:', docVisible);

    await typeMessage('According to the document, who teaches CS 416 and when is its final exam?');
    await sendAndWait();
    await page.waitForFunction(
      () => {
        const msgs = document.querySelectorAll('[class*="messageContent"]');
        return msgs.length >= 2;
      },
      { timeout: 60000 }
    );
    console.log('Document question answered');
    await delay(3000);

    // ════════════════════════════════════════════════════════════════
    // CHAT 3 — Weather tool (llama3.2:latest, fresh context)
    // ════════════════════════════════════════════════════════════════
    console.log('\n── Chat 3: Weather in Tokyo (llama3.2) ──');

    await clickByText('button', '+ New Chat');
    await delay(1200);

    await ensureSingleMode();
    await selectSingleModel('ollama:llama3.2:latest');

    await typeMessage('What is the current weather in Tokyo?');
    await sendAndWait();
    await page.waitForFunction(
      () => {
        const msgs = Array.from(document.querySelectorAll('[class*="messageContent"]'));
        const last = msgs[msgs.length - 1];
        return last && (
          last.innerText.includes('°F') ||
          last.innerText.includes('Tokyo') ||
          last.innerText.includes('temperature') ||
          last.innerText.includes('weather')
        );
      },
      { timeout: 60000 }
    );
    console.log('Weather response received');
    await delay(3000);

    // ════════════════════════════════════════════════════════════════
    // CHAT 4 — Math tool (llama3.2:latest, fresh context)
    // ════════════════════════════════════════════════════════════════
    console.log('\n── Chat 4: Derivative of 6x³ + 9x + 2 (llama3.2) ──');

    await clickByText('button', '+ New Chat');
    await delay(1200);

    await ensureSingleMode();
    await selectSingleModel('ollama:llama3.2:latest');

    await typeMessage('What is the derivative of 6x^3 + 9x + 2?');
    await sendAndWait();
    await page.waitForFunction(
      () => {
        const msgs = Array.from(document.querySelectorAll('[class*="messageContent"]'));
        const last = msgs[msgs.length - 1];
        return last && (
          last.innerText.includes('18') ||
          last.innerText.includes('x^2') ||
          last.innerText.includes('x²') ||
          last.innerText.includes('derivative')
        );
      },
      { timeout: 60000 }
    );
    console.log('Math response received');
    await delay(3000);

    console.log('\n✓ All test scenarios completed successfully');

  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    await page.screenshot({ path: 'test_failure.png' });
  } finally {
    await delay(1000);
    await recorder.stop();
    console.log('Recording saved to demo_recording.webm — converting to MP4...');
    spawnSync('ffmpeg', ['-y', '-i', 'demo_recording.webm', '-c:v', 'libx264', '-preset', 'fast', '-movflags', '+faststart', 'demo_recording.mp4'], { stdio: 'inherit' });
    console.log('MP4 saved to demo_recording.mp4');
    await browser.close();
  }
})();
