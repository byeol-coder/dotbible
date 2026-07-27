# Dot Bible — Dot Library 등록 사양서

- 작성: 이샛별 · 대상: tactileworlds.com `#/dotlibrary` 배포 담당(심영훈)
- 저장소: https://github.com/byeol-coder/dotbible
- 상태: 앱 완료 · **배포 URL 확정 대기**

---

## 1. 무엇을 등록하나

Dot Bible은 자유 라이선스 성경 본문을 닷패드 촉각 면과 음성으로 읽는
접근성 웹앱입니다. Dot Library의 기존 도서(월든·모비딕 등)와 달리
**정적 도서가 아니라 앱**입니다.

| | 기존 도서 | Dot Bible |
|---|---|---|
| 콘텐츠 | 고정된 본문 | 5개 번역본 × 66권 + 1년 통독 플랜 |
| 읽기 | Dot Library 내장 리더 | 자체 리더 (연속 청취, 절 동기) |
| 촉각 출력 | 점자 라인 | 60×40 전면 displayGraphicData 멀티라인 |
| 제공 방식 | 카탈로그 항목 | **iframe 임베드** |

카드는 Dot Library 그리드에 기존 도서와 똑같이 서고, 열면 상세가 아니라
임베드 모달이 뜨는 형태를 제안합니다. Dot Games가 이미 같은 방식으로
외부 앱을 물리고 있어 새로 만들 구조가 없습니다.

## 2. 카탈로그 항목

Dot Games의 Qa 배열과 같은 형태입니다. 배포 URL 확정 후 마지막 항목만
채우면 됩니다.

    ["Dot Bible", "닷패드로 읽는 다국어 성경", "종교·인문",
     ["60×40"], "note", 3, <표지 thumb>, <hero>,
     "https://dotbible.vercel.app/index.html?embed=1&preview=0"]

| 필드 | 값 |
|---|---|
| 제목 | Dot Bible (한국어·영어 동일 표기) |
| 부제 | 닷패드로 읽는 다국어 성경 |
| 분류 | 종교 · 인문 (기존 Humanities 계열) |
| 가격 | **무료** (구독·구매 배지 없음) |
| 지원 규격 | 60×40 |
| 표지 이미지 | **별도 제작 필요** — 월든·종의 기원과 동일 톤 |

## 3. 호스트 계약 (tib-preview 번들에서 확인)

| 항목 | 값 |
|---|---|
| iframe allow | bluetooth; microphone; autoplay; clipboard-write |
| 모달 크기 | max-width 1180px · width 96vw · height calc(100vh - 56px) |
| 자식 → 호스트 | postMessage({source:'dotarcade', type:'exit'}) |
| 호스트 → 자식 | **없음** (크로스오리진이라 window 주입 불가) |
| 초기 포커스 | 호스트가 80ms 후 iframe 자체를 focus |

**닷패드 연결 주체는 iframe 하나로 고정해야 합니다.** 호스트와 자식이
동시에 Web Bluetooth를 잡으면 충돌합니다. 임베드 모달에는 호스트 쪽
연결 버튼을 두지 않습니다.

앱은 ?embed=1일 때 헤더 오른쪽을 68px 비워 호스트 닫기 버튼과
겹치지 않게 합니다. 헤더 자체는 유지합니다 — 호스트 모달에 제목
표시줄이 없고, 닷패드 연결 버튼도 그 안에 있기 때문입니다.

## 4. 접근성 — 같이 반영할 것

### 4-1. Escape 문제 (Dot Bible은 해결됨)

호스트의 Escape 핸들러는 부모 document에 붙어 있습니다. 포커스가
크로스오리진 iframe 안으로 들어가면 그 keydown이 부모까지 올라가지
않아, **키보드·스크린리더 사용자가 모달을 빠져나올 수 없습니다.**

Dot Bible은 Escape를 capture 단계에서 직접 잡아 exit를 보냅니다.

### 4-2. 기존 Dot Games 6종 점검 권장 ← 별도 건

robo77, dot-forest, dot-ocean, indianpoker, tictactoe, braille —
**같은 문제를 가지고 있을 가능성이 높습니다.** 접근성 서비스에서
모달을 못 닫는 건 작은 문제가 아니라 별도로 짚었습니다.

embed-test.html(저장소 루트)이 호스트 모달 조건을 그대로 재현하므로
각 게임 URL을 넣어 바로 확인할 수 있습니다.

### 4-3. 그 밖

- 96vw 폭에서 60×40 점자 서피스 잘림 없음 (--wrap:820px으로 묶여 있음)
- 모달 이탈 시 음성 합성·연속 청취 취소
- 본문 요소에 lang 부여 — 없으면 스크린리더가 영어 본문을 한국어
  발음으로 읽습니다

## 5. 알려진 제약

**Safari 임베드 시 설정이 저장되지 않습니다.** 서드파티 iframe의
저장소를 막기 때문입니다. 크래시는 없고 메모리 폴백으로 조용히
동작하지만, 읽던 위치·낭독 속도·읽음 표시가 세션 간에 남지 않습니다.
Dot Library가 로그인 기반이니 장기적으로는 Supabase user_state에
얹는 게 정석입니다.

## 6. 콘텐츠와 라이선스

bible/LICENSES.md가 생성 시점에 자동으로 갱신됩니다.

| 번역본 | 언어 | 라이선스 | 닷패드 출력 |
|---|---|---|---|
| kor-krv | 한국어 | Public Domain | 가능 |
| eng-web | English | Public Domain | 가능 |
| spa-rv1909 | Español | Public Domain | liblouis 로드 후 |
| fra-ostervald | Français | Public Domain | liblouis 로드 후 |
| chi-cuv | 中文(번체) | Public Domain | liblouis 로드 후 |
| jpn-kougo | 日本語 | **확인 필요** | 불가 — 비활성 |

일본어는 비활성입니다. open-bibles는 퍼블릭 도메인으로 표기하지만
일본 내 권리 주장 이력이 있어 법무 확인이 필요하고, liblouis에 표준
가나 점자 테이블이 없습니다(한자점자만 존재).

CC BY·CC BY-SA 번역본을 추가할 경우 화면 출처 표시가 필수입니다.
앱 푸터가 레지스트리에서 자동 생성하므로 별도 작업은 없습니다.

## 7. 남은 작업

- [x] 배포 — https://dotbible.vercel.app (Vercel · GitHub push 시 자동 갱신)
- [x] 배포 URL 확정 → 카탈로그 항목에 기입 완료
- [ ] 표지 이미지 제작 (이샛별)
- [ ] Dot Library 카탈로그 항목 추가 (심영훈 — 번들 원본 보유)
- [ ] 라이브에서 키보드 탐색·스크린리더 흐름 검수
- [ ] (별도) Dot Games 6종 Escape 문제 점검

## 8. 미해결

**브랜드 포지셔닝 확인.** 회사명을 성경 제품에 직접 붙이는 결정입니다.
기관 파트너(NFB·APH)와 비기독교권 시장을 고려하면 대표님·브랜드 쪽
확인이 필요합니다. 되돌릴 수 있게 커밋 e3ebf1e 하나로 분리해
두었습니다.
