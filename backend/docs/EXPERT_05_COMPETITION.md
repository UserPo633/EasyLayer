# EasyLayer 전문가 검토 5/5 — 해커톤 제품·심사 전략

검토 기준: 2026-09-30 KST. 기존 v0.3 인수인계와 ZIP의 README/DEMO를 읽었으며, 아래 현재 구현 평가는 해당 파일에 기록된 범위다. 이번 실행에서 테스트를 다시 통과했다는 뜻은 아니다. v0.4의 최종 검증 결과는 `evidence/release-checks.json` 및 개별 실행 기록을 우선한다.

## 가장 먼저 바꿀 결정

**제출 목표를 ‘실제 Alexa 계정 연결 확보’에서 ‘실제로 동작하는 MCP 예약 엔진을 자체 Alexa+ 시뮬레이터로 시연’으로 명확히 바꾼다.** 공식 FAQ는 해커톤 참가자가 제한된 Alexa+ Toolkit·CLI·Web Simulator 접근을 신청하거나 얻을 수 없다고 설명한다. 로컬 실행 가능한 공개 저장소와 영상도 심사에 충분하다고 명시한다.[2] 따라서 이 프로젝트에서 웹 화면은 정당한 시연·사용자 인터페이스다. 중요한 것은 그 화면이 같은 예약 상태와 실제 MCP 호출에 연결되는지다.

**‘사이트로 만드는 게 맞나요?’에 대한 수정 답변:** 이번 해커톤에서는 웹 시뮬레이터로 만드는 것이 맞다. MCP 서버는 실제 예약 상태와 실행을 담당하고, 웹 화면은 Alexa+에서 경험할 상호작용을 보여준다. 실제 Alexa 호출이 전제라고 했던 이전 로드맵은 공식 FAQ에 맞춰 수정한다.

v0.3의 구현 가치는 서버에 남아 있는 예약 상태와 실행 전 재검증이다. 하지만 `ui/connected.html`은 새로운 MCP 서버와 상태를 공유하지 않는다. 이 분리를 그대로 두고 각각의 좋은 기능을 한 영상에 이어 붙이면 하나의 제품으로 오해시키기 쉽다. **다음 개발의 최우선은 화면–대화–MCP–원본 예약을 한 경로로 묶는 것**이다.

## 제품을 한 문장으로 좁히기

> EasyLayer는 복잡한 예약 화면에서 막히는 사람이 말로 수업을 고르고, 큰 글씨로 내용을 확인하며, 예약이 실제로 접수됐는지까지 확인하도록 돕는다.

초기 대상은 ‘모든 고령층’처럼 넓게 잡지 않는다. 자신의 선호는 말로 표현할 수 있지만 작은 폼·선택 목록·다단계 화면에서 도움이 필요한 성인이라는 사용 상황으로 정의한다. 우선 한 기관의 수업 예약을 지원한다. 이 대상이 얼마나 많고 얼마나 자주 실패하는지는 아직 검증할 가설이다.

접근성 문제에 대한 주장도 구체화한다. 말로 말할 수 있어서 편할 수 있다는 가설, 날짜·시간·가격을 함께 읽고 볼 수 있어 잘못된 선택을 발견하기 쉽다는 가설, 중단 후 같은 초안으로 돌아가 처음부터 반복하지 않을 수 있다는 가설이다. 음성을 어려워하는 사용자도 있으므로 음성을 유일한 입력으로 강제하지 않는다.

## Why Alexa+

사용자의 문장을 검색 조건으로 옮기고, 이어지는 ‘좀 더 늦게’, ‘아까 보던 것’ 같은 요청을 같은 예약 문맥 안에서 처리하는 데 대화형 홈 인터페이스가 맞는다. 화면은 예약 사실을 고정해서 보여주고 음성은 선택·질문을 돕는다. 이 조합을 데모에서 보여줘야 Alexa+ 트랙과 연결된다.

‘Alexa로도 할 수 있다’는 설명만으로는 부족하다. 다음 세 장면이 차별점을 증명한다.

