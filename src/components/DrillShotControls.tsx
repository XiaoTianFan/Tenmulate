import { defaultContentText } from '../i18n/content';
import { t } from '../i18n/locale';
import { RangeField } from './RangeField';
import { ContactTimingControl } from './ContactTimingControl';
import { BallFocusControls } from './BallFocusControls';
import type { DrillBall, StrokeChoice, DrillDefinitionV2, OpeningFeed, PlayerShotEventV2, ShotFamily } from '../content/types';
import { changeBallFamily, openingFor, receivingZone } from '../content/playerShots';
import { openingZoneSource } from '../content/playerHandedness';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { DEFAULT_CAMERA_POSITION_PRESETS } from '../storage/appStorage';
import { cameraLookAtCourtPoint } from '../domain/camera';
import { COURT } from '../domain/court';
import { SHOT_CAMERA_RANGES } from '../engine/session/cameraTimeline';
import { SHOT_TYPE_LABELS, spinsForShot } from '../domain/shotKinds';
import { landingZoneCenter, resolveLandingZone } from '../engine/trajectory/landingZone';

export function EditorNumber({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number | undefined; min: number; max: number; step?: number; onChange: (value: number) => void;
}) {
  return <RangeField commitOnRelease label={label} value={value ?? min} min={min} max={max} step={step} unit="" onChange={onChange}/>;
}

export function BallIdentity<Side extends StrokeChoice>({ ball, label, opening = false, showHand = true, onChange }: {
  ball: DrillBall<Side>; label: string; opening?: boolean; showHand?: boolean; onChange: (ball: DrillBall<Side>) => void;
}) {
  return <>
    <label className="stack-field"><span>{t("Shot type")}</span><select aria-label={t("{0} shot type", {"0": label})} value={ball.family} onChange={e => onChange(changeBallFamily(ball, e.target.value as ShotFamily))}>
      {Object.entries(SHOT_TYPE_LABELS).filter(([family]) => opening ? family === 'serve' || family === 'groundstroke' : family !== 'serve').map(([family, name]) => <option key={family} value={family}>{t(name)}</option>)}
    </select></label>
    <label className="stack-field"><span>{t("Spin type")}</span><select aria-label={t("{0} spin type", {"0": label})} value={ball.spin} onChange={e => onChange({ ...ball, spin: e.target.value as DrillBall['spin'] })}>
      {spinsForShot(ball.family).map(spin => <option key={spin} value={spin}>{t(spin)}</option>)}
    </select></label>
    <div className="paired-fields">
      {showHand ? <label className="stack-field"><span>{t("Playing hand")}</span><select aria-label={t("{0} playing hand", {"0": label})} value={ball.hand} onChange={e => onChange({ ...ball, hand: e.target.value as DrillBall['hand'] })}><option value="right">{t("Right")}</option><option value="left">{t("Left")}</option></select></label> : null}
      {ball.family !== 'serve' ? <label className="stack-field"><span>{t("Stroke side")}</span><select aria-label={t("{0} stroke side", {"0": label})} value={ball.stroke} onChange={e => onChange({ ...ball, stroke: e.target.value as Side })}>{showHand ? <option value="auto">{t("Automatic")}</option> : null}<option value="forehand">{t("Forehand")}</option><option value="backhand">{t("Backhand")}</option></select></label> : null}
    </div>
  </>;
}

