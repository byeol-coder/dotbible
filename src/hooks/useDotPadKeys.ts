import { useEffect } from "react";
import { DP, KeyCodes } from "../dotpad/DotPadManager";
import type { BibleReaderEngine } from "./useBibleReader";

/** DotPad hardware keys route to the same engine actions the on-screen
    buttons use, so device and screen never diverge. F4 = hear current
    status follows the Dot Games platform convention.
    원본은 DOM #id를 찾아 .click()을 흉내냈지만(tap 패턴), React에서는
    엔진 메서드를 직접 호출한다 — 결과는 같고 중간 단계가 줄었다. */
export function useDotPadKeys(engine: BibleReaderEngine, graphicVisible: boolean) {
  useEffect(() => {
    const handler = (key: string) => {
      const is = (n: string) => key === (KeyCodes as Record<string, string>)[n] || key === n;
      if (is("PanningRight")) { engine.pagerMove(1); return; }
      if (is("PanningLeft")) { engine.pagerMove(-1); return; }
      if (engine.view !== "reader") return;
      if (is("KeyFunction1")) engine.playToggle();
      else if (is("KeyFunction2")) engine.selectVerse(engine.reader.cur - 1);
      else if (is("KeyFunction3")) engine.selectVerse(engine.reader.cur + 1);
      else if (is("KeyFunction4")) engine.where();
      else if (is("KeyFunction12")) engine.repeat();
      else if (is("KeyFunction23")) { if (graphicVisible) engine.toggleGraphic(); }
      else if (is("KeyFunction34")) engine.toggleTactileMode();
      else if (is("KeyFunction14")) engine.markCurrentRead();
    };
    DP.onKey(handler);
    return () => DP.onKey(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.view, engine.reader.cur, graphicVisible]);
}
