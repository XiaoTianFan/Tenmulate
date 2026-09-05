import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, instance, weld, prune, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import validator from 'gltf-validator';

const root = new URL('../../', import.meta.url);
const venue = process.argv[2] ?? 'hard-open-arena';
if (!['hard-open-arena', 'clay-sunset-arena', 'grass-center-court', 'timber-hall', 'clay-stadium', 'covered-grass-arena'].includes(venue)) throw new Error('Unsupported venue build target');
const build = new URL(venue === 'hard-open-arena' ? 'artifacts/venue-build/' : `artifacts/venue-build/${venue}/`, root);
const output = new URL(`public/assets/venues/${venue}/`, root);
await mkdir(output, { recursive: true });
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
async function variant(mode) {
const suffix = mode === 'performance' ? '.performance' : '';
const document = await io.read(fileURLToPath(new URL(`${venue}${suffix}.raw.glb`, build)));
const nodes = document.getRoot().listNodes();
const expected = { court_origin: [0, 0, 0], baseline_near: [0, 0, -11.885],
  baseline_far: [0, 0, 11.885], net_center: [0, .914, 0],
  doubles_left: [-5.485, 0, 0], doubles_right: [5.485, 0, 0] };
for (const [name, position] of Object.entries(expected)) {
  const node = nodes.find(node => node.getName() === name);
  if (!node || node.getWorldTranslation().some((v, i) => Math.abs(v - position[i]) > .001)) {
    throw new Error(`Invalid court registration: ${name}`);
  }
}
// Check the uncompressed reference; the Khronos validator does not decode Meshopt.
const reference = await readFile(new URL(`${venue}${suffix}.raw.glb`, build));
const validation = await validator.validateBytes(new Uint8Array(reference), { maxIssues: 5000 });
await writeFile(new URL(`gltf-validation${suffix}.json`, build), JSON.stringify(validation, null, 2));
if (validation.issues.numErrors) throw new Error(`${validation.issues.numErrors} glTF validation errors`);
await document.transform(dedup(), instance({ min: 5 }), weld(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: mode === 'performance' ? [256, 256] : [1024, 1024], quality: mode === 'performance' ? 72 : 85 }),
  prune({ keepExtras: true, keepLeaves: true }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16 }));
// Enforce cutout rather than blended net rendering in the published glTF.
// This happens before hashing and after all transforms.
for (const material of document.getRoot().listMaterials()) {
  if (material.getName().includes('Performance woven net')) material.setAlphaMode('MASK').setAlphaCutoff(.35);
}
const published = await io.writeBinary(document);
const publishedHash = createHash('sha256').update(published).digest('hex');
const filename = `${venue}${suffix}.${publishedHash.slice(0, 12)}.glb`;
await writeFile(new URL(filename, output), published);
const stats = JSON.parse(await readFile(new URL('blender-build.json', build), 'utf8'));
const manifest = {
  id: venue, version: 1, compatibility: 'tenmulate-court-v1',
  url: `/assets/venues/${venue}/${filename}`, bytes: published.length, sha256: publishedHash,
  source: `assets/venues/${venue}/${venue}.blend`,
  anchors: expected, seats: stats.seats,
  extensions: document.getRoot().listExtensionsUsed().map(e => e.extensionName),
  materials: document.getRoot().listMaterials().length,
  meshes: document.getRoot().listMeshes().length,
  textureBytes: document.getRoot().listTextures().reduce((s,t) => s+(t.getImage()?.byteLength ?? 0),0),
};
// Read back the optimized binary through both decoders before publishing the manifest.
const decoded = await io.readBinary(published);
for (const [name, position] of Object.entries(expected)) {
  const node = decoded.getRoot().listNodes().find(n => n.getName() === name);
  if (!node || node.getWorldTranslation().some((v,i) => Math.abs(v-position[i]) > .001)) throw new Error(`Lost anchor: ${name}`);
}
if (published.length > (mode === 'performance' ? 4 : 15)*1024*1024) throw new Error('Venue exceeds its asset budget');
return manifest;
}
const quality = await variant('quality');
const performance = await variant('performance');
const stats = JSON.parse(await readFile(new URL('performance-build.json', build), 'utf8'));
const seatBytes = await readFile(new URL('audience-seats.json', build));
const seatHash = createHash('sha256').update(seatBytes).digest('hex');
const seatName = `audience-seats.${seatHash.slice(0,12)}.json`;
await writeFile(new URL(seatName, output), seatBytes);
const manifest = { ...quality, performance, geometry: stats,
  audience: { url: `/assets/venues/${venue}/${seatName}`, bytes: seatBytes.length, sha256: seatHash, count: stats.seats } };
if (performance.bytes >= quality.bytes*.65) throw new Error('Performance payload must be at least 35% smaller');
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ id: venue, qualityBytes: quality.bytes, performanceBytes: performance.bytes, ...stats }));
