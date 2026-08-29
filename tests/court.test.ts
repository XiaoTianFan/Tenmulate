import { describe, expect, it } from 'vitest';
import { COURT } from '../src/domain/court';

describe('regulation court constants', () => {
  it('uses SI dimensions from the product contract', () => {
    expect(COURT.singlesWidth).toBe(8.23);
    expect(COURT.fullLength).toBe(23.77);
    expect(COURT.serviceLineFromNet).toBe(6.4);
    expect(COURT.netCenterHeight).toBe(0.914);
    expect(COURT.netPostHeight).toBe(1.07);
  });
});
