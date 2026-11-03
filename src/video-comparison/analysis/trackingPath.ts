import type { Anchor } from './types';
import type { TrackingPass, TrackingPoint } from './trajectory';

type Candidate = TrackingPoint & { agreed?: boolean; directions?: number };
const distance = (a: TrackingPoint, b: TrackingPoint, w: number, h: number) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
/** Keep competing image matches instead of discarding both directions when they
 * disagree. A bounded second-order beam follows evidence across the entire range;
 * endpoints constrain identity, never a straight-line position prior. */
export function selectTrackingPath(forward: TrackingPass, backward: TrackingPass, anchors: readonly Anchor[], times: Float64Array, start: number, width: number, height: number): TrackingPass {
  const manual = new Map(anchors.map(a => [a.frame - start, a]));
  const layers: { frame: number; nodes: Candidate[] }[] = [];
  for (let f = 0; f < forward.length; f++) {
    const anchor = manual.get(f);
    if (anchor) { layers.push({ frame: f, nodes: [{ x: anchor.x, y: anchor.y, confidence: 1, verified: true }] }); continue; }
    const nodes: Candidate[] = [];
    for (const [direction, point] of [forward[f], backward[f]].entries()) {
      if (!point) continue;
      for (const p of [point, ...(point.alternatives ?? [])].slice(0, 4)) {
        if (![p.x, p.y, p.confidence].every(Number.isFinite) || p.confidence < .4) continue;
        const near = nodes.find(n => distance(n, p, width, height) <= 2);
        if (near) {
          const weight = near.confidence + p.confidence;
          near.x = (near.x * near.confidence + p.x * p.confidence) / weight;
          near.y = (near.y * near.confidence + p.y * p.confidence) / weight;
          near.confidence = Math.max(near.confidence, p.confidence);
          near.directions = (near.directions ?? 0) | (1 << direction);
          if (near.directions === 3) { near.agreed = true; near.verified = true; }
        } else nodes.push({ x: p.x, y: p.y, confidence: p.confidence, verified: p.verified, directions: 1 << direction });
      }
    }
    if (nodes.length) layers.push({ frame: f, nodes });
  }
  const out: TrackingPass = Array(forward.length).fill(null);
  if (!layers.length) return out;
  type State = { node: number; priorNode: number; cost: number; vx: number; vy: number; parent: number };
  const history: State[][] = [[{ node: 0, priorNode: -1, cost: 0, vx: 0, vy: 0, parent: -1 }]];
  const huber = (v: number) => v < 1 ? .5 * v * v : v - .5;
  for (let i = 1; i < layers.length; i++) {
    const current = layers[i], prior = layers[i - 1], dt = times[start + current.frame] - times[start + prior.frame];
    const states = history[i - 1], next = new Map<string, State>();
    for (let p = 0; p < states.length; p++) for (let n = 0; n < current.nodes.length; n++) {
      const state = states[p], a = prior.nodes[state.node], b = current.nodes[n];
      const dx = (b.x - a.x) * width, dy = (b.y - a.y) * height;
      const predicted = Math.hypot(state.vx, state.vy) * dt;
      // Robust acceleration permits turns/strikes while making teleporting from
      // a background distractor expensive. No penalty for sustained fast motion.
      const residual = Math.hypot(dx - state.vx * dt, dy - state.vy * dt);
      const motion = i > 1 ? .45 * huber(residual / Math.max(3, predicted * .65)) : .03 * Math.log1p(Math.hypot(dx, dy));
      const emission = -2 * Math.log(Math.max(.05, b.confidence)) - (b.agreed ? .12 : 0);
      const cost = state.cost + motion + emission, key = `${state.node}:${n}`;
      if (!next.has(key) || cost < next.get(key)!.cost) next.set(key, { node: n, priorNode: state.node, cost, vx: dx / dt, vy: dy / dt, parent: p });
    }
    // At most 24 hypotheses per frame, independent of clip duration.
    history.push([...next.values()].sort((a, b) => a.cost - b.cost).slice(0, 24));
  }
  let state = 0;
  for (let i = layers.length - 1; i >= 0; i--) {
    const selected = history[i][state]; out[layers[i].frame] = layers[i].nodes[selected.node]; state = selected.parent;
  }
  return out;
}
