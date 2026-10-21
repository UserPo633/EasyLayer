# 전문가 1 · Alexa+ 플랫폼·연동 구조 검토

기준: 2026-09-30 KST. 복원된 v0.3 코드와 아래 공식 문서를 확인한 설계 검토다. 실제 Alexa+ 실행·계정 연결을 수행한 결과는 아니다.

## 결정

**이번 해커톤의 구현 경로는 자체 호스팅 MCP 서버와 자체 웹 시뮬레이터다.** 웹 화면은 공식적으로 허용된 시연 수단이다. 기존 웹 화면과 MCP 서버가 같은 예약 상태를 사용하도록 연결하는 것이 이번 개선의 핵심이다.

공식 FAQ는 참가자가 Alexa+ Category SDK, MCP Toolkit, CLI, Web Simulator 접근권을 얻거나 신청할 방법이 없다고 안내한다. 주최 측 포럼 답변은 사용자 정의 UI, 선택적 음성, 실제 백엔드 위의 시뮬레이션 화면을 허용한다. 실제 Alexa 접근권 확보를 이번 제출의 선행 조건으로 두지 않는다. [1][2]

제출 설명은 **“Self-hosted MCP booking workflow with a simulated Alexa+ interface”**로 통일한다. 실제 예약 원본을 검증한 경우에만 “real booking workflow”를 추가한다. 테스트 더블만 이용한 실행은 해당 사실을 표시한다.

## v0.3에서 확인한 구현과 남은 차이

| 항목 | 확인한 상태 | 설계 판단 |
|---|---|---|
| MCP 서버 | 여섯 도구, Streamable HTTP, 영속 예약 초안 | 유지하고 실제 시뮬레이터가 호출 |
| 인증 | `oauth` 모드, 서비스/사용자 scope, JWT 검증, PRM 경로, 401 호환 처리 | 재구현 불필요. 외부 인가 서버와 Amazon 연결 검증은 별도 |
| MCP Apps | `ui://easylayer/booking.html`, `resourceUri`, 상태·갱신·완료 버튼 | 표준 UI 자산으로 유지. Alexa 렌더링 성공으로 표현하지 않음 |
| 기존 웹 UI | MCP 서버와 상태를 공유하지 않는 별도 흐름 | 새 시뮬레이터의 예약 경로를 하나로 통합 |
| 승인 | 별도 페이지의 연락처 입력·확인 후 실행 | 시뮬레이터에서 명시적 UI 승인으로 제공 |
| 예약 원본 | Easy!Appointments 어댑터, 테스트 더블 검증 | 실제 원본 E2E가 다음 핵심 증거 |

## 이번 버전의 세 가지 우선순위

1. **동일 예약의 완결된 흐름:** 선택 → 초안 → 검토 → 승인 → 실행 → 원본 확인을 같은 `draft_id`로 연결한다. 웹 호스트는 실제 `/mcp`의 도구 호출을 사용한다. 모델은 의도를 해석하고 도구를 선택하며, 가격·시간·완료 상태는 서버 응답을 따른다.
2. **중단·불확실 상태의 복구:** 새로고침과 재접속 후 이어가기를 제공한다. `pending`·`unknown` 상태는 새 예약을 만들어 재시도하지 않는다. 원본을 다시 확인할 방법을 제시한다.
3. **재현 가능한 증거:** MCP 협상, 원본 예약 한 건, 반복 요청, 상태 복구를 실제 실행으로 기록한다. 실제 원본·테스트 더블·시뮬레이션 화면을 각각 정확히 표시한다.

규칙상 self-hosted MCP는 2025-11-25 이상과 Streamable HTTP가 요구된다. 별도의 simulated Alexa+ 제출 경로는 특정 MCP 형태를 요구하지 않는다. EasyLayer는 이미 MCP를 구현했으므로 이를 실제 시연 경로에 연결하는 선택이 합리적이다. [3]

## 단일 페이지 시뮬레이터에 대한 교차 검토

제안된 **서버 측 MCP 클라이언트 + 세션 쿠키 + CSRF 검사** 구조에 동의한다. 브라우저에는 MCP bearer를 전달하지 않는다. 선택, 초안, 검토, 상태 갱신, 실행, 영수증을 한 흐름으로 보여준다. 음성은 브라우저 지원 여부에 따라 선택 기능으로 두며, 음성 전사만으로 승인 상태를 만들지 않는다.

