import { describe, expect, it } from 'vitest';
import { practiceDefaults } from '../src/app/practiceDefaults';
import bundled from '../src/content/project-configs.json';
import { validateProjectConfigs } from '../src/storage/projectConfigs';
import { QUICK_PRACTICE_VIEWS } from '../src/domain/practiceViews';

const project = validateProjectConfigs(bundled).practiceConfigs;
describe('Quick Practice reset defaults', () => {
  it('restores the complete project config without mutating its zones or camera', () => {
    const reset = practiceDefaults('Return Practice', project);
    expect(reset).toEqual(project['Return Practice']);
    expect(reset.launchSpeedKmh).toBe(170);
    expect(reset.camera).not.toBe(project['Return Practice']!.camera);
    expect(reset.landingZone).not.toBe(project['Return Practice']!.landingZone);
  });
  it('gives unsaved modes independent cameras and incoming shots', () => {
    const volley = practiceDefaults('Serve & Volley', project);
    const overhead = practiceDefaults('Net & Overhead', project);
    expect(volley.camera).toEqual(QUICK_PRACTICE_VIEWS.volley);
    expect(volley.shotType).toBe('groundstroke');
    expect(overhead.camera).toEqual(QUICK_PRACTICE_VIEWS.overhead);
    expect(overhead.shotType).toBe('lob');
    expect(overhead.landingDepthM).not.toBe(volley.landingDepthM);
  });
});
