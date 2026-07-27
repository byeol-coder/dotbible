import { useEffect } from "react";

/* 스티키 도구 막대는 본문 위에 떠서 그려진다. 아래 여백을 막대 높이만큼
   확보하지 않으면 촉각 면이 막대에 가린다. 높이는 버튼 줄바꿈·언어·
   단축키 펼침 여부에 따라 달라지므로 ResizeObserver로 실측한다.
   막대가 없는 화면(홈/성경)에서는 0으로 돌아간다. */
function fitReaderBar() {
  const bar = document.querySelector(".reader-bar") as HTMLElement | null;
  const h = bar && bar.offsetParent !== null ? bar.offsetHeight : 0;
  document.documentElement.style.setProperty("--reader-bar-h", h + "px");
}

export function useReaderBarHeight(deps: unknown[]) {
  useEffect(() => {
    fitReaderBar();
    const bar = document.querySelector(".reader-bar");
    if (!bar || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(fitReaderBar);
    ro.observe(bar);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    window.addEventListener("resize", fitReaderBar);
    return () => window.removeEventListener("resize", fitReaderBar);
  }, []);
}
