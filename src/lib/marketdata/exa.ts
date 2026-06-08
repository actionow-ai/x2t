import type { NewsItem } from "./types";

// Exa 语义新闻搜索(有免费额度)。按公司名/代码做语义检索,取近 7 天财经新闻标题。
// 与 Finnhub 互补:Finnhub 给行情/概况,Exa 给更广的语义新闻面。
// 未配置 EXA_API_KEY → 返回 [],调用方自然降级到 provider 自带新闻。
export function exaConfigured(): boolean {
  return !!process.env.EXA_API_KEY;
}

export async function exaNews(query: string, limit = 3): Promise<NewsItem[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        query: `${query} stock market news`,
        type: "auto",
        numResults: limit,
        category: "news",
        startPublishedDate: since,
      }),
      signal: AbortSignal.timeout(Number(process.env.EXA_TIMEOUT_MS ?? 8000)),
    });
    if (!res.ok) throw new Error(`exa ${res.status}`);
    const json = (await res.json()) as { results?: Array<{ title?: string; url?: string }> };
    return (json.results ?? [])
      .map((r): NewsItem => ({ headline: r.title ?? "", url: r.url }))
      .filter((n) => n.headline)
      .slice(0, limit);
  } catch (e) {
    console.error(`[exa] ${query} 失败:`, e instanceof Error ? e.message : e);
    return [];
  }
}
