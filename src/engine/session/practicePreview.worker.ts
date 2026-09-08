import { preparePreviewBatch, type PreviewBatchRequest } from './practicePreview';

self.onmessage = ({ data }: MessageEvent<PreviewBatchRequest>) => {
  self.postMessage(preparePreviewBatch(data));
};
