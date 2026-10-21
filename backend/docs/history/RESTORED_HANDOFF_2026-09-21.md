# EasyLayer — Amazon Build, Ship, Shape / Alexa+ 프로젝트 복원·인수인계

작성일: 2026-09-21  
대상 대회: **Build, Ship, Shape: Amazon Developer Hackathon**  
트랙: **Alexa+ / Simulated Alexa+ Experience**  
프로젝트명: **EasyLayer**

---

## 0. 이 문서의 목적

이 문서는 2026년 9월 11일~13일 사이 진행했던 Amazon Build, Ship, Shape 해커톤의 **EasyLayer 프로젝트를 다시 이어서 개발할 수 있도록** 기존 기획·리서치·구현 파일과 현재 상태를 한 문서로 복원한 인수인계본이다.

핵심 원칙은 다음과 같다.

1. 가장 최신 구현 기준은 `EasyLayer_Connected_Update.zip`이다.
2. `EasyLayer_Competition_Preparation_v3.md`는 기획·심사 대응·데모·검증 계획의 기준 문서다.
3. `simulated_alexa_plus_hackathon_research.md`는 대회 자체와 Alexa+ 트랙 규칙을 조사한 기준 자료다.
4. 초기 기획 문서에는 아직 구현되지 않았던 내용이 포함되어 있으므로, **실제 구현 여부는 최신 ZIP의 README와 evidence 파일을 우선한다.**
5. 현재 상태는 “기획만 있는 상태”가 아니다. 9월 13일 기준 **Easy!Appointments 연결 코드, Bedrock planner 연결 코드, 오프라인 시뮬레이션, 테스트 코드까지 구현**되어 있다. 다만 Docker 기반 실제 E2E, 실제 예약, 실제 Bedrock 호출, 브라우저/접근성 검증은 아직 남아 있다.

---

# 1. 대회 정체

## 1.1 정확한 대회명

**Build, Ship, Shape: Amazon Developer Hackathon**

“Simulated Alexa+ 해커톤”은 별도 독립 대회가 아니라 이 대회의 **Alexa+ 트랙 내 허용된 제출 경로**다.

기존 조사 문서 기준:

- 글로벌 온라인 해커톤
- 플랫폼: Devpost
- 제출 기간: 2026-08-31 ~ 2026-10-23 12:00 PM PDT
- 한국시간 기준 마감: **2026-10-24 04:00 KST**
- Alexa+ 트랙은 실제 MCP/Agent Skill 외에도 **Simulated Alexa+ Experience**를 허용
- Simulated 경로는 실제 Alexa+ 디바이스나 공식 Alexa+ 런타임 연결 없이 웹 앱으로 agentic experience를 시연할 수 있는 대안 경로

제출 직전에는 반드시 공식 규칙의 최신 상태를 다시 확인해야 한다.

---

# 2. 프로젝트 한 줄 정의

> **EasyLayer turns complex web tasks into clear choices people can hear, review, and act on.**

한국어 정의:

> **사용자가 원하는 일을 말하거나 화면에서 선택하면, 복잡한 웹 업무를 필요한 결정 단위로 정리하고, 음성·터치·텍스트로 검토·수정·실행하며 실제 결과까지 확인하는 conversational display layer.**

EasyLayer는 단순 챗봇이나 원본 웹사이트 확대 UI가 아니다.

핵심은:

**목적 이해 → 중요한 결정만 추출 → 사용자가 확인 → 원본 서비스에 실행 → 실제 결과 재검증 → 실패 시 복구**

이다.

---

# 3. 해결하려던 문제

기존 웹 업무는 사용자가 실제 목적보다 인터페이스 자체를 이해하는 데 많은 노력을 요구한다.

예:

- 서비스 카테고리 찾기
- 가능한 날짜/시간 비교
- 담당자 확인
- 이름·이메일 등 필수 정보 입력
- 예약 실패 시 다시 탐색
- 내가 무엇을 확정했는지 확인
- 실제 접수가 됐는지 검증

