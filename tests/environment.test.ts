import { describe, expect, it } from 'vitest';
import {
  SCENE_DEFINITIONS,
  VENUE_IDS,
  isOutdoorVenue,
  normalizeVenueId,
} from '../src/domain/environment';

describe('canonical scene registry', () => {
  it('defines nine complete, distinct scene identities', () => {
    expect(VENUE_IDS).toHaveLength(9);
    expect(Object.keys(SCENE_DEFINITIONS)).toEqual(VENUE_IDS);
    expect(new Set(VENUE_IDS.map((id) => SCENE_DEFINITIONS[id].label)).size).toBe(9);
    expect(VENUE_IDS.map((id) => SCENE_DEFINITIONS[id].defaultSurface)).toEqual([
      'hard', 'clay', 'grass', 'hard', 'clay', 'grass', 'hard', 'clay', 'grass',
    ]);
  });

  it('keeps outdoor and indoor lighting families explicit', () => {
    expect(VENUE_IDS.filter(isOutdoorVenue)).toEqual(['outdoor-club', 'clay-terrace', 'grass-park-night', 'hard-open-arena', 'clay-sunset-arena', 'grass-center-court']);
    expect(VENUE_IDS.filter((id) => !isOutdoorVenue(id))).toEqual(['timber-hall', 'clay-stadium', 'covered-grass-arena']);
  });

  it('migrates stored legacy venue identifiers without guessing', () => {
    expect(normalizeVenueId('outdoor')).toBe('outdoor-club');
    expect(normalizeVenueId('club-hall')).toBe('timber-hall');
    expect(normalizeVenueId('stadium')).toBe('clay-stadium');
    expect(normalizeVenueId('clay-terrace')).toBe('clay-terrace');
    expect(normalizeVenueId('unknown')).toBe('outdoor-club');
  });
});
