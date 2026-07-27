import { useEffect } from "react";
import type { BibleReaderEngine } from "./useBibleReader";

/* 임베드 어댑터 — tactileworlds Dot Library 호스트 계약
     자식 → 호스트: postMessage({source:'dotarcade', type:'exit'})
     호스트 → 자식: 없음(크로스오리진이라 window 주입 불가)
   호스트의 Escape 리스너는 부모 document에 있어서, 포커스가 iframe
   안에 있으면 거기까지 올라가지 않는다 — 자식이 직접 잡아야 키보드·
   스크린리더 사용자가 모달을 빠져나올 수 있다.

   임베드 판정 자체(data-tw-embed 속성 부여)는 main.tsx에서 렌더 전에
   끝낸다 — 스타일 적용 전에 끝나야 깜빡임이 없다(원본과 동일한 순서). */
export function useEmbedAdapter(engine: BibleReaderEngine) {
  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-tw-embed")) return;

    const stopAudio = () => {
      try { engine.stopPlayer(); } catch { /* noop */ }
    };
    const exitToHost = () => {
      stopAudio();
      try { parent.postMessage({ source: "dotarcade", type: "exit" }, "*"); } catch { /* noop */ }
    };

    // capture 단계에서 잡아 앱의 읽기 화면 단축키보다 먼저 처리한다.
    // 입력 요소 안에서는 IME 조합 취소를 막지 않도록 통과시킨다.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag && /INPUT|SELECT|TEXTAREA/.test(tag)) return;
      e.preventDefault();
      exitToHost();
    };
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pagehide", stopAudio);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pagehide", stopAudio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** 스타일 적용 전에 끝나야 하는 임베드 판정 — main.tsx에서 렌더 전에 호출 */
export function detectEmbedMode(): void {
  try {
    if (new URLSearchParams(location.search).get("embed") === "1") {
      document.documentElement.setAttribute("data-tw-embed", "");
    }
  } catch { /* noop */ }
}
