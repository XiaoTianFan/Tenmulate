import { describe, expect, it } from 'vitest';
import { DEFAULT_ENVIRONMENT, VENUE_IDS, isOutdoorVenue } from '../src/domain/environment';
import { resolveVenueLighting } from '../src/engine/rendering/venueLighting';

describe('shared venue lighting schedule', () => {
  it('balances a high directional daylight key against restrained sky fill', () => {
    const day = resolveVenueLighting(DEFAULT_ENVIRONMENT);
    expect(day.elevation).toBeGreaterThan(75);
    expect(day.sunIntensity).toBeGreaterThan(day.hemisphereIntensity * 10);
    expect(day.environmentIntensity).toBeLessThan(.08);
    expect(day.fixtureScale).toBe(0);
  });
  it('keeps warm oblique sunlight and court fixtures together through evening', () => {
    const dusk = resolveVenueLighting({ ...DEFAULT_ENVIRONMENT, timeOfDay: 18.5 });
    expect(dusk.elevation).toBeGreaterThan(30);
    expect(dusk.elevation).toBeLessThan(50);
    expect(dusk.golden).toBeGreaterThan(.8);
    expect(dusk.sunIntensity).toBeGreaterThan(3);
    expect(dusk.fixtureScale).toBeGreaterThan(.25);
    expect(dusk.exposure).toBeGreaterThan(resolveVenueLighting(DEFAULT_ENVIRONMENT).exposure);
  });
  it('preserves full night floodlights, night fill and black-sky timing', () => {
    const night = resolveVenueLighting({ ...DEFAULT_ENVIRONMENT, timeOfDay: 22 });
    expect(night.elevation).toBe(-4);
    expect(night.golden).toBe(0);
    expect(night.fixtureScale).toBe(1);
    expect(night.hemisphereIntensity).toBe(.28);
    expect(night.environmentIntensity).toBe(.3);
  });
  it('shares the outdoor model without leaking sunlight into indoor halls', () => {
    for (const venue of VENUE_IDS) {
      const state = resolveVenueLighting({ ...DEFAULT_ENVIRONMENT, venue, timeOfDay: 18.5 });
      expect(state.outdoor).toBe(isOutdoorVenue(venue));
      if (isOutdoorVenue(venue)) expect(state.sunIntensity).toBeGreaterThan(0);
      else { expect(state.sunIntensity).toBe(0); expect(state.fixtureScale).toBe(1); }
    }
  });
  it('attenuates direct sun under weather and has no discontinuous dark interval', () => {
    const clear = resolveVenueLighting(DEFAULT_ENVIRONMENT);
    const rain = resolveVenueLighting({ ...DEFAULT_ENVIRONMENT, weather: 'rain', weatherIntensity: 1 });
    expect(rain.sunIntensity).toBeLessThan(clear.sunIntensity * .3);
    expect(rain.hemisphereIntensity).toBeGreaterThan(clear.hemisphereIntensity);
    for (let timeOfDay = 17; timeOfDay <= 22; timeOfDay += .1) {
      const state = resolveVenueLighting({ ...DEFAULT_ENVIRONMENT, timeOfDay });
      expect(state.sunIntensity > .5 || state.fixtureScale > .9).toBe(true);
      const next = resolveVenueLighting({ ...DEFAULT_ENVIRONMENT, timeOfDay: timeOfDay + .01 });
      expect(Math.abs(next.fixtureScale - state.fixtureScale)).toBeLessThan(.025);
    }
  });
});
