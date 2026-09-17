/** Real browser DSP checks. Start Vite first. Uses an existing Playwright install. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.AUDIO_BROWSER || 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const base = process.env.AUDIO_BASE_URL || 'http://127.0.0.1:4185';
  const localFixtures = process.env.AUDIO_LOCAL_FIXTURES === '1';
  if (localFixtures) {
    // Isolates browser DSP from host download-manager interception. This mode
    // explicitly does NOT verify normal HTTP transport, PWA caching or gameplay.
    const manifest = JSON.parse(await readFile(new URL('../../src/content/audio-palette.json', import.meta.url), 'utf8'));
    const assets = new Set(Object.values(manifest.assets).map(asset => asset.url));
    await page.route('**/assets/audio/*', async route => {
      const path = new URL(route.request().url()).pathname;
      if (!assets.has(path)) return route.continue();
      const body = await readFile(new URL(`../../public${path}`, import.meta.url));
      await route.fulfill({ contentType: path.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg', body });
    });
  }
  await page.route('**/audio-verification', route => route.fulfill({ contentType: 'text/html', body: '<title>Tenmulate audio verification</title>' }));
  await page.goto(`${base}/audio-verification`);
  const result = await page.evaluate(async () => {
    const { SoundscapeGraph } = await import('/src/engine/audio/SoundscapeGraph.ts');
    const { AudioPalette } = await import('/src/engine/audio/AudioPalette.ts');
    const { ACOUSTICS } = await import('/src/engine/audio/acoustics.ts');
    const { contactPcm } = await import('/src/engine/audio/synthesis.ts');
    const rate = 48000;
    const energy = (data, start, end) => {
      let sum = 0; for (let i = Math.floor(start * rate); i < Math.min(data.length, end * rate); i++) sum += data[i] ** 2;
      return sum;
    };
    async function render(venue, mute = false, stress = false) {
      const context = new OfflineAudioContext(2, rate * 3, rate);
      const graph = new SoundscapeGraph(context);
      graph.output.connect(context.destination); graph.setVenue(venue);
      const source = context.createBuffer(1, rate * .2, rate); source.copyToChannel(contactPcm(rate, 11), 0);
      const count = stress ? 80 : 1;
      for (let i = 0; i < count; i++) graph.play(source, 'contact', { gain: stress ? .6 : .4, when: .1 });
      const metrics = graph.metrics;
      let pause;
      if (mute) pause = context.suspend(.2).then(() => { graph.setMaster(true); return context.resume(); });
      const buffer = await context.startRendering();
      if (pause) await pause;
      const data = buffer.getChannelData(0);
      let peak = 0, finite = true;
      for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); finite &&= Number.isFinite(sample); }
      const report = { venue, peak, finite, early: energy(data, .1, .3), late: energy(data, .6, 1.6),
        afterMute: energy(data, .3, 3), metrics };
      graph.dispose(); report.disposed = graph.metrics;
      return report;
    }
    const venues = [];
    for (const venue of Object.keys(ACOUSTICS)) venues.push(await render(venue));
    const muted = await render('clay-stadium', true);
    const stress = await render('clay-stadium', false, true);
    const context = new OfflineAudioContext(2, rate, rate), graph = new SoundscapeGraph(context);
    let maximumConvolvers = 0;
    for (let i = 0; i < 60; i++) {
      graph.setVenue(Object.keys(ACOUSTICS)[i % 6]);
      maximumConvolvers = Math.max(maximumConvolvers, graph.metrics.convolvers);
    }
    graph.reset(); const reset = graph.metrics; graph.dispose();
    const palette = new AudioPalette(context);
    for (const surface of ['hard', 'clay', 'grass']) await palette.prepare(surface, true);
    for (const kind of ['room', 'wind', 'rain']) palette.atmosphere(kind);
    const loaded = { status: palette.status, ...palette.metrics };
    palette.clear();
    return { venues, muted, stress, maximumConvolvers, reset, loaded, cleared: palette.metrics, browser: navigator.userAgent };
  });
  for (const venue of result.venues) {
    assert.equal(venue.finite, true); assert(venue.peak > .01 && venue.peak < 1);
    assert(venue.early > .01); assert.equal(venue.disposed.voices, 0); assert.equal(venue.disposed.convolvers, 0);
  }
  const outdoor = result.venues.slice(0, 3), indoor = result.venues.slice(3);
  assert(indoor.every(venue => venue.late / venue.early > Math.max(...outdoor.map(value => value.late / value.early))));
  assert(result.muted.afterMute / (48000 * 2.7) < 1e-8, 'Master mute must also silence reverb');
  assert(result.stress.peak < 1); assert(result.stress.metrics.voices <= 32);
  assert(result.maximumConvolvers <= 2); assert.equal(result.reset.convolvers, 0);
  assert.equal(result.loaded.status, 'ready', JSON.stringify(result.loaded)); assert.equal(result.loaded.failed.length, 0);
  assert.equal(result.loaded.buffers, 18); assert(result.loaded.decodedBytes < 32 * 1024 * 1024);
  assert.equal(result.cleared.buffers, 0); assert.equal(result.cleared.pending, 0);

  // Reverse check: a real network failure must be visible and recover on retry.
  await page.route('**/assets/audio/contact-0.*.wav', route => route.fulfill({ status: 404, body: 'injected missing audio' }));
  const failed = await page.evaluate(async () => {
    const { AudioPalette } = await import('/src/engine/audio/AudioPalette.ts');
    globalThis.qaPalette = new AudioPalette(new OfflineAudioContext(2, 48000, 48000));
    await globalThis.qaPalette.load('contact-0');
    return { status: globalThis.qaPalette.status, ...globalThis.qaPalette.metrics };
  });
  assert.equal(failed.status, 'fallback'); assert.deepEqual(failed.failed, ['contact-0']);
  await page.unroute('**/assets/audio/contact-0.*.wav');
  const recovered = await page.evaluate(async () => {
    await globalThis.qaPalette.load('contact-0');
    return { status: globalThis.qaPalette.status, ...globalThis.qaPalette.metrics };
  });
  assert.equal(recovered.status, 'ready'); assert.equal(recovered.failed.length, 0);
  console.log(JSON.stringify({ passed: true, transport: localFixtures ? 'local byte fixtures; normal HTTP UNVERIFIED' : 'normal HTTP', ...result, faultInjection: { failed, recovered } }, null, 2));
} finally { await browser.close(); }
