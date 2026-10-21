# EasyLayer · v0.3

EasyLayer makes a supported booking service callable by a conversational assistant. **The main product is now a persistent MCP booking server.** An MCP Apps view shows the booking summary and status; a companion page collects contact details and approval. The original website prototype remains available for interaction research.

Target experience: a person asks Alexa for a class, hears a few available options, reviews the same date/time/price on screen, and receives a confirmation only after the original booking record is read back.

**Status:** MCP 2025-11-25 over real loopback Streamable HTTP has been tested using the official Python SDK. These transport tests use a synthetic booking source. Actual Alexa account linking, Alexa rendering, source-container booking, live Bedrock and real-browser visual/speech checks are not yet verified. See `evidence/release-checks.json` for the recorded run, and `docs/ALEXA_INTEGRATION.md` for the connection plan.

## What to run

Use Python 3.12 and Node 20+. Docker Desktop/Compose is needed for the bundled booking source.

```sh
python -m venv .venv
```

Activate the environment: `source .venv/bin/activate` on macOS/Linux, or `.venv\Scripts\Activate.ps1` in Windows PowerShell. Then:

```sh
python -m pip install -r bridge/requirements.txt
python scripts/start_demo.py
python scripts/start_bridge.py
```

`start_demo.py` starts and seeds the original Easy!Appointments source in Docker, then exits. `start_bridge.py` keeps the MCP bridge running. Defaults:

| Endpoint/file | Purpose |
|---|---|
| `http://127.0.0.1:8092/mcp` | MCP Streamable HTTP endpoint |
| `http://127.0.0.1:8092/healthz` | Configuration status; not proof that the booking source or Alexa works |
| `http://localhost:8080/index.php/booking` | Owned Easy!Appointments test service |
| `.local/mcp-token` | Generated private credential for local development only |
| `.local/bridge.sqlite3` | Persistent drafts and submission state |

In another terminal, from the project root:

```sh
python scripts/probe_mcp.py
python scripts/probe_mcp.py --source
```

The probe is read-only. It checks the protocol handshake, six tools, the MCP Apps resource and, with `--source`, the actual source catalog. No reservation is made. Configure a compatible local MCP client with the endpoint and `Authorization: Bearer <contents of .local/mcp-token>` in its private credential settings. Never paste the token into a shared config, Git, chat or a video.

The local-token mode cannot bind to a public address. It is not OAuth and cannot be used as a deployed Alexa login flow.

## Tools and execution

| Tool | Role |
|---|---|
| `list_services` | Read current classes, prices and eligible teachers |
| `find_available_times` | Read times in the provider's timezone |
| `create_booking_draft` | Create a draft and return the private review link; no booking |
| `get_booking_status` | Read the authenticated person's draft |
| `complete_booking` | Submit an approved draft once, then verify the original record |
| `verify_booking` | Re-read an existing record; never resubmit |

The review page and MCP tools use the same SQLite state. A tool argument cannot mark a draft approved. The separate review page requires the draft capability, current revision, contact validation, checkbox and matching page Origin. This is a prototype approval boundary, not cryptographic proof of a human click: a client with unrestricted HTTP access and the review capability could submit the form. Keep that capability private and do not give a model permission to operate this review page.

Before submission, the bridge refreshes price, provider, time, timezone and required fields. Changed details require a new draft and new review. The server claims the draft as `pending` before sending a request. Concurrent or repeated calls for that same draft cannot blindly send another registration. An uncertain post remains `unknown`; verification may resolve it when a source record is known.

This guarantee applies **per draft** while the database is retained. Separate drafts, a lost database, multiple independent databases, and the source's own concurrency behavior are outside that guarantee. Use one server process and persistent local storage for this prototype.

## The screen is an MCP Apps resource

`bridge/app/dist/booking.html` is bundled with the release. Tools point to `ui://easylayer/booking.html` through `_meta.ui.resourceUri`. A compatible host loads it via `resources/read` and supplies the tool result. The view uses the official MCP Apps SDK for status refresh, opening the private review page and completing an already-approved draft.

Opening this HTML by itself does not connect to Alexa. Alexa-specific rendering has not been tested. Contact entry and approval still use the companion page; fully voice-only approval and approval inside Alexa are future integration work.