1. 원하는 수업·시간을 평소 말하듯 설명한다. 에이전트는 원본 카탈로그의 선택지로 답한다.
2. 잠시 중단했다가 돌아와도 자기 초안으로 이어간다. 저장되지 않은 대화 기억이나 URL에만 의존하지 않는다.
3. 접수 확인이 불확실하면 완료라고 말하거나 다시 접수하지 않는다. 확인할 수 있는 기록이 있으면 다시 읽고, 없으면 확인이 필요하다고 알린다.

v0.4 개발 범위에는 같은 출처의 웹 시뮬레이터에서 실제 MCP 엔드포인트 호출, 인증된 소유자의 초안 복귀, 미접수 초안 취소, 같은 소유자·같은 예약 대상의 중복 초안 방지가 포함된다. 완료 여부와 보장 범위는 최종 코드·테스트를 기준으로 확정한다. 음성이 한정 명령을 인식하는 기능이면 그 범위를 표시하며, 자유로운 생성형 대화로 설명하지 않는다. **실제 구현·테스트로 확인된 장면만 현재 기능으로 설명한다.**

## 공식 심사기준에 맞춘 개발 우선순위

공식 심사는 네 항목을 동일하게 평가한다. 공식 업데이트는 항목별 1~5점이라고 설명한다. 아래 25%는 동일 가중치를 비율로 표현한 값이며 추가 자체 배점을 만든 것이 아니다.[1][4]

| 공식 항목 | 비중 | v0.3에서 설명 가능한 근거 | 제출 전에 보강할 근거 |
|---|---:|---|---|
| 기술 구현 | 25% | 실제 로컬 MCP 통신 및 테스트용 원본을 이용한 상태 검증이 기록돼 있음 | 한 실행 경로의 원본 서비스 예약·재조회, 재현 명령, 오류 시 원본 등록 수 |
| 디자인 | 25% | MCP Apps 요약 화면과 별도 검토 화면 | 대화와 화면이 같은 상태를 사용함, 복귀·수정·실패 시 다음 행동이 명확함 |
| 잠재 영향 | 25% | 예약 폼의 어려움이라는 문제 가설 | 대상 사용자 관찰, 도움 요청·오선택·완료 여부 등 소규모 사용 실험 |
| 아이디어 품질 | 25% | 상태 보관과 확인 후 완료 처리 | 중단→복귀와 불확실한 접수 대응을 한 이야기로 보여주는 장면 |

공식 규칙은 단순 API 포장을 넘어 세션 간 문맥 유지, 시각 카드, MCP Apps 등의 활용을 창의적 예시로 제시한다.[1] 그렇다고 기능 개수를 늘리라는 뜻은 아니다. EasyLayer는 **한 건의 예약을 끝까지 책임지는 흐름**에 집중한다.

## 이번 MVP의 경계

- 한 기관, 한 원본 예약 서비스, 하나의 합성 연락처 계정으로 재현한다.
- 지원 기능: 원본 선택지 조회, 시간 선택, 초안 저장·복귀, 내용 검토, 사용자 승인, 접수 후 원본 확인.
- 지원할 수 있는 변경은 제출 전 초안 수정이다. 이미 완료된 예약 변경·취소는 별도 개발 전까지 원본 서비스 안내로 처리한다.
- 결제, 병원 예약, 보호자 대리 승인, 임의 웹사이트 자동화, 다기관 가격 비교, 임의 CAPTCHA 처리는 이번 범위에 넣지 않는다.
- 실제 Alexa 연결 여부, LLM 호출 여부, 원본이 실제 서비스인지 fixture인지 화면과 설명에서 구별한다.

### 경쟁력을 판단할 때 남겨 둘 비판

가이드형 선택 화면과 세 가지 음성 명령만 동작한다면 ‘일상적인 말로 예약을 끝낸다’는 경험은 아직 충분히 입증되지 않았다. 이번 버전의 개선은 화면과 실제 MCP 상태가 연결된다는 데 있다. 다음 우선순위는 실제 원본에서 한 건을 끝까지 확인한 뒤, ‘더 늦은 시간’, ‘아까 하던 예약’처럼 좁고 유용한 문맥 변경을 다루고, 이를 대상 사용자에게 관찰하는 것이다. 참가 요건 충족과 수상 경쟁력 확보는 같은 판단이 아니다.

