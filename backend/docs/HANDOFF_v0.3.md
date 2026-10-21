# EasyLayer 인수인계 · v0.3 · 2026-09-24

## 이 프로젝트를 지금 한 문장으로 말하면

**“Alexa+가 호출할 수 있는 예약 도구를 MCP 서버로 만들고, 수업·시간·가격을 대화 안에서 확인한 뒤 원본 예약까지 검증하는 EasyLayer.”** 웹사이트는 연구용 시뮬레이션 및 연락처/승인 동반 화면에 사용한다. 실제 Alexa에 등록·접속된 상태는 아니다.

## 지난 버전에서 바뀐 점

| v0.2 | v0.3 |
|---|---|
| 브라우저 UI와 탭 안의 예약 상태 | MCP 서버 + SQLite에 초안, 승인, 실행 상태 보관 |
| 브라우저 전용 예약 원본 호출 | 서버의 Easy!Appointments 1.6.0 어댑터 |
| 독립 HTML 시뮬레이션 | 별도 시뮬레이션은 유지, 신규 MCP Apps 리소스 추가 |
| 단일 탭 중복 전송 방지 | 동일 초안은 서버 트랜잭션으로 한번 실행; 불확실하면 재전송 금지 |
| Alexa+를 흉내 낸 UX | Alexa+ Add-on이 붙을 MCP 2025-11-25 Streamable HTTP 프로토콜 구현 |

중요: v0.2의 `ui/connected.html`과 새 MCP 서버는 사용자/상태를 공유하지 않는다. 지금 시연할 MCP 중심 경로는 `create_booking_draft → MCP Apps 화면 → /review → complete_booking → 원본 확인`이다.

## 바로 실행할 파일

- `README.md` : 설치, 실행, 로컬 테스트, 경계.
- `docs/ALEXA_INTEGRATION.md` : 공식 링크와 실제 Alexa 연동 선결 조건.
- `docs/DEMO_v0.3.md` : 영상 흐름과 심사용 설명.
- `bridge/server.py` : 여섯 개 MCP 도구, OAuth 토큰 검증, UI 리소스, 검토 페이지.
- `bridge/core.py` : 영속화된 초안, 승인·재확인·실행 상태 전이.
- `bridge/source.py` : 원본 예약 서버의 카탈로그, 슬롯, 등록 및 원본 기록 확인.
- `bridge/app/dist/booking.html` : MCP Apps HTML 번들; 호스트가 로드한다.
- `scripts/start_bridge.py`와 `scripts/probe_mcp.py` : 로컬 시작 및 예약하지 않는 프로토콜 검사.
- `evidence/release-checks.json` : 실제로 실행한 검증과 미검증 범위.

## 검증 상태

직접 실행한 테스트: JavaScript 35개, MCP/예약 엔진·HTTP·JWT Python 27개, 기존 플래너 Python 10개. MCP HTTP 테스트에서 실제 SDK 서버를 루프백으로 띄워 `initialize(2025-11-25)`, 도구/리소스 발견, 초안 작성, 웹 검토 승인, 한 차례 원본 fixture 등록, 재호출 결과를 확인한다. 예약 원본은 **테스트 더블**이다. 실제 Alexa·OAuth 서버·Easy!Appointments Docker 컨테이너·브라우저 시각/음성 실험은 아직 확인하지 않았다.

`python scripts/verify_local.py`가 검사 결과를 갱신한다. `npm --prefix bridge/app ci && npm --prefix bridge/app run build`로 앱 번들을 다시 만들 수 있다.

## 해커톤 준비 우선순위

1. Docker 가능한 PC에서 `start_demo.py`, `start_bridge.py`, `probe_mcp.py --source` 순으로 실행하고, 합성 연락처로 원본 레코드까지 실제 예약해 화면/DB 결과를 기록한다.
2. Alexa 개발환경 접근 자격을 확인한다. Amazon 문서는 MCP Toolkit의 미국 제공을 명시한다. 실제 Add-on 등록을 원한다면 공개 HTTPS, OAuth AS, 계정 연결 및 Web Simulator가 필요하다. 접근이 없다면 공식 규칙에 허용된 자체 호스팅 MCP 경로와 웹 시뮬레이션 경로 중 실제 재현 가능한 것을 영상과 설명에 맞춰 선택한다.
3. 영어 설명·스크린 레코딩 3분 미만, GitHub 코드 저장소, 테스트 방법, 제품 피드백을 준비한다. 기존 프로젝트에서 바뀐 MCP 서버와 검증 장치를 구체적으로 보여준다. 실제 Alexa 연결을 테스트하지 않았다면 문구를 **“Alexa+ integration candidate / MCP-powered booking prototype”** 수준으로 제한한다.
4. 심사위원이 따라 할 수 있도록 Docker 설정, 합성 연락처, 실행 명령을 저장소에 제공하되 로컬 토큰·AWS 자격·실제 이용자 데이터는 넣지 않는다.

## 개인 배경과 메시지

사용자는 서비스 기획/데이터 분석 배경을 가진 해커톤 참여자다. 피치는 복잡한 기술부터 설명하기보다 **예약을 도와주더라도 약관·가격·시간을 틀리게 이해하거나 중복으로 접수하면 안 된다**는 문제에서 시작한다. 핵심 장면은 (1) 음성으로 조건 전달, (2) 큰 글씨의 예약 내용, (3) 사람 확인, (4) 원본 기록이 맞을 때만 성공 표시다. 현재 음성/실기기 부분은 사용 가능한 시뮬레이터 또는 확보된 Alexa 접근으로 확인해 표시해야 한다.

원본 ZIP은 unchanged `upstream.zip` SHA256 `299f8da75583ea185992ece4ac0b10e98f673825edbf75116446d99001911e60`. 프로젝트 통합 코드는 GPL-3.0, 추가 UI 의존성 라이선스는 `bridge/app/dist/THIRD_PARTY_NOTICES.md`.
