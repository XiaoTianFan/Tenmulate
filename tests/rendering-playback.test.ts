import { describe, expect, it } from 'vitest';
import { trajectoryPlaybackState } from '../src/engine/rendering/TennisScene';

describe('setup trajectory playback timing', () => {
  it('uses the configured interval as the relaunch cycle', () => {
    expect(trajectoryPlaybackState(5.2, 2.4, true, 5)).toEqual({ sampleTime: expect.closeTo(0.2, 8), visible: true });
    expect(trajectoryPlaybackState(3.2, 2.4, true, 5)).toEqual({ sampleTime: expect.closeTo(3.2, 8), visible: false });
    expect(trajectoryPlaybackState(3.2, 2.4, true, 3)).toEqual({ sampleTime: expect.closeTo(0.2, 8), visible: true });
  });

  it('leaves non-looping rehearsal playback on elapsed time', () => {
    expect(trajectoryPlaybackState(3.2, 2.4, false, 5)).toEqual({ sampleTime: 3.2, visible: true });
  });
});
