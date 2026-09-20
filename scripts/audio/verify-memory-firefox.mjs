/** Installed Firefox runs a local HTML fixture; only numeric results use HTTP. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';
import { audioMemoryPayload, memoryAudioScript } from './memory-transport.mjs';
const bundle = await build({ input: 'tmp/audio-review/dsp-entry.ts', output: { format: 'iife', name: 'AudioQA' } });
let deliver;
const result = new Promise(resolve => { deliver = resolve; });
const server = createServer((request, response) => {
  const chunks = []; request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' }); response.end('ok');
    if (request.method === 'POST') deliver(JSON.parse(Buffer.concat(chunks).toString()));
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'tenmulate-memory-firefox-'));
await writeFile(join(profile, 'user.js'), ['user_pref("app.update.auto", false);', 'user_pref("app.update.enabled", false);', 'user_pref("browser.shell.checkDefaultBrowser", false);', 'user_pref("browser.startup.homepage_override.mstone", "ignore");', 'user_pref("network.captive-portal-service.enabled", false);'].join('\n'));
const html = `<title>Memory-only Firefox audio check</title><script>${memoryAudioScript(await audioMemoryPayload())}</script><script>${bundle.output[0].code}</script><script>
(async () => {
 let report;
 try {
   const rows = [];
   for (const venue of Object.keys(AudioQA.ACOUSTICS)) {
     const context = new OfflineAudioContext(2, 96000, 48000), palette = new AudioQA.AudioPalette(context), graph = new AudioQA.SoundscapeGraph(context);
     await palette.prepare('hard', true);
     if (palette.status !== 'ready') throw Error(JSON.stringify(palette.metrics));
     graph.output.connect(context.destination); graph.setMaster(false); graph.setVenue(venue);
     const scheduledMute = typeof context.suspend === 'function';
     graph.play(palette.contact(0), 'contact', { when: scheduledMute ? .1 : 0 });
     // Older Firefox lacks OfflineAudioContext.suspend (not used by the app).
     // Exercise its real 40 ms initial fade, retaining both audible and zero-tail assertions.
     const mute = scheduledMute ? context.suspend(.3).then(() => { graph.setMaster(true); return context.resume(); }) : (graph.setMaster(true), Promise.resolve());
     const audio = await context.startRendering(); await mute;
     const peak = audio.getChannelData(0).reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
     const mutedPeak = audio.getChannelData(0).slice(24000).reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
     if (mutedPeak >= .0001) throw Error('Mute failed: ' + mutedPeak);
     rows.push({ venue, peak, mutedPeak, muteMode: scheduledMute ? 'scheduled at .3s' : 'initial 40ms fade' }); graph.dispose(); palette.clear();
   }
   report = { passed: true, browser: navigator.userAgent, rows, memory: audioMemoryTransport };
 } catch (error) { report = { passed: false, browser: navigator.userAgent, error: String(error) }; }
 document.body.textContent = JSON.stringify(report);
 await fetch('http://127.0.0.1:${server.address().port}/result', { method: 'POST', body: JSON.stringify(report) });
})();</script>`;
const file = resolve('tmp/audio-review/firefox-memory.html'); await writeFile(file, html);
const child = spawn('C:/Program Files/Mozilla Firefox/firefox.exe', ['--headless', '--no-remote', '--profile', profile, pathToFileURL(file).href], { windowsHide: true, env: { ...process.env, MOZ_HEADLESS: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
child.stderr.on('data', data => process.stderr.write(data));
let timeout;
try {
  const report = await Promise.race([result, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Installed Firefox did not report within 30 seconds')), 30000); })]);
  await writeFile('tmp/audio-memory-firefox-result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  assert.equal(report.passed, true); assert(report.rows.every(row => row.peak > .01 && row.peak < 1));
} finally { clearTimeout(timeout); child.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
