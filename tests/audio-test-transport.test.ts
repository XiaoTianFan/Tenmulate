import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';

it('serves exact local audio bytes without calling native fetch and fails closed for unknown media', async () => {
  // Execute the exact serializable browser function; no browser or network.
  const source = readFileSync('scripts/audio/memory-transport.mjs', 'utf8');
  const functionSource = source.slice(source.indexOf('export function installMemoryAudio'), source.indexOf('export function memoryAudioScript')).replace('export ', '');
  const nativeFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('module text'));
  const sandbox = { fetch: nativeFetch, location: { href: 'http://localhost/' }, URL, Request, Response, DOMException, Uint8Array, atob };
  const path = '/assets/audio/contact.0123456789ab.wav';
  runInNewContext(`${functionSource}; installMemoryAudio(${JSON.stringify({ [path]: Buffer.from([0, 1, 254, 255]).toString('base64') })});`, sandbox);
  const response = await sandbox.fetch(path);
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0, 1, 254, 255]);
  expect(nativeFetch).not.toHaveBeenCalled();
  await expect(sandbox.fetch('/assets/audio/unknown.mp3')).rejects.toThrow('network fallback forbidden');
  expect(nativeFetch).not.toHaveBeenCalled();
  await sandbox.fetch('/src/app.ts');
  expect(nativeFetch).toHaveBeenCalledExactlyOnceWith('/src/app.ts', undefined);
});
