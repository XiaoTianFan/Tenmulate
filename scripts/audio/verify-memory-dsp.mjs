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
  await writeFile('tmp/audio-memory-dsp-result.json', JSON.stringify({ passed: true, requests, ...result }, null, 2));
  console.log(JSON.stringify({ passed: true, requests, ...result }));
} finally { await browser.close(); }
