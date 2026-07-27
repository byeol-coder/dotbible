# vendor/liblouis

`tools/vendor-liblouis.mjs` 가 생성합니다. 직접 고치지 마세요.

- 원본: https://github.com/liblouis/js-build (liblouis 3.38 계열)
- 라이선스: liblouis 는 LGPL-2.1+, 테이블은 각 파일 상단 표기를 따릅니다.
- 빌드 파일은 끝의 `liblouisBuild = liblouisBuild();` 자동 호출을 제거하고
  `window.liblouisBuild` 팩토리를 노출하도록 수정했습니다. 앱이 힙 크기를
  지정해 호출해야 하기 때문입니다(기본 힙으로는 ko-2006-g2 컴파일이 실패).

테이블 33개 · 2553KB
