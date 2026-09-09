import { compileSession, type SessionSettings } from './compileSession';
import { compilePracticePreview, preparePreviewBatch } from './practicePreview';
import type { DrillDefinitionV1 } from '../../content/types';

self.onmessage = ({ data }: MessageEvent<{ drill: DrillDefinitionV1; settings: SessionSettings; preview: boolean }>) => {
  try {
    let session = data.preview ? compilePracticePreview(data.drill, data.settings) : compileSession(data.drill, data.settings);
    if (session.previewLoop) {
      const previewNext = preparePreviewBatch({ drill: data.drill, settings: session.settings, last: session.repetitions.at(-1)!, cycle: 1 });
      // A failed next connection is visible immediately, not a hidden reset at the seam.
      session = previewNext.next.repetitions.length ? { ...session, previewNext }
        : { ...session, previewLoop: undefined, planningIssues: previewNext.next.planningIssues };
    }
    self.postMessage({ session });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
