import { useMemo } from "react";
import { useI18n } from "../i18n";
import { BOOKS, TOTAL_CHAPTERS } from "../data/books";
import { readSet } from "../data/plan";
import { BrailleStrip } from "./BrailleStrip";
import { DP } from "../dotpad/DotPadManager";
import type { BibleReaderEngine } from "../hooks/useBibleReader";

export function HomeView({ engine }: { engine: BibleReaderEngine }) {
  const { t, lang } = useI18n();
  const {
    homeVerseText, homeVerseRef, homeVerseLang,
    todayPlan, todayQueue, refCh, openChapter,
    resumePos, refV, live,
  } = engine;

  const todayLine = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(t("home.locale"), { year: "numeric", month: "long", day: "numeric", weekday: "long" }) + t("home.dateSuffix");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, lang]);

  const read = readSet();
  const pct = Math.round((read.size / TOTAL_CHAPTERS) * 1000) / 10;
  const todayCount = todayPlan.to - todayPlan.from + 1;

  const speakKeyVerse = () => {
    engine.stopPlayer();
    // 홈 화면 전용 단발 발화 — Player를 거치지 않고 바로 speechSynthesis
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(homeVerseText);
      u.lang = engine.translation.ttsLang || "ko-KR";
      window.speechSynthesis.speak(u);
    } catch { /* noop */ }
  };

  const sendKeyVerse = async () => {
    if (!DP.isConnected()) { live(t("dp.connectFirst")); return; }
    const ok = await engine.send();
    live(ok ? t("dp.sendOk") : t("dp.sendFailRetry"));
  };

  return (
    <section aria-labelledby="homeTitle">
      <h1 id="homeTitle">{t("home.title")}</h1>
      <p className="sub">{todayLine}</p>

      <div className="verse-card">
        <span className="eyebrow">{t("home.eyebrow")}</span>
        <blockquote lang={homeVerseLang}>{homeVerseText}</blockquote>
        <cite lang={homeVerseLang}>— {homeVerseRef} ({t("home.bundledSource")})</cite>
        <BrailleStrip engine={engine} />
        <div className="row">
          <button className="btn primary" onClick={sendKeyVerse}>{t("home.sendKey")}</button>
          <button className="btn" onClick={speakKeyVerse}>{t("home.speakKey")}</button>
        </div>
      </div>

      <div className="card">
        <h2>{t("home.planTitle")}</h2>
        <p className="sub">{t("home.planDesc", TOTAL_CHAPTERS, todayCount)}</p>
        <div className="plan-grid">
          <div className="stat"><b>{t("home.statDay", todayPlan.day)}</b><span>{t("home.statJourney")}</span></div>
          <div className="stat">
            <b>{pct}%</b><span>{t("home.statProgress")}</span>
            <div className="progress"><i style={{ width: pct + "%" }} /></div>
          </div>
        </div>
        <p className="field-label">{t("home.fieldLabel")}</p>
        <div className="chip-list" role="list">
          {todayQueue.map((q, i) => {
            const key = q.bookId + "-" + q.chapter;
            const done = read.has(key);
            return (
              <button
                key={key}
                className="chip"
                role="listitem"
                aria-pressed={done ? "true" : "false"}
                onClick={() => openChapter(q.bookId, q.chapter, todayQueue, i)}
              >
                {refCh(q.bookId, q.chapter)}{done ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <div className="row">
          <button
            className="btn primary"
            onClick={() => { if (todayQueue.length) openChapter(todayQueue[0].bookId, todayQueue[0].chapter, todayQueue, 0); }}
          >
            {t("home.startToday")}
          </button>
          <button
            className="btn"
            onClick={async () => {
              if (todayQueue.length) {
                await openChapter(todayQueue[0].bookId, todayQueue[0].chapter, todayQueue, 0);
                engine.playStart(0);
              }
            }}
          >
            {t("home.listenToday")}
          </button>
        </div>
        {resumePos && resumePos.bookId && BOOKS[resumePos.bookId - 1] && (
          <div className="row row--tight">
            <button
              className="btn"
              onClick={async () => {
                await openChapter(resumePos.bookId, resumePos.chapter, engine.reader.queue, resumePos.qIdx);
                engine.playStart(resumePos.cur || 0);
              }}
            >
              {t("reader.resume", refV(resumePos.bookId, resumePos.chapter, resumePos.cur + 1))}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