일반적인 챗봇보다 낫다는 포괄적인 비교도 하지 않는다. 비교할 것은 같은 예약 과제에서 완료 여부, 오선택, 도움 요청, 승인 내용 이해와 중복 접수 여부다. 기존 예약 서비스의 강점은 원본 정보에 직접 접근한다는 점이며 EasyLayer는 그 원본을 계속 기준으로 삼아야 한다. 지원하는 서비스 한 곳의 어댑터를 구현했다는 근거로 모든 사이트에 붙는다고 주장하지 않는다.

다섯 전문가의 협업은 이번 개발과 검토 방식이다. 제품에 다섯 개의 AI 에이전트를 넣을 이유가 생겼다는 뜻은 아니다. 예약 작업에 필요한 최소한의 실행 구조와 검증을 선택한다.

## 킬러 데모 — ‘아까 하던 예약, 두 번 접수하지 않게’

**이것은 향후 전체 제품 촬영 계획이다. `DEMO_v0.4.md`도 실제 원본 E2E 통과 후 촬영할 리허설 계획이다. 현재 배포 화면에는 fixture 선택 기능이 없으며, fixture는 자동화 테스트에만 주입된다. 원본이 실행되지 않으면 예약 완료 화면을 현재 촬영할 수 없다.** 모든 연락처는 합성값이고 원본은 전용 테스트 인스턴스다. 자유로운 자연어 해석, 실제 원본 등록, 실패 복구 장면은 각각 실제로 구현·검증한 다음 포함한다.

| 시간 | 사용자에게 보이는 장면 | 뒤에서 증명할 것 |
|---|---|---|
| 0:00–0:15 | 작은 예약 폼에서 날짜·시간을 다시 확인해야 하는 상황과 EasyLayer 한 문장 | 대상 문제를 과장 없이 설명 |
| 0:15–0:45 | “화요일 오후 도예 수업을 찾고 싶어요.” → 실제 원본에서 가능한 선택지 두세 개 | 카탈로그·시간 조회의 실제 MCP 호출 |
| 0:45–1:05 | 중단 후 “아까 하던 예약 이어서 할게요.” → 같은 초안과 큰 글씨 요약 | 서버의 같은 사용자·초안 상태 복원 |
| 1:05–1:30 | 날짜·시간·기관·가격을 읽고 검토 화면에서 승인 | 승인은 접수 완료와 구별됨 |
| 1:30–2:05 | 접수 후 확인 응답이 늦어진 상황에서 “다시 해줘.” | 같은 초안의 반복 호출이 새 등록을 만들지 않음 |
| 2:05–2:30 | 알려진 원본 기록을 재조회해 결과 확인, 원본 예약 수 함께 표시 | 검증 가능할 때만 완료 표시. 기록 식별자도 잃은 경우에는 확인 필요 상태 유지 |
| 2:30–2:50 | 구현 구조와 현재 지원 범위를 짧게 보여줌 | 자체 Alexa+ 시뮬레이션, MCP 백엔드, 실제 원본/테스트 원본을 명확히 표기 |

확인 지연을 의도적으로 주입했다면 영상에 ‘실패 상황 재현’이라고 표시한다. 실제로 실패하지 않은 영상을 편집해 시스템이 스스로 복구한 것처럼 구성하지 않는다. 기능이 아직 없다면 0:45 복귀나 1:30 실패 복구를 주장하지 않고, 정상 흐름과 이미 검증한 재호출 동작만 촬영한다.

## 사용성 근거를 만드는 가장 작은 실험

5명 안팎의 탐색 실험을 제안한다. 표본은 대표성이나 통계적 우월성을 주장하기 위한 것이 아니다. 예약 폼에서 도움이 필요한 참여자를 실제로 모집하고, 표준 원본 폼과 EasyLayer에서 비슷하지만 다른 두 예약 과제를 수행하도록 한다. 절반은 원본부터, 나머지는 EasyLayer부터 시작해 익숙해짐의 영향을 줄인다.

측정은 완료 여부, 날짜·시간·가격 오선택, 진행 중 도움 요청 횟수, 승인 전 내용을 정확히 다시 말할 수 있는지, 소요 시간, 인터페이스 선호 이유로 제한한다. ‘30% 빠름’ 같은 수치는 실제 결과가 나올 때만 쓰고, 참여자별 원자료와 실패 사례도 함께 보관한다. 원본보다 느리더라도 정확성이나 도움 요청이 개선됐는지 따로 해석한다.

