const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('response', async res => {
    try {
      const status = res.status();
      if (status === 404) {
        const url = res.url();
        console.log('404:', url);
        errors.push({ url, status });
      }
    } catch (e) {
      // ignore
    }
  });

  page.on('pageerror', err => console.log('Page error:', err.message));
  page.on('console', msg => console.log('Console:', msg.text()));

  const url = process.env.FRONTEND_URL || 'http://localhost:3001';
  console.log('Navigating to', url);
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    // wait a bit for background requests
    await page.waitForTimeout(1000);
  } catch (e) {
    console.error('Navigation error:', e.message);
  }

  if (errors.length === 0) console.log('No 404 responses detected');
  await browser.close();
  process.exit(0);
})();
