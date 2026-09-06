import neutralPlayer from '../content/opponent-asset.json';
export type OpponentHand = 'left' | 'right';

export const OPPONENT_ASSET = Object.freeze(neutralPlayer);

export const OPPONENT_SKELETON_ADAPTER = Object.freeze({
  root: 'root',
  hips: 'pelvis',
  spine: 'spine_01',
  chest: 'spine_02',
  upperChest: 'spine_03',
  neck: 'neck_01',
  head: 'Head',
  leftShoulder: 'clavicle_l',
  leftUpperArm: 'upperarm_l',
  leftLowerArm: 'lowerarm_l',
  leftHand: 'hand_l',
  rightShoulder: 'clavicle_r',
  rightUpperArm: 'upperarm_r',
  rightLowerArm: 'lowerarm_r',
  rightHand: 'hand_r',
  leftUpperLeg: 'thigh_l',
  leftLowerLeg: 'calf_l',
  leftFoot: 'foot_l',
  leftToes: 'ball_l',
  rightUpperLeg: 'thigh_r',
  rightLowerLeg: 'calf_r',
  rightFoot: 'foot_r',
  rightToes: 'ball_r',
} as const);

export type OpponentBoneRole = keyof typeof OPPONENT_SKELETON_ADAPTER;

export const inspectOpponentBoneNames = (names: Iterable<string>) => {
  const available = new Set(names);
  const missing = Object.entries(OPPONENT_SKELETON_ADAPTER)
    .filter(([, bone]) => !available.has(bone))
    .map(([role, bone]) => ({ role: role as OpponentBoneRole, bone }));
  return {
    compatible: missing.length === 0,
    missing,
    racketSockets: {
      left: available.has(OPPONENT_SKELETON_ADAPTER.leftHand),
      right: available.has(OPPONENT_SKELETON_ADAPTER.rightHand),
    },
  } as const;
};
