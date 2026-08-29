import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/build-neutral-opponent.mjs <input.gltf> <output.glb>');
  process.exit(1);
}

const expectedBones = [
  'root',
  'pelvis',
  'spine_01',
  'spine_02',
  'spine_03',
  'neck_01',
  'Head',
  'clavicle_l',
  'upperarm_l',
  'lowerarm_l',
  'hand_l',
  'clavicle_r',
  'upperarm_r',
  'lowerarm_r',
  'hand_r',
  'thigh_l',
  'calf_l',
  'foot_l',
  'ball_l',
  'thigh_r',
  'calf_r',
  'foot_r',
  'ball_r',
];

const json = JSON.parse(await readFile(inputPath, 'utf8'));
if (json.asset?.version !== '2.0' || json.buffers?.length !== 1) {
  throw new Error('Expected a glTF 2.0 asset with exactly one external binary buffer.');
}

const nodeNames = new Set((json.nodes ?? []).map((node) => node.name));
const missingBones = expectedBones.filter((bone) => !nodeNames.has(bone));
if (missingBones.length > 0) {
  throw new Error(`Source rig is missing required bones: ${missingBones.join(', ')}`);
}

const sourceBufferUri = json.buffers[0].uri;
if (!sourceBufferUri || sourceBufferUri.startsWith('data:')) {
  throw new Error('Expected one external .bin buffer.');
}
const binary = await readFile(path.resolve(path.dirname(inputPath), decodeURIComponent(sourceBufferUri)));
if (binary.byteLength !== json.buffers[0].byteLength) {
  throw new Error(`Buffer length mismatch: glTF declares ${json.buffers[0].byteLength}, file has ${binary.byteLength}.`);
}

const hiddenPresentationNodes = new Set(['Eyes', 'Eyebrows']);
for (const node of json.nodes ?? []) {
  if (Array.isArray(node.children)) {
    node.children = node.children.filter((index) => !hiddenPresentationNodes.has(json.nodes[index]?.name));
  }
  if (node.name === 'SuperHero_Male') node.name = 'NeutralOpponentBody';
}

json.materials = [{
  name: 'TenmulateNeutralOpponent',
  doubleSided: false,
  pbrMetallicRoughness: {
    baseColorFactor: [0.075, 0.14, 0.22, 1],
    metallicFactor: 0,
    roughnessFactor: 0.78,
  },
}];
for (const mesh of json.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) primitive.material = 0;
}
delete json.images;
delete json.textures;
delete json.samplers;
delete json.extensionsUsed;
delete json.extensionsRequired;
delete json.buffers[0].uri;

json.asset.extras = {
  ...(json.asset.extras ?? {}),
  tenmulate: {
    role: 'neutral-mocap-carrier',
    source: 'Quaternius Universal Base Characters Standard',
    sourceLicense: 'CC0-1.0',
    presentationMeshesRemovedFromScene: [...hiddenPresentationNodes],
    racketSockets: { left: 'hand_l', right: 'hand_r' },
  },
};

const pad = (buffer, fill) => {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(padding, fill)]);
};
const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
const binaryChunk = pad(binary, 0x00);
const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
const glb = Buffer.alloc(totalLength);
let offset = 0;
glb.writeUInt32LE(0x46546c67, offset); offset += 4;
glb.writeUInt32LE(2, offset); offset += 4;
glb.writeUInt32LE(totalLength, offset); offset += 4;
glb.writeUInt32LE(jsonChunk.length, offset); offset += 4;
glb.writeUInt32LE(0x4e4f534a, offset); offset += 4;
jsonChunk.copy(glb, offset); offset += jsonChunk.length;
glb.writeUInt32LE(binaryChunk.length, offset); offset += 4;
glb.writeUInt32LE(0x004e4942, offset); offset += 4;
binaryChunk.copy(glb, offset);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, glb);
console.log(JSON.stringify({
  outputPath: path.resolve(outputPath),
  bytes: glb.byteLength,
  bones: expectedBones.length,
  hiddenPresentationNodes: [...hiddenPresentationNodes],
}, null, 2));
