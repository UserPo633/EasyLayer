# Recovery, verification evidence, and accessible review

This follow-up improves the existing Alexa+ experience simulation. It does not add native Alexa access, a generative runtime, or a live booking service.

## Problems reproduced

- An older tab could overwrite another tab's submitted sample record because rendering unconditionally saved stale state.
- The unavailable-time scenario used a one-time flag, so selecting the same unavailable time again could eventually produce a verified sample booking.
- Desktop appointment details were presented mainly inside a status-labelled SVG, while the semantic summary was hidden. Replacing action controls also removed keyboard focus.
- The separate Python source adapter verified the start time but not the appointment end time, allowing a wrong-duration receipt to pass its controlled source check.

## Changes

- Rendering no longer writes storage. Each user change checks the last observed stored value before saving. When another tab changes or clears it, the older tab blocks changes until the person selects **Load saved progress**. Read failures keep work in memory and do not authorize an unchecked storage overwrite.
- State version 3 retains unavailable slots through navigation, draft discard, and restoration. Ambiguous older availability history requires a new sample scenario instead of reconstructing missing facts.
- **Record details do not match** is now an interactive scenario. A field-by-field evidence table exposes the approved and observed values, record count, and expected record identity. A mismatch stays unknown and cannot cause another write.
- A semantic appointment summary is available at desktop and mobile sizes. Guided summary text includes the provider, full date, timezone, currency, and fictional contact. Action-control focus is restored after updates.
- The separate backend requires the source receipt's end time to equal the approved start plus duration. Controlled HTTP regressions cover missing/wrong receipt fields, restart, read-only recovery, and appointments crossing midnight.

## Verification boundaries

The combined web run passed **59 Node tests**. `npm run build` confirmed shipped assets and `node --check dist/app.mjs` passed. Run these from `web/`. The four presentation tests cover full summary fields, semantic markup, escaping of record text, and avoiding a success claim before explicit verification; they do not run the page in a browser.

The backend passed **44 targeted Python tests**: 14 core, 12 lifecycle, and 18 source HTTP contract checks. `python -m py_compile bridge/source.py tests/test_source_http_contract.py` also passed. The MCP-chain test was excluded because `mcp`, `httpx2`, `jwt`, `starlette`, and `uvicorn` were absent in the test environment. To reproduce the same bounded run from `backend/`:

```sh
python - <<'PY'
import unittest
loader = unittest.TestLoader()
suite = unittest.TestSuite()
def add(tests):
    for item in tests:
        if isinstance(item, unittest.TestSuite):
            add(item)
        elif item._testMethodName != 'test_simulator_mcp_native_adapter_full_http_chain':
            suite.addTest(item)
        else:
            print('NOT RUN (missing MCP dependencies):', item.id())
for pattern, directory in [('test_core.py', 'bridge'), ('test_bridge_lifecycle.py', 'tests'), ('test_source_http_contract.py', 'tests')]:
    add(loader.discover(directory, pattern=pattern))
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(0 if result.wasSuccessful() else 1)
PY
```

The backend's 117-test September release evidence remains historical; it is not relabelled as a current full-suite run.

Cross-tab detection is a best-effort localStorage guard, not an atomic transaction lock. Synthetic state remains browser-editable. The backend is still a single-user loopback prototype. Controlled HTTP fixtures are not the original PHP/MariaDB service. DOM tests are not real-browser or screen-reader validation. No live Alexa, real booking, production security, or user-study result is claimed.

The existing 134-second film remains an earlier walkthrough and does not demonstrate these new cases. The interactive source and judge instructions are current. The old v0.4 source ZIP is retained as an archived asset; the current backend is in the repository's `backend/` directory.
