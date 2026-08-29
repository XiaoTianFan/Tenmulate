# Modular court scene-generation prompt kit

- **Status:** Accepted prompt baseline; generated results still require owner review
- **Last updated:** 2026-08-29
- **Composition rule:** `perspective prefix + environment prompt + shared production suffix`
- **Product baseline:** Perspective 2 + Environment 1

The six environment prompts deliberately contain no camera instructions. Choose exactly one perspective prefix and one environment prompt, then append the shared suffix. This keeps the environment identity stable while producing an oblique concept, a gameplay view, a spatial-planning view, or a spherical world-generation input.

## Perspective prefixes

### Perspective 1: high oblique environment view

> Perspective: high oblique bird's-eye environment view from above a near-court corner, camera pitched downward approximately 50 degrees, natural 28–35 mm full-frame-equivalent lens, the full regulation court and surrounding venue visible with generous perimeter context, straight vertical architecture, no fisheye distortion, landscape 16:9 composition.

### Perspective 2: player-level gameplay view

> Perspective: first-person tennis-player eye-level view, camera 1.70 meters high and 1.50 meters behind the center of the near baseline, looking squarely across the net toward the opponent baseline, approximately 70-degree horizontal field of view, level horizon, unobstructed opponent-contact and incoming-ball corridor, no near-player body or racket, landscape 16:9 composition.

### Perspective 3: true top-down floor plan

> Perspective: true 90-degree top-down orthographic floor-plan view, camera centered directly above the court, far baseline oriented toward the top of the frame, no perspective distortion and no tilted façades, the full regulation court and all venue boundaries visible with an even perimeter margin, landscape 16:9 composition.

### Perspective 4: full spherical panorama for world generation

> Perspective: full 360-degree by 180-degree monoscopic spherical panorama in equirectangular latitude-longitude projection, viewed from tennis-player eye level at 1.70 meters high and 1.50 meters behind the center of the near baseline, with the center of the far baseline straight ahead. Keep the horizon level at the exact vertical midpoint and preserve coherent scale, lighting, architecture, court geometry, and environmental detail in every direction from sky or ceiling through the ground. The panorama must wrap continuously, with matching left and right edges, no visible seam, no duplicated or cut-off objects at the wrap boundary, no cropped zenith or nadir, and no flat-perspective frame or border. Use a 2:1 landscape composition suitable for an immersive 360-degree viewer and as a panorama input to world-generation services.

For GPT Image 2, request a true 2:1 output such as `2048x1024` at `quality="medium"` or `quality="high"`; the prompt alone does not set the file dimensions. Review the result in a spherical panorama viewer before sending it to Marble, Aholo, or another world-generation provider. Reject outputs with a broken wrap seam, tilted or discontinuous horizon, missing poles, duplicated court features, or a merely wide rectilinear view.