EasyLayer는 이 과정을 **“결정 가능한 작은 단위”**로 바꾼다.

---

# 4. 타깃 사용자

초기 1차 타깃:

- 복잡한 디지털 절차에 부담을 느끼는 고령 사용자
- 디지털 숙련도가 낮은 사용자
- 음성 인터페이스를 선호하는 사용자
- 말을 하기 어렵거나 마이크를 사용하고 싶지 않은 사용자

중요한 설계 원칙:

- **Alexa+ 음성 경험이 기본**
- 화면은 단순 장식이 아니라 “다시 볼 수 있는 결정 정보”
- 화면만으로도 시작 → 선택 → 수정 → 오류 복구 → 최종 확정까지 가능해야 함
- 음성·터치·텍스트는 **동일한 task state** 공유
- 방식 전환 시 입력값을 잃지 않음

---

# 5. 핵심 UX

## 5.1 음성만으로 좋은 순간

- “사진 수업 예약하고 싶어.”
- “화요일 오전으로 해줘.”
- “시간만 바꿔줘.”
- “다시 읽어줘.”

## 5.2 화면이 필요한 순간

- 여러 시간 비교
- 가격/담당자/날짜 다시 확인
- 선택한 항목 수정
- 최종 제출 전에 검토
- 오류 발생 후 대안 선택

## 5.3 화면의 역할

화면은 대화 자막이 아니다.

계속 남겨둘 정보:

- 현재 선택한 서비스
- 담당자
- 날짜/시간
- 가격(원본에서 실제 확인되는 경우만)
- 제출될 개인정보
- 현재 단계
- 변경된 조건
- 최종 검증 결과

---

# 6. 메인 데모 시나리오

주력 원본 서비스:

**Easy!Appointments 1.6.0**

가상의 지역센터 예약 환경을 구성해 다음 흐름을 보여주도록 설계했다.

### 정상 흐름

1. 사용자: “사진 수업을 예약하고 싶어.”
2. EasyLayer가 가능한 서비스 탐색
3. 사진 관련 서비스를 선택
4. 가능한 담당자/시간 조회
5. 사용자에게 핵심 후보만 제공
6. 사용자가 선택
7. 이름/연락처 등 원본이 요구하는 정보 입력
8. 최종 내용 검토
9. 사용자 승인
10. 실제 원본 예약 요청
11. 원본 예약 레코드 재조회
12. 예약 ID·서비스·담당자·시작시간 일치 확인 후에만 성공 표시

### 실패 복구 흐름

선택했던 시간이 다른 세션에서 먼저 예약되었을 때:

1. 기존 승인 무효화
2. 성공으로 표시하지 않음
3. 가능한 새 시간 재조회
4. 대안 제시
5. 사용자가 새 시간 선택
6. 다시 승인
7. 제출
8. 원본 레코드 확인
9. 성공 표시

이 복구 흐름이 EasyLayer의 핵심 경쟁력 중 하나다.

---

# 7. 구현 아키텍처

초기 기획의 구조:

```text
User
  ↓
Voice / Text / Touch
  ↓
Intent / Decision Planner
  ↓
Structured Decision Model
  ↓
Policy / Approval Check
  ↓
Voice + Display Renderer
  ↓
Source Adapter / Executor
  ↓
Original Website
  ↓
State Verification
  ↓
Success / Recovery / Unknown
```

구성 요소:

### 7.1 Source Adapter

현재 최신 구현에서는 범용 DOM Agent보다 **Easy!Appointments 1.6.0 전용 native HTTP adapter**로 현실화되었다.

주요 기능:

- 원본 예약 페이지에 포함된 JSON 파싱
- 원본 service/provider ID 사용
- CSRF token 사용
- same-origin fetch
- 실제 available hours endpoint 호출
- 원본 duration 기반 종료시간 생성
- 등록 요청
- 등록 후 원본 record 재조회 및 값 비교

