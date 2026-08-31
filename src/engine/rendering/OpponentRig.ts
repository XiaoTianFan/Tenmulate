import * as THREE from 'three';
import { DEFAULT_RALLY_OPPONENT_POSITION } from '../../domain/court';
import {
  OPPONENT_ASSET,
  OPPONENT_SKELETON_ADAPTER,
  inspectOpponentBoneNames,
  type OpponentHand,
} from '../../domain/opponent';

export type OpponentLoadReport = Readonly<{
  sourceHeightMeters: number;
  displayHeightMeters: number;
  boneCount: number;
  clipNames: readonly string[];
}>;

export class OpponentRigDisposedError extends Error {
  constructor() {
    super('Opponent rig was disposed before loading completed.');
    this.name = 'OpponentRigDisposedError';
  }
}

const collectNames = (root: THREE.Object3D): string[] => {
  const names: string[] = [];
  root.traverse((object) => {
    if (object.name) names.push(object.name);
  });
  return names;
};

const canonicalBoneNames = new Set<string>(Object.values(OPPONENT_SKELETON_ADAPTER));

export class OpponentRig {
  readonly group = new THREE.Group();
  private readonly neutralMaterial = new THREE.MeshStandardMaterial({
    color: 0x13283d,
    roughness: 0.78,
    metalness: 0,
  });
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private racketSockets: Partial<Record<OpponentHand, THREE.Object3D>> = {};
  private activeAction: THREE.AnimationAction | null = null;
  private disposed = false;

  constructor() {
    this.group.name = 'neutral-opponent-rig';
    this.group.position.set(DEFAULT_RALLY_OPPONENT_POSITION.x, 0, DEFAULT_RALLY_OPPONENT_POSITION.z);
    this.group.rotation.y = Math.PI;
    this.group.visible = false;
  }

