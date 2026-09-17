import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openMemoryApp } from './memory-app.mjs';
const { chromium } = await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const app = await openMemoryApp(browser);
try {
  const page = await app.context.newPage(); await page.goto(app.url);
  const button = name => page.getByRole('button', { name, exact: true }).click();
  await button('Drills'); await page.locator('.drill-table-row').first().click(); await button('Run drill');
  const safety = page.getByRole('checkbox', { name: 'I have cleared a safe practice area.' });
  if (await safety.count()) { await safety.check(); await button('Continue'); }
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor(); await page.keyboard.press('h');
  await page.evaluate(async () => { globalThis.qaAudio = (await import('/src/engine/audio/AudioCueEngine.ts')).practiceAudio; });
  await page.waitForFunction(() => globalThis.qaAudio.metrics.dispatches.length >= 3);
  const before = await page.evaluate(() => globalThis.qaAudio.metrics);
  assert(before.dispatches.some(event => event.id.startsWith('contact')));
  assert.equal(new Set(before.dispatches.map(event => event.id)).size, before.dispatches.length);
  // Browser-controlled visibility input exercises the actual installed listener.
  // This is not a claim about OS background throttling or an iPhone interrupt.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor(); await page.waitForTimeout(150);
  const hidden = await page.evaluate(() => globalThis.qaAudio.metrics);
  assert.equal(hidden.playback, 'paused'); assert.equal(hidden.voices, 0); assert.equal(hidden.convolvers, 0);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  assert(await page.getByRole('button', { name: 'Resume', exact: true }).isVisible());
  await button('Resume'); await page.waitForFunction(count => globalThis.qaAudio.metrics.dispatches.length > count, hidden.dispatches.length);
  const resumed = await page.evaluate(() => globalThis.qaAudio.metrics);
  assert.equal(new Set(resumed.dispatches.map(event => event.id)).size, resumed.dispatches.length);
  await button('Exit'); await page.waitForTimeout(150);
  const idle = await page.evaluate(() => globalThis.qaAudio.metrics); assert.equal(idle.decodedBytes, 0);
  assert.deepEqual(app.mediaRequests, []);
  await writeFile('tmp/audio-memory-drill-lifecycle.json', JSON.stringify({ passed: true, before, hidden, resumed, idle, visibilityMethod: 'controlled document.hidden event; real React listener and audio graph', mediaRequests: app.mediaRequests }, null, 2));
  console.log('Actual drill dispatch and controlled visibility lifecycle passed.');
} finally { await app.close(); await browser.close(); }
