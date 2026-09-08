export type TimingSummary = Readonly<{
  samples: number; medianMs: number; p95Ms: number; maxMs: number;
}>;

/** A bounded recent window, with the worst stall retained until reset. */
class Timings {
  private readonly values = new Float64Array(600);
  private count = 0;
  private maximum = 0;
  add(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.values[this.count++ % this.values.length] = ms;
    this.maximum = Math.max(this.maximum, ms);
  }
  summary(): TimingSummary {
    const sorted = this.values.slice(0, Math.min(this.count, this.values.length)).sort();
    return {
      samples: this.count, medianMs: sorted[Math.floor(sorted.length * .5)] ?? 0,
      p95Ms: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)] ?? 0,
      maxMs: this.maximum,
    };
  }
}

type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

/** Developer-only CPU/GPU instrumentation. GPU queries are asynchronous and
 * bounded; never block the render thread waiting for the GPU to finish. */
export class RendererProfiler {
  readonly adapter: string;
  private readonly extension: TimerExtension | null;
  private pending: WebGLQuery[] = [];
  private activeQuery: WebGLQuery | null = null;
  private timings = new Map<string, Timings>();
  private frameStart = 0;
  private previousMark = 0;
  private previousRaf: number | null = null;
  private recording = false;
  private disjointSamples = 0;
  private skippedGpuSamples = 0;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly now = () => performance.now()) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    this.adapter = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'Unavailable';
  }

  private add(stage: string, ms: number): void {
    let timings = this.timings.get(stage);
    if (!timings) { timings = new Timings(); this.timings.set(stage, timings); }
    timings.add(ms);
  }

  beginFrame(rafTime: number, visible: boolean): void {
    this.recording = visible && !this.gl.isContextLost();
    if (!this.recording) { this.previousRaf = null; this.clearQueries(); return; }
    this.pollGpu();
    if (this.previousRaf !== null) this.add('frameInterval', rafTime - this.previousRaf);
    this.previousRaf = rafTime;
    this.frameStart = this.previousMark = this.now();
  }

  mark(stage: string): void {
    if (!this.recording) return;
    const time = this.now();
    this.add(stage, time - this.previousMark);
    this.previousMark = time;
  }

  endFrame(): void {
    if (this.recording) this.add('cpuFrame', this.now() - this.frameStart);
    this.recording = false;
  }

  beginGpu(): void {
    if (!this.recording || !this.extension || this.activeQuery) return;
    if (this.pending.length >= 8) { this.skippedGpuSamples++; return; }
    this.activeQuery = this.gl.createQuery();
    if (this.activeQuery) this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, this.activeQuery);
  }

  endGpu(): void {
    if (!this.activeQuery || !this.extension) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending.push(this.activeQuery);
    this.activeQuery = null;
  }

  private pollGpu(): void {
    if (!this.extension || !this.pending.length) return;
    if (this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)) {
      this.disjointSamples += this.pending.length;
      this.clearQueries();
      return;
    }
    while (this.pending.length && this.gl.getQueryParameter(this.pending[0]!, this.gl.QUERY_RESULT_AVAILABLE)) {
      const query = this.pending.shift()!;
      this.add('gpuRender', Number(this.gl.getQueryParameter(query, this.gl.QUERY_RESULT)) / 1e6);
      this.gl.deleteQuery(query);
    }
  }

  snapshot() {
    return {
      adapter: this.adapter, gpuTimerAvailable: !!this.extension,
      pendingGpuSamples: this.pending.length, skippedGpuSamples: this.skippedGpuSamples,
      disjointSamples: this.disjointSamples,
      timings: Object.fromEntries([...this.timings].map(([stage, values]) => [stage, values.summary()])),
    };
  }

  /** A resize, quality/venue change or resume starts a comparable new window. */
  reset(): void {
    this.clearQueries(); this.timings.clear(); this.previousRaf = null;
    this.recording = false; this.disjointSamples = 0; this.skippedGpuSamples = 0;
  }

  private clearQueries(): void {
    if (this.activeQuery) {
      if (!this.gl.isContextLost()) this.gl.endQuery(this.extension!.TIME_ELAPSED_EXT);
      this.gl.deleteQuery(this.activeQuery); this.activeQuery = null;
    }
    for (const query of this.pending) this.gl.deleteQuery(query);
    this.pending = [];
  }

  dispose(): void { this.reset(); }
}
