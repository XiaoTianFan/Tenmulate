import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  BALL_PRESENTATION,
  createOpponentOutlineClone,
  createOpponentOutlineMaterial,
  OPPONENT_PRESENTATION,
} from '../src/engine/rendering/presentationMaterials';

describe('gameplay presentation materials', () => {
  it('uses a saturated yellow-green ball rather than a pure yellow presentation', () => {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(BALL_PRESENTATION.standard.color).getHSL(hsl);

    expect(hsl.h).toBeGreaterThan(1 / 6);
    expect(hsl.h).toBeLessThan(1 / 3);
    expect(hsl.s).toBeGreaterThan(0.8);
    expect(BALL_PRESENTATION.standard.emissiveIntensity).toBeGreaterThan(0);
    expect(BALL_PRESENTATION.standard.emissiveIntensity).toBeLessThan(0.5);
  });

  it('builds a non-tone-mapped black back-face outline with a stable world width', () => {
    const material = createOpponentOutlineMaterial(0.5);
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\n#include <begin_vertex>',
    };

    material.onBeforeCompile(shader as never, {} as never);

    expect(material.color.getHex()).toBe(OPPONENT_PRESENTATION.outlineColor);
    expect(material.side).toBe(THREE.BackSide);
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(false);
    expect(shader.uniforms.outlineWidth?.value).toBeCloseTo(OPPONENT_PRESENTATION.outlineWidthMeters / 0.5, 8);
    expect(shader.vertexShader).toContain('transformed += normalize(normal) * outlineWidth;');
  });

  it('keeps an outline clone bound to the animated source skeleton', () => {
    const bone = new THREE.Bone();
    const source = new THREE.SkinnedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );
    source.name = 'body';
    source.bind(new THREE.Skeleton([bone]));
    const outlineMaterial = createOpponentOutlineMaterial(1);

    const outline = createOpponentOutlineClone(source, outlineMaterial);

    expect(outline).toBeInstanceOf(THREE.SkinnedMesh);
    expect((outline as THREE.SkinnedMesh).skeleton).toBe(source.skeleton);
    expect(outline.geometry).toBe(source.geometry);
    expect(outline.material).toBe(outlineMaterial);
    expect(outline.userData.opponentSilhouetteOutline).toBe(true);
    expect(outline.castShadow).toBe(false);
  });
});
