// ===== LLM 对话 Hook =====

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, LLMConfig } from '../engine/llm/types';
import { buildMessages, summarizeHistory } from '../engine/context';
import type { Character } from '../engine/character/types';

interface UseLLMOptions {
  config: LLMConfig;
  systemPrompt: string;
  character: Character;
}

interface UseLLMReturn {
  /** 对话历史 */
  history: ChatMessage[];
  /** 是否正在生成 */
  streaming: boolean;
  /** 当前流式内容 */
  streamContent: string;
  /** 发送消息 */
  sendMessage: (content: string) => Promise<void>;
  /** 清空历史 */
  clearHistory: () => void;
  /** 加载历史 */
  loadHistory: (messages: ChatMessage[]) => void;
  /** 中断当前生成 */
  abort: () => void;
  /** 发送消息引用（避免闭包过期） */
  sendRef: React.MutableRefObject<(content: string) => Promise<void>>;
}

export function useLLM({ config, systemPrompt, character: _character }: UseLLMOptions): UseLLMReturn {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (streaming) return;

    // 添加用户消息
    const userMsg: ChatMessage = { role: 'user', content };
    const newHistory = [...historyRef.current, userMsg];
    setHistory(newHistory);
    setStreamContent('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const messages = buildMessages(
        systemPrompt,
        summarizeHistory(newHistory),
      );

      // 使用 fetch + AbortController 实现可中断的流式请求
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature,
          max_tokens: Math.max(1, Math.floor(config.maxTokens) || 4096),
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content ?? '';
            if (chunk) {
              fullContent += chunk;
              setStreamContent(fullContent);
            }
          } catch { /* skip */ }
        }
      }

      reader.releaseLock();

      // 完成：添加 assistant 消息
      if (fullContent) {
        const assistantMsg: ChatMessage = { role: 'assistant', content: fullContent };
        setHistory(prev => [...prev, assistantMsg]);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户中断
        if (streamContent) {
          const assistantMsg: ChatMessage = { role: 'assistant', content: streamContent };
          setHistory(prev => [...prev, assistantMsg]);
        }
      } else {
        let errMsg = err instanceof Error ? err.message : String(err);

        // 翻译常见错误
        if (errMsg.includes('401') || errMsg.includes('unauthorized')) {
          errMsg = 'API Key 无效或未设置，请在设置中填入正确的 Key';
        } else if (errMsg.includes('429')) {
          errMsg = 'API 请求过于频繁或余额不足，请稍后再试';
        } else if (errMsg.includes('max_tokens')) {
          errMsg = 'max_tokens 参数异常，请在设置中重新输入（建议 2048）';
        } else if (errMsg.includes('model')) {
          errMsg = '模型名称错误，请检查设置中的模型名（如 deepseek-chat）';
        }

        const errorMsg: ChatMessage = {
          role: 'system',
          content: `[错误] ${errMsg}`,
        };
        setHistory(prev => [...prev, errorMsg]);
      }
    } finally {
      setStreaming(false);
      setStreamContent('');
      abortRef.current = null;
    }
  }, [config, systemPrompt, streaming]);

  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  const clearHistory = useCallback(() => {
    setHistory([]);
    setStreamContent('');
  }, []);

  const loadHistory = useCallback((messages: ChatMessage[]) => {
    setHistory(messages);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    history,
    streaming,
    streamContent,
    sendMessage,
    clearHistory,
    loadHistory,
    abort,
    sendRef,
  };
}
