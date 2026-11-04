import { cameraPoint } from '../speed/lens';
import { atDepth, atHeight, contactCourtDepth, COURT } from '../speed/geometry';
import { COURT_LINES, isNetLine, newServeSetup, type BallMark, type GroundLine } from '../speed/types';
import { exportMetadata, frameReference, timeAt } from './common';
import type { DataExportRequest } from './types';
export function serveSpeedData(request: DataExportRequest) {
  const { clip, result, calibration, issue } = request,
    setup = clip.serve ?? newServeSetup();
  const camera = result?.camera ?? calibration;
  const pixel = (p: { x: number; y: number }) => ({
    x: p.x * clip.sourceWidth,
    y: p.y * clip.sourceHeight
  });
  const ball = (mark?: BallMark) =>
    mark
      ? {
          ...mark,
          ...frameReference(clip, mark.frame),
          imagePixels: pixel(mark),
          radiusUnit: 'source pixels'
        }
      : null;
  let contactPosition: number[] | null = null,
    bouncePosition: number[] | null = null;
  if (camera) {
    try {
      if (setup.contact?.frame === clip.contact)
        contactPosition = atDepth(camera.p, cameraPoint(camera, setup.contact!), contactCourtDepth(setup));
    } catch {
      /* Export annotations even if geometry is incomplete. */
    }
    try {
      if (setup.bounce)
        bouncePosition = atHeight(camera.p, cameraPoint(camera, setup.bounce), COURT.ballRadius);
    } catch {
      /* See calibration diagnostics. */
    }
  }
  let totalLength = 0;
  const trajectory = result?.path.map((point, i, path) => {
    const previous = path[i - 1];
    if (previous) totalLength += Math.hypot(...point.world.map((v, axis) => v - previous.world[axis]));
    return {
      physicalSecondsSinceContact: point.time,
      sourceTimeSeconds: timeAt(clip, setup.contact!.frame)! + point.time * setup.slowdown,
      imageNormalized: { x: point.x, y: point.y },
      imagePixels: pixel(point),
      courtPositionMeters: point.world,
      cumulativeLengthMeters: totalLength
    };
  });
  return {
    ...exportMetadata(clip, 'serve-speed'),
    method:
      'Endpoint reconstruction with quadratic drag and optional robust Magnus-lift fitting from intermediate ball points. No sidespin. Sensitivity envelope, not a statistical confidence interval.',
    reference:
      'https://github.com/XiaoTianFan/tennis-point-edit-review/tree/2b63d12ad7dfb85c30d4c2e3d38e5c9d873a6b78',
    status: result ? 'estimated' : issue ? 'needs-review' : camera ? 'calibrated' : 'annotations-only',
    issue: issue ?? null,
    units: {
      annotations:
        'Normalized source-image coordinates, except radius/pixelFloor/pixelError in source pixels. Half spans join the centre to a singles sideline; detectedHalf uses original unmirrored sides. courtPointsMeters contains only calibrated observed endpoints.',
      camera:
        'Row-major 3×4 projective matrix: [u,v,w] = P × [courtX,courtY,courtZ,1]; corrected image position = [u/w,v/w]. If camera.lens is present, use the inverse centred radial correction to obtain original source-image coordinates. Correction: d=(image-[0.5,0.5])*[width,height]/(hypot(width,height)/2); corrected d = d*(1+k*|d|²/(1+|d|²))/(1+max(k,0)/2).',
      court:
        'Metres: origin at near baseline centre on ground, x rightward in original image, y toward far baseline, z upward.',
      result:
        'launchKph/rangeKph/horizontalMeanKph: km/h; distance: horizontal contact-to-bounce metres; velocity: [horizontal along-flight, vertical] m/s; flightSeconds: physical seconds; path x/y: normalized image, z/world: metres, time: physical seconds since contact.',
      errors:
        'camera rms/checkError/residuals/pixelError and flightRms: source pixels. netClearance/contact3D/contactHeightRange/bounce3D: metres.',
      assumptions:
        'contactDepth/depthError: metres; frameError: frames per endpoint; slowdown: source-seconds / physical-second; drag/dragError/liftError and fitted lift/liftRange: 1/m. Negative lift bends the flight downward (topspin); this is not a spin-rate measurement. lens: dimensionless radial correction, held fixed in the sensitivity trials. flightFit reports per-point residuals and excluded outliers.',
      trajectory:
        'Reconstructed model samples, not observed ball detections or source-frame samples. Length is the 3D polyline arc length.'
    },
    courtDimensionsMeters: {
      basis:
        'Standard court/net dimensions assumed for calibration, not independently measured from the video.',
      singlesWidth: COURT.halfWidth * 2,
      doublesWidth: 10.97,
      length: COURT.length,
      nearBaselineY: 0,
      farBaselineY: COURT.length,
      netY: COURT.net,
      nearServiceLineY: COURT.nearService,
      farServiceLineY: COURT.farService,
      netSupportHeight: COURT.postHeight,
      netCenterHeight: COURT.centerHeight,
      netSupportSpan: setup.netSupports === 'doubles' ? 12.798 : 10.058,
      ballRadius: COURT.ballRadius
    },
    annotations: setup,
    courtMarks: Object.entries(setup.lines).map(([key, mark]) => ({
      id: key,
      name: COURT_LINES[key as keyof typeof COURT_LINES],
      ...frameReference(clip, mark!.frame),
      pointsNormalized: mark!.points,
      pointsPixels: mark!.points.map(pixel),
      span: isNetLine(key) ? 'vertical' : (mark!.span ?? 'full'),
      detectedHalf: camera?.mapping?.halves[key as GroundLine] ?? null,
      courtPointsMeters:
        camera?.controls
          ?.filter((c) => c.mark === key)
          .sort((a, b) => a.endpoint - b.endpoint)
          .map((c) => c.world) ?? null,
      pixelFloor: mark!.pixelFloor
    })),
    ballMarks: {
      contact: ball(setup.contact),
      firstBounce: ball(setup.bounce),
      flightChecks: setup.flight.map((mark) => ball(mark)),
      contactMatchesSelectedFrame: !!setup.contact && setup.contact.frame === clip.contact
    },
    calibration: camera ?? null,
    derivedPositions: {
      contactMeters: result?.contact3D ?? contactPosition,
      firstBounceMeters: result?.bounce3D ?? bouncePosition,
      conditionalOn:
        'The contact depth assumption and fitted camera; first-bounce centre is one ball radius above the ground.'
    },
    result: result ?? null,
    trajectory: trajectory
      ? {
          samples: trajectory,
          arcLengthMeters: totalLength,
          horizontalDistanceMeters: result!.distance,
          launchVelocityMetersPerSecond: [
            (result!.velocity[0] * (result!.bounce3D[0] - result!.contact3D[0])) / result!.distance,
            (result!.velocity[0] * (result!.bounce3D[1] - result!.contact3D[1])) / result!.distance,
            result!.velocity[1]
          ]
        }
      : null
  };
}
