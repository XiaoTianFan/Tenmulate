import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { OPPONENT_ASSET, OPPONENT_SKELETON_ADAPTER, inspectOpponentBoneNames } from '../src/domain/opponent';

describe('opponent skeleton adapter', () => {
  it('accepts the complete canonical bone map and exposes both racket sockets', () => {
    const report = inspectOpponentBoneNames(Object.values(OPPONENT_SKELETON_ADAPTER));

    expect(report.compatible).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.racketSockets).toEqual({ left: true, right: true });
  });

  it('fails closed when a retargeting or racket bone is absent', () => {
    const names = Object.values(OPPONENT_SKELETON_ADAPTER).filter((bone) => bone !== 'hand_r');
    const report = inspectOpponentBoneNames(names);

    expect(report.compatible).toBe(false);
    expect(report.missing).toContainEqual({ role: 'rightHand', bone: 'hand_r' });
    expect(report.racketSockets.right).toBe(false);
  });

  it('ships the recorded texture-free GLB with the neutral scene graph', async () => {
    const glb = await readFile(new URL('../public/assets/opponents/quaternius-neutral-male.glb', import.meta.url));
    const digest = createHash('sha256').update(glb).digest('hex');

    expect(digest).toBe(OPPONENT_ASSET.sha256);
    expect(glb.readUInt32LE(0)).toBe(0x46546c67);
    expect(glb.readUInt32LE(4)).toBe(2);
    expect(glb.readUInt32LE(8)).toBe(glb.byteLength);
    expect(glb.readUInt32LE(16)).toBe(0x4e4f534a);

    const jsonLength = glb.readUInt32LE(12);
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8').trimEnd());
    const armature = json.nodes.find((node: { name?: string }) => node.name === 'Armature');
    const activeChildNames = armature.children.map((index: number) => json.nodes[index].name);

    expect(activeChildNames).toEqual(['NeutralOpponentBody', 'root']);
    expect(json.materials).toHaveLength(1);
    expect(json.images).toBeUndefined();
    expect(json.textures).toBeUndefined();
  });
});
