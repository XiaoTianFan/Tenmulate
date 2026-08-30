import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { COURT } from '../domain/court';

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
const COURT_LEFT = 70;
const COURT_TOP = 30;
const COURT_WIDTH = 220;
const COURT_HEIGHT = 560;

const toPlan = (point: CourtPoint) => ({
  x: COURT_LEFT + ((point.x + COURT.doublesWidth / 2) / COURT.doublesWidth) * COURT_WIDTH,
  y: COURT_TOP + ((COURT.halfLength - point.z) / COURT.fullLength) * COURT_HEIGHT,
});

export function CourtPlan({ opponent, landing = null, aimDirectionDeg = 0, onOpponentChange, onAimChange }: CourtPlanProps) {
  const dragMode = useRef<'opponent' | 'aim' | null>(null);
  const opponentMarker = toPlan(opponent);
  const landingMarker = landing ? toPlan(landing) : null;

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): CourtPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const planX = ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH;
    const planY = ((event.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT;
    return {
      x: Math.min(COURT.doublesWidth / 2, Math.max(-COURT.doublesWidth / 2, ((planX - COURT_LEFT) / COURT_WIDTH) * COURT.doublesWidth - COURT.doublesWidth / 2)),
      z: Math.min(COURT.halfLength, Math.max(-COURT.halfLength, COURT.halfLength - ((planY - COURT_TOP) / COURT_HEIGHT) * COURT.fullLength)),
    };
  };

  const updateFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event);
    if (dragMode.current === 'opponent') onOpponentChange?.(point);
    if (dragMode.current === 'aim') {
      const dx = point.x - opponent.x;
      const dz = point.z - opponent.z;
      const direction = Math.atan2(dx, -dz) * 180 / Math.PI;
      onAimChange?.(Math.min(35, Math.max(-35, direction)));
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
      aria-label="Interactive top-down tennis court"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={startPointer}
      onPointerMove={(event) => { if (dragMode.current) updateFromPointer(event); }}
      onPointerUp={(event) => { dragMode.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { dragMode.current = null; }}
    >
      <rect x={COURT_LEFT - 18} y={COURT_TOP - 18} width={COURT_WIDTH + 36} height={COURT_HEIGHT + 36} rx="18" className="court-plan-surround" />
      <rect x={COURT_LEFT} y={COURT_TOP} width={COURT_WIDTH} height={COURT_HEIGHT} className="court-plan-surface" />
      <rect x={COURT_LEFT + singlesInset} y={COURT_TOP} width={COURT_WIDTH - singlesInset * 2} height={COURT_HEIGHT} className="court-plan-line" />
      <line x1={COURT_LEFT} y1={VIEW_HEIGHT / 2} x2={COURT_LEFT + COURT_WIDTH} y2={VIEW_HEIGHT / 2} className="court-plan-net" />
      <line x1={COURT_LEFT + singlesInset} y1={VIEW_HEIGHT / 2 - serviceOffset} x2={COURT_LEFT + COURT_WIDTH - singlesInset} y2={VIEW_HEIGHT / 2 - serviceOffset} className="court-plan-line" />
      <line x1={COURT_LEFT + singlesInset} y1={VIEW_HEIGHT / 2 + serviceOffset} x2={COURT_LEFT + COURT_WIDTH - singlesInset} y2={VIEW_HEIGHT / 2 + serviceOffset} className="court-plan-line" />
      <line x1={VIEW_WIDTH / 2} y1={VIEW_HEIGHT / 2 - serviceOffset} x2={VIEW_WIDTH / 2} y2={VIEW_HEIGHT / 2 + serviceOffset} className="court-plan-line" />
      {onAimChange ? <line x1={opponentMarker.x} y1={opponentMarker.y} x2={aimEnd.x} y2={aimEnd.y} className="court-plan-aim" /> : null}
      {landingMarker ? <g transform={`translate(${landingMarker.x} ${landingMarker.y})`} className="court-plan-landing"><circle r="11" /><path d="M-15 0H15M0-15V15" /></g> : null}
      <g transform={`translate(${opponentMarker.x} ${opponentMarker.y})`} className="court-plan-opponent"><circle r="13" /><circle cy="-3" r="4" /><path d="M-7 9Q0 1 7 9" /></g>
      <text x="18" y="52" className="court-plan-label">OPPONENT</text>
      <text x="18" y={VIEW_HEIGHT - 36} className="court-plan-label">YOU</text>
    </svg>
  );
}
