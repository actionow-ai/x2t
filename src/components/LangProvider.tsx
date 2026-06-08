"use client";

import { createContext, useContext } from "react";
import { dictionaries, type Locale, type Dict } from "@/lib/i18n";

const Ctx = createContext<{ locale: Locale; t: Dict }>({ locale: "zh", t: dictionaries.zh });

export function LangProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = dictionaries[locale] ?? dictionaries.zh;
  return <Ctx.Provider value={{ locale, t }}>{children}</Ctx.Provider>;
}

export function useT(): Dict {
  return useContext(Ctx).t;
}

export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
