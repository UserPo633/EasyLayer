# 전문가 4 · 품질·재현성 검토

검토 기준: 2026-09-30 KST, v0.3에서 v0.4로 발전시키는 작업. 이 문서는 실제 고객 실험이나 Alexa 실행 결과를 주장하지 않는다.

## 결론

심사위원에게 보여줄 핵심 증거는 **같은 예약이 대화·화면·원본 시스템에서 일치하며, 불확실한 결과를 성공으로 말하지 않는 것**이다. 사이트가 예쁜지보다 이 경계가 동작하는지가 먼저다. 웹 시뮬레이터는 공유 MCP 예약 상태에 연결하고, 원본 예약 기록을 다시 읽은 경우에만 완료를 표시해야 한다.

v0.3의 주요 검증 공백은 실제 `NativeSource` 어댑터였다. HTTP MCP 테스트는 다른 합성 source 객체를 사용했고, 기존 `scripts/check_source.py`는 별도 HTTP 코드를 사용했다. 따라서 둘이 통과해도 `NativeSource`의 쿠키·CSRF·form encoding·영수증 URL 경로가 함께 동작한다는 증거는 없었다.

## 이번에 추가한 검증

`tests/test_source_http_contract.py`의 **15개 테스트 통과**. 실제 `NativeSource`, `Engine`, SQLite, urllib, CookieJar를 사용한다. 어댑터나 네트워크 함수를 mock하지 않고 loopback HTTP 서버와 통신한다. 서버는 번들 원본 `application/controllers/Booking.php`의 요청·응답 형태를 참고한 작은 fixture다. **실제 PHP/MariaDB Easy!Appointments 실행 결과가 아니다.**

| 검증 | 관측한 결과 | 증명 범위 |
|---|---|---|
| HTML CSRF + HttpOnly 쿠키 | 세션 쿠키를 보내고 HTML token으로 POST 성공 | Python 어댑터의 세션·폼 전달 |
| 문자·form encoding | 한글, `&`, `+`, bracket 필드 보존; 허용되지 않은 연락처 필드 제외 | 실제 HTTP 요청 body |
| 예약 종료 시각 | 30분 수업의 end_datetime 일치 | 전송 payload 계약 |
| 영수증 URL | `/`, `+` 포함 fixture hash를 percent encoding하여 read-back | URL 구성 및 원문 필드 대조 |
| simulator → MCP → NativeSource → HTTP fixture | 별도 검토 POST 뒤 verified, resume 동일 초안, register 합계 1회 | 실제 프로토콜을 통과한 전체 백엔드 경로, 브라우저 미포함 |
| 정상 완료·같은 초안 반복 | verified, 같은 예약 ID, register 1회 | 동일 DB·동일 초안 반복 억제 |
| 가격 변경 | changed, register 0회 | 사전 재확인 |
| 예약 시간 소진 | conflict, register 0회 | 사전 가용성 재확인 |
| POST 처리 후 응답 유실 | unknown, 재시작 이후에도 register 합계 1회 | 무작정 재전송하지 않음 |
| 다른 서비스의 영수증 | unknown; 올바른 read-back 이후 verified | ID만 받아 성공 처리하지 않음 |
| 영수증 HTTP 503 | unknown; 이후 읽기만으로 verified | 기존 receipt로 복구 |
| POST 전 HTTP 503 | approved 유지; 회복 후 register 1회 | 아직 쓰지 않은 요청만 재시도 |
| source 거절, receipt 없음 | unknown, 재호출 시 register 증가 없음 | 불확실한 source 오류의 보수적 처리 |
| 지원하지 않는 필수 동의·잘못된 availability·없는 catalog | 초안/쓰기 차단 | 지원 범위 이탈 실패 처리 |
| live runner 읽기/명시적 쓰기 모드 | 기본 0회, 쓰기 모드 1회; 보고서에 연락처·hash 없음 | 러너 자체의 동작, 동일 fixture 기반 |

CSRF fixture에서는 HTML token과 cookie 값이 일부러 다르다. 이는 token 획득 경로의 회귀 검사를 위한 스트레스 조건이며 실제 원본이 반드시 서로 다른 값을 준다는 주장이 아니다. 응답 유실·503 등의 fault injection도 source 제품의 실제 장애 빈도를 나타내지 않는다.

bridge/requirements.txt가 설치된 Python 환경에서 실행:

```sh
python -m unittest discover -s tests -p 'test_source_http_contract.py' -v
```

## 실제 원본 검증용 실행 경로

