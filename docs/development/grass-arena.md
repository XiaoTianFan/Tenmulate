# Blender grass arena

## Reference and construction brief — 2026-09-05

The third authored venue targets the architectural character of the modern Centre Court at Wimbledon, with neutral **Grass Open Arena** / Tenmulate identity in the product. This is original geometry informed by public references, not a measured replica. Reference names remain here and in development provenance, not in visible signs or runtime mesh names. Removing logos is not a rights-clearance opinion.

The [official seating diagram](https://www.wimbledon.com/pdf/Centre_Court_Plan_2021.pdf) was downloaded and rendered locally for visual inspection. It shows straight longitudinal seating blocks connected by rounded corner fans, a baseline box and nonuniform upper-gallery coverage. It is schematic: it does not publish row slopes or construction dimensions. Owner-supplied empty-bowl photographs are the main source for rake, aisle rhythm, low dark parapets, green seats and the canopy underside. No reference image is shipped.

| Element | Evidence | Authored decision |
| --- | --- | --- |
| Court / lawn | [AELTC grass facts](https://www.wimbledon.com/en_GB/about/grass_courts): 22 × 41 m overall grass, 23.77 m regulation court length | Exact regulation anchors and lawn footprint; separate outer perimeter walkway |
| Seating bowl | Official plan and supplied empty court / corner views | Rounded rectangle, court-aligned straight blocks and symmetric curved corners; no normalized-perimeter spiral |
| Rake | No dimensioned row section located | 0.74 m tread; lower rise 0.29 m (21.4°), main rise 0.41 m (29.0°), gallery rise 0.43 m (30.2°). Estimates, not surveyed values |
| Upper gallery | [Populous](https://populous.com/showcases/wimbledon-aeltc): six additional upper rows on three sides, about 15,000 capacity | Six-row gallery omitted behind the south pavilion; linked green seat shells; actual exported capacity measured after generation |
| Roof mechanism | [Fairfields](https://www.fairfields.co.uk/projects/wimbledon-roof/): two banks of five cross-spanning trusses | Two folded banks beyond the central aperture; white lattice members, fold fabric, rails, bogies and fixed lighting |
| Roof dimensions | Architect gives 65 × 75 m roof; fabricator describes roughly 77 m truss span | 77 m structural span, 61 × 68 m clear central aperture; these are different measures. Canopy and bowl dimensions are adjusted estimates |
| Baseline architecture | Supplied baseline photograph | Original timber-edged garden pavilion and generic score displays; no royal label, crest, event sponsors or copied inscriptions |
| Materials / light | Supplied daylight court and canopy views | Longitudinal mowing stripes, subtle baseline wear, forest-green padding/seats, olive fixed roof, opaque grid soffit and dense folded fabric. Shared runtime atmosphere retained |

Source parameters live in `assets/venues/grass-center-court/design.json`; provenance and exclusions in `sources.json`. Roof pose is statically open, not a full control/engineering simulation. Public sources do not establish a complete dimensioned as-built plan; precise bowl geometry is explicitly authored from reference proportions.

## Delivery status

Construction, exported-geometry checks and browser comparison are in progress. The procedural grass venue remains the default/failure fallback until the opt-in authored asset is ready. Existing hard and clay sources must remain unchanged.
