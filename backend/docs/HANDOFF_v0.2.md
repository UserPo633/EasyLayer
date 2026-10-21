# EasyLayer v0.2 — 프로젝트 인수인계

업데이트: 2026-09-21 KST  
대회: Amazon Build, Ship, Shape / Alexa+ · Simulated Alexa+ 경로  
현재 소스: `EasyLayer_v0.2_Updated.zip`의 `EasyLayer_Source_Bootstrap/`

## 가장 먼저 알아야 할 상태

**이번 버전은 구현 코드와 로컬 테스트가 업데이트된 상태다. 실제 서버 예약·실제 Bedrock 호출·브라우저 시각/음성 검증은 아직 통과하지 않았다.**

- JavaScript: **32개 통과** — 기존/신규 상태·adapter·jsdom DOM 이벤트 테스트.
- Python: **10개 통과** — fake client 기반 planner 검증.
- JavaScript/Python 구문 검사 통과, Compose/workflow YAML 파싱 통과.
- 원본 `upstream.zip` SHA256 일치.
- Docker/PHP/MariaDB 없음. 패키지 설치는 환경의 사용자/그룹 권한 제한으로 실패.
- AWS region/model/인증 미설정. 실제 호출 없음.
- Cloud Browser는 로컬 file URL을 정책상 거절. 브라우저 화면/음성/접근성 실기 검증 없음.
- GitHub 업로드·공개·워크플로 실행·서버 배포·대회 등록·제출·영상 게시를 수행하지 않음.

## 제품 정의

사용자가 원하는 예약을 말하거나 입력하면 핵심 선택을 화면에 남기고, 직접 검토·수정·확정하도록 돕는 conversational display. 원본 Easy!Appointments에 실제 등록한 뒤 원본 기록을 다시 읽어 성공을 확인하는 구조다.

이번 주력 시나리오: **사진 수업 → 날짜/시간 선택 → 날짜 변경 → 최종 검토 → 시간 마감 → 대안 선택 → 새 확인 → 원본 예약 결과 검증.**

## v0.2에서 변경한 것

1. 원본의 HttpOnly 쿠키를 JS에서 읽으려던 CSRF 오류 수정. 원본 HTML의 `vars.csrf_token`을 사용한다. 보안 설정은 유지.
2. `ui/booking-session.js` 공통 상태 도입. 음성·텍스트·버튼이 같은 예약 상태를 변경.
3. Bedrock planner를 수업 선택에서 날짜·시간대·순번 선택·재질문·요약 요청으로 확장. LLM 제출 권한 없음.
4. 규칙 기반 기본 명령 모드. `Tuesday morning`, `목요일 오전으로 바꿔줘`, `내일`, `두 번째로`, 정확한 수업 이름 지원. AI와 구분해서 표시.
5. 브라우저 음성 출력·다시 읽기. 음성 입력은 전사 후 사용자가 확인하고 전송. 완전한 hands-free는 아님.
6. 확정 전 연락처까지 보여주는 최종 검토. 확인란 체크 후 버튼 또는 정확한 `confirm booking` / `예약 확정` 요청으로 확정.
7. 마감된 시간의 대안 재조회, 연락처 유지, 새 확인 요구.
8. POST 이전 sessionStorage pending marker. 같은 탭의 새로고침 후 재제출 잠금. 연락처는 저장 안 함. 탭 종료/다른 탭/서버 전체는 보장 안 함.
9. 수업 이름·가격·시간, 담당자·시간대, 필수 입력 변경 재검사. 미지원 필수 사용자 정의 필드는 원본으로 안내.
10. 화면·영한 전환·큰 글씨·고정 요약·요청 입력창 정리.
11. Docker 시작 도우미, 실제 원본 probe 개선, live E2E 코드, GitHub Actions 정의, Bedrock 실측 스크립트, 데모 대본 추가.

## 즉시 확인할 파일

- `EasyLayer_Conversation_Preview.html`: 최신 화면과 동작을 보는 단일 HTML. **가상 예약 / AI 호출 없음.** 일반 데스크톱 브라우저에서 열어본다.
- `ui/connected.html`: 실제 원본 서버에 연결하는 화면. 파일을 직접 여는 방식으로는 원본 연결이 작동하지 않는다.
- `README.md`: 설치·실행·검증 방법.
- `docs/UPDATE_2026-09-21.md`: 상세 변경/제약.
- `docs/DEMO_AND_SUBMISSION.md`: 약 170초 영어 데모 구성·사용자 관찰·일정.
- `evidence/release-checks.json`: 실제 실행한 로컬 검사 결과.
- `evidence/preflight.json`: 현재 환경 상태.
- `evidence/history/2026-09-13/`: 이전 실행 기록. 현재 실행 증거로 사용하지 않는다.

