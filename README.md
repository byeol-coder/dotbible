# Dot Bible (React + Vite)

닷패드로 읽는 다국어 성경 묵상 웹앱. 원래 단일 파일(vanilla JS) 앱을
React + Vite + TypeScript로 재구성했다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

웹 블루투스는 `file://`에서 동작하지 않는다 — `npm run dev`나 배포된
https 주소로만 열 것.

## 빌드

```bash
npm run build       # tsc -b && vite build → dist/
npm run preview     # 빌드 결과 로컬 확인
```

## 구조

```
src/
  dotpad/       DotPad Web SDK 3.0.0(벤더, 로직 무변경) + 연결 관리자 + React 훅
  braille/      한국어 1종·UEB Grade 1 내장 엔진, liblouis 로더, 촉각 면 레이아웃
  data/         성경 66권 메타, 번역본 레지스트리, 본문/그래픽 데이터 어댑터
  i18n/         UI 언어(KO/EN) — 성경 번역본 언어와 완전히 분리된 축
  hooks/        useBibleReader(핵심 엔진) · useDotPadKeys · useEmbedAdapter 등
  components/   Header · HomeView · ReaderView · BrowseView · BrailleStrip · Footer
  styles/       디자인 토큰 + 컴포넌트 스타일(원본 CSS 그대로)

public/
  bible/        성경 본문 JSON(번역본별) + 핵심 그래픽(DTMS)
  vendor/       liblouis 브라우저 빌드 + 점자 테이블
  assets/       브랜드 마크(Dot Library 카탈로그 썸네일용)

tools/          본문·liblouis·그래픽 빌드 스크립트(원본과 동일, 사용법 불변)
docs/           Dot Library 등록 사양서 등
```

## 원본(vanilla) 대비 달라진 것

- **아키텍처만** 바뀌었다. 점자 변환·닷패드 프로토콜·i18n 분리·통독 플랜 계산 등
  알고리즘은 전부 그대로 옮겼다 — 새로 만들지 않았다.
- `window.DotPadSDK` 같은 전역 우회를 없애고 ES 모듈 import로 바꿨다.
- UI 상태(재생/페이저/그래픽/알림)를 전역 싱글턴 대신 React state로 관리한다.
- `applyI18N()`/`renderDpKeys()`처럼 DOM을 수동으로 다시 그리던 함수들은
  필요 없어졌다 — JSX가 언어 변경 시 자동으로 다시 그린다.
- 도구 막대 높이(`--reader-bar-h`), 임베드 모드 판정, DotPad 하드웨어 키
  매핑은 각각 작은 훅으로 분리했다(`useReaderBarHeight`, `useEmbedAdapter`,
  `useDotPadKeys`).

## 데이터 재생성

```bash
node tools/vendor-liblouis.mjs      # public/vendor/liblouis/
node tools/build-bible.mjs          # public/bible/
node tools/build-graphic.mjs <파일.dtma> <bookId>-<chapter>   # 선별 챕터 핵심 그래픽
```

## 배포

Vercel Import 시 프레임워크가 Vite로 자동 감지된다. 빌드 커맨드를
따로 지정할 필요 없음 — `vercel.json`은 `bible/`·`vendor/` 캐시 헤더만
지정한다.

## 검증한 것

- `npm run build` 실제 성공(오류·경고 없음).
- 빌드된 번들을 jsdom에 직접 로드해 렌더링 확인 — 헤더·홈 화면·촉각 면
  (실제 점자 패턴)·통독 플랜·푸터까지 실제 데이터로 채워지는 것을 확인했다.
- UI 언어(영어)와 콘텐츠 언어(한국어 성경 구절)가 독립적으로 표시되는 것도
  이 렌더링에서 확인됨(`lang="ko"`가 정확히 붙었다).

## 아직 확인 못한 것

브라우저·실기기가 없는 환경에서 작업해서, 아래는 실제 사용 환경에서
확인이 필요하다.

- 닷패드 실기기 연결·F1~F4 하드웨어 키·촉각 출력
- 언어 전환 버튼 클릭 등 실제 인터랙션(정적 렌더링만 확인함)
- Dot Library 임베드(`?embed=1`) 실제 동작
- 다국어 liblouis(스페인어/프랑스어/중국어) 로드
