# EasyLayer · v0.4

**A readable booking flow that remembers progress and checks the original result.** EasyLayer is an Alexa+ interaction simulation backed by a real self-hosted MCP server. The web simulator, review page and MCP tools now share the same persistent booking draft.

The [hackathon FAQ](https://amazonappdev2026.devpost.com/details/faqs) explicitly says participants cannot obtain the gated Alexa+ Toolkit, CLI or Web Simulator. It recommends a self-hosted MCP server with your own front end. A locally runnable repository and demo video are sufficient; hosting is not required. This corrects the v0.3 roadmap, which put Alexa developer access first. **There is no native Alexa connection in this release.**

The interface is guided, with a few optional typed/spoken commands. It does not call a generative model. The older optional Bedrock prototype remains separate. Intended users are adults who can describe a class they want but need help with small controls or multi-step forms; that is a product hypothesis awaiting user observation.

## Run the shared simulator

Python 3.12, Node 20+ (tests/build only), and Docker Desktop with Compose for the original source:

```sh
python -m venv .venv
```

Activate: `source .venv/bin/activate` on macOS/Linux, or `.venv\Scripts\Activate.ps1` on Windows. Then:

```sh
python -m pip install -r bridge/requirements.txt
python scripts/start_demo.py
python scripts/start_bridge.py
```

Open **http://127.0.0.1:8092/simulator/**. Use this exact origin; `localhost` and `127.0.0.1` are not interchangeable for session/review checks. The source setup command starts and seeds Docker, then exits; the bridge stays running. No Alexa account, AWS account or model key is needed for this guided flow.

| Address/file | Purpose |
|---|---|
| `/simulator/` | Shared booking screen with optional limited voice controls |
| `/mcp` | MCP 2025-11-25 Streamable HTTP endpoint |
| `/review/{draft_id}` | Private contact-entry and explicit approval form |
| `/healthz` | Configuration only; not proof of live source or Alexa |
| `http://localhost:8080/index.php/booking` | Owned Easy!Appointments test instance |
| `.local/mcp-token` | Private local MCP credential; never share |
| `.local/bridge.sqlite3` | Persistent state; preserve across restarts |

The simulator is deliberately **single-user and loopback-only**. Its server-side client negotiates MCP and calls `/mcp` through actual HTTP. The browser receives a session/CSRF token, not the MCP bearer. Only eight booking tools are exposed. OAuth deployment mode disables simulator routes. No source fixtures are substituted on the shipped screen when the source is unavailable.

## What changed from v0.3

- One route from source lookup through MCP draft, separate review, completion and verification.
- `resume_booking` restores the owner's persisted work. Unresolved writes take priority. An unapproved draft receives a rotated review link; old links become invalid without extending expiry.
- `cancel_booking_draft` discards an unsubmitted draft. It never cancels an actual appointment.
- Same-owner, same-service/provider/date/time drafts cannot bypass an existing pending, unknown or verified write in the same retained database.
- Contacts are logically cleared on submission claim and terminal states. Expired approvals are cleared on startup or the next draft operation.
- Real HTTP source-adapter contract tests now exercise cookies, HTML CSRF, form encoding, registration and receipt read-back. A separate operator-run gate targets the bundled original source.

## Booking contract

| Tool | Role |
|---|---|
| `list_services` | Source catalog, prices and eligible providers |
| `find_available_times` | Source availability in provider timezone |
| `create_booking_draft` | Persist an unsubmitted draft and private review link |
| `get_booking_status` | Read the authenticated owner's draft |
| `resume_booking` | Restore persisted work; rotate draft-only review capability |
| `cancel_booking_draft` | Discard draft/approved state without a source booking write |
| `complete_booking` | Recheck approved facts, claim once, register, read back |
| `verify_booking` | Read an existing result without registration |

A tool cannot approve a draft. Approval uses a separate capability URL, current revision, validated contact fields, explicit checkbox and exact Origin. This is a UI approval boundary, not cryptographic human attestation. A client with unrestricted HTTP and the private capability could operate that page; do not give the model that permission.

Only `state=verified` **and** `verified=true` are displayed as success. Changed price/conditions or a lost time require a fresh draft and review. A lost POST response can leave `unknown` without a recoverable source identifier: the application does not automatically retry or promise recovery. Check the original service. Resume intentionally keeps unresolved writes visible.

Duplicate suppression is bounded to one retained SQLite database, owner and exact target. It is not universal exactly-once delivery, cross-user deduplication, or synchronization of appointments later cancelled directly at the source. The database and source management identifiers are private. Use synthetic contacts in a dedicated test instance.

## Verification and the next source gate

```sh
npm ci --ignore-scripts
npm --prefix bridge/app ci --ignore-scripts
python -m pip install -r planner/requirements.txt
python scripts/verify_local.py
```

The generated `evidence/release-checks.json` records real commands and test counts. Local HTTP tests use synthetic sources, including an HTTP fixture shaped from the bundled PHP controller. DOM tests use jsdom. These do not establish real PHP/MariaDB booking, browser rendering, voice quality, Alexa compatibility or user benefit.

On the Docker-capable machine with the owned source running:

```sh
python scripts/probe_mcp.py --source
python scripts/verify_source_live.py
python scripts/verify_source_live.py --book-fixture
```

The first two are read-only. The last explicitly creates **one synthetic reservation** in the owned loopback test service and verifies its original record. It preserves a separate probe database and blocks a new run if a previous probe is unresolved. It uses programmatic test approval, so then also walk the actual simulator's review form in a browser before filming. These live-source/browser gates have not been executed in this environment; Docker, PHP and MariaDB are absent.

Record the native-source evidence, then follow `docs/DEMO_v0.4.md` for a 2:45 English recording. The supplied script is a rehearsal plan, not a completed video. Use `docs/EXPERT_05_COMPETITION.md` for the problem hypothesis, judging strategy and a small usability observation plan.

## MCP Apps and future Alexa connection

The bundled `ui://easylayer/booking.html` resource uses the official MCP Apps SDK. A compatible host may load it through `resources/read`; it has no direct network or microphone domains. It is separate from the new web simulator host. Actual Alexa rendering remains unverified.

```sh
npm --prefix bridge/app run build
```

The future OAuth scaffold validates RS256 JWT issuer/audience and separates service/user scopes. It does not implement an authorization server or account linking. The incomplete `alexa/addon.template.json` is not deployable as supplied. Native Alexa/OAuth integration is future partner-access work, **not the hackathon's next prerequisite**. See `docs/ALEXA_INTEGRATION.md`.

## Scope and files

The adapter supports the bundled Easy!Appointments 1.6.0 contract only. Unsupported consent, CAPTCHA, authentication walls and fields require source handoff. Cancellation terms are not extracted. Cleanup is logical deletion on activity, not a wall-clock purge or physical erasure. This is not production multi-user infrastructure.

- `bridge/simulator/`, `bridge/simulator_host.py`: shared guided screen and actual MCP client
- `bridge/core.py`, `source.py`, `server.py`: persisted state, native HTTP adapter, MCP/auth/review
- `bridge/app/`: MCP Apps resource, source and built bundle
- `tests/test_*`, `bridge/test_*`: lifecycle, transport and source contract checks
- `docs/HANDOFF_v0.4.md`: Korean five-expert decisions, completed work and next steps
- `docs/EXPERT_01_…` through `EXPERT_05_…`: individual expert and peer reviews
- `ui/`, `planner/`: preserved v0.2 prototypes; they do not share this MCP state
- `docs/history/`: historical roadmaps; current README and handoff take precedence

Original [Easy!Appointments 1.6.0](https://github.com/alextselegidis/easyappointments/releases/tag/1.6.0) remains unchanged as `upstream.zip`; SHA256 `299f8da75583ea185992ece4ac0b10e98f673825edbf75116446d99001911e60`. Integration code is GPLv3; see `LICENSE`. Upstream and bundled dependency licenses remain applicable.