**Generated coordinated Environment 1 set (2026-08-29):** [true top-down](court-environment-01-top-down-2026-08.png), [player-level baseline](court-environment-01-player-view-2026-08.png), [high-oblique bird's-eye](court-environment-01-birds-eye-2026-08.png), and [2:1 equirectangular panorama](court-environment-01-panorama-2026-08.png). The top-down image established the site plan; the baseline used it as a reference; the bird's-eye view used both prior images; and the panorama used all three accepted views. The panorama's court-line layout received one focused correction pass. Spherical-viewer and provider-ingestion review remain pending.

## Six court and environment prompts

### Environment 1: outdoor blue/green hard-court complex — product baseline

> Environment: a bright, welcoming outdoor public-club tennis complex centered on one regulation hard court. Use a medium blue in-bounds court with a muted green runoff zone, crisp white markings, a regulation black net, dark green windscreens, low black perimeter fencing, and open safe runback space. Place a neutral umpire chair beside the net, two practical player-rest benches with small shade canopies, restrained empty blue spectator bleachers, broad access aisles, and a modest maintenance gate outside play. Surround the venue with mature deciduous trees, clipped planting, low contemporary clubhouse structures, and distant neighboring courts implied through fencing rather than clutter. The default lighting is clear late-morning daylight with a high but directional sun, soft realistic shadows, clean blue sky, and strong yellow-ball contrast. The overall character is realistic, calm, public, accessible, and training-focused rather than a branded tournament show court.

### Environment 2: outdoor red-clay Mediterranean club

> Environment: an elegant outdoor Mediterranean tennis club centered on one regulation red-clay court. Show rich but natural burnt-orange clay, lightly groomed drag-brush texture, subtle believable slide and ball-mark traces, crisp pale lines, a regulation net, green windscreens, and generous clay runback. Include a traditional umpire chair, shaded player-rest benches, restrained empty terracotta-and-dark-green spectator seating, access paths, and low retaining walls outside the playing envelope. Set the court among warm limestone or stucco club buildings, cypress and olive trees, planted terraces, and understated wrought-metal fencing. Use golden late-afternoon sunlight from one side, long soft shadows, warm bounced light, and exposure controlled so the ball, net, and far player silhouette remain legible. The atmosphere is premium and relaxed without copying a recognizable real venue.

### Environment 3: outdoor grass park stadium at night

> Environment: a refined outdoor park-stadium centered on one regulation natural-grass tennis court at night. Use closely mown striped turf with realistic worn baseline areas kept subtle, clean white lines, a regulation dark net, deep-green surrounds, and ample grass runback. Add a classic umpire chair, player-rest benches, modest empty dark-green tiered seating, broad access paths, clipped hedges, mature trees, and low traditional pavilion architecture beyond the court. Four or more modern floodlight arrays illuminate the playing surface evenly while the sky and park remain dark and atmospheric. Control bloom and lamp glare, preserve shadow detail, and make the ball and far athlete silhouette exceptionally readable. The venue should feel prestigious yet intimate, not like a copied championship court.

### Environment 4: indoor hard-court timber-and-steel club hall

> Environment: a modern enclosed indoor tennis club hall centered on one regulation hard court. Use a blue in-bounds court with muted green runoff, clean white lines, a regulation net, generous safety clearance, and durable sports flooring. Include an umpire chair, player-rest benches, restrained empty bleachers, accessible aisles, storage recesses, and protective wall padding outside play. The architecture combines warm laminated-timber arches, dark steel connections, acoustic wall panels, clerestory windows, and north-light roof glazing, with no visually busy structure behind the opponent contact zone. Use bright neutral LED sports lighting supplemented by soft daylight, controlled reflections, believable indirect light, and a calm practice-club atmosphere.

### Environment 5: indoor clay tournament stadium

> Environment: a medium-scale enclosed tournament stadium centered on one regulation red-clay court. Show realistic groomed clay with subtle foot and slide traces, pale line tapes, a regulation net, wide clay runback, and protected access routes. Include a professional umpire chair, player-rest benches, empty tiered spectator seating on all sides, vomitories and player tunnels, dark roof trusses, acoustic treatment, and restrained courtside equipment without advertising. Use powerful neutral stadium fixtures focused on the court, softly receding empty stands, coherent shadows, and high exposure priority for the ball and opponent. The atmosphere should carry tournament energy while remaining uncluttered and suitable for focused training.

### Environment 6: contemporary covered grass arena

> Environment: a contemporary covered tennis arena centered on one regulation natural-grass court. Use immaculate striped green turf, subtle believable baseline wear, crisp white lines, a regulation dark net, and broad grass runback. Include an umpire chair, player-rest benches, restrained empty green seating, generous concourses and access aisles, and discreet player-entry openings. The architecture uses a light-colored long-span roof structure, slender trusses, high translucent panels or perimeter glazing, and a partially retractable-roof character without copying a recognizable stadium. Light the court with soft diffuse roof daylight reinforced by balanced sports fixtures, keeping the arena airy, quiet, and highly readable.

## Shared production suffix

> Rendering and constraints: polished game-realistic 3D environment concept for a Three.js/WebGPU web simulation, physically plausible scale and PBR materials, exact-looking regulation tennis proportions, coherent buildable architecture, clear central play corridor, realistic but restrained detail. Include one umpire chair, player-rest seating, empty spectator seating, access context, appropriate fencing or walls, and a complete surrounding environment. No people, crowds, near-player body, racket, ball, text, labels, logos, sponsorships, flags, watermark, or UI. Do not invent duplicate nets, impossible line markings, warped court geometry, obstructed runback, or props inside the playing area. This is visual-development input only; generated geometry is not the dimensional or collision authority.

## Recommended combinations

- **Starting product view:** Perspective 2 + Environment 1 + shared suffix.
- **Baseline world-generation input:** Perspective 1 + Environment 1 + shared suffix.
- **Registration and layout reference:** Perspective 3 + Environment 1 + shared suffix.
- **Preferred panorama world-generation input:** Perspective 4 + Environment 1 + shared suffix.

The four images should be treated as a coordinated visual set, not as metrically consistent reconstruction views. Regulation coordinates, camera calibration, and world-to-court registration remain code-owned. Perspective 4 is a provider input and visual shell reference, not evidence that the generated world preserves exact court dimensions.
