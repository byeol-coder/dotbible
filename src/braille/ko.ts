/* 한국 점자 변환 (1종/기초) — 초성·중성·종성·된소리·숫자·기본 부호
   ※ 약자·약어 규정 미적용. liblouis ko-2006-g2 로드 전 폴백으로만 쓴다.
   셀 인코딩: dot1..dot8 → bit0..bit7 (1바이트/셀)

   원본(index.html vanilla) BR 모듈의 알고리즘을 그대로 옮겼다. 로직을
   바꾸지 않았다 — 이미 검증된 코드라 재작성하면 회귀 위험만 늘어난다. */

const D = (...ds: number[]) => ds.reduce((m, d) => m | (1 << (d - 1)), 0);

const CHO: Record<string, number[]> = {
  "ㄱ": [D(4)], "ㄲ": [D(6), D(4)], "ㄴ": [D(1,4)], "ㄷ": [D(2,4)], "ㄸ": [D(6), D(2,4)],
  "ㄹ": [D(5)], "ㅁ": [D(1,5)], "ㅂ": [D(4,5)], "ㅃ": [D(6), D(4,5)], "ㅅ": [D(6)], "ㅆ": [D(6), D(6)],
  "ㅇ": [], "ㅈ": [D(4,6)], "ㅉ": [D(6), D(4,6)], "ㅊ": [D(5,6)], "ㅋ": [D(1,2,4)], "ㅌ": [D(1,2,5)],
  "ㅍ": [D(1,4,5)], "ㅎ": [D(2,4,5)],
};
const JUNG: Record<string, number[]> = {
  "ㅏ": [D(1,2,6)], "ㅐ": [D(1,2,3,5)], "ㅑ": [D(3,4,5)], "ㅒ": [D(3,4,5), D(1,2,3,5)],
  "ㅓ": [D(2,3,4)], "ㅔ": [D(1,3,4,5)], "ㅕ": [D(1,5,6)], "ㅖ": [D(3,4)],
  "ㅗ": [D(1,3,6)], "ㅘ": [D(1,2,3,6)], "ㅙ": [D(1,2,3,6), D(1,2,3,5)], "ㅚ": [D(1,3,4,5,6)],
  "ㅛ": [D(3,4,6)], "ㅜ": [D(1,3,4)], "ㅝ": [D(1,2,3,4)], "ㅞ": [D(1,2,3,4), D(1,2,3,5)],
  "ㅟ": [D(1,3,4), D(1,2,3,5)], "ㅠ": [D(1,4,6)], "ㅡ": [D(2,4,6)], "ㅢ": [D(2,4,5,6)], "ㅣ": [D(1,3,5)],
};
const JONG1: Record<string, number | null> = {
  "ㄱ": D(1), "ㄴ": D(2,5), "ㄷ": D(3,5), "ㄹ": D(2), "ㅁ": D(2,6), "ㅂ": D(1,2),
  "ㅅ": D(3), "ㅇ": D(2,3,5,6), "ㅈ": D(1,3), "ㅊ": D(2,3), "ㅋ": D(2,3,5), "ㅌ": D(2,3,6),
  "ㅍ": D(2,5,6), "ㅎ": D(3,5,6), "ㄲ": null, "ㅆ": null,
};
const JONG_COMPOSE: Record<string, [string, string]> = {
  "ㄲ": ["ㄱ","ㄱ"], "ㄳ": ["ㄱ","ㅅ"], "ㄵ": ["ㄴ","ㅈ"], "ㄶ": ["ㄴ","ㅎ"],
  "ㄺ": ["ㄹ","ㄱ"], "ㄻ": ["ㄹ","ㅁ"], "ㄼ": ["ㄹ","ㅂ"], "ㄽ": ["ㄹ","ㅅ"], "ㄾ": ["ㄹ","ㅌ"],
  "ㄿ": ["ㄹ","ㅍ"], "ㅀ": ["ㄹ","ㅎ"], "ㅄ": ["ㅂ","ㅅ"], "ㅆ": ["ㅅ","ㅅ"],
};
const CHO_L  = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG_L = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG_L = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
export const NUM_SIGN = D(3,4,5,6);
export const NUM: Record<string, number> = {"1":D(1),"2":D(1,2),"3":D(1,4),"4":D(1,4,5),"5":D(1,5),"6":D(1,2,4),"7":D(1,2,4,5),"8":D(1,2,5),"9":D(2,4),"0":D(2,4,5)};
const PUNCT: Record<string, number> = {".":D(2,5,6),",":D(5),"?":D(2,3,6),"!":D(4,5,6),"-":D(3,6)};

function jong(ch: string): number[] {
  if (!ch) return [];
  const v = JONG1[ch];
  if (v != null) return [v];
  const c = JONG_COMPOSE[ch];
  if (c) return c.map((x) => JONG1[x] as number);
  return [];
}

/** 문자열 → 셀 바이트 배열 (한국 점자 1종) */
export function toCellsKo(text: string): number[] {
  const out: number[] = [];
  let inNum = false;
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (ch === " ") { out.push(0); inNum = false; continue; }
    if (NUM[ch] != null) { if (!inNum) { out.push(NUM_SIGN); inNum = true; } out.push(NUM[ch]); continue; }
    inNum = false;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const s = code - 0xac00, ci = Math.floor(s / 588), ji = Math.floor((s % 588) / 28), ti = s % 28;
      out.push(...CHO[CHO_L[ci]]);
      out.push(...JUNG[JUNG_L[ji]]);
      out.push(...jong(JONG_L[ti]));
      continue;
    }
    if (PUNCT[ch] != null) { out.push(PUNCT[ch]); continue; }
    out.push(0); // 미지원 문자는 빈 셀 하나로 대체(레이아웃 유지)
  }
  return out;
}
