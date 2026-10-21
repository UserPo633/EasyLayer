# EasyLayer 데모·제출 준비

## 제품 설명

EasyLayer helps people complete a booking through clear, reviewable choices. A conversational display keeps the class, teacher, time and price visible while voice, text and touch share one task state. Before submission, the person reviews the details. If a slot disappears, EasyLayer preserves their information and asks for a new choice. It shows success only after checking the original booking record.

Status sentence to retain until live gates pass:

> This submission is being prepared as a simulated Alexa+ web experience. The current package includes source integration and Bedrock planner code; live source and model verification are pending.

## 약 170초 영어 데모 구성 — 실제 촬영 전 검증 필수

| 구간 | 화면 | 영어 설명 초안 |
|---|---|---|
| 0–15초 | 원본 예약 화면, 선택해야 할 항목 | “Booking a class should be about what you want to learn, not how well you can navigate a website.” |
| 15–40초 | EasyLayer, 사진 수업 요청 | “EasyLayer turns that task into a few clear choices you can speak, see, and change.” |
| 40–65초 | 날짜 선택 후 “Thursday morning instead” | “Voice, text and touch share the same task. Change the day without starting again.” |
| 65–90초 | 화면 요약, 연락처, 최종 검토 | “The important details stay visible. You review what will be sent, and you remain in control.” |
| 90–125초 | 별도 세션에서 시간 선점 → 실제 unavailable | “This slot was just taken. EasyLayer does not claim success. It keeps the details and offers a new choice.” |
| 125–150초 | 새 시간, 재확인, 원본 레코드 | “After a fresh confirmation, it completes the booking and checks the original record.” |
| 150–170초 | 검증된 완료 화면 | “A little guidance. A lot more independence. That is EasyLayer.” |

UI fixture의 `Simulate 10:00 taken`은 디자인 검토용이다. 실제 source 실패로 설명하거나 그 영상을 실제 연동 증거로 제출하지 않는다. 실제 실패는 다른 세션이 선택 시간을 선점하는 방식으로 촬영한다.

## 실제 사용자 관찰 — 3~5명

진행자는 답을 유도하지 않고 동일한 예약 목표를 준다. 기존 화면/EasyLayer의 순서를 바꿔 순서 효과를 줄인다.

| 관찰 항목 | 기록 방법 |
|---|---|
| 완료 여부 | 원본 기록 확인까지 완료했는가 |
| 시간 | 시작부터 검증된 완료까지 초 단위 |
| 도움 요청 | 진행자에게 물어본 횟수 |
| 수정 성공 | 날짜를 바꾼 뒤 기존 연락처가 유지되는가 |
| 결과 이해 | 무엇을 언제 예약했는지 본인이 설명하는가 |

소규모 관찰은 개선 방향을 찾는 자료다. 고령층 전체에 대한 효과나 접근성 인증으로 확대하지 않는다. 현재 관찰을 수행하지 않았으므로 숫자를 기입하지 않는다.

## 공식 요구사항 재확인

2026-09-21 확인: Alexa+ simulated 경로 허용, 실행 코드 포함 저장소, 3분 미만 영어 공개 영상, 프로젝트 설명, 사용 도구 피드백. 마감은 2026-10-23 12:00 PDT = 2026-10-24 04:00 KST.

- [공식 대회 안내](https://amazonappdev2026.devpost.com/)
- [공식 규칙](https://amazonappdev2026.devpost.com/rules)

제출 당일 공식 페이지를 다시 확인한다. AWS Builder는 실제 사용한 AWS 연동 증거를 바탕으로 작성한다. 현재 버전은 실제 Bedrock 성공을 주장하지 않는다.

## 우선순위 일정

- 9월 말: Docker 실제 예약과 기록 재조회
- 10월 7일까지: Bedrock 다중 턴 실기와 음성 점검
- 10월 14일까지: 실제 충돌 복구, 사용자 관찰
- 10월 21일까지: 영상·저장소·설명·도구 피드백 완성
- 마감 전: 최종 실행 확인과 사용자 직접 제출