  private aimBoneAt(boneName: string, childName: string, direction: THREE.Vector3): void {
    const bone = this.model?.getObjectByName(boneName);
    const child = this.model?.getObjectByName(childName);
    if (!bone || !child || !bone.parent) return;
    this.group.updateMatrixWorld(true);
    const bonePosition = bone.getWorldPosition(new THREE.Vector3());
    const childPosition = child.getWorldPosition(new THREE.Vector3());
    const currentDirection = childPosition.sub(bonePosition).normalize();
    const worldDelta = new THREE.Quaternion().setFromUnitVectors(currentDirection, direction.clone().normalize());
    const worldRotation = bone.getWorldQuaternion(new THREE.Quaternion());
    const desiredWorldRotation = worldDelta.multiply(worldRotation);
    const parentWorldRotation = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parentWorldRotation.invert().multiply(desiredWorldRotation));
    this.group.updateMatrixWorld(true);
  }

  private applyNeutralReadyStance(): void {
    if (!this.model) return;
    this.group.updateMatrixWorld(true);
    const point = (name: string) => this.model?.getObjectByName(name)?.getWorldPosition(new THREE.Vector3());
    const head = point(OPPONENT_SKELETON_ADAPTER.head);
    const hips = point(OPPONENT_SKELETON_ADAPTER.hips);
    const leftShoulder = point(OPPONENT_SKELETON_ADAPTER.leftUpperArm);
    const rightShoulder = point(OPPONENT_SKELETON_ADAPTER.rightUpperArm);
    if (!head || !hips || !leftShoulder || !rightShoulder) return;

    const up = head.sub(hips).normalize();
    const right = rightShoulder.sub(leftShoulder).normalize();
    const forward = new THREE.Vector3().crossVectors(right, up).normalize();
    const down = up.clone().negate();
    const left = right.clone().negate();
    const combine = (...terms: readonly [THREE.Vector3, number][]) => {
      const result = new THREE.Vector3();
      for (const [axis, weight] of terms) result.addScaledVector(axis, weight);
      return result.normalize();
    };

    this.aimBoneAt('upperarm_l', 'lowerarm_l', combine([left, 0.18], [down, 0.94], [forward, 0.28]));
    this.aimBoneAt('upperarm_r', 'lowerarm_r', combine([right, 0.18], [down, 0.94], [forward, 0.28]));
    this.aimBoneAt('lowerarm_l', 'hand_l', combine([right, 0.32], [down, 0.12], [forward, 0.94]));
    this.aimBoneAt('lowerarm_r', 'hand_r', combine([left, 0.32], [down, 0.12], [forward, 0.94]));
  }

  async load(url = OPPONENT_ASSET.url): Promise<OpponentLoadReport> {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    if (this.disposed) {
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      throw new OpponentRigDisposedError();
    }

    const model = gltf.scene;
    model.name = 'neutral-opponent-model';
    model.traverse((object) => {
      if (object.name === 'Eyes' || object.name === 'Eyebrows') object.visible = false;
      if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) {
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of sourceMaterials) {
          if (material !== this.neutralMaterial) material.dispose();
        }
        object.material = this.neutralMaterial;
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });
    model.updateMatrixWorld(true);
    const sourceBounds = new THREE.Box3().setFromObject(model);
    const sourceHeight = sourceBounds.max.y - sourceBounds.min.y;
    if (!Number.isFinite(sourceHeight) || sourceHeight <= 0.01) {
      throw new Error(`Opponent source height is invalid: ${sourceHeight}`);
    }
    const scale = OPPONENT_ASSET.nominalHeightMeters / sourceHeight;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    const normalizedBounds = new THREE.Box3().setFromObject(model);
    model.position.y -= normalizedBounds.min.y;
    model.updateMatrixWorld(true);

    const boneReport = inspectOpponentBoneNames(collectNames(model));
    if (!boneReport.compatible) {
      throw new Error(`Opponent rig is missing bones: ${boneReport.missing.map(({ bone }) => bone).join(', ')}`);
    }

    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.racketSockets = {
      left: model.getObjectByName(OPPONENT_SKELETON_ADAPTER.leftHand),
      right: model.getObjectByName(OPPONENT_SKELETON_ADAPTER.rightHand),
    };
    this.group.add(model);
    this.applyNeutralReadyStance();
    const posedBounds = new THREE.Box3().setFromObject(model);
    model.position.y -= posedBounds.min.y;
    model.updateMatrixWorld(true);
    for (const clip of gltf.animations) this.clips.set(clip.name, clip);
    this.group.visible = true;

    const displayBounds = new THREE.Box3().setFromObject(model);
    return {
      sourceHeightMeters: sourceHeight,
      displayHeightMeters: displayBounds.max.y - displayBounds.min.y,
      boneCount: collectNames(model).filter((name) => canonicalBoneNames.has(name)).length,
      clipNames: [...this.clips.keys()],
    };
  }

  async loadAnimationBundle(url: string): Promise<readonly string[]> {
    if (!this.model) throw new Error('Load the opponent mesh before loading an animation bundle.');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    for (const clip of gltf.animations) this.clips.set(clip.name, clip);
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    return gltf.animations.map((clip) => clip.name);
  }

  playClip(name: string, fadeSeconds = 0.16): boolean {
    if (!this.mixer) return false;
    const clip = this.clips.get(name);
    if (!clip) return false;
    const next = this.mixer.clipAction(clip);
    next.reset().setLoop(THREE.LoopOnce, 1).play();
    next.clampWhenFinished = true;
    if (this.activeAction && this.activeAction !== next) this.activeAction.crossFadeTo(next, fadeSeconds, false);
    this.activeAction = next;
    return true;
  }

  getRacketSocket(hand: OpponentHand): THREE.Object3D | null {
    return this.racketSockets[hand] ?? null;
  }

  attachRacket(racket: THREE.Object3D, hand: OpponentHand): boolean {
    const socket = this.getRacketSocket(hand);
    if (!socket) return false;
    socket.add(racket);
    return true;
  }

  update(deltaSeconds: number): void {
    this.mixer?.update(deltaSeconds);
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.group.removeFromParent();
    this.model?.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) object.geometry.dispose();
    });
    this.neutralMaterial.dispose();
    this.model = null;
    this.mixer = null;
    this.activeAction = null;
    this.clips.clear();
  }
}
