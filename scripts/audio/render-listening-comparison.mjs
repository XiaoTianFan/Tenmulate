/** Same observed gameplay event times, baseline oscillator vs current graph. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'rolldown';
import { audioMemoryPayload, installMemoryAudio } from './memory-transport.mjs';
const { chromium } = await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
const gameplay = JSON.parse(await readFile('tmp/audio-gameplay-result.json', 'utf8'));
const events = gameplay.rates.find(row => row.rate === 1).events.filter(event => event.eventTime < 15);
assert(events.length >= 4);
const bundle = await build({ input: 'tmp/audio-review/dsp-entry.ts', output: { format: 'iife', name: 'AudioQA' } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ offline: true });
  const requests = []; context.on('request', request => requests.push(request.url()));
  await context.route('**/*', route => route.request().url() === 'https://audio.test/' ? route.fulfill({ contentType: 'text/html', body: '<title>Listening render</title>' }) : route.abort());
  const page = await context.newPage(); await page.addInitScript(installMemoryAudio, await audioMemoryPayload());
  await page.goto('https://audio.test/'); await page.addScriptTag({ content: bundle.output[0].code });
  const audio = await page.evaluate(async events => {
    const outputs = [];
    for (const version of ['baseline', 'hard-open-arena', 'timber-hall']) {
      const context = new OfflineAudioContext(2, 48000 * 17, 48000);
      if (version === 'baseline') {
        const ambient = context.createOscillator(), level = context.createGain();
        ambient.frequency.value = 74; level.gain.value = .3 * .018; ambient.connect(level).connect(context.destination); ambient.start(); ambient.stop(15);
        for (const event of events) {
          const bounce = event.id.startsWith('bounce'), time = event.eventTime;
          const source = context.createOscillator(), gain = context.createGain();
          source.frequency.value = bounce ? 240 : 760; source.type = bounce ? 'triangle' : 'sine';
          gain.gain.setValueAtTime(.12 * (bounce ? .7 : 1), time); gain.gain.exponentialRampToValueAtTime(.0001, time + .12);
          source.connect(gain).connect(context.destination); source.start(time); source.stop(time + .14);
        }
      } else {
        const { SoundscapeGraph, AudioPalette, ACOUSTICS } = globalThis.AudioQA;
        const graph = new SoundscapeGraph(context), palette = new AudioPalette(context); await palette.prepare('hard', true);
        if (palette.status !== 'ready') throw Error('Palette unavailable');
        graph.output.connect(context.destination); graph.setVenue(version); graph.setBus('ambience', .3);
        graph.play(palette.atmosphere('room'), 'ambience', { gain: ACOUSTICS[version].roomTone * .13, loop: true });
        graph.play(palette.get('murmur'), 'crowd', { gain: .75 * .32 * .3 * .35, loop: true });
        for (let i = 0; i < events.length; i++) {
          const event = events[i], bounce = event.id.startsWith('bounce');
          graph.play(bounce ? palette.bounce('hard', i % 3) : palette.contact(i % 3), bounce ? 'bounce' : 'contact', { when: event.eventTime, gain: .42 * (bounce ? .7 : 1) * .6 });
        }
      }
      const buffer = await context.startRendering();
      const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
      let sum = 0, peak = 0;
      for (const channel of channels) for (const sample of channel) { sum += sample ** 2; peak = Math.max(peak, Math.abs(sample)); }
      const rms = Math.sqrt(sum / (buffer.length * 2));
      const gain = Math.min(.9 / peak, .0316227766 / rms); // Matched -30 dBFS RMS, peak safety.
      const pcm = new Uint8Array(buffer.length * 4), view = new DataView(pcm.buffer);
      for (let i = 0; i < buffer.length; i++) for (let channel = 0; channel < 2; channel++) view.setInt16(i * 4 + channel * 2, Math.round(channels[channel][i] * gain * 32767), true);
      let binary = ''; for (let i = 0; i < pcm.length; i += 8192) binary += String.fromCharCode(...pcm.subarray(i, i + 8192));
      outputs.push({ version, pcm: btoa(binary), sourceRms: rms, gain, normalizedRms: rms * gain, peak: peak * gain });
    }
    return outputs;
  }, events);
  assert.deepEqual(requests, ['https://audio.test/']);
  for (const item of audio) {
    const pcm = Buffer.from(item.pcm, 'base64'), header = Buffer.alloc(44);
    header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(48000, 24); header.writeUInt32LE(192000, 28);
    header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
    await writeFile(`tmp/audio-review/${item.version}.wav`, Buffer.concat([header, pcm])); delete item.pcm;
  }
  await writeFile('tmp/audio-review/comparison.json', JSON.stringify({ method: 'Real OfflineAudioContext; same observed 1x gameplay times; standardized gain/center pan; matched -30 dBFS RMS. Baseline oscillator recipe from e78d086. Current hard surface; full crowd at rally gain. Not live gameplay recordings.', events, audio, requests }, null, 2));
  console.log(JSON.stringify(audio));
} finally { await browser.close(); }
