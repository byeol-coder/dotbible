import { useCallback, useState } from "react";
import { useI18n } from "../i18n";
import { DP } from "../dotpad/DotPadManager";
import { useDotPadConnected } from "../dotpad/useDotPad";
import type { BibleReaderEngine, View } from "../hooks/useBibleReader";

export function Header({ engine }: { engine: BibleReaderEngine }) {
  const { lang, setLang, t } = useI18n();
  const connected = useDotPadConnected();
  const [busy, setBusy] = useState(false);
  const { nav, view, present } = engine;

  const onNavClick = useCallback((v: View) => {
    if (v === "reader" && !engine.reader.bookId) {
      if (engine.resumePos?.bookId) {
        engine.openChapter(engine.resumePos.bookId, engine.resumePos.chapter, engine.reader.queue, engine.resumePos.qIdx);
        return;
      }
      if (engine.todayQueue.length) {
        engine.openChapter(engine.todayQueue[0].bookId, engine.todayQueue[0].chapter, engine.todayQueue, 0);
        return;
      }
      nav("browse");
      return;
    }
    nav(v);
  }, [nav, engine]);

  const onDpClick = useCallback(async () => {
    if (DP.isConnected()) { engine.live(t("dp.alreadyConnecting", DP.deviceName())); return; }
    const blocked = DP.blocker(t);
    if (blocked) { engine.setDpNotice(blocked); engine.live(blocked); return; }
    engine.setDpNotice("");
    setBusy(true);
    try {
      await DP.connect();
      setBusy(false);
      engine.live(t("dp.connected", DP.deviceName()));
      present();
    } catch (err) {
      setBusy(false);
      const msg = DP.reason(err, t);
      engine.setDpNotice(msg);
      engine.live(msg);
      console.error("[DotPad] 연결 실패:", err);
      console.table(DP.diag());
    }
  }, [engine, t, present]);

  return (
    <header>
      <div className="logo" aria-hidden="true">
        <svg className="brand-mark" width="32" height="32" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="12" fill="#FFFFFF" />
          <path fill="#231F20" d="M8 10 29 16v38L8 48V10Zm48 0-21 6v38l21-6V10Z" />
          <g fill="#FFFFFF">
            <circle cx="16" cy="22" r="3" /><circle cx="23" cy="31" r="3" /><circle cx="16" cy="40" r="3" />
            <circle cx="48" cy="22" r="3" /><circle cx="41" cy="31" r="3" /><circle cx="48" cy="40" r="3" />
          </g>
        </svg>
        <span>{t("brand.name")}</span>
      </div>
      <span className="visually-hidden">{t("app.tagline")}</span>
      <nav aria-label={t("nav.aria")}>
        <button data-nav="home" aria-current={view === "home" ? "page" : undefined} onClick={() => onNavClick("home")}>
          {t("nav.today")}
        </button>
        <button data-nav="reader" aria-current={view === "reader" ? "page" : undefined} onClick={() => onNavClick("reader")}>
          {t("nav.reader")}
        </button>
        <button data-nav="browse" aria-current={view === "browse" ? "page" : undefined} onClick={() => onNavClick("browse")}>
          {t("nav.browse")}
        </button>
      </nav>
      <button
        type="button"
        className="dp-badge lang-toggle"
        aria-label={t("lang.switchAria", lang === "ko" ? "en" : "ko")}
        onClick={() => setLang(lang === "ko" ? "en" : "ko")}
      >
        {(lang === "ko" ? "en" : "ko").toUpperCase()}
      </button>
      <button
        type="button"
        className={"dp-badge" + (connected ? " on" : "")}
        aria-live="polite"
        aria-busy={busy ? "true" : "false"}
        disabled={busy}
        onClick={onDpClick}
      >
        <span className="lamp" aria-hidden="true" />
        <span>{busy ? t("dp.connecting") : connected ? t("dp.connected", DP.deviceName()) : t("dp.connect")}</span>
      </button>
    </header>
  );
}
