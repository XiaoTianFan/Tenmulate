# ADR-0056: Bilingual interface with authored-content boundaries

- Status: Accepted
- Date: 2026-09-14
- Scope: English / Simplified Chinese UI and shipped default catalogs

## Decision

Use a bundled English-source-key translation catalog for interface messages and
an independent content catalog for shipped drills, shots, positions and
perspectives. Select Simplified Chinese for a Chinese primary browser language,
English otherwise. A valid explicit browser-local language choice takes priority.
Expose language selection in the application header and playback Settings.

Catalog provenance determines whether content can be translated. Apply default
translations before editing, only to project/bundled IDs without browser overrides.
Browser-authored and imported names, descriptions and cues stay exactly authored,
even when they match a built-in English name. Copying/editing a default establishes
the draft's authored language; changing the interface does not rewrite the draft.
No migration of existing browser data is needed.

Language is presentation state. It does not change physics enums, IDs, camera
configuration, session clocks or persisted content. Playback of defaults can
translate labels in place without recompilation; playback of authored drafts and
browser drills keeps their text. All resources ship offline without external
translation calls. Project saves still use the existing destination coordinator;
the interface language preference is saved independently in browser storage.

## Maintenance and consequences

New fixed UI must use the shared message helper. New or renamed project defaults
need corresponding bundled content translations; unknown content is retained
verbatim, never guessed or sent to a service. Worker/server diagnostics are
translated at the UI boundary, retaining unknown technical detail and interpolated
user names. See [implementation and verification](../development/internationalization.md).
