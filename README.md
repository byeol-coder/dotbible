# Dot Bible (dotbible)

닷패드(DotPad)로 읽는 다국어 성경 묵상 웹앱. 시각장애인 사용자가
60×40 멀티라인 촉각 면에 장문 점자를 펼쳐 읽고, 음성 안내로 매일
말씀을 묵상할 수 있게 만든 접근성 서비스입니다.

빌드 도구 없는 **단일 파일 앱**입니다. `index.html` 하나에 UI·점자
변환·닷패드 SDK가 모두 들어 있고, 본문 데이터와 liblouis만 별도
폴더로 둡니다.

## 실행

웹 블루투스는 `file://`에서 동작하지 않습니다. 반드시 서버로 여세요.

```bash
python3 -m http.server 8000
```

`http://localhost:8000` — 브라우저는 크롬 또는 엣지여야 합니다
(사파리·파이어폭스는 웹 블루투스 미지원).

## 구조

```
index.html              앱 전체 (UI · i18n · 점자 엔진 · DotPad SDK 3.0.0)
embed-test.html         임베드 계약 테스트 하네스 (배포물 아님)
bible/<번역본>/<책번호>.json    본문 — {"1":["1절",...], ...}
bible/<번역본>/books.json      해당 언어 책 이름 66개
bible/LICENSES.md              번역본별 출처·라이선스 (생성물)
vendor/liblouis/               liblouis 브라우저 번들 + 필요한 테이블만
tools/build-bible.mjs          open-bibles → 내부 스키마 변환
tools/vendor-liblouis.mjs      liblouis 빌드·테이블 내려받기
```

`bible/`와 `vendor/`는 스크립트 생성물이지만 **저장소에 포함**합니다.
정적 호스팅에서 그대로 서빙돼야 앱이 오프라인으로 동작하기 때문입니다.
다시 만들려면:

```bash
node tools/vendor-liblouis.mjs
node tools/build-bible.mjs
```

## 언어

두 축이 **독립적**입니다. 한국어 화면으로 영어 성경을 읽는 조합이
정상 동작합니다.

- **UI 언어** — 화면 문구. 헤더 토글(KO/EN). `index.html`의 `I18N`
- **번역본** — 본문·책 이름·구절 참조 표기. 성경 화면에서 선택. `TRANSLATIONS`

구절 참조("3장" / "3" / "3章")는 UI 언어가 아니라 **번역본 관례**를
따릅니다. `TRANSLATIONS[].ref` 참고.

## 번역본과 점자

언어를 늘릴 때 병목은 본문 라이선스가 아니라 **점자 테이블**입니다.
본문을 읽을 수 있어도 테이블이 없으면 닷패드에 아무것도 못 찍습니다.
그래서 레지스트리가 둘을 함께 관리하고, 테이블이 없으면 촉각 출력을
막습니다(빈 셀을 보내지 않습니다).

| 번역본 | 언어 | 라이선스 | 점자 |
|---|---|---|---|
| kor-krv | 한국어 | Public Domain | `ko-2006-g2` · 내장 1종 폴백 |
| eng-web | English | Public Domain | `en-ueb-g2` · 내장 UEB G1 폴백 |
| spa-rv1909 | Español | Public Domain | `es-g1` |
| fra-ostervald | Français | Public Domain | `fr-bfu-g2` |
| chi-cuv | 中文(번체) | Public Domain | `zh-tw` |
| jpn-kougo | 日本語 | **확인 필요** | 없음 — 비활성 |

일본어는 두 가지 이유로 비활성입니다. open-bibles는 퍼블릭 도메인으로
표기하지만 일본 내 권리 주장 이력이 있어 법무 확인이 필요하고,
liblouis에 **표준 가나 점자 테이블이 없습니다**(한자점자만 존재).

liblouis(4.6MB)는 첫 점자 사용 시점에 지연 로드하며, 로드 전에는
내장 엔진(한국어 1종 / 영어 UEB Grade 1)으로 동작합니다.

## Dot Library 임베드

`?embed=1`로 열면 tactileworlds Dot Library 모달 안에서 동작합니다.

- 자식 → 호스트: `postMessage({source:'dotarcade', type:'exit'})`
- 호스트 iframe에 `allow="bluetooth"` 필요
- 호스트의 Escape 핸들러는 부모 document에 있어 프레임 안 포커스에서는
  동작하지 않습니다. 앱이 Escape를 직접 잡아 `exit`를 보냅니다.

`embed-test.html`이 호스트 모달 조건(96vw · `calc(100vh - 56px)` ·
`allow` 속성 · 자동 포커스)을 그대로 재현합니다. 같은 폴더에서 서버를
띄우고 여세요.

## 라이선스

- 앱 코드: 주식회사 닷 (Dot Incorporation)
- 성경 본문: `bible/LICENSES.md` 참고 — 전부 퍼블릭 도메인 또는 CC 계열
- liblouis: LGPL-2.1+ · 테이블은 각 파일 상단 표기
  `vendor/liblouis/README.md`에 수정 내역 기재 (힙 크기 지정을 위해
  자동 호출 구문 제거)
- DotPad Web SDK 3.0.0: 주식회사 닷
