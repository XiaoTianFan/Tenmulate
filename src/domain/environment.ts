export type VenueId = 'outdoor' | 'club-hall' | 'stadium';
export type LightingPreset = 'day' | 'golden-hour' | 'night' | 'indoor-neutral' | 'indoor-warm' | 'indoor-bright';

export type EnvironmentConfiguration = Readonly<{
  venue: VenueId;
  lighting: LightingPreset;
  lightDirection: number;
  lightIntensity: number;
}>;

export const DEFAULT_ENVIRONMENT: EnvironmentConfiguration = Object.freeze({
  venue: 'outdoor',
  lighting: 'day',
  lightDirection: -35,
  lightIntensity: 1,
});

export const VENUE_LABELS: Record<VenueId, string> = {
  outdoor: 'Outdoor court complex',
  'club-hall': 'Indoor club hall',
  stadium: 'Indoor stadium',
};
