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
const build = new URL('artifacts/venue-build/', root);
const output = new URL('public/assets/venues/hard-open-arena/', root);
await mkdir(output, { recursive: true });
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const document = await io.read(fileURLToPath(new URL('hard-open-arena.raw.glb', build)));
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
const reference = await readFile(new URL('hard-open-arena.raw.glb', build));
const validation = await validator.validateBytes(new Uint8Array(reference), { maxIssues: 5000 });
await writeFile(new URL('gltf-validation.json', build), JSON.stringify(validation, null, 2));
if (validation.issues.numErrors) throw new Error(`${validation.issues.numErrors} glTF validation errors`);
await document.transform(dedup(), instance({ min: 5 }), weld(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }),
  prune({ keepExtras: true, keepLeaves: true }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16 }));
const bytes = await io.writeBinary(document);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const filename = `hard-open-arena.${sha256.slice(0, 12)}.glb`;
await writeFile(new URL(filename, output), bytes);
const stats = JSON.parse(await readFile(new URL('blender-build.json', build), 'utf8'));
const manifest = {
  id: 'hard-open-arena', version: 1, compatibility: 'tenmulate-court-v1',
  url: `/assets/venues/hard-open-arena/${filename}`, bytes: bytes.length, sha256,
  source: 'assets/venues/hard-open-arena/hard-open-arena.blend',
  anchors: expected, seats: stats.seats,
  extensions: document.getRoot().listExtensionsUsed().map(e => e.extensionName),
  materials: document.getRoot().listMaterials().length,
  meshes: document.getRoot().listMeshes().length,
  textureBytes: document.getRoot().listTextures().reduce((s,t) => s+(t.getImage()?.byteLength ?? 0),0),
};
// Read back the optimized binary through both decoders before publishing the manifest.
const decoded = await io.readBinary(bytes);
for (const [name, position] of Object.entries(expected)) {
  const node = decoded.getRoot().listNodes().find(n => n.getName() === name);
  if (!node || node.getWorldTranslation().some((v,i) => Math.abs(v-position[i]) > .001)) throw new Error(`Lost anchor: ${name}`);
}
if (bytes.length > 15*1024*1024) throw new Error('Venue exceeds the 15 MiB additional asset budget');
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2)+'\n');
console.log(JSON.stringify(manifest, null, 2));
