import { useI18n } from "../i18n";
import { pickLocalized } from "../data/translations";
import * as BR from "../braille";
import type { BibleReaderEngine } from "../hooks/useBibleReader";

export function Footer({ engine }: { engine: BibleReaderEngine }) {
  const { t, lang } = useI18n();
  const { translation } = engine;

  const attributionText = pickLocalized(translation.attribution, lang);
  const licenseNote = pickLocalized(translation.licenseNote, lang);
  const brailleNote = pickLocalized(translation.brailleNote, lang);

  const bits = [t("footer.attrPrefix") + attributionText];
  if (licenseNote) bits.push(licenseNote);
  if (translation.modified) bits.push(t("footer.modified"));
  bits.push(t("footer.sourcePrefix") + translation.source);

  const brailleLine = BR.hasEngine(translation.braille)
    ? t("footer.brailleImpl", brailleNote)
    : t("footer.brailleNone", brailleNote);

  return (
    <footer>
      <span>{bits.join(" · ")}.</span> · <span>{t("footer.about")}</span> · <span>{brailleLine}</span>
    </footer>
  );
}