Rebuild after editing the view:

```sh
npm --prefix bridge/app ci --ignore-scripts
npm --prefix bridge/app run build
```

The view requests no direct network domains, microphone or camera permissions. It communicates through the host. Third-party notices accompany the bundle.

## Alexa connection

Amazon documents an Alexa+ MCP Add-on that connects a remote MCP endpoint to Alexa. MCP Apps can supply the visual surface. Use the [official MCP Toolkit guide](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html), then follow `docs/ALEXA_INTEGRATION.md`.

The production-mode scaffold validates RS256 OAuth access tokens against a configured issuer, JWKS and MCP resource audience. It separates service discovery/catalog scope from user booking scopes. It does **not** implement an authorization server, issue credentials, or complete account linking. Configure an external OAuth server supporting the required grants and PKCE; OIDC sign-in is not assumed to be an Alexa-supported flow.

`alexa/addon.template.json` is an explicitly incomplete manifest template with invalid placeholder URLs. No add-on was registered, deployed, certified or submitted.

## Tests and evidence

```sh
npm ci --ignore-scripts
npm test
python -m unittest discover -s bridge -p 'test_*.py' -v
python -m unittest discover -s planner -p 'test_*.py'
python scripts/verify_local.py
```

The bridge tests cover authenticated HTTP, protocol negotiation, tool and resource discovery, draft ownership, review checks, concurrent execution, response loss, restart persistence, changing conditions and receipt verification. JWT tests use locally generated test keys, not a live authorization server. DOM tests use jsdom with a mock MCP host; they do not establish real browser, accessibility or Alexa behavior.

`evidence/release-checks.json` distinguishes executed tests from pending integration gates. The GitHub Actions workflow is supplied but has not been pushed or run. Run the actual source and browser checks from `docs/history/README_v0.2.md` on your Docker-capable machine before recording a real booking demo.

## Existing v0.2 prototype

`ui/connected.html` and the two standalone previews remain independent interaction prototypes. **They do not share draft state with the new MCP bridge.** Do not claim that switching from the old page to Alexa resumes one booking. The MCP Apps view and the new companion review page do share bridge state.

The optional Bedrock planner belongs to that v0.2 path. It is not automatically invoked by the MCP server; Alexa provides its own conversational orchestration. See `docs/history/README_v0.2.md` for the original UI, Docker source and Bedrock instructions.

## Boundaries and operation

Only the bundled Easy!Appointments 1.6.0 native HTTP contract is supported. Arbitrary websites, SPAs, CAPTCHA, authentication walls and unsupported required fields/consents are not automated. Cancellation terms are not extracted. A source handoff is required where these block the adapter.

Use fictional contacts in a dedicated test instance. Approval temporarily stores contacts in SQLite; terminal verified/unknown/conflict/changed states clear them. Expired drafts and crash-pending records are not automatically purged. Disk encryption, retention, deletion, backup policy and production user consent must be implemented before accepting real customer information. Source management hashes remain private in the database and are excluded from MCP results.

The current native source calls can exceed Amazon's documented query-latency target; no production latency claim is made. Keep latency measurement and possible caching/job processing on the integration backlog. Never cache the final preflight availability check.

## Files

- `bridge/`: persistent engine, native adapter, MCP/auth server and tests
- `bridge/app/`: MCP Apps UI source, locked build dependencies and bundle
- `scripts/start_bridge.py`, `scripts/probe_mcp.py`: local startup and read-only protocol probe
- `docs/ALEXA_INTEGRATION.md`: official contracts, configuration, remaining gates
- `docs/HANDOFF_v0.3.md`: Korean project handoff
- `docs/DEMO_v0.3.md`: English demo plan and honest submission wording
- `alexa/`: incomplete add-on manifest and listing drafts
- `ui/`, `planner/`: retained v0.2 browser prototype and optional Bedrock planner

Original [Easy!Appointments 1.6.0](https://github.com/alextselegidis/easyappointments/releases/tag/1.6.0) is retained unchanged as `upstream.zip`; SHA256 `299f8da75583ea185992ece4ac0b10e98f673825edbf75116446d99001911e60`.
Integration code is GPLv3; see `LICENSE`. Upstream and bundled dependency licenses remain applicable.
