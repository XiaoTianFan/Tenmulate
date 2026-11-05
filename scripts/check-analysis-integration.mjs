import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { parse } from '@babel/parser';

const root = resolve('dist'), assets = resolve(root, 'assets');
const optional = /^(?:analysis\/|(?:analyze|analysis\.worker|pose\.worker|poseRuntime|speed\.worker|data\.worker|decodedVideo|nativeVideo|videoFrames|indexVideo\.worker|previewFrames|reviewSession|previewFilmstrip)-)/;
const workers = readdirSync(assets).filter(name => /^(?:analysis|pose|speed|data)\.worker-.*\.js$/.test(name));
if (workers.length !== 4) throw new Error('Expected separate point, pose, serve-speed and data-export workers.');

// A dependency that imports a worker entry can re-run its global message handler
// in WebKit. Check the emitted module graph, where shared bundler helpers live.
const visited = new Set();
for (const entry of readdirSync(assets).filter(name => name.endsWith('.js'))) {
  function visit(file) {
    if (visited.has(file)) return; visited.add(file);
    const tree = parse(readFileSync(file, 'utf8'), { sourceType: 'module' });
    for (const node of tree.program.body) {
      if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) || !node.source) continue;
      const name = node.source.value;
      if (!name.startsWith('.')) throw new Error(`External analysis runtime import: ${name}`);
      const target = resolve(dirname(file), name);
      if (workers.includes(basename(target))) throw new Error(`Analysis chunk imports a worker entry: ${file} → ${name}`);
      visit(target);
    }
  }
  visit(resolve(assets, entry));
}
const serviceWorker = readFileSync(resolve(root, 'sw.js'), 'utf8');
const cached = [...serviceWorker.matchAll(/\burl:\s*["']([^"']+)["']/g)].map(match => match[1]);
if (!cached.length) throw new Error('Could not inspect the service-worker precache.');
for (const url of cached) if (optional.test(url.replace(/^\/?assets\//, ''))) throw new Error(`Analysis asset is precached: ${url}`);
for (const file of ['tfjs-backend-wasm.wasm', 'tfjs-backend-wasm-simd.wasm']) {
  const path = resolve(assets, 'analysis/tfjs-4.22.0', file);
  if (!existsSync(path) || readFileSync(path).subarray(0, 4).toString('hex') !== '0061736d') throw new Error(`Missing WASM delivery: ${file}`);
}
const manifest = JSON.parse(readFileSync(resolve(assets, 'analysis/movenet-lightning-v4/manifest.json'), 'utf8'));
for (const name of Object.keys(manifest.files)) if (!existsSync(resolve(assets, 'analysis/movenet-lightning-v4', name))) throw new Error(`Missing pose asset: ${name}`);
console.log('Analysis workers, optional caching and model/WASM delivery passed.');