### 7.2 Bedrock Planner

역할:

- 사용자의 자연어 요청을 서비스 선택 의도로 변환
- 현재 실제 catalog 안에 존재하는 서비스만 선택
- 모호하면 clarification 요청
- planner 자체는 예약 제출 권한 없음

Production planner는 Boto3 Converse를 호출하도록 구현되어 있다.

### 7.3 Deterministic Logic

LLM에 맡기지 않는 부분:

- 서비스 ID 검증
- CSRF
- 필수 입력 검증
- 승인 revision
- 예약 전 availability 재조회
- 결과 verification
- 중복 제출 방지
- 원본 record mismatch 확인

### 7.4 UI

- 영어 기본
- 한국어 전환 가능
- 음성 인식은 editable text 입력으로 변환
- AI 없이도 버튼으로 전 과정 진행 가능
- 입력 수정 시 기존 approval 무효화
- 연락처 값은 유지하면서 서비스/시간 수정 가능
- 원본 서비스 label은 그대로 표시

---

# 8. 2026-09-13 기준 실제 구현 상태

가장 최신 파일:

**`EasyLayer_Connected_Update.zip`**

ZIP 내부 기준 프로젝트 폴더:

```text
EasyLayer_Source_Bootstrap/
```

## 구현된 것

### 원본 연동

- Easy!Appointments 1.6.0 upstream ZIP 포함
- 원본 ZIP SHA256 검증
- self-hosted source 연결 구조 작성
- 서비스 목록 읽기
- 가격 읽기
- provider 읽기
- 필수 contact field 읽기
- available hours endpoint 연결
- registration request 생성
- registration 이후 record verification 로직
- CSRF 처리
- 원본 duration 사용

### 소비자 UI

- Connected prototype
- Offline interaction simulation
- 영어 기본
- 한국어 전환
- 서비스/시간 선택
- 연락처 입력
- review/approval
- approval invalidation
- error/recovery UI
- speech recognition → editable request
- 버튼 기반 non-AI fallback

### Bedrock

- server-side planner 코드 구현
- Boto3 Converse 호출 구조
- frontend credential 미노출
- model output이 존재하지 않는 service ID를 선택하면 거부
- planner가 예약 제출을 시도하면 거부
- clarification 분기

### 안전/신뢰

- 서버 응답에 booking ID가 있다고 즉시 성공 표시하지 않음
- 원본 reschedule record를 다시 읽어:
  - booking ID
  - service
  - provider
  - start time
  를 확인한 후 성공 처리
- 결과가 불명확한 경우 재제출 잠금
- 같은 요청을 중복 실행하지 않도록 방지
- contact 정보가 receipt에 들어가지 않도록 테스트

---

# 9. 실행된 테스트

`EasyLayer_Connected_Update.zip`의 README 기준:

## JavaScript

**14개 테스트 통과**

대상:

- state transition
- source JSON parsing
- request construction
- CSRF failure
- duration handling
- record mismatch rejection
- time 변경 후 approval invalidation
- double submit 방지
- full slot 복구
- lost response 복구 simulation
- confirmation evidence 부재 시 success 금지
- 필수 field validation
- service 변경 후 contact 유지
- receipt의 개인정보 제거

## Python planner

**4개 테스트 통과**

fake model client를 사용하여:

- valid service selection
- invented ID rejection
- submission attempt rejection
- clarification

검증.

## 기타

- JavaScript syntax 검사
- PHP proxy syntax 검사
- Python syntax 검사
- Shell syntax 검사
- YAML parse 검사
- upstream ZIP hash 검증
- PHP execution 확인

---

# 10. 아직 검증되지 않은 것

이 부분이 현재 프로젝트의 가장 중요한 TODO다.

## 10.1 Docker E2E

현재 작업 환경에 Docker가 없어:

```bash
docker compose up -d --build
```

실행이 완료되지 않았다.

`evidence/docker-gate.json`에는:

