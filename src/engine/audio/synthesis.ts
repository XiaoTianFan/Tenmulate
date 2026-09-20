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

/** Short stochastic excitation with damped resonances; no sustained two-tone beep. */
export function contactPcm(sampleRate: number, seed: number) {
  const samples = new Float32Array(Math.ceil(sampleRate * .18));
  const random = noiseRandom(seed);
  const modes = [180, 530, 970, 1430, 2380].map((frequency, i) => ({
    frequency: frequency * (1 + random() * .045), decay: [.012, .009, .006, .004, .003][i]!,
    weight: [.18, .13, .09, .05, .035][i]!, phase: random() * Math.PI,
  }));
  let low = 0, previous = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, noise = random();
    low += .28 * (noise - low);
    const transient = (noise - previous) * .12 * Math.exp(-t / .0014);
    previous = noise;
    const compression = low * .8 * Math.exp(-t / .006);
    const modesValue = modes.reduce((sum, mode) => sum + mode.weight * Math.sin(2 * Math.PI * mode.frequency * t + mode.phase) * Math.exp(-t / mode.decay), 0);
    samples[i] = Math.min(1, t / .00035) * (transient + compression + modesValue);
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
