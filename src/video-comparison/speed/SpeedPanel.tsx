import { useId, useState } from 'react';
import { t } from '../../i18n/locale';
import type { ComparisonClip } from '../types';
import { COURT_LINES, COURT_KEYS, type ServeSetup, type SpeedSelection, type MeasurementIssue } from './types';
import { clipFrameRange } from '../timeline';
import type { SpeedControls } from './useServeEstimate';
import { useCourtCalibration } from './useCourtCalibration';
import { atDepth } from './projective';
import { contactCourtDepth } from './geometry';
import './speed.css';

type NumberKey =
  'contactDepth' | 'depthError' | 'pixelError' | 'frameError' | 'slowdown' | 'drag' | 'dragError' | 'liftError';
export function SpeedPanel({
  active,
  clip,
  setup,
  frame,
  width,
  height,
  controls,
  onEdit,
  onSelect,
  onFrame,
  onPause
}: {
  active: boolean;
  clip: ComparisonClip;
  setup: ServeSetup;
  frame: number;
  width: number;
  height: number;
  controls: SpeedControls;
  onEdit: (edit: (setup: ServeSetup) => ServeSetup) => void;
  onSelect: (selection: SpeedSelection) => void;
  onFrame: (frame: number) => void;
  onPause: () => void;
}) {
  const [open, setOpen] = useState(false),
    id = useId();
  const { result, busy, error, progress } = controls;
  const range = clip.index ? clipFrameRange({ ...clip, index: clip.index }) : { start: 0, end: 0 };
  const calibration = useCourtCalibration({ setup, width, height }, active && open);
  const issueText = (issue: MeasurementIssue) =>
    t(issue.message, { mark: issue.mark ? t(COURT_LINES[issue.mark]) : '', error: issue.pixels?.toFixed(1) });
  let derivedHeight: number | undefined;
  if (calibration.camera && setup.contact?.frame === clip.contact) {
    try {
      derivedHeight = atDepth(calibration.camera.p, setup.contact!, contactCourtDepth(setup))[2];
    } catch {
      /* The estimator reports unsupported geometry. */
    }
  }
  const number = (key: NumberKey, label: string, min: number, max: number, step: number) => (
    <label className="speed-number" key={key}>
      <span>{t(label)}</span>
      <input
        type="number"
        aria-label={t(label)}
        value={Number.isFinite(setup[key]) ? setup[key] : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const value = e.target.valueAsNumber;
          onEdit((s) => ({ ...s, [key]: value }));
        }}
      />
    </label>
  );
  const select = (kind: SpeedSelection['kind']) =>
    onSelect({ kind, frame: kind === 'contact' ? (clip.contact ?? frame) : frame });
  const canEstimate =
    !!calibration.camera &&
    !calibration.busy &&
    clip.contact !== null &&
    setup.contact?.frame === clip.contact &&
    !!setup.bounce;
  const download = () => {
    if (!result || !clip.index) return;
    const data = {
      version: 2,
      method: 'Endpoint reconstruction with quadratic drag; sensitivity envelope, not a confidence interval',
      reference:
        'https://github.com/XiaoTianFan/tennis-point-edit-review/tree/2b63d12ad7dfb85c30d4c2e3d38e5c9d873a6b78',
      clip: clip.name,
      source: {
        width,
        height,
        frameNumbering: 'zero-based',
        fps: clip.index.fps,
        variableFrameRate: clip.index.variable
      },
      excerpt: range,
      annotations: setup,
      sourceTimestamps: Object.fromEntries(
        [
          ...new Set([
            ...Object.values(setup.lines).map((mark) => mark!.frame),
            setup.contact!.frame - 1,
            setup.contact!.frame + 1,
            setup.bounce!.frame - 1,
            setup.bounce!.frame + 1,
            ...[setup.contact!, setup.bounce!, ...setup.flight].map((p) => p.frame)
          ])
        ]
          .filter((f) => f >= 0 && f < clip.index!.timestamps.length)
          .map((f) => [f, clip.index!.timestamps[f]])
      ),
      sourceEnd: clip.index.end,
      result
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clip.name.replace(/\.[^.]+$/, '')}-serve-speed.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="motion-panel speed-panel">
      <button
        type="button"
        className="motion-disclosure"
        aria-label={t('Serve speed')}
        aria-expanded={open}
        aria-controls={id}
        disabled={!clip.index || !!clip.error}
        onClick={() => setOpen(!open)}
      >
        {t('Serve speed')}
        <span>{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div id={id} className="motion-panel-body">
          {width <= height ? (
            <p className="motion-help">{t('Serve speed needs a landscape recording with the full court visible.')}</p>
          ) : (
            <>
              <p className="motion-help">
                {t(
                  'Estimate launch speed from court geometry and contact-to-first-bounce timing. Use a fixed, full-court view with visible net supports. All measurements stay on this device.'
                )}
              </p>
              <fieldset>
                <legend>{t('1. Map the court')}</legend>
                <p className="motion-help">
                  {t(
                    'Use any clear frame for each line; the camera must stay fixed. Mark the singles endpoints of both baselines and the far service line. Cropping is temporarily lifted while marking.'
                  )}
                </p>
                <label>
                  {t('Net supports')}
                  <select
                    value={setup.netSupports}
                    onChange={(e) =>
                      onEdit((s) => ({ ...s, netSupports: e.target.value as ServeSetup['netSupports'] }))
                    }
                  >
                    <option value="doubles">{t('Doubles posts · 12.798 m apart')}</option>
                    <option value="singles">{t('Singles sticks · 10.058 m apart')}</option>
                  </select>
                </label>
                <p className="motion-help">
                  {t(
                    'Draw a top-to-ground line at each net support (1.07 m) and the centre strap (0.914 m). Follow the post or strap, even if it leans in the image. Mark supports A and B in either order.'
                  )}
                </p>
                <div className="speed-court-marks">
                  {COURT_KEYS.map((kind) => {
                    const mark = setup.lines[kind],
                      outside = mark && (mark.frame < range.start || mark.frame > range.end);
                    return (
                      <div
                        key={kind}
                        className={
                          calibration.camera?.quality === 'review' && calibration.camera.worstMark === kind
                            ? 'needs-review'
                            : ''
                        }
                      >
                        <button type="button" onClick={() => select(kind)} aria-label={t(COURT_LINES[kind])}>
                          {mark ? '✓ ' : ''}
                          {t(COURT_LINES[kind])}
                        </button>
                        {mark ? (
                          <button
                            type="button"
                            className="speed-mark-frame"
                            aria-label={t('Review {mark}, frame {frame}', {
                              mark: t(COURT_LINES[kind]),
                              frame: mark.frame + 1
                            })}
                            disabled={!!outside}
                            title={
                              outside
                                ? t('This court mark is outside the excerpt and still contributes to calibration.')
                                : undefined
                            }
                            onClick={() => onFrame(mark.frame)}
                          >
                            {t('Frame {frame}', { frame: mark.frame + 1 })}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {Object.keys(setup.lines).length ? (
                  <button type="button" onClick={() => onEdit((s) => ({ ...s, lines: {} }))}>
                    {t('Reset court marks')}
                  </button>
                ) : null}
                {calibration.busy ? (
                  <p className="motion-help" role="status">
                    {t('Fitting court and net geometry…')}
                  </p>
                ) : null}
                {calibration.error ? (
                  <p className="speed-error" role="alert">
                    {issueText(calibration.error)}
                  </p>
                ) : null}
                {calibration.camera ? (
                  <div className="speed-calibration" role="status">
                    <span>{t('Court fit: {error} px RMS', { error: calibration.camera.rms.toFixed(1) })}</span>
                    {calibration.camera.quality === 'review' ? (
                      <p className="motion-help">
                        {t(
                          'Review {mark}: {error} px mismatch. You can estimate; this mismatch increases the uncertainty range.',
                          {
                            mark: t(COURT_LINES[calibration.camera.worstMark]),
                            error: calibration.camera.checkError.toFixed(1)
                          }
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <label>
                  {t('Serving baseline')}
                  <select
                    value={setup.servingEnd}
                    onChange={(e) => onEdit((s) => ({ ...s, servingEnd: e.target.value as ServeSetup['servingEnd'] }))}
                  >
                    <option value="near">{t('Near baseline')}</option>
                    <option value="far">{t('Far baseline')}</option>
                  </select>
                </label>
                {number('contactDepth', 'Contact depth inside baseline (m)', -1, 3, 0.1)}
                {number('depthError', 'Contact-depth uncertainty ± (m)', 0, 1.5, 0.1)}
                <p className="motion-help">
                  {t(
                    'The default assumes contact 0.5 m inside the serving baseline. Height is derived from the marked ball and court geometry. Adjust depth if needed; negative values are behind the baseline.'
                  )}
                </p>
                <div className="speed-derived-height">
                  <span>{t('Estimated contact height')}</span>
                  <output aria-label={t('Estimated contact height')}>
                    {derivedHeight !== undefined && derivedHeight >= 0.3 && derivedHeight <= 5.5
                      ? `≈ ${derivedHeight.toFixed(2)} m`
                      : '—'}
                  </output>
                </div>
                {!setup.contact || setup.contact.frame !== clip.contact ? (
                  <p className="motion-help">{t('Mark the contact ball position to derive its height.')}</p>
                ) : derivedHeight !== undefined && (derivedHeight < 0.3 || derivedHeight > 5.5) ? (
                  <p className="motion-help">
                    {t(
                      'The derived contact height is implausible. Check the ball mark, serving end and contact depth.'
                    )}
                  </p>
                ) : null}
              </fieldset>
              <fieldset>
                <legend>{t('2. Mark the ball')}</legend>
                <p className="motion-help">
                  {t(
                    'Use Set contact on the card for racket impact. Navigate with the existing preview lane to the first ground impact. Mark the ball centre, not its shadow. Do not include a net touch or an earlier bounce.'
                  )}
                </p>
                <div className="speed-court-actions">
                  <button type="button" disabled={clip.contact === null} onClick={() => select('contact')}>
                    {t('Contact ball position')}
                    {clip.contact !== null
                      ? ` · ${clip.contact + 1}${setup.contact?.frame === clip.contact ? ' ✓' : ''}`
                      : ''}
                  </button>
                  <button
                    type="button"
                    disabled={clip.contact === null || frame <= clip.contact}
                    onClick={() => select('bounce')}
                  >
                    {t('First bounce ball position')}
                    {setup.bounce ? ` · ${setup.bounce.frame + 1} ✓` : ''}
                  </button>
                </div>
                {clip.contact === null ? (
                  <p className="motion-help">{t('Set a contact frame on this card first.')}</p>
                ) : null}
                {setup.contact && setup.contact.frame !== clip.contact ? (
                  <p role="status">{t('Contact changed. Mark the ball again on the new contact frame.')}</p>
                ) : null}
                {setup.bounce ? (
                  <button type="button" onClick={() => onFrame(setup.bounce!.frame)}>
                    {t('Review bounce: frame {frame}', { frame: setup.bounce.frame + 1 })}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={
                    !setup.bounce ||
                    clip.contact === null ||
                    frame <= clip.contact ||
                    frame >= setup.bounce.frame ||
                    setup.flight.length >= 24
                  }
                  onClick={() => select('flight')}
                >
                  {t('Add flight check at this frame')}
                </button>
                <p className="motion-help">
                  {t(
                    'Optional flight checks test the reconstructed path against visible ball positions. They do not silently fit or replace your court measurements.'
                  )}
                </p>
                <div className="speed-checks">
                  {setup.flight.map((mark) => (
                    <span key={mark.frame}>
                      <button type="button" onClick={() => onFrame(mark.frame)}>
                        {t('Frame {frame}', { frame: mark.frame + 1 })}
                      </button>
                      <button
                        type="button"
                        aria-label={t('Remove flight check at frame {frame}', { frame: mark.frame + 1 })}
                        onClick={() =>
                          onEdit((s) => ({ ...s, flight: s.flight.filter((p) => p.frame !== mark.frame) }))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>{t('3. Recording time')}</legend>
                {number('slowdown', 'Recording slowdown factor', 1, 16, 0.1)}
                <p className="motion-help">
                  {t(
                    'Use 1 for real-time recordings, or 4 for footage recorded to play four times slower. Card and global playback speeds do not change this measurement.'
                  )}
                </p>
                <details>
                  <summary>{t('Measurement uncertainty and aerodynamics')}</summary>
                  <div className="speed-assumptions">
                    {number('pixelError', 'Mark uncertainty ± (source pixels)', 0.25, 30, 0.25)}
                    <p className="motion-help">
                      {t(
                        'Mark uncertainty includes at least one screen pixel at the marking scale. Increase it for blur or imprecise marks. Arrow keys adjust by one source pixel; Shift moves ten.'
                      )}
                    </p>
                    {number('frameError', 'Timing uncertainty ± (frames per endpoint)', 0.5, 3, 0.5)}
                    {number('drag', 'Quadratic drag (1/m)', 0, 0.06, 0.001)}
                    {number('dragError', 'Drag uncertainty ± (1/m)', 0, 0.03, 0.001)}
                    {number('liftError', 'Lift sensitivity ± (1/m)', 0, 0.02, 0.001)}
                    <p className="motion-help">
                      {t(
                        'The central model uses gravity, quadratic drag and no lift or wind. The range varies timing, marks, contact depth, drag and lift; height follows the geometry. Ball regions add centroid uncertainty. It is a sensitivity envelope, not a statistical confidence interval.'
                      )}
                    </p>
                  </div>
                </details>
              </fieldset>
              <label>
                <input
                  type="checkbox"
                  checked={setup.showOverlay}
                  onChange={(e) => onEdit((s) => ({ ...s, showOverlay: e.target.checked }))}
                />
                {t('Show measurement overlay')}
              </label>
              <p className="motion-help">
                {t(
                  'Cyan: court marks. White: observed ball positions. Dashed yellow: reconstructed flight, not an observed track.'
                )}
              </p>
              <button
                type="button"
                className="speed-estimate"
                disabled={busy || !canEstimate}
                onClick={() => {
                  onPause();
                  controls.run();
                }}
              >
                {t('Estimate serve speed')}
              </button>
              {busy ? (
                <div className="motion-status" role="status">
                  <span>{t('Checking measurement sensitivity…')}</span>
                  <progress max={1} value={progress ?? 0} />
                  <button type="button" onClick={controls.cancel}>
                    {t('Cancel')}
                  </button>
                </div>
              ) : null}
              {error ? (
                <p className="speed-error" role="alert">
                  {issueText(error)}
                </p>
              ) : null}
              {result ? (
                <div className="speed-result" role="status">
                  <span>{t('Estimated launch speed')}</span>
                  <strong>≈ {Math.round(result.launchKph)} km/h</strong>
                  <span>
                    {t('Sensitivity range: {low}–{high} km/h', {
                      low: Math.floor(result.rangeKph[0]),
                      high: Math.ceil(result.rangeKph[1])
                    })}
                  </span>
                  <dl>
                    <dt>{t('Horizontal mean speed')}</dt>
                    <dd>{result.horizontalMeanKph.toFixed(1)} km/h</dd>
                    <dt>{t('Physical flight time')}</dt>
                    <dd>{result.flightSeconds.toFixed(3)} s</dd>
                    <dt>{t('Horizontal travel')}</dt>
                    <dd>{result.distance.toFixed(2)} m</dd>
                    <dt>{t('Model net clearance')}</dt>
                    <dd>{result.netClearance.toFixed(2)} m</dd>
                    <dt>{t('Estimated contact height')}</dt>
                    <dd>{result.contact3D[2].toFixed(2)} m</dd>
                    <dt>{t('Height sensitivity range')}</dt>
                    <dd>
                      {result.contactHeightRange[0].toFixed(2)}–{result.contactHeightRange[1].toFixed(2)} m
                    </dd>
                    <dt>{t('Court fit error (maximum)')}</dt>
                    <dd>{result.camera.checkError.toFixed(1)} px</dd>
                    <dt>{t('Flight check error (RMS)')}</dt>
                    <dd>
                      {result.flightRms === null
                        ? t('No flight checks')
                        : `${result.flightRms.toFixed(1)} px · ${result.checkedPoints}`}
                    </dd>
                  </dl>
                  {!result.checkedPoints ? (
                    <p className="motion-help">
                      {t('Endpoint-only estimate. Add visible in-flight ball checks to test the path.')}
                    </p>
                  ) : null}
                  {result.collisionVariants ? (
                    <p className="motion-help">
                      {t(
                        'Some uncertainty scenarios hit the net. Review contact depth, timing and marks before relying on this estimate.'
                      )}
                    </p>
                  ) : null}
                  <p className="motion-help">
                    {t(
                      'A model estimate, not a radar measurement. Lens distortion, spin, wind, camera movement and labeling errors can add uncertainty beyond this range.'
                    )}
                  </p>
                  <button type="button" onClick={download}>
                    {t('Download measurement JSON')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
