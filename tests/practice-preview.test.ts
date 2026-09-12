import { describe, expect, it } from 'vitest';
import { DRILLS } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { compilePracticePreview, ContinuousPracticePreview, preparePreviewBatch, type PreviewBatch, type PreviewBatchRequest } from '../src/engine/session/practicePreview';
import { sampleOpponentTimeline } from '../src/engine/session/opponentTimeline';
import { MAX_OPPONENT_SPEED } from '../src/engine/session/opponentMovement';
import { PRACTICE_SHOT_PROFILES } from '../src/engine/trajectory/practiceProfiles';

const settings: SessionSettings={repetitions:1,workBlockSize:1,restSeconds:120,shotIntervalSeconds:1,
  rhythmPercent:150,variationPercent:8,timingVariationPercent:0,launchSpeedKmh:70,spin:'preset',surface:'hard',
  seed:'preview-seam',opponentHand:'right',serveRhythm:'preset',mode:'quick-practice',practiceShotType:'groundstroke'};

describe('continuous practice preview',()=>{
  it('uses prefetched batches with identical trajectories and seam timing, including rewind', async () => {
    const initial = compilePracticePreview(DRILLS[0]!, settings);
    const serial = new ContinuousPracticePreview(initial);
    const asyncPreview = new ContinuousPracticePreview(initial, {
      compile: async request => structuredClone(preparePreviewBatch(structuredClone(request))), dispose() {},
    });
    let time = 0;
    for (let i = 0; i < 4; i++) {
      await Promise.resolve();
      time = serial.frame(time).nextContact;
      expect(asyncPreview.frame(time)).toEqual(serial.frame(time));
    }
    expect(asyncPreview.frame(0)).toEqual(serial.frame(0));
    await Promise.resolve();
    time = serial.frame(0).nextContact;
    expect(asyncPreview.frame(time)).toEqual(serial.frame(time));
    expect(asyncPreview.preparation.cacheHits).toBe(5);
    expect(asyncPreview.preparation.cacheMisses).toBe(0);
    // Serial, cloned-worker and rewind paths now compare both incoming and player
    // flights across five batches; allow that larger workload in the parallel suite.
  }, 10_000);

  it('ignores stale async results after a seek and preserves deterministic synchronous recovery', async () => {
    const initial = compilePracticePreview(DRILLS[0]!, settings);
    const pending: { request: PreviewBatchRequest; resolve: (batch: PreviewBatch) => void }[] = [];
    let disposed = false;
    const preview = new ContinuousPracticePreview(initial, {
      compile: request => new Promise(resolve => pending.push({ request, resolve })),
      dispose: () => { disposed = true; },
    });
    const serial = new ContinuousPracticePreview(initial), first = preview.frame(0);
    expect(preview.frame(first.nextContact)).toEqual(serial.frame(first.nextContact));
    expect(preview.preparation.cacheMisses).toBe(1);
    preview.frame(0); serial.frame(0);
    pending[1]!.resolve(preparePreviewBatch(pending[1]!.request));
    await Promise.resolve();
    expect(preview.preparation.ready).toBe(false);
    pending[2]!.resolve(preparePreviewBatch(pending[2]!.request));
    await Promise.resolve();
    expect(preview.frame(first.nextContact)).toEqual(serial.frame(first.nextContact));
    preview.dispose();
    pending.at(-1)!.resolve(preparePreviewBatch(pending.at(-1)!.request));
    await Promise.resolve();
    expect(preview.preparation.ready).toBe(false); expect(disposed).toBe(true);
  });

  it('reports worker failure while keeping the exact playable sequence', async () => {
    const initial = compilePracticePreview(DRILLS[0]!, settings);
    const preview = new ContinuousPracticePreview(initial, { compile: async () => { throw new Error('unavailable'); }, dispose() {} });
    const serial = new ContinuousPracticePreview(initial);
    await Promise.resolve(); await Promise.resolve();
    expect(preview.preparation.mode).toBe('synchronous');
    const time = preview.frame(0).nextContact;
    expect(preview.frame(time)).toEqual(serial.frame(time));
  });
  it.each(['groundstroke','serve','volley','overhead','lob'] as const)('continues fresh %s feeds across batch boundaries without rest, countdown or root reset',family=>{
    const profile=PRACTICE_SHOT_PROFILES[family];
    const session=compilePracticePreview(DRILLS[0]!,{...settings,practiceShotType:family,launchSpeedKmh:profile.defaultLaunchSpeedKmh,
      opponentPosition:profile.opponentPosition,landingDepthM:profile.defaultLandingDepthM});
    expect(session.restPeriods).toHaveLength(0);
    const preview=new ContinuousPracticePreview(session), first=preview.frame(0);
    let frame=first;
    for(let cycle=1;cycle<=4;cycle++){
      const seam=frame.nextContact, before=preview.frame(seam-1/240), after=preview.frame(seam+1/240);
      const a=sampleOpponentTimeline(before.events,seam-1/240)!,b=sampleOpponentTimeline(after.events,seam+1/240)!;
      expect(Math.hypot(a.root.x-b.root.x,a.root.z-b.root.z)).toBeLessThan(MAX_OPPONENT_SPEED/120+.001);
      expect(Math.abs(a.yaw-b.yaw)).toBeLessThan(.1);
      expect(after.cycle).toBe(cycle);expect(after.flights[0]!.time).toBeCloseTo(1/240,6);
      expect(after.events.length).toBe(18);
      expect(after.repetition.shot.target).not.toEqual(frame.repetition.shot.target);
      expect(after.nextContact-seam).toBeLessThan(90);
      frame=after;
    }
    expect(preview.frame(0)).toEqual(first);
  });
  it('leaves launched set counts and rest durations finite and intact',()=>{
    const session=compileSession(DRILLS[0]!,{...settings,repetitions:3});
    expect(session.previewLoop).toBeUndefined();expect(session.repetitions).toHaveLength(3);
    expect(session.restPeriods).toHaveLength(2);
    for(const rest of session.restPeriods)expect(rest.endTime-rest.startTime).toBeCloseTo(120,8);
    expect(Number.isFinite(session.duration)).toBe(true);
  });
});
