import { t } from '../i18n/locale';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { COURT, OPPONENT_POSITION_LIMITS, clampOpponentPosition, playerViewHorizontalToWorldX, worldXToPlayerViewHorizontal } from '../domain/court';
import { aimDirectionToCourtPoint } from '../engine/trajectory/physics';

export type CourtPoint = Readonly<{ x: number; z: number }>;

type CourtPlanProps = Readonly<{
  opponent: CourtPoint;
  landing?: CourtPoint | null;
  aimDirectionDeg?: number;
  onOpponentChange?: (position: CourtPoint) => void;
  onAimChange?: (directionDeg: number) => void;
}>;

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 620;
const PLACEMENT_LEFT = 40;
const PLACEMENT_TOP = 30;
const PLACEMENT_WIDTH = 280;
const PLACEMENT_SCALE = PLACEMENT_WIDTH / (OPPONENT_POSITION_LIMITS.halfWidth * 2);
const PLACEMENT_HEIGHT = OPPONENT_POSITION_LIMITS.halfLength * 2 * PLACEMENT_SCALE;
const COURT_LEFT = PLACEMENT_LEFT + COURT.internationalSideRunoff * PLACEMENT_SCALE;
const COURT_TOP = PLACEMENT_TOP + COURT.internationalBackRunoff * PLACEMENT_SCALE;
const COURT_WIDTH = COURT.doublesWidth * PLACEMENT_SCALE;
const COURT_HEIGHT = COURT.fullLength * PLACEMENT_SCALE;
const NET_Y = COURT_TOP + COURT_HEIGHT / 2;

const toPlan = (point: CourtPoint) => ({
  x: PLACEMENT_LEFT + ((worldXToPlayerViewHorizontal(point.x) + OPPONENT_POSITION_LIMITS.halfWidth) / (OPPONENT_POSITION_LIMITS.halfWidth * 2)) * PLACEMENT_WIDTH,
  y: PLACEMENT_TOP + ((OPPONENT_POSITION_LIMITS.halfLength - point.z) / (OPPONENT_POSITION_LIMITS.halfLength * 2)) * PLACEMENT_HEIGHT,
});

export function CourtPlan({ opponent, landing = null, aimDirectionDeg = 0, onOpponentChange, onAimChange }: CourtPlanProps) {
  const dragMode = useRef<'opponent' | 'aim' | null>(null);
  const opponentMarker = toPlan(opponent);
  const landingMarker = landing ? toPlan(landing) : null;

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): CourtPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const planX = ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH;
    const planY = ((event.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT;
    return clampOpponentPosition({
      x: playerViewHorizontalToWorldX(((planX - PLACEMENT_LEFT) / PLACEMENT_WIDTH) * OPPONENT_POSITION_LIMITS.halfWidth * 2 - OPPONENT_POSITION_LIMITS.halfWidth),
      z: OPPONENT_POSITION_LIMITS.halfLength - ((planY - PLACEMENT_TOP) / PLACEMENT_HEIGHT) * OPPONENT_POSITION_LIMITS.halfLength * 2,
    });
  };

  const updateFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event);
    if (dragMode.current === 'opponent') onOpponentChange?.(point);
    if (dragMode.current === 'aim') {
      onAimChange?.(aimDirectionToCourtPoint(opponent, point));
    }
  };

  const startPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button === 2 && onAimChange) dragMode.current = 'aim';
    else if (event.button === 0 && onOpponentChange) dragMode.current = 'opponent';
    else return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  };

  const directionRadians = aimDirectionDeg * Math.PI / 180;
  const aimEnd = toPlan({
    x: opponent.x + Math.sin(directionRadians) * 8,
    z: opponent.z - Math.cos(directionRadians) * 8,
  });
  const singlesInset = ((COURT.doublesWidth - COURT.singlesWidth) / 2 / COURT.doublesWidth) * COURT_WIDTH;
  const serviceOffset = (COURT.serviceLineFromNet / COURT.fullLength) * COURT_HEIGHT;

  return (
    <svg
      className="court-plan"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={t("Interactive top-down tennis court and ITF runoff")}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={startPointer}
      onPointerMove={(event) => { if (dragMode.current) updateFromPointer(event); }}
      onPointerUp={(event) => { dragMode.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { dragMode.current = null; }}
    >
      <rect x={PLACEMENT_LEFT} y={PLACEMENT_TOP} width={PLACEMENT_WIDTH} height={PLACEMENT_HEIGHT} rx="18" className="court-plan-surround" />
      <rect x={COURT_LEFT} y={COURT_TOP} width={COURT_WIDTH} height={COURT_HEIGHT} className="court-plan-surface" />
      <rect x={COURT_LEFT + singlesInset} y={COURT_TOP} width={COURT_WIDTH - singlesInset * 2} height={COURT_HEIGHT} className="court-plan-line" />
      <line x1={COURT_LEFT} y1={NET_Y} x2={COURT_LEFT + COURT_WIDTH} y2={NET_Y} className="court-plan-net" />
      <line x1={COURT_LEFT + singlesInset} y1={NET_Y - serviceOffset} x2={COURT_LEFT + COURT_WIDTH - singlesInset} y2={NET_Y - serviceOffset} className="court-plan-line" />
      <line x1={COURT_LEFT + singlesInset} y1={NET_Y + serviceOffset} x2={COURT_LEFT + COURT_WIDTH - singlesInset} y2={NET_Y + serviceOffset} className="court-plan-line" />
      <line x1={VIEW_WIDTH / 2} y1={NET_Y - serviceOffset} x2={VIEW_WIDTH / 2} y2={NET_Y + serviceOffset} className="court-plan-line" />
      <text x={VIEW_WIDTH / 2} y={PLACEMENT_TOP + 17} textAnchor="middle" className="court-plan-runoff-label">{t("6.40 m BACK RUNOFF")}</text>
      <text x={PLACEMENT_LEFT + 11} y={NET_Y} textAnchor="middle" transform={`rotate(-90 ${PLACEMENT_LEFT + 11} ${NET_Y})`} className="court-plan-runoff-label">{t("3.66 m SIDE RUNOFF")}</text>
      {onAimChange ? <line x1={opponentMarker.x} y1={opponentMarker.y} x2={aimEnd.x} y2={aimEnd.y} className="court-plan-aim" /> : null}
      {landingMarker ? <g transform={`translate(${landingMarker.x} ${landingMarker.y})`} className="court-plan-landing"><circle r="11" /><path d="M-15 0H15M0-15V15" /></g> : null}
      <g transform={`translate(${opponentMarker.x} ${opponentMarker.y})`} className="court-plan-opponent"><circle r="13" /><circle cy="-3" r="4" /><path d="M-7 9Q0 1 7 9" /></g>
      <text x="18" y="52" className="court-plan-label">{t("OPPONENT")}</text>
      <text x="18" y={VIEW_HEIGHT - 36} className="court-plan-label">{t("YOU")}</text>
    </svg>
  );
}
