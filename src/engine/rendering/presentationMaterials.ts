import * as THREE from 'three';

export const BALL_PRESENTATION = Object.freeze({
  standard: Object.freeze({
    color: 0xd6ff3f,
    emissive: 0x6f980f,
    emissiveIntensity: 0.3,
  }),
  highContrast: Object.freeze({
    color: 0xcaff2f,
    emissive: 0x86b814,
    emissiveIntensity: 0.54,
  }),
  trajectoryColor: 0xcfff36,
  trailColor: 0xe6ff8a,
});

export const OPPONENT_PRESENTATION = Object.freeze({
  fillColor: 0xf7f6ef,
  outlineColor: 0x050709,
  outlineWidthMeters: 0.045,
});

export const createOpponentOutlineMaterial = (
  sourceScale: number,
  worldWidth = OPPONENT_PRESENTATION.outlineWidthMeters,
): THREE.MeshBasicMaterial => {
  const localWidth = worldWidth / Math.max(sourceScale, 1e-6);
  const material = new THREE.MeshBasicMaterial({
    color: OPPONENT_PRESENTATION.outlineColor,
    side: THREE.BackSide,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  material.name = 'opponent-silhouette-outline-material';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = { value: localWidth };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float outlineWidth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * outlineWidth;');
  };
  material.customProgramCacheKey = () => `opponent-inverted-hull-${localWidth.toFixed(6)}`;
  return material;
};

export const createOpponentOutlineClone = (
  source: THREE.Mesh,
  material: THREE.MeshBasicMaterial,
): THREE.Mesh => {
  const outline = source.clone(false);
  outline.name = `${source.name || 'opponent-mesh'}-silhouette-outline`;
  outline.material = material;
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.frustumCulled = false;
  outline.renderOrder = source.renderOrder + 1;
  outline.userData = { ...outline.userData, opponentSilhouetteOutline: true };
  return outline;
};
