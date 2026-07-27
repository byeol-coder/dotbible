/* UEB Grade 1(영어) — 대문자표·수표·기본 문장부호. 약자(Grade 2) 미적용.
   스페인어·프랑스어는 악센트 문자 때문에 이 표로 대신할 수 없다 —
   liblouis 로드 전 폴백은 영어에만 유효하다. */
import { NUM } from "./ko";

const D = (...ds: number[]) => ds.reduce((m, d) => m | (1 << (d - 1)), 0);

const UEB: Record<string, number> = {
  a: D(1), b: D(1,2), c: D(1,4), d: D(1,4,5), e: D(1,5), f: D(1,2,4), g: D(1,2,4,5),
  h: D(1,2,5), i: D(2,4), j: D(2,4,5), k: D(1,3), l: D(1,2,3), m: D(1,3,4), n: D(1,3,4,5),
  o: D(1,3,5), p: D(1,2,3,4), q: D(1,2,3,4,5), r: D(1,2,3,5), s: D(2,3,4), t: D(2,3,4,5),
  u: D(1,3,6), v: D(1,2,3,6), w: D(2,4,5,6), x: D(1,3,4,6), y: D(1,3,4,5,6), z: D(1,3,5,6),
};
const UEB_CAP = D(6);
const UEB_NUM = D(3,4,5,6);
const UEB_PUNCT: Record<string, number> = {
  ".": D(2,5,6), ",": D(2), ";": D(2,3), ":": D(2,5), "?": D(2,3,6),
  "!": D(2,3,5), "'": D(3), "-": D(3,6),
};

export function toCellsUeb(text: string): number[] {
  const out: number[] = [];
  let inNum = false;
  for (const ch of String(text)) {
    if (ch === " ") { out.push(0); inNum = false; continue; }
    if (NUM[ch] != null) { if (!inNum) { out.push(UEB_NUM); inNum = true; } out.push(NUM[ch]); continue; }
    inNum = false;
    const low = ch.toLowerCase();
    if (UEB[low] != null) { if (ch !== low) out.push(UEB_CAP); out.push(UEB[low]); continue; }
    if (UEB_PUNCT[ch] != null) { out.push(UEB_PUNCT[ch]); continue; }
    out.push(0); // 미지원 문자 — 빈 셀로 자리만 유지
  }
  return out;
}
