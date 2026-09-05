import * as THREE from 'three';
import { OPPONENT_MOTION, type MotionSample } from '../session/opponentTimeline';
import { DEFAULT_RALLY_OPPONENT_POSITION } from '../../domain/court';
import {
  OPPONENT_ASSET,
  OPPONENT_SKELETON_ADAPTER,
  inspectOpponentBoneNames,
  type OpponentHand,
} from '../../domain/opponent';
import {
  createOpponentOutlineClone,
  createOpponentOutlineMaterial,
  OPPONENT_PRESENTATION,
} from './presentationMaterials';

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
    color: OPPONENT_PRESENTATION.fillColor,
    roughness: 0.84,
    metalness: 0,
  });
  private outlineMaterial: THREE.MeshBasicMaterial | null = null;
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private racketSockets: Partial<Record<OpponentHand, THREE.Object3D>> = {};
  private activeAction: THREE.AnimationAction | null = null;
  private readonly motionActions = new Map<string, THREE.AnimationAction>();
  private bakedCorrections: { bone: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion }[] = [];
  private readonly bindRotations = new Map<string, THREE.Quaternion>();
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

  async load(url = OPPONENT_MOTION.url): Promise<OpponentLoadReport> {
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
    model.traverse(object => {
      if (object instanceof THREE.SkinnedMesh) object.skeleton.bones.forEach((bone,index) => {
        this.bindRotations.set(bone.name,new THREE.Quaternion().setFromRotationMatrix(object.skeleton.boneInverses[index]!.clone().invert()));
      });
    });
    model.name = 'neutral-opponent-model';
    model.traverse((object) => {
      if (object.name === 'Eyes' || object.name === 'Eyebrows') object.visible = false;
      if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) {
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        if (object instanceof THREE.SkinnedMesh) for (const material of sourceMaterials) {
          if (material !== this.neutralMaterial) material.dispose();
        }
        // The skinned carrier stays neutral; the separate racket retains graphite/string materials.
        if (object instanceof THREE.SkinnedMesh) object.material = this.neutralMaterial;
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });
    model.updateMatrixWorld(true);
    const body = model.getObjectByName('NeutralOpponentBody') ?? model;
    const sourceBounds = new THREE.Box3().setFromObject(body);
    const sourceHeight = sourceBounds.max.y - sourceBounds.min.y;
    if (!Number.isFinite(sourceHeight) || sourceHeight <= 0.01) {
      throw new Error(`Opponent source height is invalid: ${sourceHeight}`);
    }
    const scale = url === OPPONENT_MOTION.url ? OPPONENT_MOTION.scale : OPPONENT_ASSET.nominalHeightMeters / sourceHeight;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    const normalizedBounds = new THREE.Box3().setFromObject(body);
    model.position.y = url === OPPONENT_MOTION.url ? OPPONENT_MOTION.floorOffset : -normalizedBounds.min.y;
    model.updateMatrixWorld(true);

    const boneReport = inspectOpponentBoneNames(collectNames(model));
    if (!boneReport.compatible) {
      throw new Error(`Opponent rig is missing bones: ${boneReport.missing.map(({ bone }) => bone).join(', ')}`);
    }

    // The animated fingers and crossed arms need a narrower hull than the static
    // carrier; the old 4.5 cm shell obscured the grip and face during strokes.
    this.outlineMaterial = createOpponentOutlineMaterial(scale, gltf.animations.length ? .012 : undefined);
    const outlinedMeshes: THREE.Mesh[] = [];
    model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh && object.visible) {
        outlinedMeshes.push(object);
      }
    });
    for (const mesh of outlinedMeshes) mesh.parent?.add(createOpponentOutlineClone(mesh, this.outlineMaterial));

    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.racketSockets = {
      left: model.getObjectByName(OPPONENT_SKELETON_ADAPTER.leftHand),
      right: model.getObjectByName(OPPONENT_SKELETON_ADAPTER.rightHand),
    };
    this.group.add(model);
    if (!gltf.animations.length) this.applyNeutralReadyStance();
    model.updateMatrixWorld(true);
    for (const clip of gltf.animations) this.clips.set(clip.name, clip);
    if (url === OPPONENT_MOTION.url) {
      for (const name of Object.keys(OPPONENT_MOTION.clips)) {
        if (!this.clips.has(name)) throw new Error(`Motion library is missing ${name}.`);
      }
      if (!model.getObjectByName('RacketContact')) throw new Error('Motion library is missing the racket contact anchor.');
      for (const clip of gltf.animations) {
        const action = this.mixer.clipAction(clip).play();
        action.paused = true;
        action.enabled = false;
        this.motionActions.set(clip.name, action);
      }
    }
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

  /** Sample the same absolute time as ball physics, including backwards seeks. */
  sampleMotion(sample: MotionSample): void {
    if (!this.model || !this.mixer || !this.motionActions.size) return;
    // PropertyMixer skips unchanged values. Undo procedural corrections before
    // sampling, otherwise a paused frame would accumulate pelvis/leg changes.
    for (const { bone, position, quaternion } of this.bakedCorrections) {
      bone.position.copy(position); bone.quaternion.copy(quaternion);
    }
    this.group.position.set(sample.root.x, 0, sample.root.z);
    this.group.rotation.y = sample.yaw;
    this.group.scale.x = sample.hand === 'left' ? -1 : 1;
    for (const action of this.motionActions.values()) { action.enabled = false; action.weight = 0; }
    for (const layer of sample.layers) {
      const action = this.motionActions.get(layer.clip);
      if (!action || layer.weight <= 0) continue;
      action.enabled = true; action.paused = true; action.weight = layer.weight; action.time = layer.time;
    }
    this.mixer.update(0);
    this.bakedCorrections = ['pelvis', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r', 'lowerarm_l', 'lowerarm_r', 'neck_01', 'Head'].map(name => {
      const bone = this.model!.getObjectByName(name)!;
      return { bone, position: bone.position.clone(), quaternion: bone.quaternion.clone() };
    });
    if (sample.layers.filter(layer => layer.weight > 0).length > 1) {
      // Blending two valid hinge + forearm-roll quaternions can introduce elbow
      // sideways bending. Reconstruct those two anatomical DOFs after blending.
      // The racket is parented to the hand, so its grip remains rigid.
      for (const side of ['l', 'r']) {
        const elbow = this.model.getObjectByName(`lowerarm_${side}`)!;
        const angles = new THREE.Euler().setFromQuaternion(elbow.quaternion, 'XYZ');
        angles.x = THREE.MathUtils.clamp(angles.x, 0, THREE.MathUtils.degToRad(150));
        angles.y = THREE.MathUtils.clamp(angles.y, -THREE.MathUtils.degToRad(88), THREE.MathUtils.degToRad(88));
        angles.z = 0;
        elbow.quaternion.setFromEuler(angles);
      }
    }
    this.group.updateMatrixWorld(true);
    if (sample.lookYaw) {
      // Split the counter-turn over the neck and head, respecting the mirrored rig.
      const turn = sample.lookYaw * (sample.hand === 'left' ? -1 : 1);
      for (const [name, weight] of [['neck_01', .4], ['Head', .6]] as const) {
        const bone = this.model.getObjectByName(name)!;
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert());
        bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, turn * weight));
      }
      this.group.updateMatrixWorld(true);
    }
    const left = this.model.getObjectByName('foot_l')!.getWorldPosition(new THREE.Vector3());
    const right = this.model.getObjectByName('foot_r')!.getWorldPosition(new THREE.Vector3());
    if (Math.abs(sample.verticalCorrection) > 1e-7) {
      const pelvis = this.model.getObjectByName('pelvis')!;
      const world = pelvis.getWorldPosition(new THREE.Vector3());
      world.y += sample.verticalCorrection;
      pelvis.position.copy(pelvis.parent!.worldToLocal(world));
      this.group.updateMatrixWorld(true);
      // Keep grounded strokes planted; serve jump correction also lifts the airborne feet.
      const airborne = sample.event?.clip === 'serve' && Math.min(left.y, right.y) > .15;
      if (!airborne) { this.solveFoot('l', left); this.solveFoot('r', right); }
    }
    if (sample.footTargets) {
      // Lower the hips just enough that both authored stride anchors are reachable.
      // This avoids stretching the legs or allowing a planted ankle to slide.
      let hipDrop = 0;
      for (const [side, target] of [['l', sample.footTargets.left], ['r', sample.footTargets.right]] as const) {
        const hip = this.model.getObjectByName(`thigh_${side}`)!.getWorldPosition(new THREE.Vector3());
        const knee = this.model.getObjectByName(`calf_${side}`)!.getWorldPosition(new THREE.Vector3());
        const ankle = this.model.getObjectByName(`foot_${side}`)!.getWorldPosition(new THREE.Vector3());
        const reach = hip.distanceTo(knee) + knee.distanceTo(ankle) - .006;
        const horizontal = Math.hypot(hip.x - target.x, hip.z - target.z);
        hipDrop = Math.max(hipDrop, hip.y - target.y - Math.sqrt(Math.max(.01, reach * reach - horizontal * horizontal)));
      }
      if (hipDrop > 0) {
        const pelvis = this.model.getObjectByName('pelvis')!, world = pelvis.getWorldPosition(new THREE.Vector3());
        world.y -= hipDrop;
        pelvis.position.copy(pelvis.parent!.worldToLocal(world));
        this.group.updateMatrixWorld(true);
      }
      this.solveFoot('l', new THREE.Vector3(sample.footTargets.left.x, sample.footTargets.left.y, sample.footTargets.left.z));
      this.solveFoot('r', new THREE.Vector3(sample.footTargets.right.x, sample.footTargets.right.y, sample.footTargets.right.z));
    }
    this.group.updateMatrixWorld(true);
  }

  private solveFoot(side: 'l' | 'r', worldTarget: THREE.Vector3): void {
    if (!this.model) return;
    const model = this.model, upper = model.getObjectByName(`thigh_${side}`)!, lower = model.getObjectByName(`calf_${side}`)!, foot = model.getObjectByName(`foot_${side}`)!;
    const point = (object: THREE.Object3D) => model.worldToLocal(object.getWorldPosition(new THREE.Vector3()));
    const modelQuaternion = (object: THREE.Object3D) => {
      const q = new THREE.Quaternion();
      new THREE.Matrix4().copy(model.matrixWorld).invert().multiply(object.matrixWorld).decompose(new THREE.Vector3(), q, new THREE.Vector3());
      return q;
    };
    const setModelQuaternion = (object: THREE.Object3D, q: THREE.Quaternion) => { object.quaternion.copy(modelQuaternion(object.parent!).invert().multiply(q)); this.group.updateMatrixWorld(true); };
    const base = point(upper), knee = point(lower), ankle = point(foot), target = model.worldToLocal(worldTarget.clone());
    const footRotation = modelQuaternion(foot), l1 = base.distanceTo(knee), l2 = knee.distanceTo(ankle);
    const axis = target.clone().sub(base), length = THREE.MathUtils.clamp(axis.length(), Math.abs(l1 - l2) + .001, l1 + l2 - .001);
    axis.normalize();
    const pelvis = model.getObjectByName('pelvis')!;
    const hipRotation = modelQuaternion(pelvis).multiply(this.bindRotations.get('pelvis')!.clone().invert());
    const forward = new THREE.Vector3(0,0,1).applyQuaternion(hipRotation);
    const bend = forward.clone().addScaledVector(axis, -forward.dot(axis)).normalize();
    const along = (l1 * l1 - l2 * l2 + length * length) / (2 * length);
    const joint = base.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    const u=joint.clone().sub(base).normalize(),v=base.clone().addScaledVector(axis,length).sub(joint).normalize();
    const hinge=new THREE.Vector3().crossVectors(u,v).normalize();
    for(const [bone,direction] of [[upper,u],[lower,v]] as const){
      const frame=new THREE.Matrix4().makeBasis(hinge,direction,new THREE.Vector3().crossVectors(hinge,direction));
      setModelQuaternion(bone,new THREE.Quaternion().setFromRotationMatrix(frame));
    }
    const restLocal=this.bindRotations.get(lower.name)!.clone().invert().multiply(this.bindRotations.get(foot.name)!);
    const change=restLocal.clone().invert().multiply(modelQuaternion(lower).invert()).multiply(footRotation);
    if(change.w<0)change.set(-change.x,-change.y,-change.z,-change.w);
    const twist=new THREE.Quaternion(0,change.y,0,change.w).normalize();
    const swing=change.clone().multiply(twist.clone().invert());
    const swingAngle=2*Math.acos(THREE.MathUtils.clamp(swing.w,-1,1));
    if(swingAngle>Math.PI/3)swing.slerp(new THREE.Quaternion(),1-(Math.PI/3)/swingAngle);
    const angle=THREE.MathUtils.clamp(2*Math.atan2(twist.y,twist.w),-25*Math.PI/180,25*Math.PI/180);
    const corrected=modelQuaternion(lower).multiply(restLocal).multiply(swing).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle));
    setModelQuaternion(foot,corrected);
  }

  getContactPosition(): THREE.Vector3 | null {
    return this.model?.getObjectByName('RacketContact')?.getWorldPosition(new THREE.Vector3()) ?? null;
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.group.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.model?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.neutralMaterial.dispose();
    this.outlineMaterial?.dispose();
    this.outlineMaterial = null;
    this.model = null;
    this.mixer = null;
    this.activeAction = null;
    this.clips.clear();
    this.motionActions.clear();
    this.bakedCorrections = [];
    this.bindRotations.clear();
  }
}
