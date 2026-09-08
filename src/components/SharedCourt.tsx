import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SceneViewport, type SceneViewportProps } from './SceneViewport';
import type { EnvironmentConfiguration } from '../domain/environment';
import type { QualityMode } from '../engine/rendering/TennisScene';
import type { BallFocusSettings } from '../engine/rendering/ballFocus';
import { BallFocusContext } from './BallFocusControls';
import { CourtCaptureContext } from './CourtCaptureContext';
import { CourtCapture } from '../engine/capture/CourtCapture';
import { practiceAudio } from '../engine/audio/AudioCueEngine';

type Lease = { publish: (owner: object, slot: HTMLDivElement, props: SceneViewportProps) => void; release: (owner: object) => void };
const CourtContext = createContext<Lease | null>(null);

/** One stable portal host, canvas, scene and WebGL context for the whole app. */
export function SharedCourtProvider({ children, environment, quality, ballFocus, onBallFocusChange }: {
  children: ReactNode; environment: EnvironmentConfiguration; quality: QualityMode;
  ballFocus: BallFocusSettings; onBallFocusChange: (settings: BallFocusSettings) => void;
}) {
  const [capture] = useState(() => new CourtCapture(() => practiceAudio.capture()));
  const captureState = useSyncExternalStore(capture.subscribe, capture.getSnapshot);
  useEffect(() => {
    const onPageHide = (event: PageTransitionEvent) => { if (!event.persisted) capture.stop(); };
    window.addEventListener('pagehide', onPageHide);
    return () => { window.removeEventListener('pagehide', onPageHide); capture.stop(); };
  }, [capture]);
  const focus = useMemo(() => ({ settings: ballFocus, onChange: onBallFocusChange }), [ballFocus, onBallFocusChange]);
  const [host] = useState(() => { const element = document.createElement('div'); element.className = 'shared-court-host'; return element; });
  const parking = useRef<HTMLDivElement>(null);
  const ownerRef = useRef<object | null>(null);
  const [view, setView] = useState<{ owner: object; props: SceneViewportProps; active: boolean } | null>(null);
  useLayoutEffect(() => { capture.setRendering(view?.active ?? false); }, [capture, view?.active]);
  const publish = useCallback<Lease['publish']>((owner, slot, props) => {
    ownerRef.current = owner;
    // Move the portal container, never recreate the portal or its React children.
    if (host.parentElement !== slot) slot.appendChild(host);
    setView({ owner, props, active: true });
  }, [host]);
  const release = useCallback((owner: object) => {
    if (ownerRef.current !== owner) return;
    ownerRef.current = null;
    parking.current?.appendChild(host);
    setView(previous => previous ? { ...previous, active: false } : null);
  }, [host]);
  const lease = useMemo(() => ({ publish, release }), [publish, release]);
  return <CourtCaptureContext.Provider value={capture}><CourtContext.Provider value={lease}><BallFocusContext.Provider value={focus}>
    {children}
    <div ref={parking} hidden aria-hidden="true" />
    {view ? createPortal(<SceneViewport {...view.props} environment={view.props.environment ?? environment}
      quality={view.props.quality ?? quality} ballFocus={ballFocus} active={view.active} viewKey={view.owner}
      onCaptureSource={capture.setSource} captureActive={captureState.state === 'capturing' || captureState.state === 'starting'} />, host) : null}
  </BallFocusContext.Provider></CourtContext.Provider></CourtCaptureContext.Provider>;
}

/** A route only supplies its viewport rectangle and current gameplay configuration. */
export function CourtViewport(props: SceneViewportProps) {
  const lease = useContext(CourtContext);
  if (!lease) throw new Error('CourtViewport requires SharedCourtProvider');
  const slot = useRef<HTMLDivElement>(null), owner = useRef({});
  useLayoutEffect(() => { if (slot.current) lease.publish(owner.current, slot.current, props); });
  useLayoutEffect(() => { const token = owner.current; return () => lease.release(token); }, [lease]);
  return <div ref={slot} className="scene-viewport-slot" />;
}
