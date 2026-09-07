// Check the consumer's files, independently of the sibling lab's publisher.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = async (name) => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const motion = await json('src/content/opponent-motion.json');
const carrier = await json('src/content/opponent-asset.json');
const manifest = await json('public/assets/opponents/tennis-local-v1.manifest.json');
assert.match(motion.url, /^\/assets\/opponents\/tennis-local-v1\.[a-f0-9]{12}\.glb$/);
const bytes = await fs.readFile(path.join(root, 'public', motion.url.slice(1)));
assert.equal(digest(bytes), motion.sha256, 'Runtime bundle hash');
assert.equal(bytes.length, motion.bytes, 'Runtime bundle size');
assert.equal(manifest.assetSha256, motion.sha256, 'Published provenance hash');
assert.equal(manifest.bytes, motion.bytes, 'Published provenance size');
assert.equal(manifest.partialReviewOnly, false, 'Partial review builds cannot ship');
assert.equal(manifest.carrierSha256, carrier.sha256, 'Motion uses the active model');
assert.equal(digest(await fs.readFile(path.join(root, 'public', carrier.url.slice(1)))), carrier.sha256);
assert.equal(manifest.nominalHeightMeters, carrier.nominalHeightMeters);
assert.equal(manifest.displayScale, motion.scale);
assert.equal(-manifest.bindMinY * manifest.displayScale, motion.floorOffset);
assert.equal(manifest.skeleton, motion.skeleton);

assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Binary glTF header');
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
assert.deepEqual(gltf.animations.map(({ name }) => name).sort(), Object.keys(motion.clips).sort());
assert.deepEqual(Object.keys(manifest.clips).sort(), Object.keys(motion.clips).sort());
assert.ok(gltf.nodes.some(({ name }) => name === 'RacketContact'), 'Racket contact node');
assert.ok(gltf.meshes.some(({ primitives }) => primitives.some(({ attributes }) => 'COLOR_0' in attributes)), 'Articulated panel/joint colors');
for (const [name, clip] of Object.entries(motion.clips)) {
  for (const [key, value] of Object.entries(clip)) assert.deepEqual(value, manifest.clips[name][key], `${name}.${key}`);
}
assert.ok(motion.clips['serve-compact'].duration < motion.clips.serve.duration);
assert.ok(motion.clips['serve-compact'].contact - motion.clips['serve-compact'].tossRelease
  < motion.clips.serve.contact - motion.clips.serve.tossRelease, 'Compact toss flight');

let cachedOpponentBundles;
if (process.argv.includes('--dist')) {
  const emitted = await fs.readFile(path.join(root, 'dist', motion.url.slice(1)));
  assert.equal(digest(emitted), motion.sha256, 'Built app contains the selected bundle');
  const sw = await fs.readFile(path.join(root, 'dist/sw.js'), 'utf8');
  cachedOpponentBundles = [...new Set(sw.match(/assets\/opponents\/[a-zA-Z0-9.-]+\.glb/g) ?? [])];
  assert.deepEqual(cachedOpponentBundles, [motion.url.slice(1)], 'Precache must include exactly the active opponent bundle');
}
console.log(JSON.stringify({ passed: true, asset: motion.url, sha256: motion.sha256,
  clips: Object.keys(motion.clips).length, model: carrier.id, heightMeters: carrier.nominalHeightMeters,
  cachedOpponentBundles }, null, 2));
