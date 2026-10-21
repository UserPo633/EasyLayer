# Product feedback draft · EasyLayer v0.4

Prepared 2026-09-30 KST. These notes describe observed development work, not a submitted feedback form. Update them after the native-source and browser gates. No Amazon account application, rejection, certification or production deployment is claimed.

## MCP Python SDK

**Use:** eight booking tools, Streamable HTTP, authenticated ownership and an MCP Apps resource. The local simulator calls this endpoint through actual HTTP. **Worked well:** initialization, tool discovery, structured tool results and resource delivery can be exercised independently of a native Alexa device. Automated tests use the actual SDK server and controlled source fixtures. **Improvement request:** an example showing a complete resumable transaction—including ambiguous external writes and a separate approval surface—would be more useful for this task than a stateless API wrapper. This is a requested example, not an SDK reliability defect. **Would use again:** yes for the integration boundary, while keeping booking correctness in the application engine.

## MCP Apps

**Use:** bundled booking summary and host-mediated actions. **Worked well:** the same server-returned data supplies the visible summary and action state. Resource delivery, bundle build and jsdom event behavior are verified. **Remaining onboarding question:** actual target-host rendering and link/approval UX must be tried in a supported host. We have not verified Alexa rendering, so cannot rate its device-specific behavior. **Would use again:** yes for compatible hosts; the hackathon's own web simulator is the current demo surface.

## Native booking source

**Use:** unmodified bundled Easy!Appointments 1.6.0, with a narrow HTTP adapter. **Worked well in contract checks:** actual cookies, HTML CSRF, form encoding and receipt read-back work against a source-shaped loopback fixture. **Friction:** an adapter-specific gate was missing while older UI tests used a different path; those tests did not establish this adapter's complete behavior. **Workaround:** add actual adapter HTTP contract tests and a separate live-source runner. **Boundary:** the original PHP/MariaDB runtime has not yet run in the current environment. Update feedback after that gate rather than claiming source integration completion now.

## Friction log A01 — choose a feasible Alexa+ development path

| Field | Observation |
|---|---|
| Task | Decide how to build an Alexa+ hackathon prototype |
| Steps | Compared public Toolkit/setup material with the hackathon's official FAQ and organizer simulation clarification |
| Expected | One explicit route showing which developer tools participants can actually access |
| Actual | The hackathon FAQ says the gated Toolkit, CLI and Web Simulator cannot be requested by participants; a self-hosted server with an own front end is the feasible route |
| Impact / severity | Important planning friction: the earlier project roadmap put developer access before end-to-end booking validation. This is a qualitative project assessment, not a measured service outage |
| Workaround used | Changed the roadmap to a shared MCP web simulator and moved native Alexa onboarding outside the submission prerequisite |
| Actionable suggestion | Put the participant-access restriction and the own-simulator path at the top of setup pages and link a runnable self-hosted example |
| Evidence | Official FAQ, organizer answer, corrected v0.4 guide; no account application or rejection was performed |

Sources: [hackathon FAQ](https://amazonappdev2026.devpost.com/details/faqs), [organizer clarification](https://amazonappdev2026.devpost.com/forum_topics/45058-clarification-on-simulated-alexa-web-experience-requirements), [Toolkit overview](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html).

AWS/Bedrock runtime feedback is intentionally pending: this release's main screen is guided and does not invoke Bedrock. The retained older planner tests use a fake client. Do not submit those as proof of a live AWS integration.
