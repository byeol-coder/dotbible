import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { detectEmbedMode } from "./hooks/useEmbedAdapter";
import "./styles/global.css";
import App from "./App";

// 임베드 판정은 스타일 적용 전에 끝나야 깜빡임이 없다(원본과 동일한 순서).
detectEmbedMode();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
