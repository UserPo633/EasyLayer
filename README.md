# EasyLayer

**Clear choices. Recoverable progress. An honest result.**

EasyLayer is a guided appointment-booking experience developed for the **Build · Ship · Shape Amazon Developer Hackathon, Alexa+ simulation track**. It explores saving a draft, resuming interrupted work, reviewing an exact appointment, and checking a result before repeating a booking attempt.

This repository includes the latest browser demo, its English narrated film, and the separate v0.4 Python/MCP backend source. **There is no native Alexa connection in this submission.** The browser demo uses fictional sample data and makes no real bookings.

## Run the demo in one minute

Requirements: Python 3 (or any static HTTP server) and a modern browser. No account, API key, Docker, or package installation is needed for this demo.

Download this repository using **Code → Download ZIP**, extract it, and open a terminal in the extracted folder:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory web/dist
```

Open **http://127.0.0.1:8000/** for the interactive demo, or **http://127.0.0.1:8000/watch.html** for the 2:14 English narrated film. On systems where Python is called `python3`, use that command instead. Stop the server with Ctrl+C.

The demo remembers synthetic progress in browser local storage. Use **Reset demo ↺** to start over. [Judging walkthrough](docs/JUDGING.md).

## What to try

1. Select **Lost response after submission** in **Demo scenario**.
2. Choose **Later**, then **Save this draft**. Pause and resume the draft.
3. Review the summary, select **I approve this exact sample appointment.**, and submit.
4. The simulated result becomes unknown. Try a repeat submission, then **Check existing record**. The sample record is verified without creating another one.
5. Choose **Time becomes unavailable** and repeat the review flow to see the unavailable-time case.

The browser's guided commands (`later`, `earlier`, `pause`, `resume`, `read summary`) are deterministic. They do not call an LLM. The sample response-loss case is an illustrative, recoverable scenario; the backend cannot guarantee recovery after every lost response.

## Source and assets

| Location | Contents |
| --- | --- |
| `web/dist/` | Complete static HTML, CSS, JavaScript, SVG-rendering code, and demo assets |
| `web/dist/assets/EasyLayer_Demo.mp4` | 1920×1080 narrated demo, 134 seconds, with English burned captions |
| `web/dist/assets/narration-en.mp3` | Included ElevenLabs English narration take |
| `web/dist/assets/captions.vtt`, `transcript.txt` | Accessible captions and transcript |
| `web/tests/`, `web/scripts/` | Browser-state tests, asset checks, and offline video renderer |
| `backend/` | v0.4 Python MCP server, source adapter, simulator, tests, Docker setup, and historical evidence |
| `backend/upstream.zip` | Unmodified Easy!Appointments 1.6.0 source archive |
| `docs/JUDGING.md` | Testing steps and evidence boundaries |
| `LICENSE` | Complete GNU GPL version 3 license text |

The downloadable `web/dist/assets/EasyLayer_Source_v0.4.zip` is also retained so the browser demo's source-download link works offline.

## Run the separate MCP backend

The static demo does not connect to this backend. The backend supplies its own shared-state simulator at `/simulator/` and a real local MCP endpoint at `/mcp`.

Requirements: **Python 3.12**, **Docker Desktop with Compose**, and **Node 20+** for tests/builds. These commands start a dedicated local Easy!Appointments test instance:

```sh
cd backend
python -m venv .venv
```

Activate the environment with `source .venv/bin/activate` on macOS/Linux, or `.venv\Scripts\Activate.ps1` in Windows PowerShell. Then:

```sh
python -m pip install -r bridge/requirements.txt
python scripts/start_demo.py
python scripts/start_bridge.py
```

Open **http://127.0.0.1:8092/simulator/** using that exact origin. The source setup command starts and seeds Docker, then exits; the bridge remains running. No Alexa or AWS account is required for the guided flow. Use synthetic contacts only.

The backend is a single-user, loopback-only prototype. Keep `.local/`, `.env`, and generated credentials private. See [the backend README](backend/README.md) for tool contracts, approval behavior, source verification commands, and limitations.

## Verification

Run the browser-state tests and asset check from the repository root:

```sh
cd web
npm test
npm run build
```

The static files are authored directly; `build` checks that the shipped files exist. No compilation or dependency installation is needed to run the static demo.

The v0.4 backend retains historical evidence for **117 passing controlled tests**, recorded on September 29, 2026. That evidence uses test sources and does not establish native Alexa compatibility, actual PHP/MariaDB booking success, voice/browser validation, or user benefit. Current web checks are separate. See [verification notes](docs/JUDGING.md).

## Rebuild the narrated film (optional)

The finished film and narration are already included. Regeneration is not required to run or judge the project. To regenerate visuals and combine the included audio, install FFmpeg with the subtitles/libass filter and DejaVu Sans fonts, then run from `web/`:

```sh
npm install --no-save sharp
node scripts/render-video.mjs
python scripts/render-narrated.py
```

Use Python 3.10+ for the renderer. The first command creates a silent storyboard film; the second applies the included narration and measured caption timings. Intermediate files stay in `web/.build/`. English audio was generated with ElevenLabs, Kayleigh – Poised Tech Tutorial Narrator, Eleven v4. No ElevenLabs key is needed to use the included recording. Rendering paths are local to this checkout.

## Scope and license

- The web film is an offline-rendered walkthrough of the sample state machine, not footage of a live Alexa device.
- The backend adapter targets Easy!Appointments 1.6.0. Native-source end-to-end verification and real-browser/user validation remain open gates.
- Optional older Bedrock and Alexa/OAuth scaffolds are included as source; this release does not claim a deployed Bedrock integration or a deployable native Alexa add-on.
- Duplicate suppression in the backend is limited to one retained SQLite database, owner, and exact booking target. An unknown result may require manual source inspection.

EasyLayer code is licensed **GPL-3.0-only**; see [LICENSE](LICENSE). Easy!Appointments and bundled dependencies retain their upstream notices and licenses. See [third-party notices](backend/bridge/app/dist/THIRD_PARTY_NOTICES.md). The upstream archive is unmodified, SHA-256 `299f8da75583ea185992ece4ac0b10e98f673825edbf75116446d99001911e60`.

The `backend/docs/` and `backend/evidence/` files describe the earlier v0.4 release. Statements there about a missing film or unpublished repository are historical; the repository root describes the October 21, 2026 submission package.
