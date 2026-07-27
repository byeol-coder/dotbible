/* 리더 엔진 — 원본 vanilla 앱의 Trans/Pager/Speech/Player/UI 오케스트레이션을
   하나의 훅으로 옮겼다. 알고리즘과 흐름은 그대로다:
     장 열기 → 절 목록 로드 → 촉각 면 배치 → 재생/이동 → 닷패드 동기

   전역 싱글턴 대신 React state로 관리하지만, 로직 자체는 원본과 동일하다
   (같은 순서로 같은 부수효과가 일어난다). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOKS } from "../data/books";
import { store } from "../data/store";
import {
  TRANSLATIONS,
  DEFAULT_TRANSLATION,
  pickLocalized,
  type TranslationConfig,
} from "../data/translations";
import { loadChapter, loadGraphic, clearChapterCache, type GraphicPage } from "../data/bible";
import * as BR from "../braille";
import { layoutPages, pageToBits, bitsToDeviceHex, deviceHexToBits } from "../braille/pagerLayout";
import { DP } from "../dotpad/DotPadManager";
import { useI18n, type TFn, type UILang } from "../i18n";
import { PLAN, readSet, markRead } from "../data/plan";
import { KEY_VERSES } from "../data/keyVerses";

export type View = "home" | "reader" | "browse";
export type PagerMode = "verse" | "chapter" | "graphic";

export interface QueueItem { bookId: number; chapter: number }

export interface ReaderState {
  bookId: number | null;
  chapter: number | null;
  verses: string[];
  cur: number;
  queue: QueueItem[] | null;
  qIdx: number;
}

export interface GraphicViewState {
  key: string;
  pages: GraphicPage[];
  idx: number;
}

function useSpeech(ttsLangRef: React.MutableRefObject<string>) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const rateRef = useRef<number>((() => {
    const r = store.get("dw.rate", 0.95);
    return r >= 0.5 && r <= 2 ? r : 0.95;
  })());

  const setRate = useCallback((r: number) => { rateRef.current = r; store.set("dw.rate", r); }, []);

  const stop = useCallback(() => {
    try { if (supported) window.speechSynthesis.cancel(); } catch { /* noop */ }
  }, [supported]);

  const speakOne = useCallback((text: string, onend?: () => void) => {
    if (!supported) { onend?.(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = ttsLangRef.current;
      u.rate = rateRef.current;
      if (onend) { u.onend = () => onend(); u.onerror = () => onend(); }
      window.speechSynthesis.speak(u);
    } catch { onend?.(); }
  }, [supported, ttsLangRef]);

  return { supported, rate: rateRef.current, setRate, stop, speakOne };
}

