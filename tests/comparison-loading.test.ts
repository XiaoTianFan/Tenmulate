import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse } from '@babel/parser';
import { loadVideoTools } from '../src/video-comparison/loadVideoTools';

afterEach(() => vi.useRealTimers());

describe('optional video tool loading', () => {
  it('does not run a canceled loader and removes timers after success', async () => {
    vi.useFakeTimers();
    const controller = new AbortController(), load = vi.fn(async () => 'ready');
    controller.abort();
    await expect(loadVideoTools(load, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(load).not.toHaveBeenCalled();
    await expect(loadVideoTools(load, new AbortController().signal)).resolves.toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds a stalled download and allows a later attempt to use the finished module', async () => {
    vi.useFakeTimers();
    let finish!: (module: string) => void;
    const download = new Promise<string>(resolve => { finish = resolve; });
    const request = loadVideoTools(() => download, new AbortController().signal, 100);
    const failed = expect(request).rejects.toThrow('taking too long');
    await vi.advanceTimersByTimeAsync(100); await failed;
    finish('ready');
    await expect(loadVideoTools(() => download, new AbortController().signal)).resolves.toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels a pending request without letting a late module reopen the UI', async () => {
    vi.useFakeTimers();
    const controller = new AbortController(), opened = vi.fn();
    let finish!: (module: string) => void;
    const download = new Promise<string>(resolve => { finish = resolve; });
    const request = loadVideoTools(() => download, controller.signal).then(opened);
    await Promise.resolve(); controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    finish('late'); await Promise.resolve(); await Promise.resolve();
    expect(opened).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([() => Promise.reject(new Error('Network')), () => { throw new Error('Import'); }])('reports a recoverable loading error', async load => {
    vi.useFakeTimers();
    await expect(loadVideoTools(load, new AbortController().signal)).rejects.toThrow('Could not load video tools');
    expect(vi.getTimerCount()).toBe(0);
  });
});

/** Follow runtime static imports only. A decoder accidentally imported by a card
 * would put the codec library back on the navigation path in production.
 */
function staticGraph(entry: string) {
  const files = new Set<string>(), packages = new Set<string>();
  function visit(file: string) {
    if (files.has(file)) return;
    files.add(file);
    const tree = parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    for (const node of tree.program.body) {
      if (node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportAllDeclaration') continue;
      if (!node.source || ('importKind' in node && node.importKind === 'type') || ('exportKind' in node && node.exportKind === 'type')) continue;
      if (node.type === 'ImportDeclaration' && node.specifiers.length && node.specifiers.every(specifier => specifier.type === 'ImportSpecifier' && specifier.importKind === 'type')) continue;
      const name = node.source.value;
      if (!name.startsWith('.')) { packages.add(name); continue; }
      if (/\.(css|json)$/.test(name)) continue;
      const path = resolve(dirname(file), name);
      const source = [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}/index.tsx`].find(candidate => /\.[cm]?[jt]sx?$/.test(candidate) && existsSync(candidate));
      if (source) visit(source);
    }
  }
  visit(entry);
  return { files, packages };
}

it('ships the comparison shell with navigation while deferring codec and export modules', () => {
  const graph = staticGraph(resolve('src/app/App.tsx'));
  expect(graph.files.has(resolve('src/video-comparison/VideoComparisonScreen.tsx'))).toBe(true);
  expect(graph.files.has(resolve('src/video-comparison/ComparisonExportModal.tsx'))).toBe(false);
  expect(graph.files.has(resolve('src/video-comparison/decodedVideo.ts'))).toBe(false);
  expect(graph.files.has(resolve('src/video-comparison/previewFrames.ts'))).toBe(false);
  expect(graph.files.has(resolve('src/video-comparison/previewFilmstrip.ts'))).toBe(false);
  expect(graph.packages.has('mediabunny')).toBe(false);
  expect(graph.packages.has('jsfeat')).toBe(false);
  expect([...graph.packages].some(name => name.startsWith('@tensorflow/'))).toBe(false);
  expect(graph.files.has(resolve('src/video-comparison/analysis/analyze.ts'))).toBe(false);
});
