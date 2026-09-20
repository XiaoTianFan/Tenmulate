/** Actual dev gameplay: authoritative-clock dispatch timing and UI lifecycle. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { openMemoryApp } from './memory-app.mjs';
if (process.env.AUDIO_BROWSER_TESTS !== 'explicitly-authorized') {
  throw new Error('Browser media tests are paused at the owner request after IDM popups. Obtain explicit reauthorization before setting AUDIO_BROWSER_TESTS=explicitly-authorized.');
}
const { chromium } = await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.AUDIO_BROWSER || 'msedge', headless: true });
const app = await openMemoryApp(browser);
try {
  const page = await app.context.newPage();
  page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(app.url);
  await page.getByRole('button', { name: 'Start practice', exact: true }).waitFor({ timeout: 30000 });
  await page.locator('summary').filter({ hasText: 'Practice set' }).click();
  await page.getByRole('slider', { name: 'Repetitions', exact: true }).fill('15');
  await page.getByRole('slider', { name: 'Rest', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  const safety = page.getByRole('checkbox', { name: 'I have cleared a safe practice area.' });
  if (await safety.count()) { await safety.check(); await page.getByRole('button', { name: 'Continue', exact: true }).click(); }
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  await page.keyboard.press('h');
  await page.evaluate(async () => { globalThis.audioUnderTest = (await import('/src/engine/audio/AudioCueEngine.ts')).practiceAudio; });
  await page.waitForFunction(() => globalThis.audioUnderTest.getSnapshot() === 'ready');
  console.log('Memory-only gameplay ready; media requests:', app.mediaRequests.length);
  const metrics = () => page.evaluate(() => globalThis.audioUnderTest.metrics);
  const button = name => page.getByRole('button', { name, exact: true }).click();
  await button('Slower playback'); await button('Slower playback');
  const rates = [];
  for (const rate of [.5, .75, 1, 1.25]) {
    const before = (await metrics()).dispatches.length;
    await page.waitForFunction(count => globalThis.audioUnderTest.metrics.dispatches.length >= count + 30, before, { timeout: 240000 });
    const current = await metrics(), events = current.dispatches.slice(before);
    const delays = events.map(event => event.latencyMs).sort((a, b) => a - b);
    const report = { rate, events, p95Ms: delays[Math.floor(delays.length * .95)], maxMs: delays.at(-1), baseLatency: current.baseLatency, outputLatency: current.outputLatency };
    rates.push(report); console.log(JSON.stringify({ rate, count: events.length, p95Ms: report.p95Ms, maxMs: report.maxMs }));
    assert(report.p95Ms <= 40, `Rate ${rate}: p95 ${report.p95Ms} exceeds 40 ms`);
    assert.equal(new Set(events.map(event => event.id)).size, events.length, 'No duplicate dispatches');
    if (rate !== 1.25) { await button('Restart set'); await button('Faster playback'); }
  }
  await button('Pause'); await page.waitForTimeout(150);
  const paused = await metrics(); assert.equal(paused.voices, 0);
  for (const action of ['Next repetition', 'Previous repetition']) {
    await button(action); await page.waitForTimeout(150);
    assert.equal((await metrics()).dispatches.length, paused.dispatches.length, 'Seek must not play crossed impacts');
  }
  await button('Resume'); await page.waitForTimeout(1800);
  const resumed = await metrics(); assert(resumed.dispatches.length > paused.dispatches.length);
  await button('Restart set'); await page.waitForTimeout(2800);
  const restarted = await metrics(); assert(restarted.dispatches.length > 0);
  assert.equal(new Set(restarted.dispatches.map(event => event.id)).size, restarted.dispatches.length);
  await button('Exit'); await page.waitForTimeout(150);
  const setup = await metrics(); assert.equal(setup.playback, 'playing', 'Exit returns to audible setup preview');
  await button('Mute all sound'); await page.waitForTimeout(150);
  const idle = await metrics(); assert.equal(idle.voices, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(app.mediaRequests, []);
  const report = { passed: true, browser: await page.evaluate(() => navigator.userAgent), transport: 'memory-only audio; browser offline', mediaRequests: app.mediaRequests, rates, paused, resumed, restarted, idle, errors };
  await mkdir('tmp/audio-ui', { recursive: true }); await writeFile('tmp/audio-gameplay-result.json', JSON.stringify(report, null, 2));
  console.log('Gameplay timing and UI lifecycle passed.');
} finally { await app.close(); await browser.close(); }
