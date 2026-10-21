# Verification and storage correction — October 21, 2026

## Reproduced before the change

- Lost-response recovery accepted a different service when time/contact matched.
- The normal submission path marked an unrelated pre-existing sample record verified.
- Storage exceptions were silently ignored while draft/pause messages claimed saving.

These were simulator findings, not evidence of a real booking incident.

## Changes

- Capture the complete sample appointment when the user approves.
- Use one matching routine for normal submission, lost-response verification, and restoration of verified state.
- Require a single record with the expected ID and matching service/provider IDs and names, date, time, time zone, duration, price, currency, and contact.
- Preserve mismatched/ambiguous records as unknown; do not create a replacement record.
- Keep older records without sufficient approval details unverified. Old unfinished drafts retain their selected time but require fresh approval.
- Show a saved notice only after a successful write and read-back. Warn that refresh/close can lose changes or restore an older draft if saving fails.
- Use neutral draft/pause wording and expose storage notices to assistive technology.

## Validation

`cd web && npm test` runs 35 Node tests. `npm run build` checks required shipped assets. `node --check dist/app.mjs` checks the UI module syntax.

The field-mismatch cases cover both confirmation routes, changed and missing fields, preservation of existing records, and no extra writes. Storage checks inject blocked access, quota errors, silent write failure, read-back failure, malformed saved data, and recovery.

The original 117 backend tests are historical evidence and were not rerun or relabeled in this update. This update has no new real-browser validation, screen recording, live booking, or Alexa integration evidence. The required managed browser-control skill is unavailable in this workspace.

## Film and submission boundaries

The earlier 134-second narrated film remains included unchanged. Its successful-storage scenario and lost-response story remain representative, but it does not demonstrate these new defensive checks. The current video page and README disclose that difference. Review wording is in `docs/DEVPOST_TEXT_REVIEW.md`; the actual saved Devpost form still requires authenticated comparison.
