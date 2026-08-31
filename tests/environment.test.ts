import { describe, expect, it } from 'vitest';
import {
  SCENE_DEFINITIONS,
  VENUE_IDS,
  isOutdoorVenue,
  normalizeVenueId,
} from '../src/domain/environment';

describe('canonical scene registry', () => {
  it('defines six uniformly named outdoor-arena and indoor-court identities', () => {
    expect(VENUE_IDS).toHaveLength(6);
    expect(Object.keys(SCENE_DEFINITIONS)).toEqual(VENUE_IDS);
    expect(VENUE_IDS.map((id) => SCENE_DEFINITIONS[id].label)).toEqual([
      'Outdoor Arena · Hard', 'Outdoor Arena · Clay', 'Outdoor Arena · Grass',
      'Indoor Court · Hard', 'Indoor Court · Clay', 'Indoor Court · Grass',
    ]);
    expect(VENUE_IDS.map((id) => SCENE_DEFINITIONS[id].defaultSurface)).toEqual([
      'hard', 'clay', 'grass', 'hard', 'clay', 'grass',
    ]);
  });

  it('keeps outdoor and indoor lighting families explicit', () => {
    expect(VENUE_IDS.filter(isOutdoorVenue)).toEqual(['hard-open-arena', 'clay-sunset-arena', 'grass-center-court']);
    expect(VENUE_IDS.filter((id) => !isOutdoorVenue(id))).toEqual(['timber-hall', 'clay-stadium', 'covered-grass-arena']);
  });

  it('migrates stored legacy venue identifiers without guessing', () => {
    expect(normalizeVenueId('outdoor')).toBe('hard-open-arena');
    expect(normalizeVenueId('outdoor-club')).toBe('hard-open-arena');
    expect(normalizeVenueId('clay-terrace')).toBe('clay-sunset-arena');
    expect(normalizeVenueId('grass-park-night')).toBe('grass-center-court');
    expect(normalizeVenueId('club-hall')).toBe('timber-hall');
    expect(normalizeVenueId('stadium')).toBe('clay-stadium');
    expect(normalizeVenueId('unknown')).toBe('hard-open-arena');
  });
});
