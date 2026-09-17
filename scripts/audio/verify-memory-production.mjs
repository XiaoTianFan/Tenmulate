import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { openMemoryApp } from './memory-app.mjs';
const { chromium } = await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const app = await openMemoryApp(browser, { production: true });
try {
  const page = await app.context.newPage(), errors = [];
  page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(app.url);
  const button = name => page.getByRole('button', { name, exact: true }).click();
  await button('Casting'); await button('Start local capture');
  await page.getByRole('button', { name: 'Stop local capture', exact: true }).waitFor();
  const tracks = await page.evaluate(() => {
    globalThis.qaStream = document.querySelector('video').srcObject;
    return globalThis.qaStream.getTracks().map(track => ({ id: track.id, kind: track.kind }));
  });
  assert.equal(tracks.length, 2);
  await button('Close casting'); await button('Start practice');
  await page.getByRole('checkbox', { name: 'I have cleared a safe practice area.' }).check(); await button('Continue');
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor(); await page.keyboard.press('h');
  await page.evaluate(async () => {
    const context = new AudioContext(); await context.resume();
    const analyser = context.createAnalyser(), source = context.createMediaStreamSource(globalThis.qaStream), silence = context.createGain();
    silence.gain.value = 0; source.connect(analyser).connect(silence).connect(context.destination);
    globalThis.qaMonitor = { context, source, analyser, silence };
    globalThis.qaChunks = [];
    globalThis.qaRecorder = new MediaRecorder(new MediaStream(globalThis.qaStream.getAudioTracks()), { mimeType: 'audio/webm;codecs=opus' });
    globalThis.qaRecorder.ondataavailable = event => globalThis.qaChunks.push(event.data); globalThis.qaRecorder.start();
  });
  await page.waitForTimeout(15000);
  const rms = () => page.evaluate(() => {
    const samples = new Float32Array(globalThis.qaMonitor.analyser.fftSize);
    globalThis.qaMonitor.analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  });
  const audible = await rms(); assert(audible > 1e-7);
  await mkdir('tmp/audio-review', { recursive: true });
  const data = await page.evaluate(async () => {
    await new Promise(resolve => { globalThis.qaRecorder.onstop = resolve; globalThis.qaRecorder.stop(); });
    return Array.from(new Uint8Array(await new Blob(globalThis.qaChunks).arrayBuffer()));
  });
  await writeFile('tmp/audio-review/production-quick-practice.webm', Buffer.from(data));
  await page.screenshot({ path: 'tmp/audio-review/production-quick.png' });
  await button('Mute all sound'); await page.waitForTimeout(200); const muted = await rms(); assert(muted < 1e-4);
  await button('Unmute all sound'); await page.waitForTimeout(200); assert(await rms() > 1e-7);
  await button('Pause'); await page.waitForTimeout(200); const paused = await rms(); assert(paused < 1e-4);
  await button('Settings'); await page.getByRole('checkbox', { name: 'Crowd sound', exact: true }).uncheck();
  assert(await page.getByRole('slider', { name: 'Crowd volume', exact: true }).isDisabled());
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('slider', { name: '观众音量', exact: true }).waitFor();
  await page.screenshot({ path: 'tmp/audio-review/production-mobile-zh.png' });
  await page.getByRole('combobox', { name: '语言', exact: true }).selectOption('en');
  await page.setViewportSize({ width: 1365, height: 900 }); await button('Close settings'); await button('Exit');
  await button('Drills'); await page.locator('.drill-table-row').first().click(); await button('Run drill');
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor(); await page.keyboard.press('h');
  await page.waitForTimeout(8000); const drillRms = await rms(); assert(drillRms > 1e-7);
  await page.screenshot({ path: 'tmp/audio-review/production-drill.png' });
  const retained = await page.evaluate(() => globalThis.qaStream.getTracks().map(track => ({ id: track.id, kind: track.kind, state: track.readyState })));
  assert.deepEqual(retained.map(({ id, kind }) => ({ id, kind })), tracks); assert(retained.every(track => track.state === 'live'));
  await button('Casting · local capture active'); await button('Stop local capture');
  const stopped = await page.evaluate(() => globalThis.qaStream.getTracks().every(track => track.readyState === 'ended')); assert(stopped);
  assert.deepEqual(errors, []); assert.deepEqual(app.mediaRequests, []);
  await writeFile('tmp/audio-memory-production-result.json', JSON.stringify({ passed: true, browser: await browser.version(), transport: 'memory-only audio; offline browser; production bundles', audible, muted, paused, drillRms, recordingBytes: data.length, tracks, retained, stopped, errors, mediaRequests: app.mediaRequests }, null, 2));
  console.log('Production Quick Practice/drill/capture and bilingual/mobile controls passed without media requests.');
} finally { await app.close(); await browser.close(); }
