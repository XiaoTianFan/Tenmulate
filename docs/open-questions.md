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
- **Long-session and offline reliability:** extended mixed-session testing and
  a complete deployed service-worker upgrade/offline lifecycle check remain useful
  acceptance work. Uncached content cannot be promised offline.
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