- status: blocked
- passed: false
- reason: docker executable unavailable

로 남아 있다.

또한 이전 unpacked 환경에서 MariaDB 초기화 중:

`ddl_recovery.log fsync errno 5`

문제가 발생한 기록이 있다.

따라서 아직 **실제 live stack 성공**을 주장하면 안 된다.

---

## 10.2 실제 예약

아직 실제 브라우저에서:

- Easy!Appointments 로드
- service 선택
- 시간 조회
- 입력
- 등록
- 원본 record 재조회

의 전체 E2E 성공을 검증하지 않았다.

즉:

**Connected code exists ≠ live reservation proven**

---

## 10.3 실제 Bedrock

아직:

- AWS credential 설정
- 실제 model access
- Converse 실제 호출
- latency
- token
- 비용
- error rate

을 검증하지 않았다.

Production code에는 Bedrock 연동이 있으나, 테스트는 fake client 기반이다.

---

## 10.4 Browser / Accessibility

미검증:

- 실제 Chrome UI
- SpeechRecognition
- visual check
- NVDA
- VoiceOver
- keyboard focus
- 실제 microphone permission 거절 상태의 전체 flow

따라서 접근성 인증이나 실제 사용자 접근성 효과를 주장하면 안 된다.

---

# 11. 알려진 현재 한계

1. 범용 웹 agent가 아니다.
2. Easy!Appointments 1.6.0용 adapter가 중심이다.
3. arbitrary SPA 지원은 구현되지 않았다.
4. CAPTCHA는 우회하지 않는다.
5. terms/privacy consent는 원본 UI로 handoff한다.
6. authentication handoff + state restore는 pending.
7. cancellation terms extraction 미구현.
8. lost response 상황에서 관리 hash가 없으면 자동 lookup이 제한된다.
9. durable submission ledger 없음.
10. reload-proof idempotency 없음.
11. browser speech는 브라우저별 지원 차이가 있다.
12. 실제 Alexa runtime 연동이 아니다.
13. secondary LimeSurvey 연결은 최종 최신 ZIP에서 핵심 구현이 아니다.
14. Docker image digest pinning은 아직 안 됨.

---

# 12. 파일 구조

최신 ZIP 내부는 다음 29개 파일로 구성된다.

```text
EasyLayer_Source_Bootstrap/
├── .dockerignore
├── .gitignore
├── Dockerfile
├── EasyLayer_Consumer_Preview.html
├── LICENSE
├── README.md
├── compose.yaml
├── upstream.zip
│
├── evidence/
│   ├── docker-gate.json
│   └── environment-status.json
│
├── planner/
│   ├── Dockerfile
│   ├── server.py
│   └── test_planner.py
│
├── scripts/
│   ├── build_preview.py
│   ├── check_source.py
│   ├── configure.php
│   ├── entrypoint.sh
│   ├── init_env.py
│   ├── inspect.php
│   └── seed.php
│
└── ui/
    ├── connected.html
    ├── connected.js
    ├── flow.js
    ├── flow.test.cjs
    ├── index.html
    ├── intent.php
    ├── source.js
    ├── source.test.cjs
    └── ui.js
```

---

# 13. 발견된 기존 프로젝트 파일

Library에서 확인된 EasyLayer 관련 핵심 파일:

## A. 최신 구현

### `EasyLayer_Connected_Update.zip`

생성: 2026-09-13

가장 중요한 최신 소스 패키지.

**앞으로 개발을 재개할 때 이 파일을 기준으로 시작한다.**

---

## B. 공모전 기획 기준서

### `EasyLayer_Competition_Preparation_v3.md`

생성: 2026-09-11

포함 내용:

- 제품 정의
- UX 원칙
- 타깃 사용자
- Easy!Appointments/LimeSurvey 후보 분석
- decision model
- permission/approval rules
- Bedrock 전략
- failure/recovery 테스트
- 사용자 관찰 계획
- 제출 설명 초안
- 7컷 데모 구조
- 심사위원 예상 Q&A
- 제출 체크리스트
- overclaim 방지 기준

