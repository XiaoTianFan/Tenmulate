/** Test-only audio transport. Media bytes never enter the browser network stack. */
import { readFile } from 'node:fs/promises';

export async function audioMemoryPayload() {
  const manifest = JSON.parse(await readFile(new URL('../../src/content/audio-palette.json', import.meta.url), 'utf8'));
  return Object.fromEntries(await Promise.all(Object.values(manifest.assets).map(async asset => [asset.url,
    (await readFile(new URL(`../../public${asset.url}`, import.meta.url))).toString('base64')])));
}

// Serializable function used by Playwright addInitScript AND the test worker.
export function installMemoryAudio(payload) {
  const original = globalThis.fetch.bind(globalThis);
  const metrics = globalThis.audioMemoryTransport = { delivered: 0, rejected: 0 };
  globalThis.audioMemoryFaults = {};
  globalThis.audioMemoryDelayMs = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, globalThis.location.href);
    if (url.pathname.startsWith('/assets/audio/') && /\.(wav|mp3|ogg|opus)(?:$|\.)/i.test(url.pathname)) {
      if (init?.signal?.aborted || input instanceof Request && input.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (globalThis.audioMemoryDelayMs > 0) await new Promise(resolve => setTimeout(resolve, globalThis.audioMemoryDelayMs));
      if (init?.signal?.aborted || input instanceof Request && input.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const fault = globalThis.audioMemoryFaults[url.pathname];
      if (fault === 'missing') { metrics.rejected++; return new Response('Injected missing audio', { status: 404 }); }
      const encoded = payload[url.pathname];
      if (!encoded) { metrics.rejected++; throw new TypeError('Unmapped test audio; network fallback forbidden'); }
      const data = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      if (fault === 'corrupt') data[data.length - 1] ^= 1;
      metrics.delivered++;
      return new Response(data, { status: 200, headers: { 'content-type': url.pathname.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg' } });
    }
    return original(input, init);
  };
}

export function memoryAudioScript(payload) {
  return `(${installMemoryAudio.toString()})(${JSON.stringify(payload)});`;
}
