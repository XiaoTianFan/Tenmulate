import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import manifest from '../public/assets/analysis/movenet-lightning-v4/manifest.json';
it('delivers the pinned, licensed pose graph and both weight shards without external model URLs', () => {
  for (const [name, record] of Object.entries(manifest.files)) {
    const file = readFileSync(`public/assets/analysis/movenet-lightning-v4/${name}`);
    expect(file.byteLength).toBe(record.bytes); expect(createHash('sha256').update(file).digest('hex')).toBe(record.sha256);
  }
  const graph = JSON.parse(readFileSync('public/assets/analysis/movenet-lightning-v4/model.json', 'utf8'));
  expect(graph.weightsManifest.flatMap((group: { paths: string[] }) => group.paths).sort()).toEqual(['group1-shard1of2.bin', 'group1-shard2of2.bin']);
  expect(readFileSync(`public${manifest.licenseUrl}`, 'utf8')).toContain('Apache License');
  const wasm = ['tfjs-backend-wasm.wasm', 'tfjs-backend-wasm-simd.wasm'];
  for (const name of wasm) expect([...readFileSync(`node_modules/@tensorflow/tfjs-backend-wasm/dist/${name}`).subarray(0,4)]).toEqual([0,97,115,109]);
});