주의:

이 파일은 9/11 시점 문서라 당시에는 구현을 “목표”로 기록했다.  
실제 구현 여부는 9/13 ZIP README가 우선이다.

---

## C. 대회 리서치

### `simulated_alexa_plus_hackathon_research.md`
### `simulated_alexa_plus_hackathon_research(1).md`

대회/트랙 조사 자료.

포함 내용:

- Build, Ship, Shape 구조
- Alexa+ 트랙
- MCP
- Agent Skill
- Simulated Alexa+ Experience
- 제출 요구사항
- 상금/일정
- 기술 선택 방향

`(1)`은 같은 내용의 후속 저장본으로 보이며, 기준 자료는 원본 파일 하나면 충분하다.

---

## D. 심층 리서치 아티팩트

### `‘Simulated Alexa+ 해커톤’ 심층 분석: Amazon Build, Ship, Shape의 Alexa+ 트랙`

Deep Research 결과물.

대회 규칙/기술 맥락을 상세히 조사한 원본 결과.

---

## E. 초기 정리본

### `붙여넣은 마크다운(1)(1).md`

9월 11일 당시 Alexa+ 조사/정리 과정에서 생성된 초기 작업 문서.

최종 기준은 위의 research MD와 Competition Preparation v3를 사용한다.

---

# 14. 과거에 언급됐던 파일명과 현재 위치 관계

과거 대화에서 다음 이름도 사용됐다.

- `EasyLayer_Source_Bootstrap.zip`
- `EasyLayer_Consumer_Preview.html`
- `EasyLayer_Consumer_Update.zip`
- `EasyLayer_Connected_Update.zip`

현재 Library에서 직접 확인되는 최종 묶음은:

**`EasyLayer_Connected_Update.zip`**

이며 이 ZIP 내부에:

- `EasyLayer_Source_Bootstrap/`
- `EasyLayer_Consumer_Preview.html`

등이 포함되어 있다.

따라서 **Connected Update ZIP 하나가 이전 bootstrap/consumer 단계의 결과를 통합한 최신 패키지**로 보는 것이 맞다.

---

# 15. 파일 우선순위

앞으로 혼동 방지를 위해 다음 순서로 사용한다.

### Source of Truth

1. **`EasyLayer_Connected_Update.zip`**
   - 실제 코드/README/evidence

2. **`EasyLayer_Competition_Preparation_v3.md`**
   - 제품/심사/데모/검증 설계

3. **`simulated_alexa_plus_hackathon_research.md`**
   - 대회 규칙/기술 리서치

4. Deep Research artifact
   - 참고 조사

5. 초기 붙여넣은 마크다운
   - 히스토리 참고

---

# 16. 개발 재개 방법

최신 ZIP 압축 해제 후:

```bash
cd EasyLayer_Source_Bootstrap
```

## 16.1 기본 테스트

```bash
node --test ui/flow.test.cjs ui/source.test.cjs
python -m unittest discover -s planner -p 'test_*.py'
node --check ui/ui.js
node --check ui/connected.js
python scripts/build_preview.py
```

기존 기준:

- JS: 14 passed
- Python planner: 4 passed

---

## 16.2 Docker 환경

필요:

- Docker Compose
- Python 3

초기화:

```bash
python scripts/init_env.py
docker compose up -d --build
```

서버가 뜨면:

```bash
python scripts/check_source.py install
python scripts/check_source.py
```

접속:

```text
http://localhost:8080/easylayer-demo/connected.html
```

---

## 16.3 Bedrock

필요 환경변수:

```text
AWS_REGION
BEDROCK_MODEL_ID
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN
```

실행:

```bash
docker compose --profile ai up -d --build
```

planner 서비스는 외부 host port 없이 `ui/intent.php`를 통해 호출하도록 설계돼 있다.

---

