import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' });
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__testVideoElements = [];
  const original = Document.prototype.createElement;
  Document.prototype.createElement = function (name, options) {
    const element = original.call(this, name, options);
    if (name.toLowerCase() === 'video') window.__testVideoElements.push(element);
    return element;
  };
});
await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?clips=0');
await page.getByTestId('clips-review').waitFor();
await page.waitForTimeout(250);
const sample = await page.evaluate(() => ({
  all: window.__testVideoElements.length,
  detached: window.__testVideoElements.filter(v => !v.isConnected).length,
  mounted: document.querySelectorAll('video').length
}));
console.log('ZERO_CLIP_VIDEO_ELEMENTS', JSON.stringify(sample));
await browser.close();
if (sample.detached > 0) { console.error('FAIL: empty review must not spawn detached decoders'); process.exitCode = 1; }
