import { TOTAL_CHAPTERS } from "./books";
import { store } from "./store";

/** 1년 1독(366일 균등 분배, 결정적 계산) */
export const PLAN = {
  dayOfYear(d: Date = new Date()): number {
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d.getTime() - start.getTime()) / 86400000);
  },
  daysInYear(d: Date = new Date()): number {
    const y = d.getFullYear();
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  },
  /** 오늘 읽을 통독 순번 범위 [from..to] */
  todayRange(d: Date = new Date()): { day: number; from: number; to: number } {
    const day = this.dayOfYear(d), N = this.daysInYear(d);
    const from = Math.floor(((day - 1) * TOTAL_CHAPTERS) / N) + 1;
    const to = Math.floor((day * TOTAL_CHAPTERS) / N);
    return { day, from, to: Math.max(from, to) };
  },
};

/** 읽음 표시(book-chapter 키 집합) */
const READ_KEY = "dw.read.v1";

export function readSet(): Set<string> {
  return new Set(store.get<string[]>(READ_KEY, []));
}

export function markRead(bookId: number, ch: number): void {
  const s = readSet();
  s.add(bookId + "-" + ch);
  store.set(READ_KEY, [...s]);
}
