# EasyLayer v0.4 — demo and English submission copy

Prepared 2026-09-30 KST. This is a recording script, not a statement that a video has been recorded or submitted. Use the final release evidence to decide which shots are ready.

## Demo route and truthful labels

The hackathon's official FAQ says its restricted Alexa+ developer tools are unavailable to participants. A self-hosted MCP server with our own web simulator is an appropriate submission route. Public hosting is not required for a locally runnable public repository plus demo video. The simulated interaction does not call Amazon's Alexa backend.

Our main demonstration should use the new web simulator calling the real MCP endpoint and the same server-side booking state. The shipped screen connects to the native Easy!Appointments source only; it has no selectable fixture demonstration mode. Source fixtures are injected by automated tests behind the real MCP transport. Do not intercut the old `ui/connected.html` prototype as if it shares the new state.

**Recording gate: a successful native booking cannot currently be filmed until the bundled source is running and its end-to-end check passes. The following script is a rehearsal plan for that later run.** A green protocol test with a fixture does not open this gate. After verification, show:

> Alexa+ interaction simulation · Owned Easy!Appointments test instance

The source instance must be dedicated to synthetic demo contacts. If the source is unavailable, show the actual unavailable state and testing evidence. Do not substitute fixture screenshots into a purported native end-to-end recording.

The current voice control is limited to supported commands. Say `Optional voice commands` rather than `Talk naturally about anything`. Do not subtitle a scripted or button-driven selection as a successful free-form LLM request. The MCP backend is useful and real even when the interaction is controlled.

## A 2 minute 45 second rehearsal script — record only after native E2E passes

Use synthetic contact details. Hide private tokens, review capability URLs and source management hashes. Keep source operations in a dedicated test environment. The timed narration leaves room for actions and results. It is planned wording, not a report of a completed demonstration.

| Time | Real screen action | English narration |
|---|---|---|
| 0:00–0:15 | Show a short problem statement, then the simulator with its mode label | “Booking a class should not require someone to work through a series of small controls. EasyLayer explores a more readable, guided way to finish a booking and know whether it actually went through.” |
| 0:15–0:40 | Choose a service, provider and date. Fetch available times through MCP. Show the human-readable response, briefly exposing the tool call only if useful. | “This is our Alexa+ interaction simulator. It calls a real MCP server. For this recording, the source is our own Easy!Appointments test instance with synthetic customer details. I choose a class and ask for available times. The screen shows only options returned by the source.” |
| 0:40–1:05 | Select a time, create a draft, close/reopen the simulation session and use resume. Keep authentication tied to the same demo owner. | “The draft is saved on the server. When I return, EasyLayer restores my own draft, so I do not have to repeat the choices. The date, time, provider and price stay visible for review.” |
| 1:05–1:30 | Open the private review screen, enter synthetic contacts, review, approve and return. Refresh status before execution. | “Reviewing and submitting are separate steps. I check the details and approve the draft. A model tool cannot simply claim that I approved it. This prototype uses a companion review screen for that step.” |
| 1:30–1:55 | Submit once, show the verified receipt and the original test instance's single registration. Repeat completion for the same draft. | “The server checks the booking conditions again, submits the approved draft, and reads back the record. Repeating completion for this draft does not create another registration. The result comes from verification, not from a convincing sentence.” |
| 1:55–2:20 | Show the separately labeled response-loss test result. If an interactive injection control is absent, show the actual test output rather than pretending it happened in the UI. | “If a response is lost and the record cannot be identified, EasyLayer keeps the result uncertain. It does not say ‘booked’ and it does not blindly try again. A same-target draft is also blocked while that earlier result needs attention.” |
| 2:20–2:45 | Show architecture, measured test status and remaining gate | “EasyLayer combines a readable interaction with persistent booking state. This recording showed the original service running in our test environment. Our submission includes runnable code, testing instructions, and a clear distinction between the Alexa+ simulation and the backend behavior we verified.” |

