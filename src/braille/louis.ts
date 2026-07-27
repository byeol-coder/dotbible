/* liblouis (public/vendor/liblouis) ------------------------------------
   내장 엔진은 한국어 1종·영어 UEB Grade 1이 한계다. 약자와 라틴 악센트,
   중국어 성조는 실제 테이블이 있어야 한다.
   easy-api는 출력 버퍼 처리에 버그가 있어 쓰지 않고 lou_translateString을
   UTF-32 버퍼로 직접 호출한다. (원본 vanilla 앱의 Louis 모듈을 그대로 이식) */

interface LiblouisModule {
  FS: { mkdir: (p: string) => void; writeFile: (p: string, data: string) => void };
  _malloc: (n: number) => number;
  _free: (p: number) => void;
  setValue: (ptr: number, value: number, type: string) => void;
  getValue: (ptr: number, type: string) => number;
  ccall: (name: string, ret: string, argTypes: string[], args: unknown[]) => number;
}

declare global {
  interface Window {
    liblouisBuild?: (opts: { TOTAL_MEMORY: number }) => LiblouisModule;
  }
}

interface Manifest {
  build: string;
  heapMB?: number;
  tables: Record<string, string[]>;
}

class LouisLoader {
  base = "/vendor/liblouis/";
  mod: LiblouisModule | null = null;
  manifest: Manifest | null = null;
  loading: Promise<LiblouisModule> | null = null;
  files = new Set<string>();
  roots = new Set<string>();
  failed = false;

  isReady(root: string | null | undefined): boolean {
    return !!root && this.roots.has(root);
  }

  load(): Promise<LiblouisModule> {
    if (this.mod) return Promise.resolve(this.mod);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const r = await fetch(this.base + "manifest.json");
      if (!r.ok) throw new Error("manifest.json 없음 — tools/vendor-liblouis.mjs 를 실행하세요");
      this.manifest = await r.json();
      await new Promise<void>((res, rej) => {
        const el = document.createElement("script");
        el.src = this.base + this.manifest!.build;
        el.onload = () => res();
        el.onerror = () => rej(new Error("liblouis 빌드 로드 실패"));
        document.head.appendChild(el);
      });
      if (typeof window.liblouisBuild !== "function") throw new Error("liblouisBuild 미노출");
      // 기본 힙으로는 ko-2006-g2 컴파일 중 abort 한다
      const mod = window.liblouisBuild({ TOTAL_MEMORY: (this.manifest!.heapMB || 128) * 1024 * 1024 });
      try { mod.FS.mkdir("/tables"); } catch { /* noop */ }
      this.mod = mod;
      return mod;
    })().catch((e) => {
      this.failed = true;
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  async ensure(root: string): Promise<boolean> {
    if (this.roots.has(root)) return true;
    const mod = await this.load();
    const dep = (this.manifest?.tables || {})[root];
    if (!dep) throw new Error("매니페스트에 없는 테이블: " + root);
    for (const n of dep) {
      if (this.files.has(n)) continue;
      const r = await fetch(this.base + "tables/" + n);
      if (!r.ok) throw new Error("테이블 로드 실패: " + n);
      mod.FS.writeFile("/tables/" + n, await r.text());
      this.files.add(n);
    }
    this.roots.add(root);
    return true;
  }

  translate(root: string, text: string): string | null {
    const M = this.mod;
    if (!M) return null;
    const cps = [...String(text)], n = cps.length;
    if (!n) return "";
    const outLen = n * 4 + 64;
    const inB = M._malloc((n + 1) * 4), outB = M._malloc((outLen + 1) * 4);
    const inL = M._malloc(4), outL = M._malloc(4);
    try {
      for (let i = 0; i < n; i++) M.setValue(inB + i * 4, cps[i].codePointAt(0)!, "i32");
      M.setValue(inB + n * 4, 0, "i32");
      M.setValue(inL, n, "i32"); M.setValue(outL, outLen, "i32");
      const rc = M.ccall(
        "lou_translateString", "number",
        ["string", "number", "number", "number", "number", "number", "number", "number"],
        ["/tables/unicode.dis,/tables/" + root, inB, inL, outB, outL, 0, 0, 0]
      );
      if (!rc) return null;
      const L = M.getValue(outL, "i32");
      let out = "";
      for (let i = 0; i < L; i++) out += String.fromCodePoint(M.getValue(outB + i * 4, "i32"));
      return out;
    } catch (e) {
      console.warn("[liblouis] 변환 실패:", e);
      return null;
    } finally {
      M._free(inB); M._free(outB); M._free(inL); M._free(outL);
    }
  }
}

export const Louis = new LouisLoader();

/** 점자 유니코드(U+2800~28FF) → 셀 바이트 */
export function fromUnicode(s: string): number[] {
  return [...s].map((c) => {
    const cp = c.codePointAt(0)!;
    return cp >= 0x2800 && cp <= 0x28ff ? cp - 0x2800 : 0;
  });
}
