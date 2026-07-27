import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { BrailleStrip } from "./BrailleStrip";
import { DP } from "../dotpad/DotPadManager";
import type { BibleReaderEngine } from "../hooks/useBibleReader";

export function ReaderView({ engine }: { engine: BibleReaderEngine }) {
  const { t } = useI18n();
  const {
    reader, readerFrom, readerNotice, tactileMode, toggleTactileMode,
    selectVerse, markCurrentRead, playing, auto, setAuto, rate, setRate,
    playToggle, repeat, where, pagerMode, graphicBtnVisible, graphicView,
    showGraphicPage, toggleGraphic, nav, translation, refCh,
  } = engine;

  const listRef = useRef<HTMLOListElement>(null);

  // 절이 바뀌면 현재 절로 스크롤 — scroll-padding-bottom(CSS)이 스티키
  // 도구 막대 뒤로 숨는 것을 막아준다(별도 지점 참고).
  useEffect(() => {
    const li = listRef.current?.children[reader.cur] as HTMLElement | undefined;
    li?.scrollIntoView?.({ block: "nearest" });
  }, [reader.cur]);

  const backLabel = "‹ " + t(readerFrom === "home" ? "nav.today" : "nav.browse");
  const title = reader.bookId ? refCh(reader.bookId, reader.chapter!) : t("reader.title");

  return (
    <section aria-labelledby="readerTitle">
      <button type="button" className="back-link" onClick={() => nav(readerFrom)}>{backLabel}</button>
      <div className="reader-head">
        <h2 id="readerTitle" lang={translation.langCode}>{title}</h2>
        <span className="meta" lang={translation.langCode}>{translation.short}</span>
      </div>
      {readerNotice && <div className={"notice " + (readerNotice.kind === "err" ? "err" : "info")}>{readerNotice.text}</div>}

      {!reader.verses.length ? (
        <ol className="verses"><li><span className="n" />{t("reader.loading")}</li></ol>
      ) : (
        <ol className="verses" ref={listRef} lang={translation.langCode}>
          {reader.verses.map((v, i) => (
            <li
              key={i}
              tabIndex={0}
              aria-current={i === reader.cur ? "true" : undefined}
              onClick={() => selectVerse(i)}
              onKeyDown={(e) => { if (e.key === "Enter") selectVerse(i); }}
            >
              <span className="n">{i + 1}</span><span>{v}</span>
            </li>
          ))}
        </ol>
      )}

      <BrailleStrip engine={engine} />

      <div className="reader-bar" role="toolbar" aria-label={t("reader.toolbarAria")}>
        <p className="field-label">{t("reader.groupPlay")}</p>
        <div className="row row--tight">
          <button className="btn primary" aria-pressed={playing ? "true" : "false"} onClick={playToggle}>
            {playing ? t("btn.pause") : t("btn.play")}
          </button>
          <button className="btn sm" onClick={repeat}>{t("reader.repeat")}</button>
          <button className="btn sm" onClick={() => selectVerse(reader.cur - 1)}>{t("reader.prevVerse")}</button>
          <button className="btn sm" onClick={() => selectVerse(reader.cur + 1)}>{t("reader.nextVerse")}</button>
        </div>

        <p className="field-label">{t("reader.groupOutput")}</p>
        <div className="row row--tight">
          <button className="btn sm" onClick={where}>{t("reader.where")}</button>
          <button
            className="btn sm accent2"
            onClick={async () => {
              if (!DP.isConnected()) { engine.live(t("dp.connectFirst")); return; }
              const ok = await engine.send();
              engine.live(ok ? t("dp.sendOk") : t("dp.sendFailRetry"));
            }}
          >
            {t("reader.sendVerse")}
          </button>
          <button className="btn sm" onClick={markCurrentRead}>{t("reader.markRead")}</button>
        </div>

        <p className="field-label">{t("reader.groupSettings")}</p>
        <div className="row row--tight row--center">
          <span className="speed-label" id="speedLabel">{t("reader.speedLabel")}</span>
          <div className="seg" role="group" aria-labelledby="speedLabel">
            {[[0.8, "reader.speedSlow"], [0.95, "reader.speedNormal"], [1.2, "reader.speedFast"]].map(([r, key]) => (
              <button
                key={key as string}
                className="seg-btn"
                aria-pressed={rate === r ? "true" : "false"}
                onClick={() => { setRate(r as number); engine.live(t("reader.speedSet", t(key as string))); }}
              >
                {t(key as string)}
              </button>
            ))}
          </div>
          <button className="btn sm" aria-pressed={auto ? "true" : "false"} onClick={() => setAuto(!auto)}>
            {t(auto ? "btn.autoOn" : "btn.autoOff")}
          </button>
          <button className="btn sm" aria-pressed={tactileMode === "chapter" ? "true" : "false"} onClick={toggleTactileMode}>
            {t(tactileMode === "chapter" ? "btn.tactileChapter" : "btn.tactileVerse")}
          </button>
          {graphicBtnVisible && (
            <button className="btn sm" aria-pressed={pagerMode === "graphic" ? "true" : "false"} onClick={toggleGraphic}>
              {t(pagerMode === "graphic" ? "btn.graphicHide" : "btn.graphicShow")}
            </button>
          )}
        </div>

        {pagerMode === "graphic" && graphicView && graphicView.pages.length > 1 && (
          <div className="row row--tight row--center">
            <span className="speed-label">{t("reader.graphicPageOf", graphicView.idx + 1, graphicView.pages.length)}</span>
            <div className="seg" role="group" aria-label={t("reader.graphicNavAria")}>
              <button className="seg-btn" disabled={graphicView.idx <= 0} onClick={() => showGraphicPage(graphicView.idx - 1)}>
                {t("reader.graphicPrev")}
              </button>
              <button className="seg-btn" disabled={graphicView.idx >= graphicView.pages.length - 1} onClick={() => showGraphicPage(graphicView.idx + 1)}>
                {t("reader.graphicNext")}
              </button>
            </div>
          </div>
        )}

        <p className="field-label">{t("reader.groupNav")}</p>
        <div className="row row--tight">
          <div className="seg" role="group" aria-label={t("reader.panGroupAria")}>
            <button className="seg-btn" onClick={() => engine.pagerMove(-1)}>{t("reader.panPrev")}</button>
            <button className="seg-btn" onClick={() => engine.pagerMove(1)}>{t("reader.panNext")}</button>
          </div>
        </div>

        <details className="shortcuts">
          <summary>{t("reader.shortcutsToggle")}</summary>
          <p className="kbd-help" dangerouslySetInnerHTML={{ __html: t("reader.kbdHelp") }} />
          <p className="kbd-help">
            {t("reader.dpKeysLabel")}: <kbd>F1</kbd> {t("btn.play")} · <kbd>F2</kbd> {t("reader.prevVerse")} ·{" "}
            <kbd>F3</kbd> {t("reader.nextVerse")} · <kbd>F4</kbd> {t("reader.where")} · <kbd>F1+F2</kbd> {t("reader.repeat")} ·{" "}
            <kbd>F2+F3</kbd> {t("btn.graphicShow")} · <kbd>F3+F4</kbd> {t("btn.tactileChapter")} · <kbd>F1+F4</kbd> {t("reader.markRead")}
          </p>
        </details>
      </div>
    </section>
  );
}
