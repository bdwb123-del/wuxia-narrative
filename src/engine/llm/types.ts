// ===== LLM 适配器类型定义 =====

/** OpenAI 兼容的消息格式 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  rawJSON?: string;
}

/** LLM 配置 */
export interface LLMConfig {
  /** API 端点，默认 OpenAI */
  endpoint: string;
  /** API Key */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 温度 (0-2) */
  temperature: number;
  /** 最大输出 tokens */
  maxTokens: number;
}

/** 默认 LLM 配置 */
export function defaultLLMConfig(): LLMConfig {
  return {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '', // 在设置面板中填入
    model: 'deepseek-chat',
    temperature: 0.8,
    maxTokens: 4096,
  };
}

/** SSE 流式响应的单个 chunk */
export interface StreamChunk {
  content: string;
  done: boolean;
}

/** 流式回调 */
export type StreamCallback = (chunk: StreamChunk) => void;