추가한 `scripts/verify_source_live.py`는 실제 `NativeSource`와 `Engine`을 사용한다. 오퍼레이터가 소유한 loopback instance만 대상으로 한다. 이 러너는 기존 `check_source.py`를 대체하여 bridge 어댑터를 검증하고, 기존 스크립트의 DB row-count 검사는 별도 보조 증거로 남길 수 있다.

Docker가 있는 환경에서 원본을 시작한 다음 실행한다.

```sh
python scripts/start_demo.py
python scripts/verify_source_live.py
python scripts/verify_source_live.py --book-fixture
```

첫 검증은 catalog와 다음 14일의 availability만 읽는다. 마지막 명령은 **테스트 원본에 합성 예약 한 건을 실제로 생성**하고, 원문 예약 기록을 다시 읽어 서비스·담당자·일시·예약 ID를 확인한다. 같은 초안의 반복 실행이 같은 verified receipt를 반환하는지도 확인한다. 출력 파일은 `evidence/native-adapter-live-*.json`이며 개인정보와 관리 hash는 기록하지 않는다.

초안 DB는 `.local/live-adapter-probe.sqlite3`에 유지한다. 기존 probe가 pending/unknown이면 새 예약 실행을 막는다. 응답 유실 후 재실행하여 예약을 더 만드는 실수를 피하기 위한 동작이다. 이 러너의 승인은 합성 테스트용 programmatic approval이다. **사람이 검토 화면을 조작했다는 증거가 아니다.**

현재 실행 환경에 Docker/PHP/MariaDB가 없어 실제 원본에 대한 위 명령은 실행하지 않았다. 러너의 기본/예약 모드 자체는 fixture와 연결해 검증했다. 실제 원본 identity, notification 설정, 관리 DB 상태는 source 시작 로그와 추가 증거로 확인해야 한다.

## 다른 전문가 제안에 대한 검토

- **동의 — 웹 시뮬레이터를 제출용 진입점으로 사용:** 설치 부담 없이 시연할 수 있고, MCP 서버 상태를 그대로 보여줄 수 있다. 단, 정적 UI를 Alexa 연동이라고 부르면 안 된다. MCP 요청/응답과 모드 표시가 함께 있어야 한다.
- **동의 — draft resume/cancel과 중복 억제 보강:** 새 화면으로 돌아가도 같은 상태를 읽는 경험에 필요하다. 취소는 제출 전 초안 폐기이며 원본 예약 취소와 구분해야 한다.
- **우선순위 낮춤 — 플랫폼 OAuth 완성:** 로컬 simulator의 예약 안전성과 실제 원본 read-back보다 먼저 구현하면 제출 증거가 늘지 않을 수 있다. 공개 배포 전에 해결해야 할 별도 gate로 둔다.
- **반대 — 성공 시나리오만으로 데모 완료 판정:** 가격 변경과 응답 유실 중 적어도 하나를 보조 장면 또는 재현 테스트로 제시한다. 실패를 숨기지 않는 설계가 이 제품의 차별점이다.
- **반대 — 테스트 수 자체를 성과 KPI로 제시:** 15개 통과는 범위가 명확한 개발 증거다. 실제 사용자 예약 성공률, 접근성 개선률, Alexa 호환성으로 환산하지 않는다.

## 제출 전에 남은 gate

| 우선순위 | Gate | 통과 증거 |
|---|---|---|
| P0 | 실제 원본 adapter booking | Docker 원본 + live runner JSON + read-back 확인 |
| P0 | 공유 MCP simulator 전체 흐름 | browse → draft → 사람이 review → complete → 원문 verified, 동일 draft ID |
| P0 | 문제 상황 사용자 문구 | changed/unknown에서 성공으로 말하지 않고 다음 행동 표시 |
| P1 | 새로고침·이어하기·초안 폐기 | 동일 사용자 상태 복원, 폐기 후 source write 없음 |
| P1 | 실제 브라우저 키보드·화면·음성 | 화면 기록과 관측 메모; speech 미지원 시 입력/버튼 대체 |
| P1 | 사용자 관찰 | 동의한 참여자와 실제 과업, 성공/실패·시간·오해를 기록; 아직 실시하지 않음 |
| P2 | 실제 Alexa host/OAuth | 대회 제출용 simulator와 별도 플랫폼 연동 검증 |

성능 기준과 접근성 효과 수치는 아직 측정되지 않았다. 계측 전 개선율·응답 시간·호환성을 기재하지 않는다.
