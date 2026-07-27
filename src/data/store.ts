/* localStorage 안전 래퍼 — 미리보기/시크릿 환경에서도 죽지 않게 메모리 폴백 */
const mem: Record<string, unknown> = {};

export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? ((k in mem ? mem[k] : d) as T) : (JSON.parse(v) as T);
    } catch {
      return (k in mem ? mem[k] : d) as T;
    }
  },
  set<T>(k: string, v: T): void {
    mem[k] = v;
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* noop */
    }
  },
};
