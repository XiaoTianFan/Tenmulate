# Open questions and proposed defaults

- **Status:** Owner input requested
- **Last updated:** 2026-08-29

The project can begin a narrow technical spike with the proposed defaults, but P0 answers can materially change V1 scope, calibration, assets, and architecture.

## P0: answer before implementation scope is accepted

| # | Question | Why it matters | Proposed default |
| --- | --- | --- | --- |
| 1 | What exact display setup should V1 optimize for: TV size/resolution, projector, viewing distance, computer/GPU, and available practice space? | Determines FOV calibration, 4K budget, ball visibility, control style, and realistic QA. | Windows laptop/desktop to a 55–65 inch 4K TV, 2.5–3.5 m viewing distance, current Chrome/Edge, 1080p internal render with adaptive upscale/pixel ratio. |
| 2 | Who is the first user: you personally, club-level adults, juniors, competitive players, or coaches? | Determines pace presets, language, content complexity, and success testing. | Self-directed adult club players, with a coach-friendly debug mode. |
| 3 | Must V1 include all three groups—groundstrokes, serve returns, and moving tactical/serve-and-volley sequences—or can V1 ship baseline + return first? | This is the largest scope lever and affects the motion library. | V1: baseline and serve return plus limited camera-position presets; volleys/overheads in V1.1. |
| 4 | What does “realistic” mean for the opponent: stylized-realistic, game-realistic, or near-photoreal? Is there a budget for a licensed/commissioned model and motion capture? | Character fidelity dominates asset cost, load size, and animation cleanup. | Stylized-realistic athlete with excellent silhouette/contact timing; spend effort on motion before skin/hair realism. |
| 5 | Should a player configure physical display dimensions and viewing distance for calibrated scale, or should the app prioritize a wider, more game-like view? | A single fixed FOV cannot be physically correct across a monitor, TV, and projector. | Offer both; recommend physical-view mode during first-use calibration, with an immersive override. |
| 6 | Which dominant-hand combinations must ship: right-handed user only initially, both users, right-handed opponent, or both opponent hands? | Changes labels, mirroring validity, contact positions, and animation volume. | Both user hands; right-handed opponent first, adding left-handed serve/stroke clips only after testing whether mirroring remains credible. |
| 7 | Can we use cloud-based generative 3D/mocap services with uploaded reference media, or must the asset pipeline remain local/private? | Controls tool choices, licensing review, security, and source-video handling. | Local Blender as source of truth; cloud tools only for explicitly approved, non-sensitive assets/footage with reviewed terms. |
| 8 | Is V1 a private prototype, publicly hosted free app, or the start of a commercial product? | Changes asset licensing, analytics/privacy, browser matrix, polish, legal review, and deployment. | Private prototype that preserves a clean path to commercial licensing. |

## P1: answer during the vertical slice

| # | Question | Proposed default |
| --- | --- | --- |
| 9 | Should speed be displayed as launch speed, speed at bounce, pace category, or a simple difficulty level? | Show friendly difficulty plus optional coach metrics for launch/bounce speed. |
| 10 | Do users need to author arbitrary drills in V1, or are curated presets enough? | Curated presets first; a constrained composer only after preset quality is proven. |
| 11 | Should surface choice change physics, visuals, or both? | Separate controls: named physics profile and visual theme, paired by default but independently testable. |
| 12 | How much camera travel is comfortable during shadow swinging? | Conservative preset movements with reduced-motion alternative; no head bob. |
| 13 | Should the app play racket contact, bounce, shoe, voice countdown, and ambience? | Contact/bounce/countdown on; shoe optional; ambience off by default. |
| 14 | Is offline use required at clubs/venues with unreliable internet? | Make the static app cacheable; defer a formal installable PWA requirement until asset size is measured. |
| 15 | Which languages must V1 support? | English-only prototype with localization-ready strings. |
| 16 | Is there a tennis coach/advanced player available to review trajectories and opponent biomechanics? | Require at least one expert reviewer before calling a shot family realistic. |

## P2: decide before public release

- Brand/project name: is **Tenmulate** intentional and final?
- Exact browser and minimum hardware support policy.
- Analytics: none, local diagnostics only, or opt-in product analytics.
- Accessibility targets beyond the initial keyboard, reduced-motion, audio, and contrast requirements.
- Asset/source attribution display and license record format.
- Hosting, domain, update cadence, and error-reporting channel.
- Whether custom drills can be exported/imported and what compatibility guarantees they receive.
- Whether future body-tracking data is processed strictly on-device and whether any frames may ever be stored.

## Suggested first response

The quickest way to unblock the next stage is to answer questions **1–8**, even approximately. Photos, room measurements, a TV/projector model, or a reference game/video for the desired visual realism would be especially useful. No purchase or cloud upload is needed for the initial renderer/trajectory spike.
