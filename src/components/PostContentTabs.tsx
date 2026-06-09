"use client";

import { useState } from "react";
import { CashtagText } from "./CashtagText";

// 站内 原文 / 中文 / English 三版切换(把"三版"做实,而非译文 + 外链原文)。
export function PostContentTabs({
  original,
  zh,
  en,
  origLang,
  originalLabel,
  defaultTab,
}: {
  original: string;
  zh: string;
  en: string;
  origLang?: string | null;
  originalLabel: string;
  defaultTab: "zh" | "en";
}) {
  const [tab, setTab] = useState<"orig" | "zh" | "en">(defaultTab);
  const text = tab === "orig" ? original : tab === "en" ? en : zh;
  return (
    <div>
      <div className="seg seg-sm" style={{ marginBottom: "0.5rem" }}>
        <button type="button" className={`segbtn${tab === "zh" ? " on" : ""}`} onClick={() => setTab("zh")}>中文</button>
        <button type="button" className={`segbtn${tab === "en" ? " on" : ""}`} onClick={() => setTab("en")}>English</button>
        <button type="button" className={`segbtn${tab === "orig" ? " on" : ""}`} onClick={() => setTab("orig")}>
          {originalLabel}{origLang ? ` · ${origLang.toUpperCase()}` : ""}
        </button>
      </div>
      <div className="pc-text">
        <CashtagText text={text} />
      </div>
    </div>
  );
}
