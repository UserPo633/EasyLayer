# EasyLayer judging and testing

## Fast path

From the repository root, run:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory web/dist
```

Open http://127.0.0.1:8000/ in a modern browser. No login or credentials are required. Open `/watch.html` to play the included English narrated demo.

## Guided checks

| Check | Steps | Expected result |
| --- | --- | --- |
| Draft lifecycle | Select a time, create a draft, pause, resume | The selected sample appointment is retained |
| Approval | Create a draft; inspect the review and approval control | Submission requires approval of the displayed appointment |
| Lost response | Select the lost-response scenario and submit an approved draft | An unknown outcome is shown; the sample record exists |
| Duplicate prevention | Try repeat submission after the unknown outcome | No second sample record is created |
| Verification | Select Check existing record | The original sample record becomes verified only if its ID and every approved field match |
| Unavailable time | Select Time becomes unavailable and submit an approved draft; cycle through choices again | No booking write for the unavailable slot; that slot stays excluded until Reset demo |
| Record mismatch | Select Record details do not match; approve and submit; inspect verification details | The different service is identified. The outcome stays unknown and a repeat attempt creates no second record |
| Older tab | Open two tabs at the same origin; change the draft in one and return to the other | The older tab blocks changes until Load saved progress is selected; existing stored records are preserved |
| Accessible review | Read the HTML appointment summary and use Tab/Space through approval and actions | Full date, provider, timezone, currency, and contact are available outside the SVG; focus is restored after control replacement (manual browser validation remains open) |
| Storage feedback | Create or pause a draft; read the notice below the controls | Saved notice after successful read-back; warning if storage fails |
| Start over | Select Reset demo ↺ | Sample progress is reset |

All displayed people, classes, prices, and appointments are fictional. This deterministic demo has no network booking service. Browser local storage holds only sample state. This walkthrough does not establish live backend behavior.

## Source inspection

The web state machine is `web/dist/engine.mjs`; the interface is `web/dist/app.mjs`. Run `npm test` and `npm run build` from `web/`.

The separate `backend/` implementation uses a real self-hosted MCP transport, SQLite draft state, a private review step, and an Easy!Appointments source adapter. Its own simulator is separate from the latest browser-only film/demo. Follow `backend/README.md` for setup, tests, and optional live-source gates. Do not expose this single-user loopback prototype to the public internet.

## Evidence boundaries

- The v0.4 `backend/evidence/release-checks.json` records 117 controlled tests from September 29, 2026. Historical reports are preserved, not relabeled as new test runs.
- A later backend duration-verification update passed 44 targeted Python tests (14 core, 12 lifecycle, 18 HTTP contract). Its MCP-chain test was not rerun because dependencies were absent. See `DEVELOPMENT_UPDATE_2026-10-21.md` for the reproducible command and boundaries.
- Those backend tests use synthetic sources and source-shaped HTTP fixtures. They do not prove real Easy!Appointments PHP/MariaDB end-to-end success.
- The latest web demo has 59 Node tests for state, verification, restoration, storage, stale-tab protection, and summary/evidence rendering, plus a static asset check. These are not real-browser tests.
- The 134-second English film includes generated narration, burned captions, a WebVTT track, and a transcript. It is an automated illustrated walkthrough, not native Alexa footage. This earlier film has not been re-recorded for the October 21 verification/storage update.
- No production Alexa integration, real bookings, live Bedrock calls, or user-study results are claimed.

## Repository license and dependencies

The full GPL version 3 text is at the root `LICENSE`, and the code is designated GPL-3.0-only. Original Easy!Appointments and dependency notices remain in the backend. Pinned backend dependencies and lockfiles are included. The static judging path needs only Python and a browser.

Storage failure tests inject blocked access, quota errors, and failed read-back at the storage boundary. These do not establish behavior in a real browser with storage disabled. The required managed browser tool is unavailable in this workspace, so this update has no new real-browser QA or screen recording.

The multi-tab guard detects observed storage changes before saving; localStorage does not provide an atomic compare-and-set. Use the supplied sample data only. The new mismatch and accessible-review features are absent from the earlier film.