# 17. 지금부터 해야 할 일 — 우선순위

## P0. Docker 실제 실행

목표:

- build 성공
- Easy!Appointments 실행
- seed 성공
- native check 성공

산출물:

- 실행 로그
- `native-check.json`
- 이미지 digest
- 원본 예약 화면 스크린샷

---

## P0. 실제 Connected E2E

반드시 직접 확인:

```text
서비스 로드
→ 담당자 로드
→ 시간 조회
→ 입력
→ 검토
→ 승인
→ 등록
→ 원본 record 재조회
→ verified success
```

성공 전에는 “실제 예약까지 작동한다”고 제출 설명에 쓰지 않는다.

---

## P0. 실제 Bedrock 호출

확인:

- 실제 Converse 성공
- 올바른 service selection
- 모호한 발화 clarification
- hallucinated ID reject
- latency
- token/cost

---

## P1. 브라우저 검증

- Chrome
- 모바일/태블릿 viewport
- 마이크 허용
- 마이크 거절
- speech recognition
- keyboard only
- 언어 전환
- error state
- double click

---

## P1. 실패 복구 데모 연결

Connected prototype에서 최소 하나의 실제 source failure를 만들 것.

가장 좋은 시나리오:

**예약 시간 경쟁 → 기존 시간 unavailable → approval invalidate → 대안 선택 → 재승인 → verified booking**

Offline simulation만 보여주고 실제 source recovery라고 주장하면 안 된다.

---

## P1. GitHub 정리

필요:

- 공개 repository
- README
- architecture
- setup
- screenshots
- demo GIF/video
- license
- upstream attribution
- evidence
- known limitations

절대 포함 금지:

- AWS credentials
- `.env`
- admin credentials
- 실제 개인정보

---

## P1. 3분 영어 데모

초기 목표는 약 **170초 / 7컷**이었다.

권장 흐름:

### Cut 1 — Problem
복잡한 예약 UI

### Cut 2 — Voice goal
“I want to book a beginner photography session.”

### Cut 3 — EasyLayer decision
서비스/시간을 명확한 카드로 제시

### Cut 4 — Review
선택 정보가 화면에 남아 있음

### Cut 5 — Failure
선택한 시간이 사라짐

### Cut 6 — Recovery
대안 제시 → 새 승인 → 실제 결과 확인

### Cut 7 — Value
“Same task, fewer interface decisions. Voice when it’s easy. Review when it matters.”

초기 기획에서는 secondary workflow까지 보여주는 안도 있었지만, 최신 구현 상태에서는 **주력 예약 workflow의 실제 E2E와 복구 완성도가 더 중요**하다.

---

# 18. 심사에서 강조할 차별점

## 18.1 단순 Voice UI가 아님

음성을 붙인 웹사이트가 아니라:

**voice → decision model → review → source action → verification**

구조.

## 18.2 사용자의 결정을 보호

- 중요한 선택은 자동 확정하지 않음
- 조건 변경 시 이전 승인 폐기
- 재승인 요구
- 성공을 서버 응답만 보고 단정하지 않음

## 18.3 결과까지 확인

대부분의 agent demo가 “버튼을 눌렀다”에서 끝나지만 EasyLayer는:

**원본 시스템의 실제 상태를 다시 읽고 성공 여부를 검증**

하는 방향.

## 18.4 Multimodal이 장식이 아님

음성:

- 빠르게 목적 표현

화면:

- 비교
- 재확인
- 수정
- 실패 복구

터치/텍스트:

- 말하지 못하거나 말하고 싶지 않은 사용자 대체 경로

---

# 19. 제출 시 절대 과장하지 말 것

현재 증거가 확보되기 전에는 다음 표현 금지:

- “Works on any website”
- “Fully accessible”
- “WCAG compliant”
- “Runs on Alexa+”
- “Alexa+ integrated”
- “Real Bedrock performance validated”
- “Live booking works end-to-end”
- “Universal browser agent”
- “Prevents all duplicate bookings”
- “Proven to help elderly users”
- “Production ready”

