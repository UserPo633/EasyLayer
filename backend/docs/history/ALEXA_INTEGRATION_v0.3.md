# EasyLayer의 Alexa+ 연결 설계 · 2026-09-24

## 선택한 구조

| 부분 | 역할 | 현재 구현 |
|---|---|---|
| Alexa+ | 사용자 음성 이해, 도구 선택, 음성·기기 화면 출력 | Amazon 환경 연결 후 확인 필요 |
| Alexa+ MCP Add-on | 서버의 도구·UI 리소스를 등록하고 Alexa+와 연결 | `alexa/addon.template.json` 초안만 준비 |
| EasyLayer MCP 서버 | 수업·시간 조회, 예약 초안, 원본 등록과 검증 | `bridge/server.py`, `/mcp`, 2025-11-25 HTTP 협상 테스트 통과 |
| MCP Apps 화면 | 도구 결과를 대화 내 시각 카드로 표시 | `ui://easylayer/booking.html` 리소스와 번들, 실제 호스트 렌더링 미검증 |
| 동반 검토 페이지 | 연락처 입력과 현재 예약 승인 | MCP 서버의 `/review/{id}`; 임시 UX, 웹 승인 필요 |
| Easy!Appointments | 실제 예약 원본 | 기존 Docker 1.6.0 패키지; 브리지와 실서버 예약은 미실행 |
| 기존 `ui/connected.html` | 별도의 브라우저 시뮬레이션·연구용 인터페이스 | 브리지의 예약 초안과 상태를 공유하지 않음 |

**결론:** Alexa를 목표로 할 때에는 서버와 Add-on 등록이 본체다. 별도 사이트는 검토·관리·시뮬레이션에 쓴다. 화면이 필요하면 MCP Apps 형식으로 Alexa의 대화 안에 붙인다. 호환 기기에 큰 글씨의 날짜·시간·선생님·가격을 표시하고 음성에는 선택지만 간결히 읽어주는 UX를 목표로 한다. Echo Show에서 현 UI가 그대로 표시된다는 주장은 아직 할 수 없다.

## 공식 문서와 해커톤 규칙

