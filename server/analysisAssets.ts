import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** Same-origin, opt-in WASM. No threaded build or cross-origin isolation required. */
export function analysisAssetsPlugin(): Plugin {
  const root = new URL('../node_modules/@tensorflow/tfjs-backend-wasm/dist/', import.meta.url);
  const files = ['tfjs-backend-wasm.wasm', 'tfjs-backend-wasm-simd.wasm'];
  const prefix = '/assets/analysis/tfjs-4.22.0/';
  return {
    name: 'analysis-wasm-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = files.find(file => req.url?.split('?')[0] === prefix + file);
        if (!file) { next(); return; }
        res.setHeader('Content-Type', 'application/wasm'); res.end(readFileSync(fileURLToPath(new URL(file, root))));
      });
    },
    generateBundle() {
      for (const file of files) this.emitFile({ type: 'asset', fileName: prefix.slice(1) + file, source: readFileSync(fileURLToPath(new URL(file, root))) });
    },
  };
}
