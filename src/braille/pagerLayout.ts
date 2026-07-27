/* 촉각 면 레이아웃 — 60×40(또는 96×64) 멀티라인 면을 최대한 활용
     · 장문 점자를 한 화면에 여러 줄로 펼쳐 손으로 훑게 함
     · 핵심 그래픽(hex)을 촉각으로 그대로 표시
   셀 배치: 점자 셀 = 2×4 도트, 가로 3핀(2+간격)·세로 5핀(4+간격)
   기기 전송: 2×4 핀 블록 단위 패킹(DTMS: bit = lx*4+ly)

   원본 vanilla 앱의 순수 함수를 그대로 옮겼다 — DP.gridPins()에만
   의존하던 것을 파라미터로 받도록 바꿔 테스트하기 쉽게 했다. */

export const DOT_DXY: Record<number, [number, number]> = {
  1: [0, 0], 2: [0, 1], 3: [0, 2], 4: [1, 0], 5: [1, 1], 6: [1, 2], 7: [0, 3], 8: [1, 3],
};

export interface GridPins { cols: number; rows: number }
export interface LayoutResult { pages: number[][][]; LINE: number; LINES: number }

/** 셀 바이트 배열(공백=0) → 화면 줄바꿈된 페이지 배열.
    각 페이지 = 줄 배열, 줄 = 셀바이트 배열 */
export function layoutPages(cellBytes: number[], grid: GridPins): LayoutResult {
  const LINE = Math.max(1, Math.floor(grid.cols / 3));
  const LINES = Math.max(1, Math.floor(grid.rows / 5));
  const words: number[][] = [];
  let cur: number[] = [];
  for (const b of cellBytes) {
    if (b === 0) { if (cur.length) { words.push(cur); cur = []; } }
    else cur.push(b);
  }
  if (cur.length) words.push(cur);

  const lines: number[][] = [];
  let line: number[] = [];
  for (let w of words) {
    while (w.length > LINE) {
      if (line.length) { lines.push(line); line = []; }
      lines.push(w.slice(0, LINE));
      w = w.slice(LINE);
    }
    const need = w.length + (line.length ? 1 : 0);
    if (line.length + need > LINE) { lines.push(line); line = []; }
    if (line.length) line.push(0); // 어절 사이 빈 셀
    line.push(...w);
  }
  if (line.length) lines.push(line);

  const pages: number[][][] = [];
  for (let i = 0; i < lines.length; i += LINES) pages.push(lines.slice(i, i + LINES));
  return { pages: pages.length ? pages : [[]], LINE, LINES };
}

/** 페이지(줄×셀) → 핀 비트맵 [rows][cols] */
export function pageToBits(page: number[][], grid: GridPins): Uint8Array[] {
  const bits = Array.from({ length: grid.rows }, () => new Uint8Array(grid.cols));
  (page || []).forEach((lineCells, li) =>
    lineCells.forEach((byte, ci) => {
      if (!byte) return;
      const x0 = ci * 3, y0 = li * 5;
      for (let d = 1; d <= 8; d++) {
        if (byte & (1 << (d - 1))) {
          const [dx, dy] = DOT_DXY[d];
          if (bits[y0 + dy]) bits[y0 + dy][x0 + dx] = 1;
        }
      }
    })
  );
  return bits;
}

const CELL: [number, number][] = [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]];

/** 핀 비트맵 → 기기 hex (2×4 블록, bit=lx*4+ly) */
export function bitsToDeviceHex(bits: Uint8Array[], grid: GridPins): string {
  let out = "";
  for (let cr = 0; cr < grid.rows / 4; cr++) {
    for (let cc = 0; cc < grid.cols / 2; cc++) {
      let byte = 0;
      CELL.forEach(([dx, dy], b) => {
        const x = cc * 2 + dx, y = cr * 4 + dy;
        if (bits[y]?.[x]) byte |= 1 << b;
      });
      out += byte.toString(16).padStart(2, "0");
    }
  }
  return out;
}

/** 기기 hex → 핀 비트맵 (그래픽 미러용, bitsToDeviceHex 역변환) */
export function deviceHexToBits(hex: string, grid: GridPins): Uint8Array[] {
  const bits = Array.from({ length: grid.rows }, () => new Uint8Array(grid.cols));
  let i = 0;
  for (let cr = 0; cr < grid.rows / 4; cr++) {
    for (let cc = 0; cc < grid.cols / 2; cc++) {
      const byte = parseInt((hex || "").substr(i, 2) || "0", 16) || 0;
      i += 2;
      CELL.forEach(([dx, dy], b) => {
        if (byte & (1 << b)) {
          const x = cc * 2 + dx, y = cr * 4 + dy;
          if (bits[y]) bits[y][x] = 1;
        }
      });
    }
  }
  return bits;
}
