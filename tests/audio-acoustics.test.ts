import { expect, it } from 'vitest';
import { ACOUSTICS, audienceGain, environmentalLevels, cueVariation, SURFACE_SOUND } from '../src/engine/audio/acoustics';
import { atmospherePcm, bouncePcm, impulsePcm, normalizePcm } from '../src/engine/audio/synthesis';
import { DEFAULT_ENVIRONMENT, SCENE_DEFINITIONS, VENUE_IDS } from '../src/domain/environment';

it('uses every authoritative venue and occupancy, keeping empty courts silent and indoor weather out', () => {
  expect(Object.keys(ACOUSTICS).sort()).toEqual([...VENUE_IDS].sort());
  for (const venue of VENUE_IDS) {
    const profile = ACOUSTICS[venue];
    expect(profile.outdoor).toBe(SCENE_DEFINITIONS[venue].setting === 'outdoor');
    for (const audience of ['empty', 'half', 'full'] as const) {
      const levels = environmentalLevels({ ...DEFAULT_ENVIRONMENT, venue, audience, windSpeedMps: 15, weather: 'rain', weatherIntensity: 1 });
      expect(levels.wind).toBe(profile.outdoor ? 1 : 0);
      expect(levels.rain).toBe(profile.outdoor ? 1 : 0);
      if (audience === 'empty') expect(audienceGain(audience, false) + audienceGain(audience, true)).toBe(0);
      else expect(audienceGain(audience, true)).toBeLessThan(audienceGain(audience, false));
    }
  }
  expect(audienceGain('half', false)).toBeLessThan(audienceGain('full', false));
});

it('has measurable room tails past outdoor decay and distinct surface transients', () => {
  const rate = 24000;
  for (const venue of VENUE_IDS) {
    const response = impulsePcm(rate, ACOUSTICS[venue], 421);
    const tail = response.slice(rate * .5).reduce((sum, sample) => sum + sample * sample, 0);
    if (ACOUSTICS[venue].outdoor) expect(tail).toBe(0);
    else expect(tail).toBeGreaterThan(0);
    expect(response.every(Number.isFinite)).toBe(true);
  }
  const samples = Object.values(SURFACE_SOUND).map(surface => bouncePcm(rate, surface.frequency, surface.decay, surface.grit, 15));
  expect(samples[0]).not.toEqual(samples[1]);
  expect(samples[1]).not.toEqual(samples[2]);
  const tailEnergy = (samples: Float32Array) => samples.slice(rate * .06).reduce((sum, value) => sum + value * value, 0);
  expect(tailEnergy(samples[0])).toBeGreaterThan(tailEnergy(samples[2]));
});

it('generates deterministic non-tonal atmospheres with seamless boundaries', () => {
  for (const kind of ['room', 'wind', 'rain'] as const) {
    const pcm = atmospherePcm(24000, kind, 57);
    expect(pcm).toEqual(atmospherePcm(24000, kind, 57));
    expect(pcm.every(Number.isFinite)).toBe(true);
    const energy = pcm.reduce((sum, sample) => sum + sample * sample, 0) / pcm.length;
    expect(energy).toBeGreaterThan(.00001);
    // The seam must be within ordinary sample-to-sample changes, not a discontinuity.
    let maximumStep = 0;
    for (let i = 1; i < pcm.length; i++) maximumStep = Math.max(maximumStep, Math.abs(pcm[i] - pcm[i - 1]));
    expect(Math.abs(pcm[0] - pcm.at(-1)!)).toBeLessThanOrEqual(maximumStep);
  }
  expect(() => normalizePcm(new Float32Array([NaN]))).toThrow('Non-finite');
});

it('varies audio locally without unbounded pitch or global random state', () => {
  const variants = new Set<number>();
  for (let i = 0; i < 100; i++) {
    const variation = cueVariation(`flight:${i}`, 42);
    expect(variation).toEqual(cueVariation(`flight:${i}`, 42));
    expect(variation.rate).toBeGreaterThanOrEqual(.975);
    expect(variation.rate).toBeLessThanOrEqual(1.025);
    variants.add(variation.variant);
  }
  expect(variants.size).toBe(3);
});
