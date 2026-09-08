import { describe, expect, it, vi } from 'vitest';
import { CourtCapture, capturePixelRatio, type AudioCaptureLease } from '../src/engine/capture/CourtCapture';

class Track extends EventTarget {
  readyState = 'live';
  muted = false;
  stop = vi.fn(() => { this.readyState = 'ended'; });
  constructor(public kind = 'video') { super(); }
}
class Stream {
  constructor(public tracks: Track[] = [new Track()]) {}
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
  addTrack(track: Track) { this.tracks.push(track); }
}
class Canvas extends EventTarget {
  captureStream = vi.fn(() => new Stream() as unknown as MediaStream);
}
function setup(acquire?: () => Promise<AudioCaptureLease>) {
  const audioStream = new Stream([new Track('audio')]);
  const audio = { stream: audioStream as unknown as MediaStream, release: vi.fn(() => audioStream.getTracks().forEach(track => track.stop())) };
  const acquireAudio = vi.fn(acquire ?? (async () => audio));
  const capture = new CourtCapture(acquireAudio);
  const canvas = new Canvas();
  const source = canvas as unknown as HTMLCanvasElement;
  capture.setSource(source);
  return { capture, canvas, source, audio, acquireAudio };
}

describe('court capture lifetime and failures', () => {
  it('retains the stream and its tracks when the same court is published again', async () => {
    const { capture, source, canvas, acquireAudio } = setup();
    await capture.start();
    const stream = capture.getSnapshot().stream!;
    capture.setSource(source);
    await capture.start();
    expect(capture.getSnapshot().stream).toBe(stream);
    expect(stream.getTracks()).toHaveLength(2);
    expect(stream.getVideoTracks()[0].readyState).toBe('live');
    expect(canvas.captureStream).toHaveBeenCalledExactlyOnceWith(30);
    expect(acquireAudio).toHaveBeenCalledTimes(1);
  });

  it('stops all owned tracks and releases the audio tap, then permits a fresh capture', async () => {
    const { capture, audio } = setup();
    await capture.start();
    const stream = capture.getSnapshot().stream!;
    capture.stop(); capture.stop();
    expect(stream.getTracks().every(track => track.readyState === 'ended')).toBe(true);
    expect(audio.release).toHaveBeenCalledTimes(1);
    await capture.start(false);
    expect(capture.getSnapshot().stream).not.toBe(stream);
    expect(capture.getSnapshot().stream?.getAudioTracks()).toHaveLength(0);
  });

  it('does not acquire audio for a video-only capture', async () => {
    const { capture, acquireAudio } = setup();
    await capture.start(false);
    expect(acquireAudio).not.toHaveBeenCalled();
    expect(capture.getSnapshot().state).toBe('capturing');
  });

  it('cancels a pending audio start without leaking or replacing a newer stream', async () => {
    let resolve!: (value: AudioCaptureLease) => void;
    const { capture, audio, canvas } = setup(() => new Promise(done => { resolve = done; }));
    const pending = capture.start();
    await capture.start(); // Double click does not allocate another source.
    const cancelled = canvas.captureStream.mock.results[0].value as MediaStream;
    capture.stop();
    expect(cancelled.getVideoTracks()[0].readyState).toBe('ended');
    await capture.start(false);
    const replacement = capture.getSnapshot().stream;
    resolve(audio);
    await pending;
    expect(audio.release).toHaveBeenCalledOnce();
    expect(capture.getSnapshot().stream).toBe(replacement);
    expect(canvas.captureStream).toHaveBeenCalledTimes(2);
  });

  it('cleans up video if audio startup fails and permits an explicit video-only retry', async () => {
    const { capture, canvas } = setup(async () => { throw new Error('suspended'); });
    await capture.start();
    expect(capture.getSnapshot().state).toBe('error');
    expect((canvas.captureStream.mock.results[0].value as MediaStream).getVideoTracks()[0].readyState).toBe('ended');
    await capture.start(false);
    expect(capture.getSnapshot().state).toBe('capturing');
  });

  it('reports unsupported and security-rejected capture without leaking state', async () => {
    const { capture, canvas } = setup();
    capture.setSource(new EventTarget() as HTMLCanvasElement);
    await capture.start(false);
    expect(capture.getSnapshot()).toMatchObject({ available: false, state: 'error', stream: null });
    capture.setSource(canvas as unknown as HTMLCanvasElement);
    canvas.captureStream.mockImplementation(() => { throw new DOMException('Tainted', 'SecurityError'); });
    await capture.start(false);
    expect(capture.getSnapshot()).toMatchObject({ available: true, state: 'error', stream: null });
  });

  it('surfaces browser mute and track termination, cleaning up both tracks', async () => {
    const { capture, audio } = setup();
    await capture.start();
    const track = capture.getSnapshot().stream!.getVideoTracks()[0] as unknown as Track;
    track.muted = true; track.dispatchEvent(new Event('mute'));
    expect(capture.getSnapshot().muted).toBe(true);
    track.muted = false; track.dispatchEvent(new Event('unmute'));
    expect(capture.getSnapshot().muted).toBe(false);
    track.dispatchEvent(new Event('ended'));
    expect(capture.getSnapshot()).toMatchObject({ state: 'error', stream: null });
    expect(audio.release).toHaveBeenCalledOnce();
  });

  it('requires explicit restart after context loss and removes source listeners on teardown', async () => {
    const { capture, canvas } = setup();
    await capture.start(false);
    const stream = capture.getSnapshot().stream!;
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(stream.getVideoTracks()[0].readyState).toBe('ended');
    expect(capture.getSnapshot()).toMatchObject({ available: false, state: 'error' });
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(capture.getSnapshot()).toMatchObject({ available: true, state: 'error' });
    await capture.start(false);
    capture.setSource(null);
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(capture.getSnapshot()).toMatchObject({ available: false, state: 'idle', stream: null });
  });
});

describe('capture resolution budget', () => {
  it.each([[1920, 1080, 2, 2 / 3], [390, 844, 3, 1280 / 844], [1000, 1000, 2, .72], [320, 180, 1, 1]])(
    'bounds a %dx%d source at preferred ratio %d', (width, height, preferred, expected) => {
      expect(capturePixelRatio(width, height, preferred, true)).toBeCloseTo(expected);
      expect(capturePixelRatio(width, height, preferred, false)).toBe(preferred);
    });
  it('does not resize a hidden, zero-sized court', () => expect(capturePixelRatio(0, 0, 1.5, true)).toBe(1.5));
});
