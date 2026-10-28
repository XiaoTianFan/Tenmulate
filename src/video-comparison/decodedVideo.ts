import { ALL_FORMATS, BlobSource, Input, VideoSampleSink, type VideoSample } from 'mediabunny';
import { FrameBuffer, type BufferedFrame } from './frameBuffer';
import { frameSeekTime, type FrameIndex } from './timeline';

/** Local sequential decoding, independent of HTMLVideoElement playback clocks. */
export function decodeVideo(file: File, index: FrameIndex, first: number, canvas: HTMLCanvasElement): FrameBuffer {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let disposed = false;
  let samples: AsyncGenerator<VideoSample | null, void, unknown> | undefined;
  async function* frames(): AsyncGenerator<BufferedFrame> {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !await track.canDecode()) {
      throw new Error('Synchronized playback is unavailable for this codec in this browser. Frame-by-frame review is still available.');
    }
    if (disposed) return;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Playback could not start. Try another video codec.');
    const sink = new VideoSampleSink(track);
    function* timestamps() {
      for (let frame = first; frame < index.timestamps.length; frame++) yield frameSeekTime(index, frame);
    }
    let frame = first;
    // Monotonic requests decode each packet once; exact indexed sample interiors
    // are shared with manual navigation, including irregular VFR timestamps.
    samples = sink.samplesAtTimestamps(timestamps());
    for await (const sample of samples) {
      if (!sample) throw new Error('No readable video frames.');
      if (disposed) { sample.close(); return; }
      yield { frame: frame++, bytes: sample.allocationSize(), close: () => sample.close(), draw: () => {
        if (disposed) return;
        if (canvas.width !== sample.displayWidth || canvas.height !== sample.displayHeight) {
          canvas.width = sample.displayWidth; canvas.height = sample.displayHeight;
        }
        sample.draw(context, 0, 0);
        canvas.hidden = false;
      } };
    }
  }
  return new FrameBuffer(frames(), first, () => {
    disposed = true;
    // Wake an outstanding next() as well as stopping the input. Returning only
    // the outer async generator could wait behind that same pending decode.
    void samples?.return().catch(() => { /* Disposing the input can abort decoding. */ });
    input.dispose();
  });
}
