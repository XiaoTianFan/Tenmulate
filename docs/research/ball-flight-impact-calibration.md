# Ball flight and impact calibration

**Status:** implemented baseline for `ball-v5-depth-intent`; real-player and instrumented-court calibration remains an external validation gate.

## Source-backed constraints

| Area | Evidence | Runtime decision |
| --- | --- | --- |
| Court legality | The [2026 ITF Rules of Tennis](https://www.itftennis.com/en/about-us/governance/rules-and-regulations/) place each service line 6.40 m from the net and divide the service area at the centre line. | Quick Practice serve targets are clamped inside the diagonally opposite half-service box with 0.12 m line margins. |
| Ball/aerodynamic constants | The 2026 Sports Engineering trajectory decomposition uses a 57.7 g, 67 mm ball and starts optimisation from `Cd = 0.55` and lift slope `Cl' = 0.6`; its equations use `Cl = Cl' S`. [Paper](https://link.springer.com/article/10.1007/s12283-026-00547-6) | The runtime uses the same mass, diameter, drag coefficient, lift slope, and spin parameter, with `Cl` capped at 0.35 outside the normal calibration range. Forces are air-relative, so wind affects drag and Magnus acceleration. |
| Groundstroke flight and rebound | Cross derives `Fd = 0.5 Cd rho A v²`, `Fl = 0.5 Cl rho A v²`, uses `Cd = 0.55`, `Cl = 0.6 S`, and models the ball inertia near `0.55 mR²`. Topspin produces a steeper incident path and a higher overall post-bounce trajectory even though the same-angle impact alone can rebound lower. [Paper](https://doi.org/10.1007/s12283-020-00322-1) | The solver uses SI force coefficients, three-dimensional spin axes, a `0.55 mR²` contact impulse, and separate pre-impact, impact, and post-impact arcs. |
| Slow/deep feasibility | Cross's 22.77 m baseline-to-near-baseline calculations show that a slower ball requires a higher launch angle; below about 17 m/s no angle/spin combination reached that full distance, while the topspin-lob example used roughly 20 m/s at about 60°. [Paper](https://doi.org/10.1007/s12283-020-00322-1) | Pace remains the exact launch magnitude. Landing depth is now independent from minimum net clearance, the solver searches low/high launch-angle branches, and an unreachable combination is reported instead of silently shortening the authored target or increasing speed. |
| Serve families | Sakurai et al. measured elite flat, slice, and kick serves at about 187.2, 167.0, and 146.9 km/h, with mean spin rates about 1217, 2217, and 3214 rpm respectively; even the “flat” serve was not spin-free. [Paper](https://doi.org/10.1080/14763141.2012.671355) | Flat, slice, and kick use distinct three-dimensional spin vectors of approximately 123, 232, and 337 rad/s. Quick Practice uses a lower 135 km/h club-oriented default but allows 80–200 km/h. |
| Court friction | Allen, Haake, and Goodwill found that tennis balls slide for most court impacts; greater friction increases rebound topspin and reduces horizontal rebound velocity. [Paper](https://doi.org/10.1243/17543371JSET66) | Hard, clay, and grass use distinct friction, normal restitution, and rolling resistance. The impact step caps the tangential impulse with Coulomb friction and transfers it into translational and rotational velocity. |
| Impact-speed dependence | Dignall’s experimental thesis reports that normal restitution decreases as impact speed increases and that court stiffness is high enough to treat the court as rigid while differentiating surfaces through friction. [Thesis](https://etheses.whiterose.ac.uk/id/eprint/14607/) | Normal restitution receives a bounded impact-speed correction instead of remaining constant at all speeds. |

## Quick Practice profiles

| Shot type | Contact/source | Legal spin choices | Default launch |
| --- | --- | --- | --- |
| Groundstroke | 1.15 m, far baseline centre | Flat, topspin, slice | 68 km/h, 0.36 m minimum clearance, 9.5 m landing depth |
| Serve | 2.75 m, far deuce service position | Flat, slice, kick | 135 km/h, 0.18 m net clearance; target remains inside the diagonal service box |
| Volley | 1.32 m, 3.7 m from the net | None | 62 km/h, 0.16 m minimum clearance, 4.5 m landing depth |
| Lob / overhead feed | 1.05 m, 6.0 m from the net | Flat, topspin, slice | 52 km/h, 3.2 m minimum clearance, 9.3 m landing depth |

The contact heights and club-oriented default paces are product calibration values, not claims about one universal player. The serve contact height is intentionally lower than an elite maximum-effort reference and remains subject to coach/player review.

## Landing-depth intent

For non-serves, Net clearance is a minimum obstacle constraint and Landing depth is an independent target. At the selected fixed pace, the runtime samples the admissible angle range, discards trajectories that bounce before the net or cross below the requested height, and locally refines the closest landing result. Groundstroke and Volley choose the lower matching branch; Lob chooses the higher matching branch. The launch magnitude is never increased behind the user's back. When no exact solution exists, setup displays the resolved depth and a reachability explanation.

## Practice-only bounce adjustment

The `0.60×–1.40×` Bounce height control multiplies only the first normal rebound velocity after the physical surface response is calculated. It does not alter launch velocity, drag, Magnus force, net clearance, landing point, wind, or the surface profile. Subsequent impacts return to the natural surface model. This separation keeps the physically based default at `1.00×` while allowing display-distance compensation to be explicit and reversible.

## Verification contract

- Every flat, slice, and kick Quick Practice serve must clear the net and first-bounce inside the correct service box.
- A volley must resolve identically even if stale storage supplies a non-flat spin value.
- Flat, topspin, and slice groundstrokes must produce distinct landing and arrival behavior under identical pace/clearance inputs.
- An attainable deep recreational groundstroke must preserve its selected launch pace while matching landing depth; increasing minimum clearance must not silently retarget the bounce.
- Lob must clear the net on the high branch, reach a visibly higher apex, and land at its separately selected depth; Overhead setup selects this incoming feed.
- Surface friction must affect horizontal rebound and spin coupling; the first-bounce factor must change only post-impact samples.
- The solver remains deterministic for identical intent, wind, surface, and seed.

Instrumented validation against Hawk-Eye-class trajectories, measured court-specific friction/restitution, and player perception at target display distances remains required before labeling any profile as venue-measured rather than research-calibrated.
