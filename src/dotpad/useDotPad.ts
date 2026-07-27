import { useSyncExternalStore } from "react";
import { DP } from "./DotPadManager";

/** DP는 이 앱에서 유일한 물리 기기를 표현하는 싱글턴이라 React state로
    옮기지 않았다 — 대신 useSyncExternalStore로 연결 상태 변화를 구독해
    화면을 리렌더한다. connect()/outputGraphic() 등은 DP 인스턴스를 직접
    쓰면 된다(컴포넌트마다 복제할 상태가 아니다). */
export function useDotPadConnected(): boolean {
  return useSyncExternalStore(
    (cb) => DP.subscribe(cb),
    () => DP.isConnected()
  );
}
