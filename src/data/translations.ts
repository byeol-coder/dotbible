/* 번역본 레지스트리 — 라이선스와 점자 테이블을 함께 관리
   ------------------------------------------------------------
   이 앱에서 언어를 늘릴 때 병목은 본문 라이선스가 아니라 점자다.
   본문을 읽을 수 있어도 점자 테이블이 없으면 닷패드에 아무것도
   못 찍는다. 그래서 항목마다 braille 엔진을 명시하고, 엔진이
   없으면 UI에서 촉각 출력을 막는다(빈 셀을 보내지 않는다).

   braille 값
     "ko"   : 한국 점자 규정 1종(기초) — src/braille/ko.ts
     "ueb1" : UEB Grade 1 — src/braille/ueb.ts
     null   : 미구현. 읽기·음성은 되지만 닷패드 출력 불가

   licenseNote·attribution·brailleNote는 콘텐츠가 아니라 "이 번역본에
   대한 설명"이라 UI 언어를 따라간다 — {ko,en} 두 값을 두고 pickLocalized()로
   현재 UI 언어에 맞게 꺼낸다. 값이 이미 언어 중립적(고유명사·라이선스명·
   기술 테이블명)이면 두 언어에 같은 문자열을 넣어 중복을 감수한다 —
   조회 코드가 한 갈래로 유지된다. */
import type { BrailleEngine } from "../braille";
import type { UILang } from "../i18n";

export type LocalizedText = string | { ko: string; en: string };

export interface RefFormatter {
  ch: (book: string, chapter: number) => string;
  v: (book: string, chapter: number, verse: number) => string;
}

export interface TranslationConfig {
  short: string;
  title: string;
  lang: string;
  langCode: string;
  ttsLang: string;
  license: LocalizedText;
  licenseNote: LocalizedText;
  ref: RefFormatter;
  source: string;
  attribution: LocalizedText;
  modified: boolean;
  braille: BrailleEngine;
  louis: string | null;
  brailleNote: LocalizedText;
  apiBase: string | null;
  enabled?: boolean;
}

