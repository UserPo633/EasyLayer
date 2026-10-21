# EasyLayer Alexa+ 제출·연동 가이드 v0.4

기준: 2026-09-30 KST. **이번 해커톤의 구현 경로는 자체 웹 시뮬레이터와 MCP 서버다.** v0.3의 ‘Alexa 개발자 도구 접근부터 확보’ 우선순위를 정정한다.

## 공식 규칙에 따른 결정

[공식 FAQ](https://amazonappdev2026.devpost.com/details/faqs)는 참가자에게 제한된 Alexa+ Category SDK, MCP Toolkit, CLI, Web Simulator 접근을 제공하지 않으며 신청할 방법도 없다고 명시한다. 직접 만든 웹 화면으로 MCP 서버를 시연하는 경로를 안내한다. 로컬 실행 가능한 공개 저장소와 영상만으로 제출 가능하며 공개 호스팅은 필수가 아니다.

[주최 측 답변](https://amazonappdev2026.devpost.com/forum_topics/45058-clarification-on-simulated-alexa-web-experience-requirements)은 자체 UI, 선택적인 음성, 실제 백엔드와 시뮬레이션 화면 조합을 허용한다. [규칙](https://amazonappdev2026.devpost.com/rules)은 MCP 2025-11-25+ Streamable HTTP 또는 별도 시뮬레이션 경로를 설명한다.

따라서 웹 화면 자체가 문제가 아니다. **화면·예약 상태·실행 결과가 하나로 연결되는지**가 중요하다. v0.4는 자체 시뮬레이터가 진짜 MCP 엔드포인트를 호출하며 같은 SQLite 초안을 사용한다. 실제 Alexa 호출, Echo 렌더링, 자유로운 생성형 대화를 구현했다는 뜻은 아니다.

## 현재 구조

| 부분 | 실제 역할 | 검증 경계 |
|---|---|---|
| `/simulator/` | 큰 글씨 선택·요약·제한 명령, 검토 링크, 재개 | jsdom 및 HTTP 검증. 실제 브라우저·음성 미검증 |
| 시뮬레이터 호스트 | 고정 MCP 주소에 initialize 및 tools/call | 실제 로컬 HTTP. 브라우저에 MCP 토큰 노출하지 않음 |
| `/mcp` | MCP 2025-11-25 HTTP, 8개 도구 | 공식 Python SDK 서버로 프로토콜 검증 |
| 예약 엔진 | 소유자별 초안, 승인, 재개, 제출 전 재검사, 중복 억제 | SQLite 및 fault-injection 테스트 |
| `/review/{id}` | 연락처 입력, 현재 revision 명시적 승인 | 화면의 승인은 실제 접수와 구분 |
| NativeSource | Easy!Appointments 쿠키·CSRF·등록·원문 재조회 | 실제 어댑터를 HTTP fixture로 검증. 원본 PHP 실행은 대기 |
| MCP Apps 리소스 | 호환 호스트에서 요약 카드 표시 | 번들·프로토콜·DOM 검증. Alexa 렌더링 미검증 |
| 기존 Bedrock/UI | 별도 v0.2 대화 실험 | v0.4 메인 화면에 연결되지 않음 |

## 실행

Python 3.12와 Docker Desktop/Compose가 있는 컴퓨터에서 ZIP을 풀고 프로젝트 루트로 이동한다.

```sh
python -m venv .venv
```

macOS/Linux: `source .venv/bin/activate`. Windows PowerShell: `.venv\Scripts\Activate.ps1`.

```sh
python -m pip install -r bridge/requirements.txt
python scripts/start_demo.py
python scripts/start_bridge.py
```

브라우저에서 **http://127.0.0.1:8092/simulator/** 로 접속한다. `localhost`로 주소를 바꾸면 세션/Origin 검사가 다르게 처리하므로 위 주소를 그대로 사용한다. `start_demo.py`는 원본 컨테이너 시작·seed 후 종료하며, `start_bridge.py`는 계속 실행된다.

다른 터미널에서 같은 가상환경을 활성화한 다음:

```sh
python scripts/probe_mcp.py --source
python scripts/verify_source_live.py
python scripts/verify_source_live.py --book-fixture
```

앞의 두 명령은 조회만 한다. 마지막 명령은 소유한 localhost 테스트 원본에 **합성 예약 한 건을 실제 생성**한다. 테스트를 반복하기 전에 pending/unknown 여부를 확인한다. `.local/live-adapter-probe.sqlite3`를 지워 불확실 상태를 우회하지 않는다. 출력은 `evidence/native-adapter-live-*.json`이다.

이후 화면에서 수업·담당자·날짜·시간 선택 → 초안 생성 → 검토 화면의 합성 연락처와 승인 → 상태 확인 → 접수 → 원문 확인까지 직접 수행한다. 이 화면 조작 검증은 programmatic test approval과 별개다. 원본 서비스가 꺼져 있으면 화면에 오류를 표시하며 샘플 시간으로 대체하지 않는다.

## 승인·재개의 정확한 의미

- 재개는 같은 소유자의 서버 상태를 읽는다. pending/unknown이 있으면 먼저 보여준다.
- draft 재개는 새 검토 링크를 발급하고 이전 링크를 폐기한다. expiry는 늘리지 않는다. 이미 approved라면 승인 상태를 보존한다.
- 초안 폐기는 draft/approved만 가능하다. 실제 예약 취소·환불 기능은 없다.
- 같은 DB·소유자·서비스·담당자·날짜·시간의 pending/unknown/verified가 있으면 다른 초안으로 재접수할 수 없다. 다른 사용자·다른 DB·원본에서 직접 취소한 예약까지 동기화하는 범용 중복 탐지는 아니다.
- 원본 재조회가 일치해야 성공이다. 응답 유실로 원본 식별자도 모르면 unknown을 유지한다. 자동 재등록하지 않는다.
- 검토 capability는 ‘사람임을 증명’하지 않는다. 승인 도구는 모델에 없지만, capability와 자유로운 HTTP 권한을 가진 클라이언트는 폼을 조작할 수 있다.
- 로컬 토큰은 한 사용자로 매핑된다. 여러 브라우저 쿠키가 있어도 다중 사용자 로그인 서비스가 아니다. OAuth 모드에서는 시뮬레이터 경로가 비활성화된다.

## 실제 Alexa는 향후 별도 단계

[Amazon Toolkit](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html)의 일반 연동 문서는 미래 파트너 접근이 확보될 때 참고한다. 현재 코드는 외부 OAuth 서버의 RS256 토큰 검증, 서비스 `mcp:service`와 사용자 `mcp:tools` + `easylayer:booking` 범위를 구분한다. 인가 서버·자격 증명 발급·계정 연결 완료를 대신하지 않는다.

향후 접근이 확보되면 HTTPS와 영구 저장소, 외부 OAuth authorization code + PKCE 및 client credentials, 공식 CLI 등록과 기기 UI를 별도로 검증한다. `alexa/addon.template.json`은 무효 URL을 담은 미완성 템플릿이다. 현재 배포·인증·Amazon 등록은 수행하지 않았다.

대회 준비의 다음 순서는 **원본 E2E → 브라우저 검토 → 실제 사용자 관찰 → 영상·GitHub 제출물**이다. Alexa 도구 접근 대기로 이 순서를 막지 않는다. 제출 마감은 공식 규칙 기준 2026-10-23 12:00 PDT, 한국시간 2026-10-24 04:00 KST다. 영어 공개 영상은 3분 미만으로 준비한다.
