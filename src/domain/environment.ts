import type { SurfaceId } from './court';

export const VENUE_IDS = [
  'outdoor-club',
  'clay-terrace',
  'grass-park-night',
  'timber-hall',
  'clay-stadium',
  'covered-grass-arena',
] as const;

export type VenueId = (typeof VENUE_IDS)[number];
export type VenueSetting = 'outdoor' | 'indoor';
export type LightingPreset = 'day' | 'golden-hour' | 'night' | 'indoor-neutral' | 'indoor-warm' | 'indoor-bright';
export type WeatherCondition = 'clear' | 'overcast' | 'rain';

export type SceneDefinition = Readonly<{
  id: VenueId;
  label: string;
  shortLabel: string;
  setting: VenueSetting;
  defaultSurface: SurfaceId;
  defaultLighting: LightingPreset;
  background: number;
  fogNear: number;
  fogFar: number;
}>;

export const SCENE_DEFINITIONS: Readonly<Record<VenueId, SceneDefinition>> = Object.freeze({
  'outdoor-club': {
    id: 'outdoor-club', label: 'Outdoor blue & green club', shortLabel: 'Outdoor club', setting: 'outdoor',
    defaultSurface: 'hard', defaultLighting: 'day', background: 0x8fc5eb, fogNear: 48, fogFar: 108,
  },
  'clay-terrace': {
    id: 'clay-terrace', label: 'Mediterranean clay terrace', shortLabel: 'Clay terrace', setting: 'outdoor',
    defaultSurface: 'clay', defaultLighting: 'golden-hour', background: 0xd7a46d, fogNear: 50, fogFar: 112,
  },
  'grass-park-night': {
    id: 'grass-park-night', label: 'Grass park under lights', shortLabel: 'Grass park', setting: 'outdoor',
    defaultSurface: 'grass', defaultLighting: 'night', background: 0x07121d, fogNear: 42, fogFar: 88,
  },
  'timber-hall': {
    id: 'timber-hall', label: 'Timber & steel club hall', shortLabel: 'Timber hall', setting: 'indoor',
    defaultSurface: 'hard', defaultLighting: 'indoor-warm', background: 0x32383a, fogNear: 46, fogFar: 90,
  },
  'clay-stadium': {
    id: 'clay-stadium', label: 'Indoor clay tournament stadium', shortLabel: 'Clay stadium', setting: 'indoor',
    defaultSurface: 'clay', defaultLighting: 'indoor-bright', background: 0x24282d, fogNear: 48, fogFar: 96,
  },
  'covered-grass-arena': {
    id: 'covered-grass-arena', label: 'Covered grass arena', shortLabel: 'Covered grass', setting: 'indoor',
    defaultSurface: 'grass', defaultLighting: 'indoor-neutral', background: 0x8b9da6, fogNear: 52, fogFar: 104,
  },
});

export type EnvironmentConfiguration = Readonly<{
  venue: VenueId;
  lighting: LightingPreset;
  lightDirection: number;
  lightIntensity: number;
  timeOfDay: number;
  weather: WeatherCondition;
  weatherIntensity: number;
  windDirection: number;
  windSpeedMps: number;
}>;

export const DEFAULT_ENVIRONMENT: EnvironmentConfiguration = Object.freeze({
  venue: 'outdoor-club',
  lighting: 'day',
  lightDirection: -35,
  lightIntensity: 1,
  timeOfDay: 14,
  weather: 'clear',
  weatherIntensity: 0,
  windDirection: 0,
  windSpeedMps: 0,
});

export const VENUE_LABELS: Readonly<Record<VenueId, string>> = Object.freeze(
  Object.fromEntries(VENUE_IDS.map((id) => [id, SCENE_DEFINITIONS[id].label])) as Record<VenueId, string>,
);

export const isOutdoorVenue = (venue: VenueId): boolean => SCENE_DEFINITIONS[venue].setting === 'outdoor';

export const normalizeVenueId = (value: unknown): VenueId => {
  if (typeof value === 'string' && (VENUE_IDS as readonly string[]).includes(value)) return value as VenueId;
  if (value === 'outdoor') return 'outdoor-club';
  if (value === 'club-hall') return 'timber-hall';
  if (value === 'stadium') return 'clay-stadium';
  return DEFAULT_ENVIRONMENT.venue;
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export const normalizeEnvironmentConfiguration = (value: unknown): EnvironmentConfiguration => {
  const candidate = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const weather = candidate.weather === 'overcast' || candidate.weather === 'rain' ? candidate.weather : 'clear';
  return {
    venue: normalizeVenueId(candidate.venue),
    lighting: candidate.lighting === 'day' || candidate.lighting === 'golden-hour' || candidate.lighting === 'night'
      || candidate.lighting === 'indoor-neutral' || candidate.lighting === 'indoor-warm' || candidate.lighting === 'indoor-bright'
      ? candidate.lighting
      : DEFAULT_ENVIRONMENT.lighting,
    lightDirection: clampNumber(candidate.lightDirection, DEFAULT_ENVIRONMENT.lightDirection, -180, 180),
    lightIntensity: clampNumber(candidate.lightIntensity, DEFAULT_ENVIRONMENT.lightIntensity, 0.35, 1.5),
    timeOfDay: clampNumber(candidate.timeOfDay, DEFAULT_ENVIRONMENT.timeOfDay, 0, 24),
    weather,
    weatherIntensity: clampNumber(candidate.weatherIntensity, weather === 'clear' ? 0 : 0.6, 0, 1),
    windDirection: clampNumber(candidate.windDirection, DEFAULT_ENVIRONMENT.windDirection, -180, 180),
    windSpeedMps: clampNumber(candidate.windSpeedMps, DEFAULT_ENVIRONMENT.windSpeedMps, 0, 20),
  };
};

export const windVelocityFromEnvironment = (configuration: EnvironmentConfiguration) => {
  const radians = configuration.windDirection * Math.PI / 180;
  return Object.freeze({
    x: Math.sin(radians) * configuration.windSpeedMps,
    y: 0,
    z: Math.cos(radians) * configuration.windSpeedMps,
  });
};