다음 조건을 구현·검증해야 한다.

- 로컬 MCP 토큰은 모든 호출에 `local-demo-person`을 사용한다. 따라서 이 호스트는 **단일 사용자 로컬 시뮬레이터**다. 쿠키가 있다고 다중 사용자 인증이 완성되는 것은 아니다.
- 초안 재개 시 검토 링크를 재발급한다면 소유자를 확인하고, 활성 `draft`에서만 capability hash와 revision을 한 트랜잭션으로 교체한다. 기존 링크는 즉시 무효화하고 원래 만료 시각·예약 내용은 유지한다.
- `approved` 재개는 기존 승인 상태를 보존한다. `pending`·`unknown`·`verified` 재개는 상태 조회·원본 확인에 한정한다. 재개가 승인이나 예약 재실행을 유발해서는 안 된다.
- 기존 탭의 오래된 검토 폼은 revision 불일치로 거부하고, 화면에서 다시 불러오도록 안내한다.
- capability를 가진 호출자가 물리적인 사람이라는 보장은 없다. **명시적 UI 승인과 모델 도구의 승인 권한 제한**이라고 설명한다. 암호학적으로 사람임을 확인했다고 표현하지 않는다.
- 취소 버튼이 원본 예약을 취소하지 않는다면 **예약 초안 폐기**라고 쓴다. 확정 예약 취소와 혼동시키지 않는다.

## 향후 실제 Alexa 연결 시 확인할 사항

이 부분은 해커톤 완료 조건이 아닌 후속 연동 검토다.

- Amazon 문서는 Alexa+의 MCP 2025-11-25 및 MCP Apps 지원과 Toolkit의 미국 제공을 명시한다. 도구·리소스 변경 후 Add-on 재배포가 필요하다. [4][7]
- 서비스 인증은 `client_credentials`, 개인 계정 연결은 `authorization_code`와 PKCE S256이다. 토큰의 resource/audience와 사용자 권한을 검증한다. 현재 JWT 검증 코드는 인가 서버 구축이나 계정 연결 성공을 대신하지 않는다. [5][6]
- Alexa 대화 내 시각 표시에는 UI resource가 사용된다. 현재 HTML 번들이 있다는 사실만으로 Echo Show의 실제 렌더링·터치·음성 동작을 검증한 것은 아니다. [7]
- 실제 native 경험에서는 음성·화면의 가격과 날짜가 같아야 하며, 화면 없는 기기의 핵심 흐름은 음성으로 완료할 수 있어야 한다. 중단 후 복구와 중복 거래 방지도 검토 대상이다. [8]
- QuickStart의 500ms 조회 응답 목표와 기능 가이드의 3초 검색 응답 권고는 서로 다른 문맥이다. 실제 왕복 지연을 기록하고, 측정 전에 성능·인증 기준을 통과했다고 주장하지 않는다. [8][9]

## 공식 근거

1. [해커톤 FAQ](https://amazonappdev2026.devpost.com/details/faqs) — 개발 도구 접근 제한, 자체 시뮬레이터 안내.
2. [주최 측 시뮬레이션 요구사항 답변](https://amazonappdev2026.devpost.com/forum_topics/45058-clarification-on-simulated-alexa-web-experience-requirements) — 사용자 UI와 실제 백엔드 허용, 음성 선택.
3. [해커톤 공식 규칙](https://amazonappdev2026.devpost.com/rules) — MCP 경로와 simulated Alexa+ 대안.
4. [Alexa+ MCP Toolkit Overview](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html).
5. [Alexa+ MCP Authentication](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-authentication.html).
6. [Account Linking for MCP Add-ons](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html).
7. [Alexa+ MCP Client and App Lifecycle](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html).
8. [Functional Requirements](https://developer.amazon.com/docs/alexaplus/add-ons/functional-requirements.html).
9. [Alexa+ MCP QuickStart Guide](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html).

Devpost 일부 페이지는 직접 열기가 제한되어 공식 페이지의 검색 결과 본문으로 확인했다. 등록·배포·계정 연결·실기기 테스트는 수행하지 않았다.
