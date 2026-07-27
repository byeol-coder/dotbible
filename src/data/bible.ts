/* 본문 데이터 어댑터 — 로컬 JSON 우선 → 공개 API → 내장 샘플
   로컬 스키마: bible/<번역본>/{bookId}.json = {"1":["1절 본문", ...], "2":[...]} */
import { TRANSLATIONS } from "./translations";

export type ChapterSource = "local" | "api" | "sample" | "none";
export interface ChapterResult {
  verses: string[] | null;
  source: ChapterSource;
}

export interface GraphicPage {
  hex: string;
  alt: string;
  verse: number | null;
  audio: string | null;
}
export interface GraphicSet {
  key: string;
  title: string;
  pages: GraphicPage[];
}

const SAMPLE: Record<string, Record<string, string[]>> = {
  "1": { "1": [
    "태초에 하나님이 천지를 창조하시니라",
    "땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 신은 수면에 운행하시니라",
    "하나님이 가라사대 빛이 있으라 하시매 빛이 있었고",
    "그 빛이 하나님의 보시기에 좋았더라 하나님이 빛과 어두움을 나누사",
    "빛을 낮이라 칭하시고 어두움을 밤이라 칭하시니라 저녁이 되며 아침이 되니 이는 첫째 날이니라",
  ]},
  "19": { "23": [
    "여호와는 나의 목자시니 내가 부족함이 없으리로다",
    "그가 나를 푸른 초장에 누이시며 쉴만한 물 가으로 인도하시는도다",
    "내 영혼을 소생시키시고 자기 이름을 위하여 의의 길로 인도하시는도다",
    "내가 사망의 음침한 골짜기로 다닐지라도 해를 두려워하지 않을 것은 주께서 나와 함께 하심이라 주의 지팡이와 막대기가 나를 안위하시나이다",
    "주께서 내 원수의 목전에서 내게 상을 베푸시고 기름으로 내 머리에 바르셨으니 내 잔이 넘치나이다",
    "나의 평생에 선하심과 인자하심이 정녕 나를 따르리니 내가 여호와의 집에 영원히 거하리로다",
  ]},
};

interface ApiVerse { verse: number; text?: string }

const bookCache: Record<string, Record<string, string[]>> = {};
const gfxCache: Record<string, GraphicSet | null> = {};

export async function loadChapter(translationId: string, bookId: number, chapter: number): Promise<ChapterResult> {
  // 1) 로컬 데이터 (배포 시 bible/<번역본>/*.json 동봉 — 권장 경로)
  try {
    const ck = translationId + ":" + bookId;
    if (!bookCache[ck]) {
      const r = await fetch(`/bible/${translationId}/${bookId}.json`, { cache: "force-cache" });
      if (r.ok) bookCache[ck] = await r.json();
    }
    const local = bookCache[ck];
    if (local && local[chapter]) return { verses: local[chapter], source: "local" };
  } catch { /* 로컬 없음 → 다음 경로 */ }

  // 2) 공개 API — 번역본 레지스트리에 apiBase가 있는 것만
  try {
    const base = TRANSLATIONS[translationId]?.apiBase;
    if (!base) throw new Error("no api");
    const r = await fetch(`${base}/${bookId}/${chapter}.json`);
    if (r.ok) {
      const j = await r.json();
      const verses: string[] = (j.verses || [])
        .sort((a: ApiVerse, b: ApiVerse) => a.verse - b.verse)
        .map((v: ApiVerse) => String(v.text || "").trim());
      if (verses.length) return { verses, source: "api" };
    }
  } catch { /* 오프라인 등 → 샘플 */ }

  // 3) 내장 샘플 — 개역한글 전용
  const s = translationId === "kor-krv" ? SAMPLE[bookId]?.[chapter] : undefined;
  if (s) return { verses: s, source: "sample" };
  return { verses: null, source: "none" };
}

/** 핵심 촉각 그래픽 — 본문별 DTMS 그래픽(300/600 hex)을 배포 폴더에서 로드.
    스키마: bible/graphics/{bookId}-{chapter}.json
      단일 이미지(구): { hex, alt, verse }
      여러 페이지(신): { title, pages:[{hex, alt, verse, audio}] } — DTMS 저작 툴 산출물
    전체 66권 적용 파이프라인이 아니라 선별 챕터에 붙이는 opt-in 기능이다. */
export async function loadGraphic(bookId: number, chapter: number): Promise<GraphicSet | null> {
  const key = bookId + "-" + chapter;
  if (gfxCache[key] !== undefined) return gfxCache[key];
  try {
    const r = await fetch(`/bible/graphics/${key}.json`, { cache: "force-cache" });
    if (r.ok) {
      const j = await r.json();
      const pages: GraphicPage[] = Array.isArray(j?.pages)
        ? j.pages
        : j?.hex
          ? [{ hex: j.hex, alt: j.alt, verse: j.verse ?? null, audio: null }]
          : [];
      if (pages.length) {
        const g: GraphicSet = { key, title: j?.title || "", pages };
        gfxCache[key] = g;
        return g;
      }
    }
  } catch { /* 없음 */ }
  gfxCache[key] = null;
  return null;
}

/** 번역본을 바꾸면 이전 번역본의 로컬 캐시는 무의미하다 — 비워서 새로 받게 한다. */
export function clearChapterCache(): void {
  for (const k of Object.keys(bookCache)) delete bookCache[k];
}
