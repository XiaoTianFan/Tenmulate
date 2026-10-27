import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } from 'mediabunny';
import { createFrameIndex } from './timeline';

self.onmessage = async (event: MessageEvent<File>) => {
  const input = new Input({ source: new BlobSource(event.data), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('No readable video frames.');
    const packets: { timestamp: number; duration: number }[] = [];
    const sink = new EncodedPacketSink(track);
    for await (const packet of sink.packets(undefined, undefined, { metadataOnly: true })) {
      packets.push({ timestamp: packet.timestamp, duration: packet.duration });
      if (packets.length > 1_000_000) throw new Error('This clip is too long. Choose a shorter excerpt.');
    }
    const index = createFrameIndex(packets);
    self.postMessage({ index }, { transfer: [index.timestamps.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error && error.message === 'This clip is too long. Choose a shorter excerpt.'
      ? error.message : 'Cannot read this video. Try an MP4, MOV or WebM file.' });
  } finally { input.dispose(); }
};
