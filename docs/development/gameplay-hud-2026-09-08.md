# Gameplay controls and metadata — 2026-09-08

## Request and resulting behavior

The supplied gameplay reference showed a persistent header, oversized bottom
transport, and competing left/right information panels. Playback now starts with
the header and transport hidden, while the compact metadata panel remains at
bottom-right, aligned with the bottom-left trajectory hint.

- Hovering either header or transport region reveals both. Court pointer movement
  does not reveal them. Show UI pins the controls; Hide UI or H restores auto-hide.
- Keyboard focus reveals the controls. Space on a focused button activates that
  button without also invoking the global pause shortcut. H releases control focus
  so its hide action is effective.
- On touch devices, the first tap in either region reveals both without pressing
  the hidden button underneath. Tapping the court hides them. Open session settings
  remain accessible and have a close button.
- Metadata uses 10–11 px text, with a 14 px speed value: speed, spin, shot family,
  arm/stroke side, placement, trajectory state, interval, resolved stroke/movement
  rates, mute, paused state and relevant drill timing/return notices.
- Desktop transport shrinks from 600×108 to 364×78 px. At narrower widths it moves
  above the metadata to avoid overlap. The hover-only trajectory instruction is
  omitted below 600 px; shot metadata remains available.

The shared court, simulation and motion assets are unchanged. CSS handles desktop
hover; there are no additional pointer-move React updates or trajectory compiles.
Touch listens on the physical shell DOM because React portal events follow their
React owner rather than the court slot's DOM ancestors.

## Fullscreen

`useFullscreen` requests fullscreen for the gameplay container with browser
navigation hidden, tracks `fullscreenchange`, updates the entry/exit button, guards
concurrent requests and reports unavailable/rejected requests. Escape and leaving
the session release fullscreen. The same renderer survives entry and exit.

The initial automated test reported `document.fullscreenElement` but did not expand
the window. This reproduces a [Playwright fullscreen issue](https://github.com/microsoft/playwright/issues/19720).
The installed Playwright implementation enables focus emulation on its own CDP
session; disabling it on a separate CDP session did not remove that override.
A fresh regular Edge process, attached with `connectOverCDP({ noDefaults: true })`,
verified the actual window transition:

| State | Content viewport (CSS px) | Native window state | Fullscreen element |
| --- | --- | --- | --- |
| Before | 1258×709 | Normal, 1280×800 | None |
| Enter | 1707×1067 | Fullscreen, 1707×1067 | Gameplay `main` |
| Escape | 1258×709 | Normal, 1280×800 | None |
| Exit session from fullscreen | 1258×709 | Normal, 1280×800 | None |

The scene instance ID stays identical throughout. No browser profile, GPU preference
or system policy was changed. Embedded browser hosts or focus-emulating automation
can still constrain native fullscreen; application CSS cannot override that host
behavior. The API contract follows [MDN's fullscreen documentation](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen).

## Verification

Browser plugin was unavailable; the already installed Playwright/Edge runtime was
used against the production preview at `http://127.0.0.1:5173/`. No dependencies were
added. Practice and bundled-drill entry use the same gameplay shell.

| Check | Result |
| --- | --- |
| Correct URL/title, meaningful gameplay, no framework/renderer error overlay | Pass |
| Relevant console/page errors | None |
| Desktop default hidden, both hover areas, pin/H, keyboard focus | Pass |
| Sound accessible with chrome hidden; settings open/close | Pass |
| Touch reveal, no accidental activation, court tap dismiss | Pass |
| 1660×928, 1024×768, 390×844, 320×720 layout bounds | Pass |
| Metadata and transport overlap at narrower widths | None |
| Native fullscreen entry, Escape, exit-session cleanup, fresh-session auto-hide | Pass |
| Fullscreen request rejection shown and dismissed | Pass, controlled rejected-promise fixture |
| Renderer reused through fullscreen and session exit | Pass |
| `npm test` | 355 tests / 37 files passed |
| `npm run build` including active motion/cache guard | Pass; existing large-chunk advisory remains |

Screenshots were inspected after both the assets and loading overlay were ready.
Reference changes are intentional: the separate left/right HUDs are merged, the
transport is smaller, and paused status moves into metadata. Gameplay visuals are
preserved.

Local artifacts are outside the repository under
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/gameplay-hud/`:
`check.mjs`, `checks.json`, `desktop-hidden.png`, `desktop-revealed.png`,
`mobile-hidden.png`, `mobile-revealed.png`, `native-fullscreen.mjs`,
`native-fullscreen.json`, and `native-fullscreen.png`.

This is local implementation and browser verification, not public deployment or
owner acceptance. Other browser engines and physical mobile devices were not tested.
