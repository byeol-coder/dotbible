import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { I18N, type UILang, type I18NValue } from "./dict";
import { store } from "../data/store";

function detectDefaultLang(): UILang {
  const saved = store.get<UILang | null>("dw.uilang", null);
  if (saved && I18N[saved]) return saved;
  const nav = (navigator.language || "ko").slice(0, 2) as UILang;
  return I18N[nav] ? nav : "ko";
}

export type TFn = (key: string, ...args: unknown[]) => string;

interface I18nContextValue {
  lang: UILang;
  setLang: (l: UILang) => void;
  t: TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UILang>(detectDefaultLang);

  // 문서 루트 lang — 스크린리더가 UI 문구를 올바른 언어 발음으로 읽게 한다.
  // 본문(성경 절)은 별도로 각 요소에 lang을 붙인다(콘텐츠 언어는 다를 수 있으므로).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: UILang) => {
    if (!I18N[l]) return;
    store.set("dw.uilang", l);
    setLangState(l);
  }, []);

  // 키가 없으면 한국어로 내려가고, 그마저 없으면 콘솔에 경고 후 키 자체를
  // 보여준다(화면이 완전히 비는 것보다 낫다).
  const t = useCallback<TFn>(
    (key, ...args) => {
      const table = I18N[lang] || I18N.ko;
      let v: I18NValue | undefined = table[key];
      if (v === undefined) {
        v = I18N.ko[key];
        if (v === undefined) {
          console.warn("[i18n] 누락된 키:", key);
          return key;
        }
      }
      return typeof v === "function" ? (v as (...a: unknown[]) => string)(...args) : v;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n은 I18nProvider 안에서만 쓸 수 있습니다");
  return ctx;
}
