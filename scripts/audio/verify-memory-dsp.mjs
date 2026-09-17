/** Real browser DSP with an in-memory secure document, offline, no media requests. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'rolldown';
import { audioMemoryPayload, installMemoryAudio } from './memory-transport.mjs';
const { chromium } = await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
await mkdir('tmp/audio-review', { recursive: true });
await writeFile('tmp/audio-review/dsp-entry.ts', [
  'export * from "../../src/engine/audio/AudioCueEngine";',
  'export * from "../../src/engine/audio/AudioPalette";',
  'export * from "../../src/engine/audio/SoundscapeGraph";',
  'export * from "../../src/engine/audio/acoustics";',
  'export { DEFAULT_ENVIRONMENT } from "../../src/domain/environment";',
].join('\n'));
const bundle = await build({ input: resolve('tmp/audio-review/dsp-entry.ts'), output: { format: 'iife', name: 'AudioQA' } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ offline: true });
  const requests = []; context.on('request', request => requests.push(request.url()));
  await context.route('**/*', route => route.request().url() === 'https://audio.test/'
    ? route.fulfill({ contentType: 'text/html', body: '<title>Memory-only audio verification</title>' }) : route.abort());
  const page = await context.newPage();
  const payload = await audioMemoryPayload();
  await page.addInitScript(installMemoryAudio, payload);
  await page.goto('https://audio.test/');
  await page.addScriptTag({ content: bundle.output[0].code });
  const result = await page.evaluate(async () => {
    const { AudioPalette, SoundscapeGraph, ACOUSTICS } = globalThis.AudioQA;
    // Integrity digest is the real browser API, not a test substitute.
    const results = [];
    for (const venue of Object.keys(ACOUSTICS)) {
      const context = new OfflineAudioContext(2, 48000 * 3, 48000);
      const palette = new AudioPalette(context), graph = new SoundscapeGraph(context);
      await palette.prepare('hard', true);
      if (palette.status !== 'ready') throw new Error(JSON.stringify(palette.metrics));
      graph.output.connect(context.destination); graph.setVenue(venue);
      graph.play(palette.contact(0), 'contact', { when: .1, gain: .4 });
      const audio = await context.startRendering(), samples = audio.getChannelData(0);
      const energy = (start, end) => samples.slice(start * 48000, end * 48000).reduce((sum, value) => sum + value * value, 0);
      const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
      results.push({ venue, peak, early: energy(.1, .3), late: energy(.6, 1.6), decodedBytes: palette.decodedBytes + graph.metrics.impulseBytes });
      graph.dispose(); palette.clear();
    }
    return { results, browser: navigator.userAgent, memory: globalThis.audioMemoryTransport };
  });
  assert.deepEqual(requests, ['https://audio.test/'], 'Only the in-memory HTML document may enter request routing; media must not');
  assert(result.results.every(row => Number.isFinite(row.peak) && row.peak > .01 && row.peak < 1 && row.decodedBytes < 32 * 1024 * 1024));
  assert(result.results.slice(3).every(row => row.late / row.early > Math.max(...result.results.slice(0, 3).map(row => row.late / row.early))));
  await page.evaluate(() => {
    globalThis.qaEngine = new globalThis.AudioQA.AudioCueEngine();
    const button = document.createElement('button'); button.textContent = 'Unlock'; button.onclick = () => globalThis.qaEngine.unlock(); document.body.append(button);
  });
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  const pending = await page.evaluate(async () => {
    const { DEFAULT_AUDIO_LEVELS, DEFAULT_ENVIRONMENT, ACOUSTICS } = globalThis.AudioQA;
    const engine = globalThis.qaEngine, delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    globalThis.audioMemoryDelayMs = 150;
    for (let i = 0; i < 18; i++) {
      engine.configure({ ...DEFAULT_ENVIRONMENT, venue: Object.keys(ACOUSTICS)[i % 6], audience: ['empty', 'half', 'full'][i % 3] }, ['hard', 'clay', 'grass'][i % 3], DEFAULT_AUDIO_LEVELS, true);
      engine.setPlayback('playing'); await delay(3); engine.setPlayback('idle');
    }
    await delay(220);
    const afterCancelled = engine.metrics;
    globalThis.audioMemoryDelayMs = 0;
    engine.configure(DEFAULT_ENVIRONMENT, 'hard', DEFAULT_AUDIO_LEVELS, true); engine.setPlayback('playing');
    for (let i = 0; i < 100 && engine.getSnapshot() !== 'ready'; i++) await delay(20);
    const recovered = engine.metrics; engine.setPlayback('idle'); await delay(100); const idle = engine.metrics; engine.dispose();
    return { afterCancelled, recovered, idle };
  });
  assert.equal(pending.afterCancelled.pending, 0); assert.equal(pending.afterCancelled.decodedBytes, 0);
  assert.equal(pending.recovered.status, 'ready'); assert(pending.recovered.decodedBytes < 32 * 1024 * 1024);
  assert.equal(pending.idle.voices, 0); assert.equal(pending.idle.convolvers, 0); assert.equal(pending.idle.cleanupTimers, 0);
  assert.deepEqual(requests, ['https://audio.test/']);
  result.pendingLoadSwitches = pending;
  await writeFile('tmp/audio-memory-dsp-result.json', JSON.stringify({ passed: true, requests, ...result }, null, 2));
  console.log(JSON.stringify({ passed: true, requests, ...result }));
} finally { await browser.close(); }
