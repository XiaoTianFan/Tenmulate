import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import palette from '../src/content/audio-palette.json';
import { AUDIO_LIMITS } from '../src/engine/audio/acoustics';

it('ships only manifested, hash-matched audio within the complete transfer budget', () => {
  const expected = Object.values(palette.assets).map(asset => asset.url.split('/').at(-1)).sort();
  const actual = readdirSync('public/assets/audio').filter(file => /\.(wav|mp3|ogg|opus)$/.test(file)).sort();
  expect(actual).toEqual(expected);
  let size = 0;
  for (const asset of Object.values(palette.assets)) {
    const bytes = readFileSync(`public${asset.url}`);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    expect(bytes.length).toBe(asset.bytes);
    size += bytes.length;
  }
  expect(size).toBeGreaterThan(0);
  expect(size).toBeLessThanOrEqual(AUDIO_LIMITS.shippedBytes);
});

it('retains useful non-clipped mono PCM impacts without a late attack', () => {
  for (const [id, asset] of Object.entries(palette.assets).filter(([id]) => /^(contact|bounce)-/.test(id))) {
    const bytes = readFileSync(`public${asset.url}`);
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    // ffmpeg WAVs may contain LIST metadata; walk RIFF chunks instead of assuming offset 44.
    let offset = 12, data = Buffer.alloc(0), sampleRate = 0;
    while (offset + 8 <= bytes.length) {
      const kind = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
      if (kind === 'fmt ') {
        expect(bytes.readUInt16LE(offset + 8)).toBe(1);
        expect(bytes.readUInt16LE(offset + 10)).toBe(1);
        sampleRate = bytes.readUInt32LE(offset + 12);
        expect(bytes.readUInt16LE(offset + 22)).toBe(16);
      }
      if (kind === 'data') data = bytes.subarray(offset + 8, offset + 8 + length);
      offset += 8 + length + length % 2;
    }
    expect(sampleRate).toBe(48000);
    expect(data.length).toBeGreaterThan(4800);
    const samples = Array.from({ length: data.length / 2 }, (_, i) => data.readInt16LE(i * 2) / 32768);
    const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    expect(peak, id).toBeGreaterThan(.05);
    expect(peak, id).toBeLessThan(.99);
    expect(samples.findIndex(sample => Math.abs(sample) > peak * .05) / sampleRate, id).toBeLessThan(.01);
    expect(Math.abs(samples.at(-1)!), id).toBeLessThan(.002);
  }
});

it('retains provenance for every recorded or procedural effect', () => {
  const provenance = JSON.parse(readFileSync('public/assets/audio/provenance.json', 'utf8'));
  expect(provenance.assets).toEqual(palette.assets);
  for (const asset of Object.values(palette.assets)) {
    expect(asset.recipe).toBeTruthy();
    if (asset.source === 'authored') continue;
    const source = provenance.sources.find((source: { id: string }) => source.id === asset.source);
    expect(source).toMatchObject({ license: 'CC0-1.0', retrieved: '2026-09-17' });
    expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(source.page).toMatch(/^https:\/\//);
    expect(source.licenseUrl).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
  }
});
