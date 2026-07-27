import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { BOOKS } from "../data/books";
import { listEnabledTranslations, pickLocalized } from "../data/translations";
import * as BR from "../braille";
import type { BibleReaderEngine } from "../hooks/useBibleReader";

export function BrowseView({ engine }: { engine: BibleReaderEngine }) {
  const { t, lang } = useI18n();
  const { translationId, setTranslationId, translation, chLabel, bookName, openChapter, prepBraille } = engine;

  const [bookId, setBookId] = useState(1);
  const [chapter, setChapter] = useState(1);
  const book = BOOKS[bookId - 1];

  useEffect(() => { setChapter(1); }, [bookId, translationId]);

  const louisOk = BR.louisReady(translation.louis);
  const builtinOk = BR.hasEngine(translation.braille);
  const louisFailed = BR.louisFailed();
  const lic = pickLocalized(translation.license, lang);
  const note = pickLocalized(translation.brailleNote, lang);

  let transClass = "notice info";
  let transText = t("trans.notReady", lic, note);
  if (louisOk) { transClass = "notice ok"; transText = t("trans.louisReady", lic, note); }
  else if (builtinOk) { transClass = "notice ok"; transText = t("trans.builtinReady", lic, note); }
  else if (louisFailed) { transClass = "notice err"; transText = t("trans.louisFailed", lic); }

  return (
    <section aria-labelledby="browseTitle">
      <h1 id="browseTitle">{t("browse.title")}</h1>
      <p className="sub">{t("browse.sub")}</p>
      <div className="card">
        <div className="row row--flush row--bottom">
          <label className="fld">
            <span>{t("browse.transLabel")}</span>
            <select
              aria-label={t("browse.transAria")}
              value={translationId}
              onChange={async (e) => {
                setTranslationId(e.target.value);
                engine.live(t("trans.selected", e.target.value));
                await prepBraille();
              }}
            >
              {listEnabledTranslations().map((tr) => (
                <option key={tr.id} value={tr.id}>{tr.lang} · {tr.title}</option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>{t("browse.bookLabel")}</span>
            <select aria-label={t("browse.bookAria")} value={bookId} onChange={(e) => setBookId(+e.target.value)}>
              {BOOKS.map((b) => (
                <option key={b.id} value={b.id}>{bookName(b.id)}</option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>{t("browse.chapterLabel")}</span>
            <select aria-label={t("browse.chapterAria")} value={chapter} onChange={(e) => setChapter(+e.target.value)}>
              {Array.from({ length: book.chapters }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{chLabel(n)}</option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={() => openChapter(bookId, chapter, null, -1)}>{t("browse.open")}</button>
        </div>
        <div className={transClass}>{transText}</div>
        <div className="notice info" dangerouslySetInnerHTML={{ __html: t("browse.dataNote") }} />
      </div>
    </section>
  );
}