이전 `EasyLayer_Consumer_Preview.html`은 v0.1 시뮬레이션으로 보존했다. 최신 화면 기준은 `EasyLayer_Conversation_Preview.html`과 `ui/connected.html`이다.

## 다음 환경에서 실행

ZIP 압축 해제 후 `EasyLayer_Source_Bootstrap` 폴더에서:

```sh
python scripts/start_demo.py
```

필요: Docker Desktop/Compose, Python 3.10+. 원본 실행 화면:

```text
http://localhost:8080/easylayer-demo/connected.html
```

AWS가 없으면 `Basic commands · no AI` 또는 버튼으로 진행한다. 반드시 가상 연락처를 사용한다. 생성된 `.env`와 `.local-admin.json`은 공유하지 않는다.

실제 검증:

```sh
python scripts/check_source.py
npm ci
npx playwright install chromium
npm run test:live
```

`tests/live-e2e.cjs`는 별도 세션이 실제 시간을 선점하게 한 뒤, EasyLayer에서 복구→새 확인→실제 완료→DB 기록 확인을 검사하도록 작성했다. **작성된 테스트와 통과한 테스트를 혼동하지 않는다.**

AWS 환경변수와 해당 모델 접근 권한을 설정한 뒤:

```sh
python scripts/start_demo.py --ai
python -m pip install -r planner/requirements.txt
python scripts/benchmark_bedrock.py --run
```

키는 로컬 환경에만 설정하고 채팅·프런트엔드·저장소에 넣지 않는다. 실제 benchmark는 AWS 비용이 발생할 수 있으며 3개 가상 요청의 latency/token을 기록한다. 현재 결과 파일은 아직 없다.

로컬 재검사:

```sh
npm ci
python scripts/verify_local.py
```

## 제출 전 남은 일

1. 실제 Docker 빌드/원본 설치 완료.
2. 실제 예약·원본 record·DB 확인.
3. 실제 UI와 두 번째 세션의 시간 경쟁 복구 확인.
4. 실제 Bedrock 3개 요청 이상과 모호한 발화 재질문 확인.
5. 실제 마이크·TTS·마이크 거절·키보드·모바일 화면 점검.
6. 목표 사용자에 가까운 3~5명 관찰. 완료 여부·시간·도움 요청 기록.
7. 공개 저장소/실행 안내/사용 도구 피드백 준비.
8. 3분 미만 영어 영상 촬영·게시, 사용자 최종 제출.

9월 말 실제 예약, 10월 7일까지 대화 실기, 10월 14일까지 복구/사용자 관찰, 10월 21일까지 영상/제출물 완성을 목표로 한다.

## 대회 정보

2026-09-21 공식 페이지 확인 기준, 마감은 **2026-10-24 04:00 KST**. Simulated Alexa+ 웹 경험 경로가 허용된다. 코드·프로젝트 설명·3분 미만 영어 공개 영상·사용 도구 피드백 등이 필요하다. 제출 직전 다시 확인한다.

- [공식 대회 안내](https://amazonappdev2026.devpost.com/)
- [공식 규칙](https://amazonappdev2026.devpost.com/rules)

## 다음 작업용 프롬프트

> 첨부된 EasyLayer v0.2 ZIP을 기준으로 이어서 개발해라. README와 evidence/release-checks.json을 먼저 확인하고 미실행 테스트를 통과했다고 가정하지 마라. 다중 턴 UI, 공통 상태, CSRF 수정, 새로고침 보호, live E2E 정의까지 구현했다. 가장 먼저 Docker 가능한 환경에서 python scripts/start_demo.py → python scripts/check_source.py → npm run test:live를 실행해 실제 예약과 시간 경쟁 복구를 증명해라. 이후 AWS 설정으로 실제 Bedrock을 검증해라. 실제 예약 기록이나 model 응답 없이 시뮬레이션을 실연동으로 표시하지 마라.
