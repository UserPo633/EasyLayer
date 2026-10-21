# EasyLayer · v0.2

A simulated Alexa+ conversational display for a self-hosted Easy!Appointments booking workflow. Speak or type a request, review persistent choices, change a date, and confirm before the app submits. Success requires a read-back of the original booking record.

**Current status:** source/Bedrock integration code and local tests are updated. Live Docker booking, live Bedrock, real-browser visual/speech/accessibility checks are still pending. See `evidence/release-checks.json` and `docs/UPDATE_2026-09-21.md`.

## Try the interaction design immediately

Open **`EasyLayer_Conversation_Preview.html`** in a normal desktop browser. It is a self-contained, explicitly labelled interaction simulation. It makes **no real reservation and no AI call**. Use fictional contact details. The example commands are handled by local rules.

Example: choose Photography Introduction → enter a future date in the request box → “second” → enter fictional details → click “Simulate 10:00 taken” → review/confirm → select another time → review/confirm again.

The simulated pending-state guard also survives reload in the same tab where sessionStorage is available. Start another fresh tab if you want a new independent simulation. Actual microphone support depends on your browser and secure-context rules. A local HTTP server can serve the preview if opening a local file is restricted on your own computer.

## Run the actual connected workflow

Requirements: Docker Desktop/Compose, Python 3.10+; Node 20+ for tests. Use a dedicated local test instance.

```sh
python scripts/start_demo.py
```

Then open:

`http://localhost:8080/easylayer-demo/connected.html`

The startup script checks Docker, creates unprinted random local credentials, starts MariaDB/PHP, uses the upstream installer and seeds six classes. Choose **Basic commands · no AI** or use buttons until AWS is configured. Reservations in connected mode are real records in your self-hosted test source.

Admin credentials are generated in `.local-admin.json`; database credentials are in `.env`. Neither file belongs in Git or a shared ZIP. The source admin UI is under `http://localhost:8080/index.php/login`.

`docker compose down` stops the stack while preserving volumes.

## Verify actual source and browser operation

```sh
python scripts/check_source.py
npm ci
npx playwright install chromium
npm run test:live
```

- The native probe books a synthetic appointment, rereads its original record, checks a same-slot rejection and reads the database.
- The live browser script uses the actual connected page, a second independent source session to take the selected slot, alternative selection with fresh approval, original-record verification, reload recovery and a mobile overflow check. It deliberately does **not** call AWS.
- `.github/workflows/verify.yml` automates these steps on a Docker-capable runner and retains only selected synthetic verification outputs. The workflow is supplied, **not uploaded or executed**.

## Enable Bedrock

Set `AWS_REGION`, `BEDROCK_MODEL_ID` and valid temporary AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and, when issued, `AWS_SESSION_TOKEN`) in your local shell. Do not put values in browser code, chat, Git or the demo video. The configured model must support Converse in your account/region.

```sh
python scripts/start_demo.py --ai
```

Select **Amazon Bedrock** on the connected page. The private planner is reached through the same-origin `ui/intent.php` proxy. It proposes reversible changes, never a reservation submission. It receives the source catalog, public provider labels, task state and the current request. Contact form values are excluded. Private information typed into the request box itself is part of that request, so the UI tells users to enter contacts only in the form.

Optional real benchmark (three synthetic prompts; incurs AWS usage):

```sh
python -m pip install -r planner/requirements.txt
python scripts/benchmark_bedrock.py --run
```

The benchmark writes actual returned latency and token usage to `evidence/bedrock-live.json`. It does not estimate cost or imply live usage when unexecuted. Host-side AWS profiles/IAM may be used by boto3; the Compose configuration currently forwards environment credentials only.

## Test without source infrastructure or AWS

```sh
npm ci
npm test
python -m unittest discover -s planner -p 'test_*.py'
```

`npm test` includes state/adapter tests and jsdom event-flow tests. **jsdom is not a real browser:** it does not establish visual layout, actual microphone/TTS behavior, keyboard/screen-reader usability or live source operation. Model tests use a fake client strictly inside tests.

## Important changes in this version

- Fixed source CSRF token acquisition for upstream HttpOnly cookie settings by using `vars.csrf_token`, just as upstream does. No security settings weakened.
- Shared `BookingSession` for touch, text and transcribed voice; typed planner schema for date/period/ordinal edits and clarification.
- Optional browser speech output and replay; explicit rules-only basic commands for offline/manual operation.
- Full contact review before submission. Each edit invalidates the previous confirmation.
- Price/provider/timezone/required-field revalidation and freshly fetched alternative slots before POST.
- A sessionStorage pending marker written before POST prevents blind resubmission after reload in the same tab. No contact fields are persisted. Known results can be rechecked; lost responses without a result hash require original-site review.
- Required custom fields that the adapter cannot handle cause an upstream handoff.

## Boundaries

This supports Easy!Appointments 1.6.0, not arbitrary sites or SPAs. It is not an actual Alexa runtime integration and not fully hands-free: speech is transcribed for review, contact details are entered on screen, and the final confirmation checkbox is required. Accessibility effectiveness and elderly-user outcomes have not been measured.

Preflight slot checks cannot eliminate the race between availability lookup and POST. If registration fails ambiguously, the app stays unknown and does not retry. The pending marker is tab-local: closing a tab, clearing storage or starting another tab is outside its guarantee. There is no durable server-side submission ledger or universal duplicate prevention.

CAPTCHA, additional original consent, authentication and unsupported required fields remain source handoffs. Cancellation terms are not extracted. Images remain version-tagged rather than digest-pinned; the successful CI run can record the DB digest.

## Repository map

- `ui/connected.html`, `connected.css`, `connected.js`: connected interface
- `ui/booking-session.js`: shared state and deterministic execution
- `ui/basic-commands.js`: deliberately limited, non-AI parser
- `ui/source.js`: upstream adapter
- `planner/`: Bedrock endpoint and tests
- `scripts/`: source setup, probes, preview generation
- `tests/`: state/DOM tests, explicit browser fixture, unexecuted live E2E script
- `docs/UPDATE_2026-09-21.md`: Korean change report and remaining gates
- `docs/DEMO_AND_SUBMISSION.md`: 170-second script and user-observation plan
- `evidence/history/`: prior release evidence retained as history

Regenerate the two separate previews from source:

```sh
python scripts/build_preview.py
python scripts/build_conversation_preview.py
```

`EasyLayer_Consumer_Preview.html` is the original v0.1 simulation; `EasyLayer_Conversation_Preview.html` is the new conversation UI. Neither replaces the actual connected page.

## Upstream and license

Original [Easy!Appointments 1.6.0](https://github.com/alextselegidis/easyappointments/releases/tag/1.6.0) is bundled unchanged as `upstream.zip`.

SHA256: `299f8da75583ea185992ece4ac0b10e98f673825edbf75116446d99001911e60`

Integration code is GPLv3; see `LICENSE`. Upstream/vendor licenses remain in the archive. No public repository, deployment, contest registration, submission or video publication was performed in this update.

References: [Official contest](https://amazonappdev2026.devpost.com/), [Rules](https://amazonappdev2026.devpost.com/rules), [Boto3 Converse](https://docs.aws.amazon.com/boto3/latest/reference/services/bedrock-runtime/client/converse.html), [Playwright request context](https://playwright.dev/docs/api/class-apirequestcontext), [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/).
