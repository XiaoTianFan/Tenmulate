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
  await page.evaluate(async () => {
    const { AudioCueEngine } = await import('/src/engine/audio/AudioCueEngine.ts');
    globalThis.qaEngine = new AudioCueEngine();
    const start = document.createElement('button'); start.textContent = 'Unlock test audio';
    start.onclick = () => globalThis.qaEngine.unlock(); document.body.append(start);
  });
  await page.getByRole('button', { name: 'Unlock test audio' }).click();
  const lifecycle = await page.evaluate(async () => {
    const { DEFAULT_AUDIO_LEVELS } = await import('/src/engine/audio/AudioCueEngine.ts');
    const { DEFAULT_ENVIRONMENT, VENUE_IDS } = await import('/src/domain/environment.ts');
    const engine = globalThis.qaEngine;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const ready = async () => {
      for (let i = 0; i < 100 && engine.metrics.status !== 'ready'; i++) await delay(20);
      if (engine.metrics.status !== 'ready') throw new Error(JSON.stringify(engine.metrics));
    };
    engine.configure(DEFAULT_ENVIRONMENT, 'hard', DEFAULT_AUDIO_LEVELS, true);
    engine.setPlayback('playing'); await ready();
    const lease = await engine.capture(), trackId = lease.stream.getAudioTracks()[0].id;
    const monitor = new AudioContext(); await monitor.resume();
    const source = monitor.createMediaStreamSource(lease.stream), analyser = monitor.createAnalyser(), silent = monitor.createGain();
    silent.gain.value = 0; source.connect(analyser).connect(silent).connect(monitor.destination);
    const rms = async () => { await delay(180); const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length); };
    // MediaStreamSource initialization has its own buffering; measure it rather
    // than treating a fixed 180 ms sample as proof of a silent application graph.
    let audible = await rms(), captureWarmupMs = 180;
    for (let attempt = 0; audible === 0 && attempt < 4; attempt++) { audible = await rms(); captureWarmupMs += 180; }
    engine.configure(DEFAULT_ENVIRONMENT, 'hard', DEFAULT_AUDIO_LEVELS, false);
    const muted = await rms();
    engine.configure(DEFAULT_ENVIRONMENT, 'hard', DEFAULT_AUDIO_LEVELS, true);
    const unmuted = await rms();
    const matrix = [];
    for (const venue of VENUE_IDS) for (const audience of ['empty', 'half', 'full']) {
      engine.configure({ ...DEFAULT_ENVIRONMENT, venue, audience, weather: 'rain', weatherIntensity: 1, windSpeedMps: 15 }, 'clay', DEFAULT_AUDIO_LEVELS, true);
      await ready(); await delay(90); engine.tick();
      matrix.push({ venue, audience, ...engine.metrics, dispatches: undefined });
    }
    engine.setPlayback('paused'); const paused = await rms();
    engine.setPlayback('playing'); const resumed = await rms();
    engine.setPlayback('idle'); await delay(100); const idle = engine.metrics;
    const captureSurvivedExit = lease.stream.getAudioTracks()[0].readyState === 'live' && lease.stream.getAudioTracks()[0].id === trackId;
    const cycles = [];
    for (let i = 0; i < 10; i++) {
      engine.configure(DEFAULT_ENVIRONMENT, 'hard', DEFAULT_AUDIO_LEVELS, true); engine.setPlayback('countdown');
      await ready(); engine.setPlayback('playing'); engine.play('contact', 1);
      engine.setPlayback('idle'); await delay(90); cycles.push(engine.metrics);
    }
    lease.release(); lease.release();
    const released = { captureLeases: engine.metrics.captureLeases, state: lease.stream.getAudioTracks()[0].readyState };
    engine.configure(DEFAULT_ENVIRONMENT, 'hard', DEFAULT_AUDIO_LEVELS, true); engine.setPlayback('playing'); await ready();
    engine.setPlayback('completed'); const completed = engine.metrics;
    await delay(4400); const settled = engine.metrics;
    engine.dispose(); source.disconnect(); analyser.disconnect(); silent.disconnect(); await monitor.close();
    return { audible, captureWarmupMs, muted, unmuted, paused, resumed, matrix, idle, cycles, captureSurvivedExit, released, completed, settled, disposed: engine.metrics };
  });
  assert(lifecycle.audible > 1e-6 && lifecycle.unmuted > 1e-6 && lifecycle.resumed > 1e-6,
    JSON.stringify({ audible: lifecycle.audible, unmuted: lifecycle.unmuted, resumed: lifecycle.resumed, matrix: lifecycle.matrix[0], paused: lifecycle.paused }));
  assert(lifecycle.muted < 1e-4 && lifecycle.paused < 1e-4);
  for (const row of lifecycle.matrix) {
    assert(row.voices <= 32 && row.convolvers <= 2 && row.decodedBytes <= 32 * 1024 * 1024);
    assert.equal(row.voicesByBus.crowd, row.audience === 'empty' ? 0 : 1);
  }
  for (const row of [lifecycle.idle, ...lifecycle.cycles]) {
    assert.equal(row.voices, 0); assert.equal(row.convolvers, 0); assert.equal(row.decodedBytes, 0);
    assert.equal(row.cleanupTimers, 0); assert.equal(row.activeLoops, 0);
  }
  assert.equal(lifecycle.captureSurvivedExit, true);
  assert.deepEqual(lifecycle.released, { captureLeases: 0, state: 'ended' });
  assert.equal(lifecycle.settled.voices, 0); assert.equal(lifecycle.settled.convolvers, 0); assert.equal(lifecycle.settled.cleanupTimers, 0);
  assert.equal(lifecycle.disposed.contextState, 'absent');
  console.log(JSON.stringify({ passed: true, transport: localFixtures ? 'local byte fixtures; normal HTTP UNVERIFIED' : 'normal HTTP', ...result, faultInjection: { failed, recovered }, lifecycle }, null, 2));
} finally { await browser.close(); }
