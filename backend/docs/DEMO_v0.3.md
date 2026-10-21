# EasyLayer: demo and submission draft (v0.3)

## Positioning

A booking assistant that helps someone select an actual class while keeping the original booking service as the source of truth. Voice works well for stating preferences; a short visual summary helps a person catch a wrong date, provider, time, or price. The implementation exposes real MCP tools, a separate MCP Apps view, a persistent booking engine, and an owned Easy!Appointments source adapter.

**Tested:** real local MCP Streamable HTTP/2025-11-25 protocol, tool/resource discovery, booking-state behavior with synthetic source, bundled view and mock-host DOM interactions. **Still to show:** live booking against Docker source; Alexa+ account, voice, simulator or physical device; production OAuth.

## Video outline (<3 minutes)

| Time | On-screen action | Narration goal |
|---|---|---|
| 00:00–00:20 | Short booking problem statement | Explain why a voice request needs a precise, verifiable result. |
| 00:20–00:55 | MCP client/tool inspector: list classes, pick a teacher, see availability | The assistant reads the real catalog from our owned source in the live run. If only test fixture is shown, label it clearly. |
| 00:55–01:30 | Create draft, show MCP Apps booking summary or labeled companion preview | No registration has occurred. Read back teacher, date, time, timezone and price. |
| 01:30–02:05 | Open companion review page, use synthetic contact and approve | Explain that person input and approval are separate from a model tool call. Avoid exposing review token in the recorded video. |
| 02:05–02:35 | Call `complete_booking`, inspect original record and `verified=true` | Show one actual appointment, then call the same draft again to show no second submission. |
| 02:35–02:55 | Brief architecture/technical feedback | MCP server as connection point; state honestly whether Alexa simulator or real Alexa was used. |

Record actual behavior after Docker live verification. Blur personal data, tokens, URLs containing `?token=`, and admin credentials. If Alexa is unavailable, present the demo as a self-hosted MCP server plus clearly identified simulated Alexa+ interaction. Do not edit together footage that implies unperformed Alexa calls.

## Project description draft

EasyLayer turns a class-booking site into a set of conversational booking tools. The MCP server reads the original service catalog and free times, saves a draft, shows the booking details in an MCP Apps view, and verifies the original record before reporting success. Its persistent state prevents repeated calls for the same draft from blindly submitting another appointment. When conditions change, the person reviews a new draft. The current prototype uses a separate review page for contact entry and authorization. The included browser simulation explores voice and large-format presentation, while the MCP bridge is the integration candidate for Alexa+.

## Product feedback prompts (answer from real experience only)

- Which MCP SDK, transport, app extension and AWS services did the demo actually call? Distinguish the optional Bedrock browser prototype from the MCP pathway.
- How long did developer setup, account linking, source configuration, and simulator tests take? What broke and what worked?
- Did Alexa support this MCP Apps resource and its links on the actual target device? What would improve confirmation without losing the user to another screen?

## Submission inventory

GitHub repository and clear setup instructions; public or explicitly shared private repo per rules; demo video publicly viewable on YouTube/Vimeo and under three minutes; written English text, testing instructions and product feedback; identify the primary track and significant work done during the submission period. Submission and publishing are not performed by this package.

References: [Official rules](https://amazonappdev2026.devpost.com/rules), [Alexa+ QuickStart](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html).
