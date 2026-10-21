# Devpost wording aligned with the current implementation

Prepared October 21, 2026. This is replacement wording for review, not confirmation that the Devpost form has been changed. The user reports the required video link was submitted correctly. The actual saved Devpost description was not accessible without a new login in this session.

## Project scope paragraph

EasyLayer is an Alexa+ experience simulation that helps a person complete a sample booking through clear choices, a recoverable draft, explicit approval, and an honest result. Its difficult case is a lost submission response: the demo keeps the outcome unknown, blocks a repeat submission, and checks the existing sample record before displaying success. The latest browser demo compares every approved booking field and the expected record ID, and it reports when browser storage cannot save progress.

The interactive browser demo is a deterministic simulation using fictional data. It does not call a generative model, connect to native Alexa, or create a real appointment. The repository separately includes the v0.4 self-hosted Python MCP backend, SQLite draft state, its own simulator, and an adapter targeting Easy!Appointments 1.6.0. The hosted browser demo is not connected to that backend.

## Testing and video paragraph

The current browser demo passes 35 Node tests covering draft state, approval, complete-record verification, old-state restoration, and storage failures. Separately, the earlier v0.4 backend release recorded 117 passing controlled tests. These are different test suites and do not prove native Alexa compatibility, real PHP/MariaDB booking success, real-browser behavior, or user-study results.

The 134-second English narrated demo is an automated illustrated walkthrough of the sample booking flow. It was produced before the latest verification and storage-error update and has not been re-recorded for those checks. The repository contains the current runnable demo, full source, assets, and setup instructions.

## Feedback 1 — Tools, APIs, and SDKs used

The separate Python backend uses the MCP Python SDK for eight booking tools, Streamable HTTP, structured results, and a server-side simulator client. MCP Apps supplies an optional booking-summary resource with host-mediated actions. SQLite stores backend drafts, and a narrow HTTP adapter targets the bundled Easy!Appointments 1.6.0 source. The browser-only demo uses HTML, CSS, JavaScript, browser local storage, and Node's test runner. ElevenLabs produced the included English narration; FFmpeg assembles the narrated film and captions. The main demo does not call Bedrock; the older planner prototype uses a fake client in its tests.

## Feedback 2 — What worked well

MCP initialization, tool discovery, structured results, and resource delivery could be exercised locally without a native Alexa device. The MCP Apps resource could be bundled and checked with controlled tests. SQLite enabled persistent backend draft state, and source-shaped HTTP fixtures exercised the adapter's cookies, CSRF fields, form submission, and receipt read-back. The deterministic browser state machine made interruption and ambiguous-result scenarios repeatable. The narration and caption assets could be combined into a short English walkthrough using FFmpeg.

## Feedback 3 — What needs work

A runnable MCP example covering a resumable transaction, an ambiguous external write, and a separate approval step would help this use case. This is a documentation request, not an observed SDK reliability defect. Actual MCP Apps rendering in the intended host still needs verification. Our adapter initially lacked a dedicated end-to-end gate; we added HTTP contract tests and a separate live-source runner, but the real PHP/MariaDB gate remains unexecuted. In our own browser code, full-record matching and honest storage-failure feedback needed improvement; both were corrected in the latest update. No measured AWS outage, IAM failure, or ElevenLabs service defect is claimed.

## Feedback 4 — Onboarding experience

The main planning difficulty was identifying a development path available to hackathon participants. We initially treated native Alexa developer access as a prerequisite, then corrected the plan after reviewing the official FAQ and simulation guidance. Local MCP initialization and tool calls provided a workable starting point. Native Alexa onboarding and actual target-host rendering remain unverified. The browser-only demo needs no account or API key and runs with a simple local HTTP server. We generated an English narration asset in ElevenLabs; we did not measure its onboarding duration.

## Feedback 5 — Would you build with these again?

Yes. MCP is useful as an integration boundary while transaction correctness stays in the application engine. We would use MCP Apps in compatible hosts after validating their rendering and approval flow. SQLite and deterministic browser state are useful for a controlled prototype, with additional work required for production and multi-user use. We would use ElevenLabs and FFmpeg again for narrated demonstrations. We cannot rate a native Alexa integration or live Bedrock deployment from this project because neither was completed.

## Friction log

Use the recorded A01 entry and native-source testing discussion in `backend/docs/PRODUCT_FEEDBACK_v0.4.md` as evidence. Do not label the project's missing adapter tests or browser bugs as Amazon product defects. Do not invent account rejection, IAM errors, outage duration, credit problems, or user research. Friction logs supplement the five feedback answers; they do not replace them.

## Final form comparison still required

Check the actual saved Devpost fields against these statements after login. Keep the submitted video URL that the user has already confirmed. Do not use the owner-private Site as an unrestricted testing link. The public GitHub repository and its local run instructions are available for judging.
