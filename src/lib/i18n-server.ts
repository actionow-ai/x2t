import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, getDict, type Locale } from "./i18n";

// 服务端读取当前语言（cookie）。默认 zh。
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  return normalizeLocale(c.get(LOCALE_COOKIE)?.value);
}

// 服务端便捷取字典。
export async function getT() {
  return getDict(await getLocale());
}
