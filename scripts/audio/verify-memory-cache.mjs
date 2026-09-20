/** Real shipped Workbox strategy in a service worker; media is IPC/RAM only. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { audioMemoryPayload, memoryAudioScript } from './memory-transport.mjs';
const { chromium } = await import(process.env.AUDIO_PLAYWRIGHT_MODULE || 'playwright');
const payload = await audioMemoryPayload();
const worker = await readFile('dist/sw.js', 'utf8');
const marker = 'function(e){"use strict";';
assert(worker.includes(marker), 'Inspect changed generated worker before instrumentation');
const instrumented = memoryAudioScript(payload) + '\n' + worker.replace(marker, marker + `
 const register = e.registerRoute;
 e.registerRoute = (match, strategy, ...args) => {
   if (String(match).includes('audio')) self.qaAudioStrategy = strategy;
   return register(match, strategy, ...args);
 };
 self.addEventListener('message', event => {
   if (!event.data?.audioQa) return;
   event.waitUntil((async () => {
     try {
       if (event.data.fault) for (const path of event.data.paths) self.audioMemoryFaults[path] = event.data.fault;
       if (event.data.clearFaults) self.audioMemoryFaults = {};
       const replies = [];
       for (const path of event.data.paths || []) {
         const request = new Request(new URL(path, self.location));
         // Calls the actual registered production strategy and its plugins.
         const [responsePromise, done] = self.qaAudioStrategy.handleAll({ request, event });
         const response = await responsePromise;
         replies.push({ status: response.status, bytes: Array.from(new Uint8Array(await response.arrayBuffer())) });
         await done;
       }
       event.ports[0].postMessage({ replies, memory: self.audioMemoryTransport });
     } catch (error) { event.ports[0].postMessage({ error: String(error) }); }
   })());
 });
`);
const root = resolve('dist'); let forbidden = 0;
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (/^\/assets\/audio\/.*\.(wav|mp3)$/.test(path)) { forbidden++; response.writeHead(403); response.end(); return; }
  try {
    if (path === '/qa.html') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<title>Cache policy verification</title>'); return; }
    if (path === '/sw.js') { response.writeHead(200, { 'Content-Type': 'text/javascript' }); response.end(instrumented); return; }
    const file = resolve(root, path === '/' ? 'index.html' : decodeURIComponent(path).slice(1));
    if (!file.startsWith(root + sep)) throw new Error('Outside test root');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' })[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext(), page = await context.newPage(), requests = [];
  context.on('request', request => { if (/\/assets\/audio\/.*\.(wav|mp3)$/.test(request.url())) requests.push(request.url()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/qa.html`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
    globalThis.askAudioWorker = data => new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = event => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data);
      navigator.serviceWorker.controller.postMessage({ audioQa: true, ...data }, [channel.port2]);
    });
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const paths = Object.keys(payload).filter(path => !path.includes('/contact-'));
  const contactChunk = worker.match(/assets\/contact-bank-[\w-]+\.js/)?.[0];
  assert(contactChunk, 'Contact application chunk must be precached');
  const warm = await page.evaluate(paths => globalThis.askAudioWorker({ paths }), paths);
  assert(warm.replies.every(reply => reply.status === 200));
  const keys = await page.evaluate(async () => (await (await caches.open('tenmulate-audio-v1')).keys()).map(request => new URL(request.url).pathname));
  assert.deepEqual(keys.sort(), [...paths].sort());
  await context.setOffline(true);
  const contactOffline = await page.evaluate(async path => { const response = await fetch('/' + path); return { status: response.status, bytes: (await response.arrayBuffer()).byteLength }; }, contactChunk);
  assert.equal(contactOffline.status, 200); assert(contactOffline.bytes > 300000);
  const offline = await page.evaluate(paths => globalThis.askAudioWorker({ paths, fault: 'missing' }), paths);
  assert.deepEqual(offline.replies, warm.replies); assert.equal(offline.memory.delivered, warm.memory.delivered);
  await page.evaluate(() => caches.delete('tenmulate-audio-v1'));
  const cold = await page.evaluate(paths => globalThis.askAudioWorker({ paths }), paths);
  assert(cold.replies.every(reply => reply.status === 404));
  assert.equal(await page.evaluate(async () => (await (await caches.open('tenmulate-audio-v1')).keys()).length), 0);
  const recovered = await page.evaluate(paths => globalThis.askAudioWorker({ paths, clearFaults: true }), paths);
  assert.deepEqual(recovered.replies, warm.replies);
  assert.equal(forbidden, 0); assert.deepEqual(requests, []);
  const report = { passed: true, browser: await browser.version(), contactOffline, warmAssets: paths.length, offlineAssets: offline.replies.length, cold404s: cold.replies.length, restoredAssets: recovered.replies.length, mediaRequests: requests, serverMediaRequests: forbidden, method: 'Actual registered Workbox strategy via worker messages; RAM transport, no media HTTP' };
  await writeFile('tmp/audio-memory-cache-result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