Show only implemented, passing behavior. If owner-based resume or same-target duplicate handling has not passed the release checks, omit its sentence and shot. The registration count must come from the owned Easy!Appointments instance used in the recording. Do not call it an actual institution's customer reservation. The response-loss segment is a separately labeled automated fixture test, not a claim that the preceding native UI booking failed or recovered.

Before recording, run the bundled native-source setup and end-to-end commands, and record the command, date, source version and persisted-record check in evidence. Retain the Alexa+ simulation label after native-source verification. Native-source success does not establish Alexa-device integration.

## Optional extra footage, outside the main demo

- Change a source condition after review: demonstrate that the user must review a new draft.
- Abandon an unsubmitted draft: demonstrate that no source reservation was cancelled, because none was made.
- Create another draft with the same owner, service, provider, date and time: demonstrate the duplicate guard's exact scope. It does not deduplicate different accounts, dates, servers or independent databases.
- Review a known source record after a verification delay: show a successful recovery only if the record can actually be re-identified. An unknown result without a source identifier remains unknown.

## Submission description draft

**Tagline**

Readable booking, persistent progress, and a result checked at the source.

**Inspiration**

Some people can describe the class they want but need help navigating a small, multi-step booking form. Our initial hypothesis is that a guided interface, a readable summary and recoverable progress can reduce that difficulty. We have not yet established a population-wide benefit or measured time savings.

**What it does**

EasyLayer exposes a supported booking service through MCP tools. Its simulator follows the same draft from availability to review, approval, submission and record verification. The server keeps drafts between sessions. Repeated calls do not blindly submit the same draft again, and the v0.4 duplicate guard checks the same owner's equivalent booking target. If the result is uncertain, the interface says so.

**Why this fits Alexa+**

An Alexa+ experience can combine short conversational choices with a screen that keeps booking facts available. EasyLayer uses that interaction direction around one complete task. Our hackathon implementation demonstrates it through a web simulator and self-hosted MCP, in line with the official FAQ. It does not require or claim access to Amazon's production Alexa backend.

**Implementation and validation**

Describe the exact MCP runtime, simulator route, state tests and source contract tests recorded by the final release. Record test counts from the generated evidence rather than this template. Clearly identify fixture-backed checks. Actual Easy!Appointments end-to-end execution, native Alexa integration and representative usability outcomes must not be described as completed without evidence.

**What we would validate next**

Run the bundled original service end to end, then observe a small group of adults who experience difficulty with booking forms. Compare completion, mistakes, assistance requests and approval comprehension against the standard form. Report individual outcomes and limitations, without presenting a small exploratory sample as representative.

## Product feedback and friction log

Report only tools used in the recorded build. The optional older Bedrock path is not automatically part of the new simulator. The restricted Alexa Toolkit was not used. A feedback entry can document the actual discovery that generic add-on setup instructions led toward restricted tools, while the hackathon FAQ directed participants to their own simulator. Include URLs, the resulting design change and a suggestion to surface contest-specific guidance earlier; do not invent an attempted account enrollment or rejection.

No successful booking video or fixture-backed simulator UI is included in this release. For each real engineering friction, record the attempted task, steps, expected and actual outcome, severity, workaround and actionable suggestion. The maximum friction-log bonus is not a promised score.

## Recording and submission checklist

- The video is in English, publicly viewable on YouTube or Vimeo, and under three minutes.
- The GitHub repository contains source, license and reproducible instructions; actual publication or reviewer access is a separate user action.
- Tested source mode, optional voice support and native Alexa status are visible and accurate.
- No live personal contact, access token, review URL capability or administrative credential appears.
- Product feedback describes the actual build and actual observed friction.
- The significant changes during the competition window are listed.

Sources checked 2026-09-30 KST: [Official rules](https://amazonappdev2026.devpost.com/rules), [FAQ](https://amazonappdev2026.devpost.com/details/faqs), [submission overview](https://amazonappdev2026.devpost.com/), [organizer simulation clarification](https://amazonappdev2026.devpost.com/forum_topics/45058-clarification-on-simulated-alexa-web-experience-requirements).
