# ADR-0034: Persistent court capture and the iOS transport boundary

- Status: Accepted for local capture implementation; direct receiver transport blocked
- Date: 2026-09-09
- Extends: [ADR-0020](0020-shared-court-and-transactional-zone-editing.md); its canvas ownership and parking decisions remain unchanged.

## Decision

`SharedCourtProvider` owns a `CourtCapture` controller alongside the stable court
portal. `SceneViewport` registers the actual WebGL canvas once its renderer starts.
Setup, Quick Practice, drill editing and drill playback publish configuration into
that same scene. Changing routes, viewport dimensions, camera, venue or quality
does not replace the canvas, capture stream or tracks.

Capture starts only on user request, using `canvas.captureStream(30)`. While it is
starting or active, the existing drawing buffer is capped at 1280 by 720 pixels
(rotated for portrait), preserving aspect ratio and the lower adaptive quality
budget. Stopping capture restores the usual pixel ratio. Simulation clocks and
motion rates are independent of capture cadence. There is no second WebGL scene,
screenshot loop, retained drawing buffer, encoder, recorder or network upload.

An optional Web Audio destination taps the existing practice cue/ambience output.
The speaker path remains connected, the tap survives route changes, and microphone
access is never requested. Closing the preview destroys only its muted video
element. It does not stop capture. Explicit Stop, source teardown, track ending,
WebGL context loss or non-bfcache page exit releases capture resources. Failed or
cancelled audio startup releases any acquired resources, including late results.

Routes without a visible court retain the canvas and stream but park the scene,
as before. Rendering also suspends while the document is hidden. The UI reports
parking or browser interruption; it does not promise background execution or
continuous frame delivery during OS suspension. Recovery after context loss or
track termination requires an explicit restart.

## Receiver boundary

This is **not a completed website-to-receiver casting implementation**. Current
WebKit's [MediaStream player](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/avfoundation/objc/MediaPlayerPrivateMediaStreamAVFObjC.h)
inherits the [base player's disabled wireless playback behavior](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/MediaPlayerPrivate.h).
It does not provide the wireless playback overrides used for transferable media.
This source inspection (2026-09-09), together with Apple's
[AirPlay source guidance](https://developer.apple.com/videos/play/wwdc2023/10122/),
rules out treating `video.srcObject = canvasStream` plus a playback picker as a
working AirPlay transport. This is an implementation inference, not an on-device
receiver test or a claim about unpublished vendor SDKs.

The Cast panel offers explicitly labeled iOS Control Center Screen Mirroring
instructions and an independent local capture preview. It cannot open the system
mirroring picker, discover receivers or report their connection state. Native
mirroring shows the device screen, including HTML controls, and does not consume
our capture stream. It is a fallback, not satisfaction of the requested in-page
sender. The receiver names are examples supplied by the owner, not discoveries.

No native sender, custom receiver page, cloud media relay, private receiver IP or
unverified SDK is introduced. A compatible transport under the owner's existing
receiver and website-only constraints remains unresolved. Real iOS video/audio,
thermal/latency and receiver qualification are separate acceptance gates.