function BallParameters<Side extends StrokeChoice>({ ball, prefix = '', onChange }: { ball: DrillBall<Side>; prefix?: string; onChange: (ball: DrillBall<Side>) => void }) {
  return <>
    <RangeField commitOnRelease label={t("{0}Launch speed", {"0": prefix})} value={ball.paceKmh} min={20} max={260} step={1} unit={t("km/h")} onChange={paceKmh => onChange({ ...ball, paceKmh })}/>
    <RangeField commitOnRelease label={t("{0}Spin rate", {"0": prefix})} value={ball.spinRateRpm} min={0} max={6000} step={50} unit={t("rpm")} onChange={spinRateRpm => onChange({ ...ball, spinRateRpm })}/>
    <RangeField commitOnRelease label={t("{0}Shot Variation", {"0": prefix})} value={ball.variationPercent} min={0} max={25} step={1} unit="%" onChange={variationPercent => onChange({ ...ball, variationPercent })}/>
    <label className="stack-field"><span>{t("Trajectory style")}</span><select aria-label={t("{0}Trajectory style", {"0": prefix})} value={ball.trajectoryMode} onChange={e => onChange({ ...ball, trajectoryMode: e.target.value as DrillBall['trajectoryMode'] })}><option value="natural">{t("Natural target")}</option><option value="exact">{t("Exact speed & spin")}</option></select></label>
    <RangeField commitOnRelease label={t("{0}Minimum net clearance", {"0": prefix})} value={ball.netClearanceM} min={.08} max={6} step={.02} unit={t("m")} onChange={netClearanceM => onChange({ ...ball, netClearanceM })}/>
    <RangeField commitOnRelease label={t("{0}Bounce factor", {"0": prefix})} value={ball.bounceFactor} min={.6} max={1.4} step={.05} unit="×" onChange={bounceFactor => onChange({ ...ball, bounceFactor })}/>
    {ball.family === 'serve' ? <label className="stack-field"><span>{t("Serve rhythm")}</span><select aria-label={t("Serve rhythm")} value={ball.serveRhythm} onChange={e => onChange({ ...ball, serveRhythm: e.target.value as DrillBall['serveRhythm'] })}><option value="normal">{t("Normal")}</option><option value="compact">{t("Compact")}</option></select></label> : null}
  </>;
}

export function OpeningShotControls({ feed, onChange, resolvedSpeedKmh }: { feed: OpeningFeed; onChange: (feed: OpeningFeed) => void; resolvedSpeedKmh?: number }) {
  const update = (patch: Partial<OpeningFeed>) => {
    const next = { ...feed, ...patch }, zone = feed.landingZone;
    next.landingZone = resolveLandingZone(landingZoneCenter(zone), { width: zone.maxX - zone.minX, depth: zone.maxZ - zone.minZ }, next.ball.family, openingZoneSource(next));
    onChange(next);
  };
  return <div className="shot-controls">
    <details className="editor-section" open><summary data-section-key="Opening opponent shot">{t("Opening opponent shot")}</summary><BallIdentity ball={feed.ball} label={t("Opening")} opening onChange={ball => update({ ball })}/>
    </details>
      <details className="editor-section" open><summary data-section-key="Ball & rhythm">{t("Ball & rhythm")}</summary><BallParameters ball={feed.ball} prefix={t("Opening ")} onChange={ball => update({ ball })}/></details>
      {feed.ball.family === 'serve' ? <p className="saved-shot-count">{resolvedSpeedKmh === undefined ? t("Calculating serve…") : t("Resolved launch {0} km/h.", {"0": resolvedSpeedKmh.toFixed(1)})} {t("Serve speed includes shot variation; your return view stays fixed.")}</p> : null}
    <p className="saved-shot-count">{t("Drag the yellow landing zone to deliver the opening ball to your first shot.")}</p>
  </div>;
}

