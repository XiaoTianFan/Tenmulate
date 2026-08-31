import {
  AD_SERVE_OPPONENT_POSITION,
  COURT,
  DEUCE_SERVE_OPPONENT_POSITION,
  type CourtPosition,
} from './court';

export type ReturnReceiverSide = 'left' | 'right';
export type ReturnServePlacement = 't' | 'body' | 'wide';

export const RETURN_SERVE_PATTERN: readonly ReturnServePlacement[] = Object.freeze(['t', 'body', 'wide']);

export const RETURN_SERVE_PLACEMENT_LABELS: Readonly<Record<ReturnServePlacement, string>> = Object.freeze({
  t: 'T',
  body: 'Body',
  wide: 'Wide',
});

export const returnReceiverSideForCameraPreset = (presetId: string): ReturnReceiverSide | null => (
  presetId === 'position-left' ? 'left' : presetId === 'position-right' ? 'right' : null
);

export const returnServerPosition = (receiverSide: ReturnReceiverSide): CourtPosition => (
  receiverSide === 'left' ? AD_SERVE_OPPONENT_POSITION : DEUCE_SERVE_OPPONENT_POSITION
);

export const returnServeTarget = (
  receiverSide: ReturnReceiverSide,
  placement: ReturnServePlacement,
  landingDepthM: number,
): CourtPosition => {
  const receiverWorldXSign = receiverSide === 'left' ? 1 : -1;
  const targetMagnitude = placement === 't'
    ? 0.28
    : placement === 'body'
      ? 2.25
      : COURT.singlesWidth / 2 - 0.22;
  const depth = Math.min(COURT.serviceLineFromNet - 0.12, Math.max(1.2, landingDepthM));
  return { x: receiverWorldXSign * targetMagnitude, z: -depth };
};
