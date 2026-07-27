/* 닷패드 촉각 면 미러 — 홈 화면과 읽기 화면이 공유하는 컴포넌트.
   원본 vanilla 앱의 strip() 함수를 그대로 JSX로 옮겼다. 기기 최대 용량이
   아니라 현재 페이지가 실제로 쓰는 줄 수만큼만 그린다(짧은 절 하나 때문에
   화면 대부분을 빈 핀으로 채우지 않기 위해). 실제 닷패드 출력(hexNow)은
   기기 규격대로 그대로 나간다 — 여기서 줄이는 건 화면 미리보기뿐이다. */
import { useMemo } from "react";
import { DOT_DXY, pageToBits, deviceHexToBits } from "../braille/pagerLayout";
import { useI18n } from "../i18n";
import type { BibleReaderEngine } from "../hooks/useBibleReader";

const DOT_ORDER = [1, 4, 2, 5, 3, 6, 7, 8];

export function BrailleStrip({ engine }: { engine: BibleReaderEngine }) {
  const { t } = useI18n();
  const { grid, pagerMode, pages, pageIdx, lineInfo } = engine;

  const bits = useMemo(() => {
    if (pagerMode === "graphic" && engine.hexNow) {
      const hex = engine.hexNow();
      return hex ? deviceHexToBits(hex, grid) : pageToBits([], grid);
    }
    return pageToBits(pages[pageIdx] || [], grid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagerMode, pages, pageIdx, grid]);

  const cols = Math.floor(grid.cols / 3);
  const maxRows = Math.floor(grid.rows / 5);
  const curPage = pagerMode !== "graphic" ? pages[pageIdx] : null;
  const rows = curPage ? Math.max(1, Math.min(maxRows, curPage.length)) : maxRows;

  const label =
    t("strip.label", grid.cols, grid.rows) +
    (pagerMode === "graphic" ? t("strip.graphicSuffix") : t("strip.lineSuffix", lineInfo.LINE, lineInfo.LINES));
  const pageLabel = pagerMode === "graphic" ? "" : t("strip.pageOf", pageIdx + 1, engine.pagerMode === "graphic" ? 1 : Math.max(1, pages.length));

  return (
    <div className="braille-strip" aria-hidden="true">
      <div className="label">
        <span className="mirror-label">{label}</span>
        <span className="mirror-page">{pageLabel}</span>
      </div>
      <div className="cells grid mirror-cells">
        {Array.from({ length: rows }, (_, li) => (
          <div className="cell-row" key={li}>
            {Array.from({ length: cols }, (_, ci) => (
              <span className="cell" key={ci}>
                {DOT_ORDER.map((d) => {
                  const [dx, dy] = DOT_DXY[d];
                  const x = ci * 3 + dx, y = li * 5 + dy;
                  const up = !!bits[y]?.[x];
                  return <i key={d} className={up ? "up" : ""} />;
                })}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
