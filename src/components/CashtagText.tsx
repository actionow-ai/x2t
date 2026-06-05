import React from "react";

// 轻量 cashtag 识别（$AAPL）—— 纯正则，不是 AI。智能 ticker 抽取在 M3。
const CASHTAG_SPLIT = /(\$[A-Za-z]{1,6})\b/g;
const IS_CASHTAG = /^\$[A-Za-z]{1,6}$/;

export function CashtagText({ text }: { text: string }) {
  const parts = text.split(CASHTAG_SPLIT);
  return (
    <>
      {parts.map((part, i) =>
        IS_CASHTAG.test(part) ? (
          <span key={i} className="cashtag">{part}</span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