export function useBibleReader() {
  const { lang: uiLang, t } = useI18n();

  // ── 번역본 ──────────────────────────────────────────────────
  const [translationId, setTranslationIdState] = useState<string>(() => store.get("dw.trans", DEFAULT_TRANSLATION));
  const translation: TranslationConfig = TRANSLATIONS[translationId] || TRANSLATIONS[DEFAULT_TRANSLATION];
  const [bookNames, setBookNames] = useState<string[] | null>(null);

  const bookName = useCallback((id: number) => bookNames?.[id - 1] || BOOKS[id - 1].name, [bookNames]);
  const refCh = useCallback((id: number, ch: number) => {
    const r = translation.ref, b = bookName(id);
    return r ? r.ch(b, ch) : `${b} ${ch}장`;
  }, [translation, bookName]);
  const refV = useCallback((id: number, ch: number, v: number) => {
    const r = translation.ref, b = bookName(id);
    return r ? r.v(b, ch, v) : `${b} ${ch}:${v}`;
  }, [translation, bookName]);
  const chLabel = useCallback((n: number) => {
    const r = translation.ref;
    return r ? r.ch("", n).trim() : `${n}장`;
  }, [translation]);

  const ttsLangRef = useRef(translation.ttsLang || "ko-KR");
  useEffect(() => { ttsLangRef.current = translation.ttsLang || "ko-KR"; }, [translation]);

  const canBraille = useCallback(
    () => BR.louisReady(translation.louis) || BR.hasEngine(translation.braille),
    [translation]
  );

  const setTranslationId = useCallback((id: string) => {
    if (!TRANSLATIONS[id]) return;
    setTranslationIdState(id);
    store.set("dw.trans", id);
    clearChapterCache();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBookNames(null);
    fetch(`/bible/${translationId}/books.json`, { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((n) => {
        if (!cancelled && Array.isArray(n) && n.length === 66) setBookNames(n);
      })
      .catch(() => { /* 내장 이름 유지 */ });
    return () => { cancelled = true; };
  }, [translationId]);

  // ── 알림/안내(원본 dpNotice / live) ──────────────────────────
  const [dpNotice, setDpNotice] = useState("");
  const [liveMsg, setLiveMsgState] = useState("");
  const [liveLang, setLiveLang] = useState<string | undefined>(undefined);
  const live = useCallback((msg: string, langCode?: string) => {
    setLiveMsgState("");
    setTimeout(() => { setLiveMsgState(msg); setLiveLang(langCode); }, 30);
  }, []);

  // ── 점자 준비(liblouis) ─────────────────────────────────────
  const [, setBrailleReadyTick] = useState(0);
  const [louisFailedFlag, setLouisFailedFlag] = useState(false);
  const preparingRef = useRef<Promise<boolean> | null>(null);

  const prepBraille = useCallback(async (): Promise<boolean> => {
    if (!translation.louis) return true;
    if (preparingRef.current) return preparingRef.current;
    live(t("brl.prepping"));
    const p = BR.ready(translation.louis, translation.braille).then((ok) => {
      preparingRef.current = null;
      setBrailleReadyTick((x) => x + 1);
      setLouisFailedFlag(BR.louisFailed());
      return ok;
    });
    preparingRef.current = p;
    return p;
  }, [translation.louis, translation.braille, t, live]);

  // ── 뷰 전환 ─────────────────────────────────────────────────
  const [view, setViewState] = useState<View>("home");
  const stopPlayerRef = useRef<() => void>(() => {});
  const stopGraphicAudioRef = useRef<() => void>(() => {});
  const nav = useCallback((v: View) => {
    setViewState((prevView) => {
      if (prevView === "reader" && v !== "reader") {
        stopPlayerRef.current();
        stopGraphicAudioRef.current();
      }
      return v;
    });
  }, []);

  // ── 리더 상태 ───────────────────────────────────────────────
  const [reader, setReader] = useState<ReaderState>({
    bookId: null, chapter: null, verses: [], cur: 0, queue: null, qIdx: -1,
  });
  const [readerFrom, setReaderFrom] = useState<"home" | "browse">("home");
  const [readerNotice, setReaderNotice] = useState<{ kind: "info" | "err"; text: string } | null>(null);
  const [tactileMode, setTactileMode] = useState<"verse" | "chapter">("verse");

  const readerRef = useRef(reader);
  useEffect(() => { readerRef.current = reader; }, [reader]);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  // ── Pager(촉각 면) ──────────────────────────────────────────
  const [pagerMode, setPagerMode] = useState<PagerMode>("verse");
  const [pages, setPages] = useState<number[][][]>([[]]);
  const [pageIdx, setPageIdx] = useState(0);
  const [pagerLabel, setPagerLabel] = useState("");
  const [graphicHex, setGraphicHex] = useState<string | null>(null);
  const [lineInfo, setLineInfo] = useState({ LINE: 20, LINES: 8 });

  const grid = DP.gridPins();

  const toCellsFor = useCallback(
    (text: string) => BR.toCells(text, translation.louis, translation.braille),
    [translation]
  );

  const pagerSet = useCallback((text: string, label: string) => {
    const L = layoutPages(toCellsFor(text), grid);
    setPages(L.pages); setLineInfo({ LINE: L.LINE, LINES: L.LINES });
    setPageIdx(0); setPagerLabel(label || ""); setPagerMode("verse"); setGraphicHex(null);
  }, [toCellsFor, grid]);

  const pagerSetChapter = useCallback((verses: string[], label: string) => {
    const stream = verses.map((tx, i) => `${i + 1} ${tx}`).join("  ");
    const L = layoutPages(toCellsFor(stream), grid);
    setPages(L.pages); setLineInfo({ LINE: L.LINE, LINES: L.LINES });
    setPageIdx(0); setPagerLabel(label || ""); setPagerMode("chapter"); setGraphicHex(null);
  }, [toCellsFor, grid]);

  const pagerSetGraphic = useCallback((hex: string, label: string) => {
    setGraphicHex(hex); setPagerLabel(label || ""); setPagerMode("graphic"); setPageIdx(0);
  }, []);

  const pagerCount = useCallback(() => (pagerMode === "graphic" ? 1 : Math.max(1, pages.length)), [pagerMode, pages]);
  const bitsNow = useCallback(() => pageToBits(pages[pageIdx] || [], grid), [pages, pageIdx, grid]);
  const hexNow = useCallback(
    () => (pagerMode === "graphic" ? graphicHex || "" : bitsToDeviceHex(bitsNow(), grid)),
    [pagerMode, graphicHex, bitsNow, grid]
  );

  const send = useCallback(async (): Promise<boolean> => {
    if (pagerMode !== "graphic" && !canBraille()) await prepBraille();
    if (pagerMode !== "graphic" && !canBraille()) {
      const msg = t("brl.gate", translation.lang, pickLocalized(translation.brailleNote, uiLang));
      setDpNotice(msg); live(msg);
      return false;
    }
    const hex = hexNow();
    const ok = await DP.outputGraphic(hex);
    if (pagerLabel) DP.outputTextLine(BR.toHex(toCellsFor(pagerLabel)));
    return ok;
  }, [pagerMode, canBraille, prepBraille, t, translation, uiLang, hexNow, pagerLabel, toCellsFor, live]);

  const present = useCallback(async (): Promise<boolean> => {
    if (DP.isConnected()) return send();
    return false;
  }, [send]);

  const pagerMove = useCallback(async (dir: number) => {
    if (pagerMode === "graphic") return;
    const p = pagerCount();
    const next = Math.min(p - 1, Math.max(0, pageIdx + dir));
    setPageIdx(next);
    if (DP.isConnected()) await send();
    live(t("pager.page", next + 1, p));
  }, [pagerMode, pagerCount, send, t, pageIdx, live]);

  // ── 재생(연속 청취) ─────────────────────────────────────────
  const speech = useSpeech(ttsLangRef);
  const [playing, setPlaying] = useState(false);
  const [auto, setAutoState] = useState<boolean>(() => store.get<boolean>("dw.auto", true) !== false);
  const setAuto = useCallback((v: boolean) => { setAutoState(v); store.set("dw.auto", v); }, []);
  const autoRef = useRef(auto);
  useEffect(() => { autoRef.current = auto; }, [auto]);

  const selectVerse = useCallback((i: number) => {
    setReader((r) => {
      if (!r.verses.length) return r;
      const cur = Math.min(r.verses.length - 1, Math.max(0, i));
      return { ...r, cur };
    });
  }, []);

  // 절 인덱스가 바뀌면(재생/이동/클릭 모두 여길 통과) 절 단위 모드일 때만
  // 촉각 면을 동기화한다 — 원본의 selectVerse 안 동기 처리를 effect로 재현.
  useEffect(() => {
    if (!reader.bookId || !reader.verses.length) return;
    if (tactileMode !== "verse") return;
    if (pagerMode === "graphic") return;
    const label = refV(reader.bookId, reader.chapter!, reader.cur + 1);
    pagerSet(`${reader.cur + 1} ${reader.verses[reader.cur]}`, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader.cur, reader.bookId, reader.chapter]);

  const savePos = useCallback(() => {
    const r = readerRef.current;
    if (!r.bookId) return;
    store.set("dw.pos", { bookId: r.bookId, chapter: r.chapter, cur: r.cur, qIdx: r.qIdx });
  }, []);

  const stopPlayer = useCallback(() => {
    setPlaying(false);
    speech.stop();
  }, [speech]);
  useEffect(() => { stopPlayerRef.current = stopPlayer; }, [stopPlayer]);

  const openChapterRef = useRef<
    ((bookId: number, chapter: number, queue?: QueueItem[] | null, qIdx?: number) => Promise<void>) | null
  >(null);

  const stepRef = useRef<(i: number) => void>(() => {});
  stepRef.current = (i: number) => {
    const r = readerRef.current;
    if (i >= r.verses.length) {
      setPlaying(false);
      if (r.qIdx > -1 && r.queue && r.queue[r.qIdx + 1]) {
        const nx = r.queue[r.qIdx + 1];
        live(t("reader.nextChapter"));
        Promise.resolve(openChapterRef.current?.(nx.bookId, nx.chapter, r.queue, r.qIdx + 1)).then(() => {
          setPlaying(true);
          stepRef.current(0);
        });
      } else {
        live(t("reader.chapterDone"));
      }
      return;
    }
    selectVerse(i);
    savePos();
    speech.speakOne(t("reader.verseNum", i + 1, r.verses[i]), () => {
      if (autoRef.current) stepRef.current(i + 1);
      else setPlaying(false);
    });
  };

  const playStart = useCallback((fromIdx?: number) => {
    const r = readerRef.current;
    if (!r.verses.length) return;
    if (!speech.supported) { live(t("brl.audioUnsupported")); return; }
    setPlaying(true);
    live(auto ? t("reader.startListening") : t("reader.readingVerse"));
    stepRef.current(fromIdx == null ? r.cur : fromIdx);
  }, [auto, speech, t, live]);

  const playToggle = useCallback(() => { playing ? stopPlayer() : playStart(); }, [playing, stopPlayer, playStart]);

  const repeat = useCallback(() => {
    const r = readerRef.current;
    if (!r.verses.length) return;
    stopPlayer();
    selectVerse(r.cur);
    speech.speakOne(t("reader.verseNum", r.cur + 1, r.verses[r.cur]));
  }, [stopPlayer, selectVerse, speech, t]);

  const where = useCallback(() => {
    const r = readerRef.current;
    if (!r.bookId) return;
    let msg = t("reader.whereMsg", refCh(r.bookId, r.chapter!), r.verses.length, r.cur + 1);
    if (r.qIdx > -1 && r.queue && r.queue.length) msg += t("reader.whereQueue", r.queue.length, r.qIdx + 1);
    live(msg);
    if (DP.isConnected()) send();
  }, [t, refCh, send, live]);

  // ── 핵심 그래픽(그림책) ─────────────────────────────────────
  const [graphicBtnVisible, setGraphicBtnVisible] = useState(false);
  const [graphicView, setGraphicView] = useState<GraphicViewState | null>(null);
  const gfxAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopGraphicAudio = useCallback(() => {
    if (gfxAudioRef.current) { try { gfxAudioRef.current.pause(); } catch { /* noop */ } gfxAudioRef.current = null; }
    speech.stop();
  }, [speech]);
  useEffect(() => { stopGraphicAudioRef.current = stopGraphicAudio; }, [stopGraphicAudio]);

  const playGraphicAudio = useCallback((page: GraphicPage, key: string) => {
    stopGraphicAudio();
    if (page.audio) {
      const a = new Audio(`/bible/graphics/${key}/${page.audio}`);
      gfxAudioRef.current = a;
      a.play().catch(() => { gfxAudioRef.current = null; speech.speakOne(page.alt || ""); });
    } else {
      speech.speakOne(page.alt || "");
    }
  }, [stopGraphicAudio, speech]);

  const showGraphicPage = useCallback((idx: number) => {
    setGraphicView((gv) => {
      if (!gv || !gv.pages.length) return gv;
      const i = Math.max(0, Math.min(gv.pages.length - 1, idx));
      const p = gv.pages[i];
      const n = gv.pages.length;
      let label = refCh(reader.bookId!, reader.chapter!) + t("reader.graphicLabelSuffix");
      if (n > 1) label += " " + t("reader.graphicPageOf", i + 1, n);
      pagerSetGraphic(p.hex, label);
      if (DP.isConnected()) send();
      playGraphicAudio(p, gv.key);
      return { ...gv, idx: i };
    });
  }, [reader.bookId, reader.chapter, refCh, t, pagerSetGraphic, playGraphicAudio, send]);

  const toggleGraphic = useCallback(async () => {
    if (!graphicView) return;
    if (pagerMode !== "graphic") {
      showGraphicPage(graphicView.idx || 0);
    } else {
      stopGraphicAudio();
      if (tactileMode === "chapter") pagerSetChapter(reader.verses, refCh(reader.bookId!, reader.chapter!));
      else pagerSet(`${reader.cur + 1} ${reader.verses[reader.cur]}`, "");
      if (DP.isConnected()) await send();
      live(t("reader.graphicHidden"));
    }
  }, [graphicView, pagerMode, showGraphicPage, stopGraphicAudio, tactileMode, reader, refCh, pagerSetChapter, pagerSet, send, t, live]);

  // ── 장 열기 ─────────────────────────────────────────────────
  const openChapter = useCallback(async (bookId: number, chapter: number, queue?: QueueItem[] | null, qIdx = -1) => {
    setReaderFrom(viewRef.current !== "reader" ? (viewRef.current === "home" ? "home" : "browse") : readerFrom);
    nav("reader");
    stopGraphicAudio();
    setGraphicBtnVisible(false);
    setGraphicView(null);
    setReaderNotice(null);

    await prepBraille();
    const { verses, source } = await loadChapter(translationId, bookId, chapter);
    if (!verses) {
      setReader({ bookId, chapter, verses: [], cur: 0, queue: queue ?? null, qIdx });
      setReaderNotice({ kind: "err", text: t("reader.loadFail") });
      live(t("reader.loadFailShort"));
      return;
    }
    if (source !== "local") {
      setReaderNotice({ kind: source === "api" ? "info" : "err", text: source === "api" ? t("reader.viaApi") : t("reader.viaSample") });
    }
    setReader({ bookId, chapter, verses, cur: 0, queue: queue ?? null, qIdx });

    if (tactileMode === "chapter") {
      pagerSetChapter(verses, refCh(bookId, chapter));
      if (DP.isConnected()) await send();
    } else {
      pagerSet(`1 ${verses[0] ?? ""}`, refV(bookId, chapter, 1));
    }

    loadGraphic(bookId, chapter).then((g) => {
      if (readerRef.current.bookId === bookId && readerRef.current.chapter === chapter && g) {
        setGraphicView({ key: g.key, pages: g.pages, idx: 0 });
        setGraphicBtnVisible(true);
      }
    });

    live(t("reader.chapterOpened", refCh(bookId, chapter), verses.length));
  }, [translationId, tactileMode, refCh, refV, pagerSet, pagerSetChapter, send, prepBraille, t, nav, stopGraphicAudio, readerFrom, live]);

  useEffect(() => { openChapterRef.current = openChapter; }, [openChapter]);

  const toggleTactileMode = useCallback(() => {
    const r = readerRef.current;
    setTactileMode((prev) => {
      const next = prev === "verse" ? "chapter" : "verse";
      if (r.verses.length) {
        if (next === "chapter") { pagerSetChapter(r.verses, refCh(r.bookId!, r.chapter!)); live(t("reader.tactileChapter")); }
        else { pagerSet(`${r.cur + 1} ${r.verses[r.cur]}`, refV(r.bookId!, r.chapter!, r.cur + 1)); live(t("reader.tactileVerse")); }
      }
      return next;
    });
  }, [refCh, refV, pagerSet, pagerSetChapter, t, live]);

  const markCurrentRead = useCallback(() => {
    const r = readerRef.current;
    if (!r.bookId) return;
    markRead(r.bookId, r.chapter!);
    live(t("reader.markedRead", refCh(r.bookId, r.chapter!)));
  }, [t, refCh, live]);

  // ── 오늘의 구절(홈) ─────────────────────────────────────────
  const keyVerseIndex = PLAN.dayOfYear() % KEY_VERSES.length;
  const keyVerse = KEY_VERSES[keyVerseIndex];
  const [homeVerseText, setHomeVerseText] = useState(keyVerse[4]);
  const [homeVerseRef, setHomeVerseRef] = useState(keyVerse[3]);
  const [homeVerseLang, setHomeVerseLang] = useState<string>("ko");

  useEffect(() => {
    setHomeVerseText(keyVerse[4]); setHomeVerseRef(keyVerse[3]); setHomeVerseLang("ko");
    pagerSet(keyVerse[4], keyVerse[3]);
    if (translationId !== "kor-krv") {
      loadChapter(translationId, keyVerse[0], keyVerse[1]).then(({ verses }) => {
        const tx = verses?.[keyVerse[2] - 1];
        if (!tx) return;
        const code = translation.langCode, ref = refV(keyVerse[0], keyVerse[1], keyVerse[2]);
        setHomeVerseText(tx); setHomeVerseRef(ref); setHomeVerseLang(code);
        pagerSet(tx, ref);
      }).catch(() => { /* 조용히 개역한글 유지 */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationId]);

  // ── 통독 플랜(홈) ───────────────────────────────────────────
  const todayPlan = useMemo(() => PLAN.todayRange(), []);
  const todayQueue: QueueItem[] = useMemo(() => {
    const out: QueueItem[] = [];
    for (let n = todayPlan.from; n <= todayPlan.to; n++) {
      let acc = 0;
      for (const b of BOOKS) {
        if (n <= acc + b.chapters) { out.push({ bookId: b.id, chapter: n - acc }); break; }
        acc += b.chapters;
      }
    }
    return out;
  }, [todayPlan]);
  const [readCount, setReadCount] = useState(() => readSet().size);
  useEffect(() => { setReadCount(readSet().size); }, [reader.bookId, reader.chapter]);

  const [resumePos] = useState(() =>
    store.get<{ bookId: number; chapter: number; cur: number; qIdx: number } | null>("dw.pos", null)
  );

  return {
    uiLang, translationId, translation, setTranslationId, bookName, refCh, refV, chLabel,
    view, nav,
    reader, readerFrom, readerNotice, tactileMode, toggleTactileMode,
    openChapter, selectVerse, savePos, markCurrentRead,
    playing, auto, setAuto, rate: speech.rate, setRate: speech.setRate,
    playToggle, playStart, stopPlayer, repeat, where,
    pagerMode, pages, pageIdx, pagerLabel, lineInfo, grid,
    pagerSet, pagerSetChapter, pagerMove, send, present, hexNow,
    canBraille, prepBraille, louisFailedFlag,
    graphicBtnVisible, graphicView, showGraphicPage, toggleGraphic,
    homeVerseText, homeVerseRef, homeVerseLang, todayPlan, todayQueue, readCount, resumePos,
    dpNotice, setDpNotice, liveMsg, liveLang, live,
    deviceHexToBits,
  };
}

export type BibleReaderEngine = ReturnType<typeof useBibleReader>;
export type { TFn, UILang };
