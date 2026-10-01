const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3000/admin', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log('URL after nav:', page.url());
  console.log('Errors:', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})();
