/** Real app on a virtual secure origin. Browser is offline; audio uses only RAM. */
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { audioMemoryPayload, installMemoryAudio } from './memory-transport.mjs';

export async function openMemoryApp(browser, { production = false } = {}) {
  const context = await browser.newContext({ offline: true, serviceWorkers: 'block', viewport: { width: 1365, height: 900 } });
  await context.addInitScript(installMemoryAudio, await audioMemoryPayload());
  const vite = production ? null : await (await import('vite')).createServer({ server: { port: 0, host: '127.0.0.1', hmr: false } });
  await vite?.listen();
  const address = vite?.httpServer.address();
  const root = resolve('dist'); const mediaRequests = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/assets/audio/') && /\.(wav|mp3|ogg|opus)$/.test(url.pathname)) {
      mediaRequests.push(url.pathname); await route.abort(); return;
    }
    if (url.origin !== 'https://audio.test') { await route.abort(); return; }
    try {
      if (vite) {
        // Only application code/non-audio assets are read through local Node HTTP.
        // This cannot fetch audio: the route above rejects it before this branch.
        const response = await fetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`);
        await route.fulfill({ status: response.status, body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'application/octet-stream' });
      } else {
        const file = resolve(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1));
        if (!file.startsWith(root + sep)) throw new Error('Outside app root');
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
        await route.fulfill({ body: await readFile(file), contentType: types[extname(file)] || 'application/octet-stream' });
      }
    } catch { await route.abort(); }
  });
  return { context, mediaRequests, url: 'https://audio.test/', close: async () => { await context.close(); await vite?.close(); } };
}
