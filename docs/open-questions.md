# Known limitations and open work

These items are unresolved scope or validation work, not promises of a release
schedule. Completed features belong in the user guide and architecture.

- **Technique and reach calibration:** independent coach review of contact poses,
  grips, footwork and reaction/coverage assumptions. The model does not measure
  the user's physical movement or fitness. A dedicated one-handed topspin
  backhand remains future work.
- **Device coverage:** real Safari/iOS, lower-power hardware, TVs and projectors
  need broader performance, audio-latency, display-calibration and interaction
  testing. Desktop tests do not establish device-wide compatibility.
- **Video comparison:** nine high-resolution/high-frame-rate videos require
  target-device decoder and memory testing. Shared decoded-frame playback preserves
  contact alignment but can buffer under load; native compatibility decoding can
  be slower. Real-device codec/profile coverage, export encoder support and large
  image-sheet memory use need broader validation. Browser codec support, untagged color profiles, canvas HDR
  rendering and phone slow-motion/edit metadata vary; encoded presentation timing
  is used, not an inferred capture frame rate. Comparison sessions are visit-only.
- **Long-session and offline reliability:** extended mixed-session testing and
  a complete deployed service-worker upgrade/offline lifecycle check remain useful
  acceptance work. Uncached content cannot be promised offline.
- **Delivery asset ownership:** introduce an explicit set of runtime assets derived
  from active motion, venue, audience and audio manifests. Retain historical motion
  evidence and character-authoring inputs outside that delivery set, with a tested
  restore path. Validate all required URLs, hashes, licenses and service-worker
  upgrades; distinguish deployment savings from Git history and GPU memory.
- **Toolchain separation:** evaluate an optional asset-authoring package and an
  external versioned tool location shared by the frontend and MotionLab. The lab's
  production and pose-diagnostic requirements currently install into one environment;
  separate them before retiring optional packages. Resolve the diagnostic lockfile's
  overlapping OpenCV distributions rather than uninstalling one in place.
- **Measured runtime budgets:** measure cold/warm startup, launch latency, venue
  switch peaks, long-session memory and frame-time percentiles on target devices.
  Evaluate byte-bounded session reuse, concurrency limits and fewer download-buffer
  copies while preserving deterministic results, stale-result rejection and each
  subscriber's cancellation. Existing quality variants and adaptive resolution are
  the baseline.
- **Renderer upgrades:** evaluate KTX2/Basis textures and measured geometry/shadow
  budgets before a renderer migration. A WebGPU prototype needs explicit material,
  custom-shader, capture and device-compatibility validation; it is not an assumed
  speed improvement. Keep the current renderer available until parity is proven.
- **Casting:** the current app offers local court capture and screen-mirroring
  instructions. Direct website-to-existing-TV-receiver transport is not provided;
  the website cannot confirm a mirroring connection.
- **Audio realism:** venue acoustics are authored approximations, not measurements
  of the depicted buildings. Volley/drop-shot and overhead contact sounds reuse
  related recorded shot families; broader shot-specific recordings and physical
  speaker/device evaluation remain possible improvements.
- **Accessibility:** broader keyboard, screen-reader and touch-device validation
  remains needed, particularly for the spatial editor.
- **Licensing:** a repository-wide source-code license has not been selected.
  Third-party asset notices remain in force; a broader distribution-rights review
  is separate from build success. See [asset attribution](asset-attribution.md).

Body/racket tracking, automatic technique assessment, accounts, cloud sync and
video-to-drill reconstruction are outside the current implementation.
