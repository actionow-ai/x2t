import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, getDict, type Locale } from "./i18n";

// 服务端读取当前语言。cookie 优先;首访无 cookie 时按 Accept-Language 协商(en* → en,否则 zh),
// 让英语首访用户不再一律见到中文界面(UX i18n#6)。
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (fromCookie) return normalizeLocale(fromCookie);
  const al = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  return al.startsWith("en") ? "en" : "zh";
}

// 服务端便捷取字典。
export async function getT() {
  return getDict(await getLocale());
}
