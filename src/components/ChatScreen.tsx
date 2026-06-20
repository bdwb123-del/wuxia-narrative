// ===== 聊天主界面 =====

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../engine/llm/types';

interface ChatScreenProps {
  history: ChatMessage[];
  streaming: boolean;
  streamContent: string;
  onSend: (content: string) => void;
  onAbort: () => void;
}

export function ChatScreen({
  history,
  streaming,
  streamContent,
  onSend,
  onAbort,
}: ChatScreenProps) {
  const [input, setInput] = useState('');
  const [expandedJSON, setExpandedJSON] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toggleJSON = (i: number) => setExpandedJSON(prev => ({ ...prev, [i]: !prev[i] }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, streamContent]);

  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (content: string) => {
    const html = content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {history.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)', fontStyle: 'italic', fontSize: '14px' }}>
            江湖夜雨十年灯……<br/>输入你的行动，开始你的江湖之旅。
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`message ${msg.role === 'assistant' ? 'narrator' : msg.role === 'user' ? 'player' : 'system'}`}>
            {msg.role === 'assistant' ? (
              <>
                <div className="sender">&#x1F3AF; 江湖</div>
                <div className="markdown">{renderMessageContent(msg.content)}</div>
                {(() => {
                  const hasJSON = (msg as any).rawJSON && (msg as any).rawJSON !== '{}';
                  return (
                    <div style={{ marginTop: '4px' }}>
                      <button onClick={() => toggleJSON(i)} style={{
                        fontSize: '9px', padding: '1px 6px', fontFamily: 'var(--font-mono)',
                        background: hasJSON ? '#2a2' : '#c44', color: '#fff', border: 'none',
                        borderRadius: '2px', cursor: 'pointer', opacity: 0.9,
                      }}>
                        {hasJSON ? `📋 JSON ${expandedJSON[i] ? '▾' : '▸'}` : '⚠ 无JSON'}
                      </button>
                      {expandedJSON[i] && hasJSON && (
                        <pre style={{ fontSize: '9px', margin: '4px 0 0', padding: '4px 6px',
                          background: '#111', color: '#8f8', borderRadius: '3px',
                          maxHeight: '120px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>{(msg as any).rawJSON}</pre>
                      )}
                      {expandedJSON[i] && !hasJSON && (
                        <div style={{ fontSize: '9px', color: '#c44', marginTop: '2px' }}>
                          AI 未输出状态 JSON，本轮无状态变更
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : msg.role === 'user' ? (
              <>
                <div className="sender">&#x2694;&#xFE0F; 你</div>
                {msg.content}
              </>
            ) : (msg.content)}
          </div>
        ))}
        {streaming && streamContent && (
          <div className="message narrator typing-cursor">
            <div className="sender">&#x1F3AF; 江湖</div>
            <div className="markdown">{renderMessageContent(streamContent)}</div>
          </div>
        )}
        {streaming && !streamContent && (
          <div className="message system">执笔凝思中……</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="input-ink"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的行动……"
            rows={1}
            disabled={streaming}
          />
          {streaming ? (
            <button className="btn-outline" onClick={onAbort}>中断</button>
          ) : (
            <button className="btn-ink" onClick={handleSend} disabled={!input.trim()}>出招</button>
          )}
        </div>
      </div>
    </div>
  );
}
