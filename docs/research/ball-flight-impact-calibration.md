# Ball flight and impact calibration

**Status:** implemented baseline for `ball-v6-spin-target`; real-player and instrumented-court calibration remains an external validation gate.

## Source-backed constraints

| Area | Evidence | Runtime decision |
| --- | --- | --- |
| Court legality | The [2026 ITF Rules of Tennis](https://www.itftennis.com/en/about-us/governance/rules-and-regulations/) place each service line 6.40 m from the net and divide the service area at the centre line. | Quick Practice serve targets are clamped inside the diagonally opposite half-service box with 0.12 m line margins. |
| Ball/aerodynamic constants | The 2026 Sports Engineering trajectory decomposition uses a 57.7 g, 67 mm ball and starts optimisation from `Cd = 0.55` and lift slope `Cl' = 0.6`; its equations use `Cl = Cl' S`. [Paper](https://link.springer.com/article/10.1007/s12283-026-00547-6) | The runtime uses the same mass, diameter, drag coefficient, lift slope, and spin parameter, with `Cl` capped at 0.35 outside the normal calibration range. Forces are air-relative, so wind affects drag and Magnus acceleration. |
| Groundstroke flight and rebound | Cross derives `Fd = 0.5 Cd rho A v²`, `Fl = 0.5 Cl rho A v²`, uses `Cd = 0.55`, `Cl = 0.6 S`, and models the ball inertia near `0.55 mR²`. Topspin produces a steeper incident path and a higher overall post-bounce trajectory even though the same-angle impact alone can rebound lower. [Paper](https://doi.org/10.1007/s12283-020-00322-1) | The solver uses SI force coefficients, three-dimensional spin axes, a `0.55 mR²` contact impulse, and separate pre-impact, impact, and post-impact arcs. |
| Flat groundstroke spin | Protheroe measured nominally flat forehands at `761 ± 580 rpm` and flat backhands at `473 ± 522 rpm`, rather than zero; topspin versions were significantly higher. [Thesis](https://knowledge.lancashire.ac.uk/id/eprint/2926/3/Protheroe_Laurence_Final_e-Thesis_(Master_Copy).pdf) A junior-match sensor study likewise reported its lowest groundstroke-spin values for flat strokes at about 1,000 rpm. [Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7037903/) | Flat means a low-topspin drive. Quick Practice defaults it to 760 rpm, exposes a 250–1,600 rpm range, migrates legacy zero to the floor, and clamps raw target-practice flat intent before flight integration. The bounds are product calibration, not population confidence limits. |
| Slow/deep feasibility | Cross's 22.77 m baseline-to-near-baseline calculations show that a slower ball requires a higher launch angle; below about 17 m/s no angle/spin combination reached that full distance, while the topspin-lob example used roughly 20 m/s at about 60°. [Paper](https://doi.org/10.1007/s12283-020-00322-1) | Launch speed remains the exact launch magnitude. Landing depth is independent from the internal net-safety constraint, the solver searches low/high launch-angle branches, and an unreachable combination retains its closest physical result instead of silently shortening the target or increasing speed. |
| Serve families | Sakurai et al. measured elite flat, slice, and kick serves at about 187.2, 167.0, and 146.9 km/h, with mean spin rates about 1217, 2217, and 3214 rpm respectively; even the “flat” serve was not spin-free. [Paper](https://doi.org/10.1080/14763141.2012.671355) | Flat, slice, and kick use distinct three-dimensional spin vectors of approximately 123, 232, and 337 rad/s. Quick Practice uses a lower 135 km/h club-oriented default but allows 80–200 km/h. |
| Court friction | Allen, Haake, and Goodwill found that tennis balls slide for most court impacts; greater friction increases rebound topspin and reduces horizontal rebound velocity. [Paper](https://doi.org/10.1243/17543371JSET66) | Hard, clay, and grass use distinct friction, normal restitution, and rolling resistance. The impact step caps the tangential impulse with Coulomb friction and transfers it into translational and rotational velocity. |
| Impact-speed dependence | Dignall’s experimental thesis reports that normal restitution decreases as impact speed increases and that court stiffness is high enough to treat the court as rigid while differentiating surfaces through friction. [Thesis](https://etheses.whiterose.ac.uk/id/eprint/14607/) | Normal restitution receives a bounded impact-speed correction instead of remaining constant at all speeds. |

## Quick Practice profiles

| Shot type | Contact/source | Legal spin choices | Default launch |
| --- | --- | --- | --- |
| Groundstroke | 1.15 m, far baseline centre | Flat drive, topspin, slice | 70 km/h, 1,103 rpm topspin, 8.5 m landing depth; Flat drive defaults to 760 rpm |
| Serve | 2.75 m, far deuce service position | Flat, slice, kick | 135 km/h, 1,179 rpm flat spin, 5.05 m service-box depth |
| Volley | 1.32 m, 3.7 m from the net | None | 62 km/h, zero spin, 4.5 m landing depth |
| Lob / overhead feed | 1.05 m, 6.0 m from the net | Flat, topspin, slice | 52 km/h, 1,199 rpm topspin, 9.3 m landing depth |

The contact heights, club-oriented launch speeds, and default spin rates are product calibration values, not claims about one universal player. The serve contact height is intentionally lower than an elite maximum-effort reference and remains subject to coach/player review.

## Landing-depth intent

Quick Practice exposes one target-practice contract: shot type, launch speed, spin type and rate, landing depth, direction, surface, and cadence. Net clearance remains a shot-profile safety constraint inside the solver rather than a second user-authored ballistic control. At the selected speed and RPM, the runtime samples the admissible angle range, discards trajectories that bounce before the net or cross below the internal minimum, and locally refines the closest landing result. Groundstroke and Volley choose the lower matching branch; Lob chooses the higher matching branch. The launch magnitude is never increased behind the user's back. The configuration panel contains only intent controls; resolved angle, apex, actual net clearance, landing error, bounce speeds, and receiver-plane state appear only when the user hovers the rendered trajectory.

## Continuous spin intent

Spin type selects a shot-local axis composition, and Spin rate supplies its magnitude in rpm. The local topspin axis follows the shot heading rather than a fixed world axis; Flat groundstroke uses that same axis at a lower calibrated magnitude, while serve slice/kick retain handed side-spin components. Free-flight angular speed decays by approximately 2% per 6.4 m before impact, then the surface impulse couples contact slip back into translation and rotation. Volley remains spin-free even if stale storage contains a non-zero rate.

## Practice-only bounce adjustment

The `0.60×–1.40×` Bounce height control multiplies only the first normal rebound velocity after the physical surface response is calculated. It does not alter launch velocity, drag, Magnus force, net clearance, landing point, wind, or the surface profile. Subsequent impacts return to the natural surface model. This separation keeps the physically based default at `1.00×` while allowing display-distance compensation to be explicit and reversible.

## Verification contract

- Every flat, slice, and kick Quick Practice serve must clear the net and first-bounce inside the correct service box.
- A volley must resolve identically even if stale storage supplies a non-flat spin value.
- Flat, topspin, and slice groundstrokes must produce distinct landing and arrival behavior under identical launch-speed and depth inputs.
- Flat groundstroke must resolve with positive topspin: 760 rpm by default and never below the 250 rpm target-practice floor, including legacy zero-spin preferences and compiled sessions.
- An explicit spin rate must be preserved in resolved metadata and must change the required launch solution without silently retargeting an attainable bounce.
- An attainable deep recreational groundstroke must preserve its selected launch speed while matching landing depth.
- Lob must clear the net on the high branch, reach a visibly higher apex, and land at its separately selected depth; Overhead setup selects this incoming feed.
- Surface friction must affect horizontal rebound and spin coupling; the first-bounce factor must change only post-impact samples.
- The solver remains deterministic for identical intent, wind, surface, and seed.
- Screen-space hover interpolation must return the physical sample nearest the pointer without advancing or mutating the simulation.

Instrumented validation against Hawk-Eye-class trajectories, measured court-specific friction/restitution, and player perception at target display distances remains required before labeling any profile as venue-measured rather than research-calibrated.
