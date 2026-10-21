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
| Draft lifecycle | Select a time, save a draft, pause, resume | The selected sample appointment is retained |
| Approval | Save a draft; inspect the review and approval control | Submission requires approval of the displayed appointment |
| Lost response | Select the lost-response scenario and submit an approved draft | An unknown outcome is shown; the sample record exists |
| Duplicate prevention | Try repeat submission after the unknown outcome | No second sample record is created |
| Verification | Select Check existing record | The original sample record becomes verified |
| Unavailable time | Select Time becomes unavailable and submit an approved draft | No booking write; the user must choose and review again |
| Start over | Select Reset demo ↺ | Sample progress is reset |

All displayed people, classes, prices, and appointments are fictional. This deterministic demo has no network booking service. Browser local storage holds only sample state. This walkthrough does not establish live backend behavior.

## Source inspection

The web state machine is `web/dist/engine.mjs`; the interface is `web/dist/app.mjs`. Run `npm test` and `npm run build` from `web/`.

The separate `backend/` implementation uses a real self-hosted MCP transport, SQLite draft state, a private review step, and an Easy!Appointments source adapter. Its own simulator is separate from the latest browser-only film/demo. Follow `backend/README.md` for setup, tests, and optional live-source gates. Do not expose this single-user loopback prototype to the public internet.

## Evidence boundaries

- The v0.4 `backend/evidence/release-checks.json` records 117 controlled tests from September 29, 2026. Historical reports are preserved, not relabeled as new test runs.
- Those backend tests use synthetic sources and source-shaped HTTP fixtures. They do not prove real Easy!Appointments PHP/MariaDB end-to-end success.
- The latest web demo has its own eight state-machine tests and a static asset check.
- The 134-second English film includes generated narration, burned captions, a WebVTT track, and a transcript. It is an automated illustrated walkthrough, not native Alexa footage.
- No production Alexa integration, real bookings, live Bedrock calls, or user-study results are claimed.

## Repository license and dependencies

The full GPL version 3 text is at the root `LICENSE`, and the code is designated GPL-3.0-only. Original Easy!Appointments and dependency notices remain in the backend. Pinned backend dependencies and lockfiles are included. The static judging path needs only Python and a browser.
