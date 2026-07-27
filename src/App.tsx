import { useEffect } from "react";
import { I18nProvider, useI18n } from "./i18n";
import { useBibleReader } from "./hooks/useBibleReader";
import { useDotPadKeys } from "./hooks/useDotPadKeys";
import { useEmbedAdapter } from "./hooks/useEmbedAdapter";
import { useReaderBarHeight } from "./hooks/useReaderBarHeight";
import { Header } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { ReaderView } from "./components/ReaderView";
import { BrowseView } from "./components/BrowseView";
import { Footer } from "./components/Footer";

function AppShell() {
  const { t } = useI18n();
  const engine = useBibleReader();

  useDotPadKeys(engine, engine.graphicBtnVisible);
  useEmbedAdapter(engine);
  useReaderBarHeight([engine.view, engine.pages.length, engine.reader.verses.length]);

  // 문서 제목·설명 — 원본의 applyI18N()이 하던 것 중 이 두 가지만 React
  // 밖(문서 head)이라 effect로 남겨둔다. 나머지 정적 문구는 JSX가 알아서
  // 다시 그린다(언어가 바뀌면 t()가 새 값을 반환하므로 별도 재적용이 필요 없다).
  useEffect(() => {
    document.title = t("meta.title");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));
  }, [t]);

  return (
    <>
      <Header engine={engine} />
      <main id="main">
        {engine.dpNotice && <div className="notice err" role="alert">{engine.dpNotice}</div>}
        {engine.view === "home" && <HomeView engine={engine} />}
        {engine.view === "reader" && <ReaderView engine={engine} />}
        {engine.view === "browse" && <BrowseView engine={engine} />}
      </main>
      <Footer engine={engine} />
      <div className="visually-hidden" role="status" aria-live="polite" lang={engine.liveLang}>
        {engine.liveMsg}
      </div>
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
