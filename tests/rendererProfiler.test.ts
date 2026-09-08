import { describe, expect, it, vi } from 'vitest';
import { RendererProfiler } from '../src/engine/rendering/RendererProfiler';

function fixture(timer = true) {
  let time = 0, available = false, disjoint = false, lost = false;
  const gl = {
    QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2,
    getExtension: (name: string) => name === 'EXT_disjoint_timer_query_webgl2'
      ? timer ? { TIME_ELAPSED_EXT: 3, GPU_DISJOINT_EXT: 4 } : null
      : { UNMASKED_RENDERER_WEBGL: 5 },
    getParameter: (key: number) => key === 5 ? 'test adapter' : disjoint,
    isContextLost: () => lost,
    createQuery: vi.fn(() => ({})), beginQuery: vi.fn(), endQuery: vi.fn(), deleteQuery: vi.fn(),
    getQueryParameter: vi.fn((_query: unknown, key: number) => key === 1 ? available : 2_500_000),
  };
  const profiler = new RendererProfiler(gl as unknown as WebGL2RenderingContext, () => time);
  const frame = (raf: number, visible = true) => {
    profiler.beginFrame(raf, visible); time += 2; profiler.mark('opponent');
    profiler.beginGpu(); time += 1; profiler.endGpu(); profiler.mark('renderSubmit'); profiler.endFrame();
  };
  return { gl, profiler, frame, ready: () => { available = true; },
    disjoint: () => { disjoint = true; }, lose: () => { lost = true; } };
}

describe('opt-in renderer profiler', () => {
  it('separates RAF cadence, CPU submission and delayed GPU execution', () => {
    const f = fixture(); f.frame(0); f.ready(); f.frame(16);
    const s = f.profiler.snapshot();
    expect(s.adapter).toBe('test adapter');
    expect(s.timings.cpuFrame?.medianMs).toBe(3);
    expect(s.timings.frameInterval?.medianMs).toBe(16);
    expect(s.timings.renderSubmit?.medianMs).toBe(1);
    expect(s.timings.gpuRender?.medianMs).toBe(2.5);
    expect(f.gl.deleteQuery).toHaveBeenCalledTimes(1);
  });

  it('bounds pending queries and never fetches an unavailable result', () => {
    const f = fixture(); for (let i = 0; i < 30; i++) f.frame(i * 4);
    expect(f.gl.createQuery).toHaveBeenCalledTimes(8);
    expect(f.profiler.snapshot().skippedGpuSamples).toBe(22);
    expect(f.gl.getQueryParameter.mock.calls.every(([, key]) => key === 1)).toBe(true);
    f.profiler.dispose(); expect(f.gl.deleteQuery).toHaveBeenCalledTimes(8);
  });

  it('discards all outstanding results after a disjoint event', () => {
    const f = fixture(); f.frame(0); f.frame(4); f.ready(); f.disjoint(); f.frame(8);
    expect(f.profiler.snapshot().disjointSamples).toBe(2);
    expect(f.profiler.snapshot().timings.gpuRender).toBeUndefined();
    expect(f.gl.deleteQuery).toHaveBeenCalledTimes(2);
  });

  it('does not count hidden-tab delays and clears queries on context loss', () => {
    const f = fixture(); f.frame(0); f.frame(4); f.frame(1000, false); f.frame(3000);
    expect(f.profiler.snapshot().timings.frameInterval?.maxMs).toBe(4);
    expect(f.profiler.snapshot().timings.cpuFrame?.samples).toBe(3);
    f.lose(); f.frame(3010);
    expect(f.profiler.snapshot().pendingGpuSamples).toBe(0);
    expect(f.profiler.snapshot().timings.cpuFrame?.samples).toBe(3);
  });

  it('provides CPU data if GPU timers are unavailable and resets comparison windows', () => {
    const f = fixture(false); f.frame(0);
    expect(f.profiler.snapshot().gpuTimerAvailable).toBe(false);
    expect(f.gl.createQuery).not.toHaveBeenCalled();
    f.profiler.reset(); f.frame(10000);
    expect(f.profiler.snapshot().timings.frameInterval).toBeUndefined();
    expect(f.profiler.snapshot().timings.cpuFrame?.samples).toBe(1);
  });

  it('retains old worst stalls while computing percentiles over a bounded recent window', () => {
    const f = fixture(false); f.frame(0); f.frame(500);
    for (let i = 1; i <= 650; i++) f.frame(500 + i * 4);
    expect(f.profiler.snapshot().timings.frameInterval).toEqual({ samples: 651, medianMs: 4, p95Ms: 4, maxMs: 500 });
  });
});