export const TRANSLATIONS: Record<string, TranslationConfig> = {
  "kor-krv": {
    short: "개역한글", title: "성경전서 개역한글판(1961)",
    lang: "한국어", langCode: "ko", ttsLang: "ko-KR",
    license: "Public Domain",
    licenseNote: { ko: "대한민국 저작권 보호기간 만료(2011)", en: "Copyright expired in South Korea (2011)" },
    ref: { ch: (b, c) => `${b} ${c}장`, v: (b, c, v) => `${b} ${c}:${v}` },
    source: "https://github.com/seven1m/open-bibles",
    attribution: { ko: "성경전서 개역한글판(1961) — 퍼블릭 도메인", en: "Korean Revised Version (1961) — Public Domain" },
    modified: false, braille: "ko", louis: "ko-2006-g2.ctb",
    brailleNote: { ko: "liblouis ko-2006-g2 (약자) · 미로드 시 내장 1종", en: "liblouis ko-2006-g2 (contracted) · falls back to the built-in Grade 1 engine until loaded" },
    apiBase: "https://api.getbible.net/v2/korean",
  },
  "eng-web": {
    short: "WEB", title: "World English Bible",
    lang: "English", langCode: "en", ttsLang: "en-US",
    license: "Public Domain",
    licenseNote: { ko: "ebible.org 공개 번역본", en: "Public-domain text from ebible.org" },
    ref: { ch: (b, c) => `${b} ${c}`, v: (b, c, v) => `${b} ${c}:${v}` },
    source: "https://ebible.org/engwebp/copyright.htm",
    attribution: { ko: "World English Bible — Public Domain", en: "World English Bible — Public Domain" },
    modified: false, braille: "ueb1", louis: "en-ueb-g2.ctb",
    brailleNote: { ko: "liblouis en-ueb-g2 · 미로드 시 내장 UEB Grade 1", en: "liblouis en-ueb-g2 · falls back to the built-in UEB Grade 1 engine until loaded" },
    apiBase: null,
  },
  "spa-rv1909": {
    short: "RV1909", title: "Reina Valera 1909",
    lang: "Espanol", langCode: "es", ttsLang: "es-ES",
    license: "Public Domain",
    licenseNote: { ko: "open-bibles 확인", en: "Verified via open-bibles" },
    ref: { ch: (b, c) => `${b} ${c}`, v: (b, c, v) => `${b} ${c}:${v}` },
    source: "https://github.com/seven1m/open-bibles",
    attribution: { ko: "Reina Valera 1909 — Public Domain", en: "Reina Valera 1909 — Public Domain" },
    modified: false, braille: null, louis: "es-g1.ctb",
    brailleNote: { ko: "liblouis es-g1", en: "liblouis es-g1" },
    apiBase: null,
  },
  "fra-ostervald": {
    short: "Ostervald", title: "Bible Ostervald 1996",
    lang: "Francais", langCode: "fr", ttsLang: "fr-FR",
    license: "Public Domain",
    licenseNote: { ko: "open-bibles 확인", en: "Verified via open-bibles" },
    ref: { ch: (b, c) => `${b} ${c}`, v: (b, c, v) => `${b} ${c}:${v}` },
    source: "https://github.com/seven1m/open-bibles",
    attribution: { ko: "French Ostervald 1996 — Public Domain", en: "French Ostervald 1996 — Public Domain" },
    modified: false, braille: null, louis: "fr-bfu-g2.ctb",
    brailleNote: { ko: "liblouis fr-bfu-g2", en: "liblouis fr-bfu-g2" },
    apiBase: null,
  },
  "chi-cuv": {
    short: "CUV", title: "Chinese Union Version (Traditional)",
    lang: "中文", langCode: "zh", ttsLang: "zh-TW",
    license: "Public Domain",
    licenseNote: { ko: "open-bibles 확인", en: "Verified via open-bibles" },
    ref: { ch: (b, c) => `${b} ${c}章`, v: (b, c, v) => `${b} ${c}:${v}` },
    source: "https://github.com/seven1m/open-bibles",
    attribution: { ko: "Chinese Union Version — Public Domain", en: "Chinese Union Version — Public Domain" },
    modified: false, braille: null, louis: "zh-tw.ctb",
    brailleNote: { ko: "liblouis zh-tw", en: "liblouis zh-tw" },
    apiBase: null,
  },
  "jpn-kougo": {
    short: "口語訳", title: "日本語口語訳",
    lang: "日本語", langCode: "ja", ttsLang: "ja-JP",
    license: { ko: "확인 필요", en: "Needs review" },
    licenseNote: {
      ko: "open-bibles는 PD로 표기하나 일본 내 권리 주장 이력이 있어 법무 확인 전 비활성",
      en: "open-bibles lists this as public domain, but rights have been asserted in Japan before, so it stays disabled pending legal review",
    },
    ref: { ch: (b, c) => `${b} ${c}章`, v: (b, c, v) => `${b} ${c}:${v}` },
    source: "https://github.com/seven1m/open-bibles",
    attribution: { ko: "日本語口語訳 — 라이선스 확인 중", en: "Japanese Kougo Version — license under review" },
    modified: false, braille: null, louis: null,
    brailleNote: { ko: "liblouis에 표준 가나 점자 테이블 없음(한자점자만 존재)", en: "liblouis has no standard kana braille table (only kanji-braille exists)" },
    enabled: false, apiBase: null,
  },
};

export const DEFAULT_TRANSLATION = "kor-krv";

/** {ko,en} 필드에서 지정 UI 언어 값을 꺼낸다. 문자열이 그대로 와도 동작한다
    (license처럼 대개 언어 중립적인 필드는 객체화하지 않은 경우가 있다). */
export function pickLocalized(v: LocalizedText | undefined, uiLang: UILang): string {
  if (v == null) return "";
  return typeof v === "string" ? v : v[uiLang] || v.ko || "";
}

/** 비활성 항목(라이선스 미확정 등)은 선택지에서 제외 */
export function listEnabledTranslations(): (TranslationConfig & { id: string })[] {
  return Object.keys(TRANSLATIONS)
    .filter((k) => TRANSLATIONS[k].enabled !== false)
    .map((k) => ({ id: k, ...TRANSLATIONS[k] }));
}