기술 검증은 사용성 실험과 섞지 않는다. 자동 테스트 통과 수는 사람이 편하게 쓴 증거가 아니다. 실제 원본 등록 성공도 대규모 안전성의 증거가 아니다.

## 제출물과 피드백

기본 제출은 영어 3분 미만 공개 영상, 기능 설명, GitHub 소스와 실행 안내, 사용 도구에 대한 제품 피드백으로 준비한다.[3] 공개 저장소에는 라이선스를 포함하고, 실제로 공개하지 않았다면 공개됐다고 쓰지 않는다. 현재 로컬 재현이 가능하면 호스팅이 별도 필수조건은 아니다.[2]

제품 피드백에는 직접 사용한 MCP SDK·MCP Apps·원본 어댑터의 설정 과정과 오류만 쓴다. 아직 호출하지 않은 Bedrock이나 접근할 수 없는 Alexa Toolkit을 사용한 것처럼 쓰지 않는다. 실제 재현한 불편은 시도한 일, 단계, 기대/실제 결과, 심각도, 우회 방법, 개선 제안과 함께 friction log로 남긴다. 가산점은 최대 10%이며 자동 지급을 기대하지 않는다.[1]

이번에 기록할 수 있는 문서 경험 후보는 ‘일반 Alexa+ 설정 가이드의 경로를 따라가려 했지만 해커톤 FAQ를 확인하니 참가자 접근이 불가능함을 알게 됨’이다. 직접 관찰한 문서 URL·확인일·설계 변경을 첨부하고, 실제 계정 신청이나 거절을 경험하지 않았다면 그런 내용을 만들지 않는다.

## 영어 제출 초안 — 구현 상태에 맞춰 확정할 것

### Short description

EasyLayer helps people complete a class booking through guided interaction, a readable review, and verification against the original booking service.

### Problem and approach

Knowing which class you want is different from navigating a booking form. EasyLayer explores a conversational route for adults who can describe their preferences but need help with small controls and multi-step forms. It reads a supported service's actual catalog and availability, keeps a booking draft on the server, and presents the date, time, provider and price for review. Submission and confirmation are distinct states: the assistant reports success only when the original record can be verified.

### Technical scope

The project provides a self-hosted MCP booking backend and an Alexa+ experience simulated through our own interface. It is not connected to Amazon's production Alexa backend. The supplied adapter targets Easy!Appointments. A repeated call for the same retained draft does not blindly create another appointment. The v0.4 release also targets same-owner, same-target duplicate-draft prevention. The final build and recorded checks define that boundary; it is not universal duplicate detection across booking systems or separate databases. The final submission will identify which end-to-end checks used the real source and which used controlled fixtures.

### Why Alexa+

Conversation is useful for saying what you want and refining it without repeatedly navigating a form. A visual summary keeps the facts available for review. The proposed experience combines those strengths around a single completed task, including interruption and recovery. We will describe only the resume and recovery behavior demonstrated by the final build.

## 출처

공식 페이지 검색 본문을 2026-09-30 KST에 확인했다. 직접 `open`은 제한 오류였으므로 성공한 검색 본문을 근거로 사용했다. 아래 출처의 규칙 요약은 핵심만 압축했다.

1. [공식 규칙](https://amazonappdev2026.devpost.com/rules) — MCP 조건, 심사, 가산점.
2. [공식 FAQ](https://amazonappdev2026.devpost.com/details/faqs) — 제한 도구 접근 불가, 로컬 저장소 시연 허용.
3. [공식 개요](https://amazonappdev2026.devpost.com/) — 제출물.
4. [주최자 심사 안내](https://amazonappdev2026.devpost.com/updates/46456-got-an-idea) — 네 항목 1~5점 동일 가중치.
5. [주최자 시뮬레이션 답변](https://amazonappdev2026.devpost.com/forum_topics/45058-clarification-on-simulated-alexa-web-experience-requirements) — 자체 UI·실제 백엔드 조합 가능, 음성 필수 아님.

이 문서는 제품·심사 의사결정 문서다. 실제 사용자 조사, 배포, 접수, 영상 촬영 완료를 의미하지 않는다.