- [Amazon Alexa+ MCP Toolkit 개요](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html): Alexa+가 MCP 클라이언트로 원격 Streamable HTTP 서버를 호출하고, MCP Apps UI 리소스를 지원한다. Toolkit은 미국에서 제공된다고 명시돼 있다.
- [Amazon MCP QuickStart](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html): MCP 2025-11-25, 원격 URL, UI용 MCP Apps, OAuth authorization code + PKCE(S256), 서버 메타데이터, 테스트·CLI 절차를 명시한다. 서버 조회 지연 목표가 500ms 미만인데 현재 예약 원본 왕복은 측정하지 않았다.
- [Amazon MCP 인증](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-authentication.html) 및 [계정 연결](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html): 서비스 연결에 client credentials, 개인 예약에 authorization code + PKCE, audience=`/mcp`, scope 구분이 필요하다. 현재 문서상 OIDC 로그인 자체를 Alexa 연결 수단으로 지원한다고 가정하면 안 된다.
- [MCP Apps 규격](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx): UI는 `ui://` 리소스와 `text/html;profile=mcp-app`, 도구 `_meta.ui.resourceUri`로 연결한다.
- [해커톤 공식 규칙](https://amazonappdev2026.devpost.com/rules): Alexa+ 트랙은 작동하는 Agent Skill 또는 자체 호스팅 MCP 2025-11-25+ Streamable HTTP를 허용하며, 별도 경로로 AI 도구 기반 Alexa+ 웹 시뮬레이션도 허용한다. 영상은 3분 미만으로 실제 동작을 보여야 하며, GitHub 저장소와 제품 피드백이 필요하다. 기존 프로젝트라면 해커톤 기간 중 의미 있는 업데이트를 설명한다. 마감 2026-10-23 12:00 PDT = 한국시간 2026-10-24 04:00 KST.

참고: Amazon 공개 페이지의 개발자 접근 자격과 국가별 지원 여부는 해커톤의 **시뮬레이션 제출 허용** 여부와 별개다. Alexa+ 개발 계정/선발·미국 제공 여부를 확인하기 전까지 실기기 연결 성공을 주장하지 않는다. 실제 계정 접근이 안 되더라도 주최 측 규칙에는 자체 호스팅 MCP 경로와 시뮬레이션 경로가 있다. 어느 쪽을 시연하든 설명·영상·코드를 같은 경로로 맞춘다.

## 로컬 연결 재현

프로젝트 루트에서:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r bridge/requirements.txt
python scripts/start_demo.py
python scripts/start_bridge.py
```

Windows라면 가상환경 활성화는 `.venv\Scripts\Activate.ps1`. 소스는 Docker가 있는 기기에서 실행해야 한다. `start_demo.py` 후에 두 번째 명령을 별도 터미널에서 실행한다.

다른 터미널에서 `python scripts/probe_mcp.py --source`로 MCP 초기화, 도구 목록, UI 리소스와 원본 카탈로그 조회를 검사한다. `--source` 없이 실행하면 원본 요청 없이 MCP만 읽는다. 기본 엔드포인트는 `http://127.0.0.1:8092/mcp`. 로컬 토큰은 `.local/mcp-token`, 초안 DB는 `.local/bridge.sqlite3`이며 ZIP에 넣지 않는다.

실제 예약 확인은 별도 테스트 인스턴스에서 **합성 연락처로** 진행한다. 수업 목록 → 제공자 및 시간 조회 → `create_booking_draft` → 동반 검토 페이지에서 확인·승인 → `complete_booking` → `verified=true` 와 원본 레코드를 대조한다. 실패/불확실 상태일 때 동일 초안으로 재전송을 시도하지 않고 `verify_booking` 또는 원본 관리자 화면에서 확인한다.

## Alexa+ Add-on 연결의 남은 단계

1. 본인이 가진 Alexa 개발자 계정에서 MCP Toolkit과 Web Simulator 접근 권한 및 US 지역 제한을 확인한다. 실제 접근이 확보된 경우에만 진행한다.
2. 소스를 HTTPS로 배포하고 실원본 예약을 검증한다. SQLite 파일을 영구 저장소에 두고, 다중 인스턴스 확장 전 단일 작성자/공유 트랜잭션 설계를 확정한다. 브리지의 로컬 토큰 모드는 외부 노출을 거부한다.
3. 실제 OAuth 인증 서버를 준비한다. `/.well-known/oauth-authorization-server` 메타데이터에 `client_credentials`, `authorization_code`, `code_challenge_methods_supported: ["S256"]` 등을 검증한다. 사용자 토큰은 `mcp:tools`와 `easylayer:booking`, 서비스용 토큰은 `mcp:service`만 부여한다. 브리지는 `EASYLAYER_AUTH_MODE=oauth`, `EASYLAYER_OAUTH_ISSUER`, `EASYLAYER_OAUTH_JWKS_URL`, `EASYLAYER_PUBLIC_URL=https://...`, `EASYLAYER_BIND=0.0.0.0` 설정으로 검증한다. 코드의 JWT 검증은 인가 서버 구현을 대신하지 않는다.
4. `alexa-ai new mcp --name "EasyLayer" --locale en-US --mcp-server-url "https://<실제도메인>/mcp"`로 공식 CLI 프로젝트를 만들고, `alexa/addon.template.json`을 참고해 실제 개인정보처리방침·이용약관·아이콘 6종·캐러셀 이미지를 채운다. 템플릿 URL은 모두 무효 값이며 그대로 배포하면 안 된다.
5. CLI의 인증/배포 개발 단계에서 도구와 UI 리소스를 introspection한다. `alexa-ai deploy` 후 Web Simulator와 접근 가능한 실제 기기로 음성 결과, 큰 글씨, UI의 승인/링크 동작을 검증한다. 공식 가이드의 계정 연결·정책·인증·지연 조건을 점검한다. 도구 구성이 바뀌면 Add-on을 다시 배포한다.
6. Alexa 대화 안에서 연락처와 명시적 확인을 안전하게 전달할 수 있는 공식 UX를 설계한다. 현재 검토 링크는 핵심 데모용 임시 연결이다. Alexa의 native confirmation을 구현하지 않았으므로 시뮬레이션 영상이라면 분명히 표시한다.

## 안전한 설명 경계

- 단일 **예약 초안**에 대해 승인 전 POST 금지, POST 시작 전 DB `pending` 기록, 불확실 시 자동 재전송 금지를 구현했다. 각각 다른 초안으로 중복을 만드는 것까지 막는 범용 dedupe는 아니다.
- 원본 예약 등록의 응답을 받았더라도 원본 재조회가 맞지 않으면 성공이라고 말하지 않는다.
- MCP Apps HTML은 프로토콜로 제공된다. Alexa 호스트의 실제 렌더링, `openLink` 지원, 음성 톤과 터치 접근성은 테스트하지 않았다.
- 동반 검토 URL을 아는 클라이언트가 페이지를 호출할 수 있다. 현재 모델 도구에 승인 도구가 없지만, 브라우징 권한까지 가진 공격적인 에이전트를 사람으로부터 암호학적으로 구분하는 인증은 없다.
- CAPTCHA·추가 약관·인증 벽·필수 미지원 필드는 원본 사이트로 이동한다. 이용자 연락처와 원본 관리 해시의 보관·삭제 정책, 접근제어와 암호화는 실사용 전 보강해야 한다.
