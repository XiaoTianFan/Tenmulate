/** Pure PCM authoring shared by the asset builder, fallback and browser DSP tests. */
export function noiseRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2147483648 - 1; };
}

export function normalizePcm(samples: Float32Array, peak = .7): Float32Array {
  let maximum = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) throw new Error('Non-finite audio sample');
    maximum = Math.max(maximum, Math.abs(sample));
  }
  if (maximum > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / maximum;
  return samples;
}

export function bouncePcm(sampleRate: number, frequency: number, decay: number, grit: number, seed: number) {
  const result = new Float32Array(Math.ceil(sampleRate * .26));
  const random = noiseRandom(seed);
  let filtered = 0;
  for (let i = 0; i < result.length; i++) {
    const t = i / sampleRate;
    filtered += .22 * (random() - filtered);
    const attack = Math.min(1, t / .0007);
    // Rubber body, short broadband ground transient, and felt/ground friction.
    const body = Math.sin(2 * Math.PI * frequency * t + .8 * (1 - Math.exp(-t * 100))) * Math.exp(-t / decay);
    const shell = Math.sin(2 * Math.PI * frequency * 2.73 * t) * Math.exp(-t / .009) * .19;
    result[i] = attack * (body * .65 + shell + filtered * grit * Math.exp(-t / .018));
  }
  for (let i = result.length - 128; i < result.length; i++) result[i] *= (result.length - 1 - i) / 128;
  return normalizePcm(result, .66);
}

export function contactPcm(sampleRate: number, seed: number) {
  const samples = new Float32Array(Math.ceil(sampleRate * .2));
  const random = noiseRandom(seed);
  let body = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    body += .4 * (random() - body);
    samples[i] = Math.min(1, t / .0005) * (body * Math.exp(-t / .014)
      + .4 * Math.sin(2 * Math.PI * 290 * t) * Math.exp(-t / .021)
      + .16 * Math.sin(2 * Math.PI * 1170 * t) * Math.exp(-t / .011));
  }
  return normalizePcm(samples, .65);
}

/** Remove a seam by overlapping the tail onto the head, without a silent gap. */
export function seamlessPcm(samples: Float32Array, overlap: number): Float32Array {
  if (overlap < 2 || overlap * 2 >= samples.length) throw new Error('Invalid audio loop overlap');
  const length = samples.length - overlap;
  const result = samples.slice(0, length);
  for (let i = 0; i < overlap; i++) {
    const amount = i / (overlap - 1);
    result[i] = samples[length + i] * (1 - amount) + samples[i] * amount;
  }
  return result;
}

export function atmospherePcm(sampleRate: number, kind: 'room' | 'wind' | 'rain', seed: number) {
  const random = noiseRandom(seed);
  const samples = new Float32Array(sampleRate * 6);
  let low = 0; let bass = 0;
  const cutoff = kind === 'room' ? .018 : kind === 'wind' ? .055 : .55;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    low += cutoff * (random() - low);
    bass += .003 * (low - bass);
    const modulation = kind === 'wind' ? .6 + .2 * Math.sin(t * 1.17) + .13 * Math.sin(t * 2.83) : 1;
    samples[i] = (low - bass) * modulation;
  }
  return normalizePcm(seamlessPcm(samples, Math.round(sampleRate * .4)), .32);
}

export type ImpulseParameters = Readonly<{ decay: number; preDelay: number; damping: number;
  reflections: readonly Readonly<{ time: number; gain: number }>[] }>;
export function impulsePcm(sampleRate: number, parameters: ImpulseParameters, seed: number) {
  const samples = new Float32Array(Math.ceil(sampleRate * (parameters.decay + parameters.preDelay)));
  const random = noiseRandom(seed);
  const alpha = 1 - Math.exp(-2 * Math.PI * parameters.damping / sampleRate);
  let low = 0;
  const start = Math.round(parameters.preDelay * sampleRate);
  for (let i = start; i < samples.length; i++) {
    const t = (i - start) / sampleRate;
    low += alpha * (random() - low);
    samples[i] = low * Math.exp(-6.91 * t / parameters.decay) * Math.min(1, t / .012) * .045;
  }
  for (const reflection of parameters.reflections) {
    const index = Math.round(reflection.time * sampleRate);
    if (index < samples.length) samples[index] += reflection.gain;
  }
  return samples;
}
