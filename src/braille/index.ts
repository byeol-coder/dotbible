/* 브라이유 변환 통합 인터페이스.
   원본 vanilla 앱은 이 모듈 안에서 전역 Trans를 몰래 참조했다
   (`typeof Trans!=="undefined"`). React 포팅에서는 이 암묵적 결합을 없애고
   호출부가 번역본 설정을 명시적으로 넘기도록 바꿨다 — 그 외 알고리즘은
   그대로다. */
import { toCellsKo } from "./ko";
import { toCellsUeb } from "./ueb";
import { Louis, fromUnicode } from "./louis";

export type BrailleEngine = "ko" | "ueb1" | null;

const ENGINES: Record<string, (text: string) => number[]> = {
  ko: toCellsKo,
  ueb1: toCellsUeb,
};

export function hasEngine(e: BrailleEngine): boolean {
  return !!e && !!ENGINES[e];
}

export const engines = Object.keys(ENGINES);

/** liblouis가 준비돼 있으면 그걸 쓰고, 아니면 내장 엔진으로 내려간다.
    둘 다 없으면 빈 배열 — 호출부가 이를 보고 촉각 출력을 막는다. */
export function toCells(text: string, louisRoot: string | null | undefined, fallbackEngine: BrailleEngine): number[] {
  if (louisRoot && Louis.isReady(louisRoot)) {
    const b = Louis.translate(louisRoot, String(text));
    if (b != null) return fromUnicode(b);
  }
  const fn = fallbackEngine ? ENGINES[fallbackEngine] : null;
  return fn ? fn(text) : [];
}

export function toHex(cells: number[]): string {
  return cells.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function toUnicode(cells: number[]): string {
  return cells.map((b) => String.fromCharCode(0x2800 + b)).join("");
}

export function louisReady(root: string | null | undefined): boolean {
  return Louis.isReady(root);
}

export function louisFailed(): boolean {
  return Louis.failed;
}

/** 현재 번역본의 점자 경로를 준비한다. 성공(또는 이미 가능)하면 true. */
export async function ready(louisRoot: string | null | undefined, fallbackEngine: BrailleEngine): Promise<boolean> {
  if (louisRoot && !Louis.isReady(louisRoot) && !Louis.failed) {
    try {
      await Louis.ensure(louisRoot);
      return true;
    } catch (e) {
      console.warn("[liblouis]", (e as Error).message);
    }
  }
  return louisReady(louisRoot) || hasEngine(fallbackEngine);
}

export { Louis };
