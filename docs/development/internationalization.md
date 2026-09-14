# English and Chinese localization

## Implementation plan

1. Add an English / Simplified Chinese locale service with browser-language
   detection, an explicit persisted choice, document language and an accessible
   language control. Language changes must preserve current forms and playback.
2. Extract fixed interface messages, labels, accessible names, help, status and
   validation text into translation resources. Keep identifiers and physics data
   independent from display text. Interpolated names remain authored content.
3. Translate built-in project drills, shot presets, positions and perspectives
   at the presentation boundary. Browser overrides take precedence and are never
   translated. Editing/copying a default creates a draft in the displayed language;
   thereafter its authored text stays unchanged on interface-language changes.
4. Verify language selection, message coverage, catalog provenance, persistence,
   Chinese layout, editor controls, saves and live playback. Commit focused stages.

## Boundaries

Chinese browser locales (including regional Chinese tags) select Simplified
Chinese; English and unsupported primary browser languages select English.
Users may override this at any time. Browser language is used only when no valid
saved choice exists. Unavailable browser storage must not prevent switching.

The language preference is local UI state, separate from project/config save
destinations. Built-in translations are bundled, work offline and do not call a
translation service. No translated display name becomes a physics enum or ID.
User names, descriptions, cues and imported text have one authored version.

Original project catalog edits present before this task remain owner-owned and
must not be rewritten or committed as part of localization.

## Implementation

- `src/i18n/locale.ts`: locale detection, `tenmulate.language` preference,
  reactive subscription, document language, interpolation and diagnostic adapter.
- `src/i18n/zh-CN.json`: fixed UI; English keys are the English fallback.
- `src/i18n/diagnostics.zh-CN.json`: fixed worker/server validation and status
  templates. Unknown external error details remain verbatim.
- `src/i18n/content.zh-CN.json` and `content.ts`: default names/descriptions/cues,
  projected only for default IDs without browser overrides. Known Chinese default
  text can be displayed in English during playback without changing the session.
- `LanguageControl`: header and playback Settings. Switching rerenders text, with
  no route key, clock reset or camera reset. Editor section persistence uses stable
  keys independent of translated headings.

Use `t('Fixed text')` or `t('Saved {0}', { 0: authoredName })` for new UI. Add the
matching Chinese key, keeping interpolation slots identical. Translate complete
messages where grammar differs. Never pass authored fields through `t` or the
worker diagnostic adapter. New/renamed shipped content requires a content-catalog
entry; do not automatically translate browser saves or imported records. Technical
IDs, application/asset brands and third-party error detail may remain unchanged.

## Verification — 2026-09-14

- Localization suite: **12 passing tests** for browser tags and preference
  precedence, blocked storage, opaque interpolation, diagnostics, translation
  slots, shipped/default coverage, browser provenance, immutable source content,
  equal English/Chinese physics and fixed JSX/key coverage.
- Full suite: **643 passed / 16 failed, 64 files**. All 16 failures concern existing
  storage and default-catalog expectations. A separate archive of pre-change HEAD,
  supplied with the same three owner-edited project JSON catalogs, reproduces the
  identical 16 failures (32 tests in the two affected suites). Localization does
  not modify those catalogs, storage normalization or their tests.
- Production build passes, including active motion/asset/precache verification.
- Isolated Edge browser: Chinese desktop/mobile layout, English editor, live
  locale switch preserving a typed mixed-language draft; a user-created preset
  named `Baseline` stays exact after Chinese switch/reload while the default is
  `底线`; Chinese development save modal and browser-only save verified.
- Browser default `zh-TW` selects Simplified Chinese; an explicit English choice
  overrides it after reload. Paused drill playback retains the same session time
  and camera pose across switching; default title and shot metadata switch.
- Screenshots retained locally under ignored `output/playwright/i18n-*.png`.

Local implementation and browser verification only; no public deployment or owner
acceptance is implied. Architectural contract: [ADR-0056](../decisions/0056-bilingual-ui-and-authored-content.md).
