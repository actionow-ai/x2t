// 可插拔 LLM provider 接口 —— 设计文档 §4 / §11。
// OpenAI 兼容（OpenAI 官方 / DeepSeek / 其他）+ 无 key 时的 mock。
export interface LlmProvider {
  readonly name: string;
  /** 返回原始文本（期望是 JSON 字符串）；解析 + schema 校验由调用方负责。 */
  completeJson(system: string, user: string): Promise<string>;
}
