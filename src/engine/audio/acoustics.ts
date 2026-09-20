import type { SurfaceId } from '../../domain/court';
import type { AudienceOccupancy, EnvironmentConfiguration, VenueId } from '../../domain/environment';

/** Artistic profiles, not measurements of real buildings. Seconds and Hz. */
export type AcousticProfile = Readonly<{
  decay: number; preDelay: number; wet: number; damping: number;
  reflections: readonly Readonly<{ time: number; gain: number }>[];
  roomTone: number; outdoor: boolean;
}>;

export const ACOUSTICS: Readonly<Record<VenueId, AcousticProfile>> = {
  'hard-open-arena': { decay: .32, preDelay: .025, wet: .12, damping: 4800,
    reflections: [{ time: .042, gain: .18 }, { time: .096, gain: .09 }], roomTone: .1, outdoor: true },
  'clay-sunset-arena': { decay: .23, preDelay: .034, wet: .09, damping: 3600,
    reflections: [{ time: .061, gain: .15 }, { time: .119, gain: .07 }], roomTone: .08, outdoor: true },
  'grass-center-court': { decay: .4, preDelay: .032, wet: .1, damping: 3900,
    reflections: [{ time: .055, gain: .14 }, { time: .131, gain: .08 }], roomTone: .08, outdoor: true },
  'timber-hall': { decay: .86, preDelay: .013, wet: .23, damping: 3200,
    reflections: [{ time: .019, gain: .32 }, { time: .038, gain: .21 }, { time: .064, gain: .14 }], roomTone: .16, outdoor: false },
  'clay-stadium': { decay: 1.55, preDelay: .027, wet: .27, damping: 3800,
    reflections: [{ time: .037, gain: .28 }, { time: .074, gain: .2 }, { time: .113, gain: .13 }], roomTone: .12, outdoor: false },
  'covered-grass-arena': { decay: 1.12, preDelay: .018, wet: .2, damping: 2900,
    reflections: [{ time: .026, gain: .27 }, { time: .051, gain: .22 }, { time: .092, gain: .1 }], roomTone: .11, outdoor: false },
};

export const SURFACE_SOUND: Readonly<Record<SurfaceId, Readonly<{ frequency: number; decay: number; grit: number; cutoff: number }>>> = {
  hard: { frequency: 185, decay: .043, grit: .24, cutoff: 4200 },
  clay: { frequency: 150, decay: .033, grit: .34, cutoff: 2800 },
  grass: { frequency: 125, decay: .024, grit: .13, cutoff: 1700 },
};

export const AUDIO_LIMITS = Object.freeze({ shippedBytes: 6 * 1024 * 1024,
  decodedBytes: 32 * 1024 * 1024, voices: 32, convolvers: 2, muteFadeSeconds: .04 });

export const audienceGain = (occupancy: AudienceOccupancy, rally: boolean) =>
  (occupancy === 'empty' ? 0 : occupancy === 'half' ? .42 : .75) * (rally ? .32 : 1);

export function environmentalLevels(environment: EnvironmentConfiguration) {
  const profile = ACOUSTICS[environment.venue];
  return { room: profile.roomTone,
    wind: profile.outdoor ? Math.min(1, Math.max(0, environment.windSpeedMps) / 15) : 0,
    rain: profile.outdoor && environment.weather === 'rain' ? Math.min(1, Math.max(0, environment.weatherIntensity)) : 0 };
}

/** Audio-only PRNG: never consumes the simulation's random sequence. */
export function audioRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function cueVariation(id: string, seed: number) {
  let hash = seed | 0;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const random = audioRandom(hash);
  return { variant: Math.floor(random() * 3), rate: .975 + random() * .05, gain: .93 + random() * .07 };
}
