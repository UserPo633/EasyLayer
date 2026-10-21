# Devpost wording aligned with the current implementation

Prepared October 21, 2026. After signing in, the actual Devpost submission was reviewed and corrected. The project story and additional information were saved; the finalization page showed **Submitted**, **5/5 steps done**, and **Project submitted!**. The public story and the saved additional fields were reopened to confirm the changes. The existing video URL, `https://youtu.be/TWfb95AJGbU`, was preserved. Video playback and anonymous YouTube availability were not independently retested in this review.

## Saved Devpost corrections

- Rewrote the public story to distinguish the deterministic browser demo from the separate MCP backend and its own simulator.
- Distinguished the current 35 web Node tests from the historical 117 controlled backend tests, and disclosed that the film predates the latest defensive checks.
- Added the public GitHub repository to the public “Try it out” links. The mandatory repository field already contained the correct URL.
- Replaced Feedback Question 3, which had duplicated the Question 2 benefits answer, with evidence-based improvement feedback.
- Corrected Question 4 to remove an unsupported service-credit defect claim and explain the verified onboarding boundaries.
- Added the existing product feedback/A01 document as the Friction Log URL, linked `docs/JUDGING.md` for testing, and updated local run instructions and button names.
- Preserved the existing track, mini-challenge choices, identity details, eligibility attestations, and submitted video URL. No new terms acceptance or submission was needed: edits updated the already-submitted project.

Public project: https://devpost.com/software/easylayer

The wording below is the alignment reference. The live form uses expanded project-story, testing, and feedback text consistent with these boundaries.

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

## Final form comparison completed

The saved Devpost fields were compared and corrected after login. The existing video URL was retained. No owner-private Site was entered as an unrestricted judge-testing link; the form now links the public repository's judging instructions. The updated public story and saved additional fields were verified through Devpost's UI.
