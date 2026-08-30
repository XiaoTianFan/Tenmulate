import { describe, expect, it } from 'vitest';
import { trajectoryPlaybackState, trajectoryPlaybackTimes } from '../src/engine/rendering/TennisScene';

describe('setup trajectory playback timing', () => {
  it('uses the configured interval as the relaunch cycle', () => {
    expect(trajectoryPlaybackState(5.2, 2.4, true, 5)).toEqual({ sampleTime: expect.closeTo(0.2, 8), visible: true });
    expect(trajectoryPlaybackState(3.2, 2.4, true, 5)).toEqual({ sampleTime: expect.closeTo(3.2, 8), visible: false });
    expect(trajectoryPlaybackState(3.2, 2.4, true, 3)).toEqual({ sampleTime: expect.closeTo(0.2, 8), visible: true });
  });

  it('leaves non-looping rehearsal playback on elapsed time', () => {
    expect(trajectoryPlaybackState(3.2, 2.4, false, 5)).toEqual({ sampleTime: 3.2, visible: true });
  });

  it('keeps earlier balls alive when the configured launch interval overlaps the trajectory', () => {
    expect(trajectoryPlaybackTimes(3.2, 4.4, true, 3)).toEqual([
      expect.closeTo(0.2, 8),
      expect.closeTo(3.2, 8),
    ]);
    expect(trajectoryPlaybackTimes(4.5, 4.4, true, 3)).toEqual([expect.closeTo(1.5, 8)]);
  });
});