현재 정확한 표현:

> “A simulated Alexa+ conversational display prototype connected to a self-hosted Easy!Appointments workflow.”

실제 E2E 검증 후에는 표현을 강화할 수 있다.

---

# 20. 제출물 체크리스트

## 필수/핵심

- [ ] 프로젝트 설명
- [ ] 공개 GitHub repository
- [ ] 작동 데모
- [ ] 3분 미만 영어 영상
- [ ] 실제 코드
- [ ] Amazon/AI 사용 근거
- [ ] README 실행 방법
- [ ] 제품/API 관련 피드백
- [ ] limitations 명시

## EasyLayer 전용

- [ ] Docker E2E
- [ ] native reservation
- [ ] source record verification
- [ ] real Bedrock
- [ ] failure recovery
- [ ] microphone-off flow
- [ ] browser check
- [ ] screenshots
- [ ] architecture diagram
- [ ] demo script
- [ ] GitHub cleanup
- [ ] Devpost submission copy

---

# 21. 현재 프로젝트 상태 한 줄 평가

> **아이디어 단계는 이미 지났다. 현재는 “연결 코드와 안전 로직은 상당 부분 구현됐지만, 실제 Docker/Easy!Appointments/Bedrock 기반 E2E 증거를 아직 통과시키지 못한 프로토타입” 상태다.**

따라서 새 프로젝트를 시작할 필요가 없다.

가장 큰 다음 단계는:

**Docker 환경에서 최신 ZIP을 실행 → 실제 예약 E2E → 실제 Bedrock → 실제 실패 복구 → 영상**

순서다.

---

# 22. 다음 채팅에 그대로 붙일 인수인계 프롬프트

아래를 새 채팅 첫 메시지로 사용할 수 있다.

```text
Amazon Build, Ship, Shape 해커톤의 Alexa+ / Simulated Alexa+ 트랙에 제출할 EasyLayer 프로젝트를 이어서 개발한다.

프로젝트의 최신 기준 소스는 EasyLayer_Connected_Update.zip이다.
기획/심사 전략 기준은 EasyLayer_Competition_Preparation_v3.md,
대회 규칙 리서치는 simulated_alexa_plus_hackathon_research.md다.

EasyLayer는 사용자의 음성/텍스트/터치 요청을 중요한 결정으로 구조화하고, self-hosted Easy!Appointments 1.6.0에 실제 실행한 뒤 원본 record까지 다시 확인하는 conversational display layer다.

현재 구현:
- Easy!Appointments source adapter
- services/providers/contact fields parsing
- native availability request
- registration request
- source record verification
- approval invalidation
- duplicate submit blocking
- offline recovery simulation
- browser SpeechRecognition → editable text
- Bedrock Boto3 Converse planner
- JS 14 tests 통과
- planner 4 tests 통과

미완료:
- Docker live stack
- 실제 live reservation E2E
- 실제 Bedrock invocation
- 브라우저/음성/접근성 검증
- connected real-source failure recovery
- GitHub 공개 정리
- 3분 영어 데모 영상
- Devpost 제출

절대 구현되지 않은 것을 구현됐다고 가정하지 말고, README/evidence를 기준으로 현재 상태를 확인한 뒤 가장 먼저 Docker E2E 게이트부터 해결해라.
```

---

# 23. 최종 핵심 파일

개발 재개에 필요한 최소 세트:

```text
1. EasyLayer_Connected_Update.zip
2. EasyLayer_Competition_Preparation_v3.md
3. simulated_alexa_plus_hackathon_research.md
4. EasyLayer_Amazon_Build_Ship_Shape_프로젝트_복원_인수인계.md  ← 이 문서
```

이 네 개만 있으면 프로젝트의 **대회 맥락 + 제품 기획 + 실제 코드 + 현재 상태**를 거의 완전히 복원할 수 있다.
