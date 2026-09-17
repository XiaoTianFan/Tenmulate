/** Node 24 + ffmpeg. Sources cached outside delivery; no credentials or runtime fetch. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { bouncePcm, seamlessPcm } from '../../src/engine/audio/synthesis.ts';

const root = new URL('../../', import.meta.url);
const temp = new URL('tmp/audio-sources/', root);
const output = new URL('public/assets/audio/', root);
await mkdir(temp, { recursive: true }); await mkdir(output, { recursive: true });
const sha = data => createHash('sha256').update(data).digest('hex');
const rate = 48000;
const sources = [
  { id: 'tennis-hit-preview', file: 'tennis-hit-preview.mp3', author: 'kletton97',
    title: 'Tennis-Ball-Hit', page: 'https://freesound.org/people/kletton97/sounds/710041/',
    url: 'https://cdn.freesound.org/previews/710/710041_13507682-hq.mp3',
    sha256: '242efef5d5058e7446f15c67fe06bed97d25032874ec8df53e172868cd2efb40',
    note: 'Public HQ MP3 preview; lossy source, not the login-gated original.' },
  { id: 'well-done', file: 'well-done.flac', author: 'qubodup', title: 'Well Done',
    page: 'https://opengameart.org/content/well-done',
    url: 'https://opengameart.org/sites/default/files/Well%20Done%20CCBY3.flac',
    sha256: '41e7646fc7ff5ffd66947bda50a07f194683318b23cb193d57c1650a5ec4953b',
    note: 'Source page relicensed to CC0 on 2024-10-05; historical CCBY3 filename retained upstream.' },
  { id: 'crowd-murmur-preview', file: 'crowd-murmur-preview.mp3', author: 'jayfrosting', title: 'Murmur 1.wav',
    page: 'https://freesound.org/people/jayfrosting/sounds/333395/',
    url: 'https://cdn.freesound.org/previews/333/333395_5884138-hq.mp3',
    sha256: '390b6b9445a47102a2c66049517d37608db67f5b2e735a6119d077b951dab359',
    note: 'Public HQ MP3 preview of a studio audience; no distinct commentary is intended.' },
].map(source => ({ ...source, license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', retrieved: '2026-09-17' }));

for (const source of sources) {
  const path = new URL(source.file, temp);
  let bytes;
  try { bytes = await readFile(path); } catch {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`Source unavailable: ${source.id}: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer()); await writeFile(path, bytes);
  }
  if (sha(bytes) !== source.sha256) throw new Error(`Source hash changed: ${source.id}. Re-verify provenance before updating.`);
}
const filePath = url => decodeURIComponent(url.pathname).replace(/^\/(\w:)/, '$1');
function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
}
function wav(channels) {
  const count = channels.length, length = channels[0].length;
  const buffer = Buffer.alloc(44 + length * count * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(count, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * count * 2, 28);
  buffer.writeUInt16LE(count * 2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(length * count * 2, 40);
  for (let i = 0; i < length; i++) for (let c = 0; c < count; c++) {
    const sample = channels[c][i];
    if (!Number.isFinite(sample) || Math.abs(sample) >= 1) throw new Error('Invalid or clipped asset');
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + (i * count + c) * 2);
  }
  return buffer;
}
const assets = {};
async function publish(id, bytes, extension, metadata) {
  const hash = sha(bytes), name = `${id}.${hash.slice(0, 12)}.${extension}`;
  await writeFile(new URL(name, output), bytes);
  assets[id] = { url: `/assets/audio/${name}`, sha256: hash, bytes: bytes.length, ...metadata };
}

for (let i = 0; i < 3; i++) {
  const target = new URL(`contact-${i}.wav`, temp);
  // Remove 477 ms of leading silence; preserve the initial attack. One recorded take, three tonal variants.
  const filter = `atrim=start=0.476:end=0.78,asetpts=PTS-STARTPTS,asetrate=${rate * (1 + (i - 1) * .025)},aresample=${rate},highpass=f=85,lowpass=f=${7600 - i * 800},afade=t=out:st=0.20:d=0.08,volume=0.7`;
  ffmpeg(['-i', filePath(new URL('tennis-hit-preview.mp3', temp)), '-af', filter, '-ac', '1', '-c:a', 'pcm_s16le', filePath(target)]);
  await publish(`contact-${i}`, await readFile(target), 'wav', { source: 'tennis-hit-preview', recipe: filter, channels: 1, sampleRate: rate });
}
for (const [surface, frequency, decay, grit] of [['hard', 185, .043, .24], ['clay', 150, .033, .34], ['grass', 125, .024, .13]]) {
  for (let i = 0; i < 3; i++) {
    const seed = 812 + i;
    const pcm = bouncePcm(rate, frequency * (1 + (i - 1) * .025), decay, grit, seed);
    await publish(`bounce-${surface}-${i}`, wav([pcm]), 'wav', { source: 'authored', recipe: { function: 'bouncePcm', frequency, decay, grit, seed, variant: i }, channels: 1, sampleRate: rate });
  }
}
for (let i = 0; i < 2; i++) {
  const target = new URL(`cheer-${i}.mp3`, temp);
  const filter = `atrim=start=${i * .7}:end=${3.8 - i * .15},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=6800,afade=t=in:d=0.06,afade=t=out:st=${2.6 - i * .45}:d=0.5,volume=0.6`;
  ffmpeg(['-i', filePath(new URL('well-done.flac', temp)), '-af', filter, '-ar', String(rate), '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '128k', filePath(target)]);
  await publish(`cheer-${i}`, await readFile(target), 'mp3', { source: 'well-done', recipe: filter, channels: 2, sampleRate: rate });
}
const rawPath = new URL('murmur.f32', temp);
ffmpeg(['-i', filePath(new URL('crowd-murmur-preview.mp3', temp)), '-t', '8.8', '-af', 'highpass=f=200,lowpass=f=2100,volume=0.32', '-ar', String(rate), '-ac', '2', '-f', 'f32le', filePath(rawPath)]);
const raw = await readFile(rawPath);
const count = raw.length / 8;
const stereo = [new Float32Array(count), new Float32Array(count)];
for (let i = 0; i < count; i++) for (let c = 0; c < 2; c++) stereo[c][i] = raw.readFloatLE(i * 8 + c * 4);
const loop = stereo.map(channel => seamlessPcm(channel, rate * .8));
const loopWav = new URL('murmur-loop.wav', temp), loopMp3 = new URL('murmur-loop.mp3', temp);
await writeFile(loopWav, wav(loop));
ffmpeg(['-i', filePath(loopWav), '-c:a', 'libmp3lame', '-b:a', '128k', filePath(loopMp3)]);
await publish('murmur', await readFile(loopMp3), 'mp3', { source: 'crowd-murmur-preview', channels: 2, sampleRate: rate,
  duration: loop[0].length / rate, recipe: 'First 8.8s, 200-2100Hz, gain .32, .8s tail/head crossfade, 128kbps MP3 with gapless metadata.' });
const bytes = Object.values(assets).reduce((sum, asset) => sum + asset.bytes, 0);
if (bytes > 6 * 1024 * 1024) throw new Error('Audio transfer budget exceeded');
await writeFile(new URL('src/content/audio-palette.json', root), JSON.stringify({ version: 1, sampleRate: rate, assets }, null, 2) + '\n');
await writeFile(new URL('provenance.json', output), JSON.stringify({ version: 1, sources, generated: 'scripts/audio/build-palette.mjs with src/engine/audio/synthesis.ts', assets }, null, 2) + '\n');
await writeFile(new URL('NOTICE.txt', output), 'Tenmulate audio palette\nRecorded sources: kletton97 (Tennis-Ball-Hit), qubodup (Well Done), jayfrosting (Murmur 1.wav).\nThese recordings are CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/\nSee provenance.json for exact source links, hashes, transformations and preview limitations.\nBounce samples are authored procedural effects, not recordings.\n');
console.log(JSON.stringify({ assets: Object.keys(assets).length, shippedAudioBytes: bytes, ffmpeg: spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout.split('\n')[0] }, null, 2));
