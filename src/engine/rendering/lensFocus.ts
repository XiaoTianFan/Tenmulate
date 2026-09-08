/** Thin-lens depth dependence, normalized to the user-selected far blur ceiling. */
export function lensBlurRadius(depth: number, focusDistance: number, maximumRadius: number): number {
  if (![depth, focusDistance, maximumRadius].every(Number.isFinite) || depth <= 0 || focusDistance <= 0 || maximumRadius <= 0) return 0;
  return Math.max(0, maximumRadius) * Math.max(-1, Math.min(1, 1 - focusDistance / depth));
}

/** Rack focus in inverse-depth space; pauses/seeks never modify the gameplay clock. */
export function advanceFocusDistance(current: number, target: number, delta: number): number {
  const from = 1 / Math.max(.1, current), to = 1 / Math.max(.1, target);
  return 1 / (from + (to - from) * (1 - Math.exp(-Math.max(0, delta) / .12)));
}

// Shared by the gather and full-resolution composite to keep the focal plane identical.
export const LENS_FOCUS_GLSL = `
  uniform float focusDistance;
  uniform float maximumRadius;
  float circleOfConfusion(float depth) {
    return maximumRadius * clamp(1. - focusDistance / max(depth, .05), -1., 1.);
  }
  float blurCoverage(float coc) { return smoothstep(0., 1.5, abs(coc)); }
`;