export function DrillShotControls({ event, drill, camera, onChange, onCameraChange, onEditOpening }: {
  event: PlayerShotEventV2; drill: DrillDefinitionV2; camera: CameraConfiguration;
  onChange: (patch: Partial<PlayerShotEventV2>) => void; onCameraChange: (camera: CameraConfiguration) => void; onEditOpening: () => void;
}) {
  const nextEvent = drill.events[drill.events.indexOf(event) + 1];
  const cameraFields: readonly [keyof CameraConfiguration, string, number][] = [
    ['lateral', 'Camera sideways (m)', .1], ['behindBaseline', 'Behind baseline (m)', .1], ['eyeHeight', 'Eye height (m)', .01],
    ['yaw', 'Camera heading (°)', 1], ['pitch', 'Camera tilt (°)', 1], ['fov', 'Field of view · all shots (°)', 1],
  ];
  return <div className="shot-controls">
    <label className="stack-field"><span>{t("Shot name")}</span><input maxLength={60} value={event.label} onChange={e => onChange({ label: e.target.value })}/></label>
    <details className="editor-section" open><summary data-section-key="Player shot · blue zone">{t("Player shot · blue zone")}</summary>
      <BallIdentity ball={event.ball} label={t("Your")} showHand={false} onChange={ball => onChange({ ball })}/>
      <ContactTimingControl family={event.ball.family} value={event.ball.contactTiming} label={t("Player contact timing")} onChange={contactTiming => onChange({ ball: { ...event.ball, contactTiming } })}/>
      <BallParameters ball={event.ball} onChange={ball => onChange({ ball })}/>
      <RangeField commitOnRelease label={t("Player shot interval")} value={event.intervalSeconds ?? drill.defaultInterval} min={1} max={30} step={.1} unit={t("s")} onChange={intervalSeconds => onChange({ intervalSeconds })}/>
      <RangeField commitOnRelease label={t("Stroke rhythm")} value={event.rhythmPercent ?? drill.defaultRhythmPercent ?? 100} min={50} max={300} step={5} unit="%" onChange={rhythmPercent => onChange({ rhythmPercent })}/>
      <RangeField commitOnRelease label={t("Movement pace")} value={event.movementPercent ?? drill.defaultMovementPercent ?? 100} min={50} max={300} step={5} unit="%" onChange={movementPercent => onChange({ movementPercent })}/>
      <label className="stack-field"><span>{t("Preparation cue")}</span><input maxLength={60} value={event.cue} onChange={e => onChange({ cue: e.target.value })}/></label>
    </details>
    <details className="editor-section return-shot-section" open><summary data-section-key="Opponent return · yellow zone">{t("Opponent return · yellow zone")}</summary>
      <BallIdentity ball={event.opponentReturn.ball} label={t("Opponent return")} onChange={ball => onChange({ opponentReturn: { ...event.opponentReturn, ball } })}/>
      <ContactTimingControl family={event.opponentReturn.ball.family} value={event.opponentReturn.ball.contactTiming} label={t("Opponent contact timing")} onChange={contactTiming => onChange({ opponentReturn: { ...event.opponentReturn, ball: { ...event.opponentReturn.ball, contactTiming } } })}/>
      <BallParameters ball={event.opponentReturn.ball} prefix={t("Return ")} onChange={ball => onChange({ opponentReturn: { ...event.opponentReturn, ball } })}/>
      {nextEvent ? <button type="button" className="secondary-button full-width" onClick={() => onChange({ opponentReturn: { ...event.opponentReturn, landingZone: receivingZone(nextEvent.camera, nextEvent.ball.family, nextEvent.ball, {
        x: (event.landingZone.minX + event.landingZone.maxX) / 2,
        z: (event.landingZone.minZ + event.landingZone.maxZ) / 2 + 3,
      }) } })}>{t("Aim return at next player shot")}</button> : null}
      <small>{drill.events.at(-1)?.id === event.id ? t("This shot finishes the point. The return settings are used if another shot follows.") : t("The opponent meets your ball and returns toward the yellow zone for your next shot.")}</small>
    </details>
    <details className="editor-section"><summary data-section-key="Perspective">{t("Perspective")}</summary><BallFocusControls/>
      <div className="court-preset-list">{DEFAULT_CAMERA_POSITION_PRESETS.map(preset => <button type="button" key={preset.id} onClick={() => {
        const position = { ...camera, ...preset.position };
        onCameraChange({ ...position, ...cameraLookAtCourtPoint(position, preset.lookAt ?? { x: 0, y: 0, z: COURT.halfLength }) });
      }}>{defaultContentText(preset.name)}</button>)}</div>
      {cameraFields.map(([key, label, step]) => <EditorNumber key={key} label={label} value={camera[key]} min={SHOT_CAMERA_RANGES[key][0]} max={SHOT_CAMERA_RANGES[key][1]} step={step} onChange={value => onCameraChange({ ...camera, [key]: value })}/>)}
      <small>{t("WASD to move · Page Up/Down for height · Drag to look · Wheel to zoom.")}</small>
    </details>
    <details className="editor-section"><summary data-section-key="New point">{t("New point")}</summary>
      <label className="check-field"><input type="checkbox" checked={!!event.openingFeed} onChange={e => onChange({ openingFeed: e.target.checked ? openingFor(event) : undefined })}/>{t("Start a fresh opening before this shot")}</label>
      {event.openingFeed ? <button type="button" className="secondary-button full-width" onClick={onEditOpening}>{t("Edit this opening and yellow zone")}</button> : null}
    </details>
  </div>;
}
