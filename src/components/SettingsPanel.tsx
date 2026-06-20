// ===== 设置面板 =====

import { useState } from 'react';
import type { LLMConfig } from '../engine/llm/types';
import { listSaves, deleteSave, exportSave } from '../engine/save';
import type { SaveData } from '../engine/save';

interface SettingsPanelProps {
  config: LLMConfig;
  onConfigChange: (config: LLMConfig) => void;
  onClose: () => void;
  onLoadGame: (save: SaveData) => void;
}

const PRESET_MODELS = [
  { label: 'GPT-4o-mini', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  { label: 'GPT-4o', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
  { label: 'DeepSeek V3', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  { label: 'DeepSeek R1', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-reasoner' },
  { label: '豆包 Lite', endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', model: 'doubao-lite-32k' },
  { label: '千问 Turbo', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-turbo' },
  { label: 'Ollama (本地)', endpoint: 'http://localhost:11434/v1/chat/completions', model: 'qwen2.5:7b' },
];

export function SettingsPanel({ config, onConfigChange, onClose, onLoadGame }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [endpoint, setEndpoint] = useState(config.endpoint);
  const [model, setModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [maxTokens, setMaxTokens] = useState(config.maxTokens);
  const [tab, setTab] = useState<'llm' | 'saves'>('llm');
  const [saves, setSaves] = useState(listSaves());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [modelList, setModelList] = useState<string[]>([]);

  const handleSave = () => {
    onConfigChange({
      ...config,
      endpoint,
      apiKey,
      model,
      temperature,
      maxTokens,
    });
    onClose();
  };

  const handlePreset = (preset: typeof PRESET_MODELS[number]) => {
    setEndpoint(preset.endpoint);
    setModel(preset.model);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 5,
        }),
      });
      if (resp.ok) {
        setTestResult('✓ 连接成功');
      } else {
        const err = await resp.text();
        setTestResult(`✗ 连接失败: ${resp.status} ${err.slice(0, 100)}`);
      }
    } catch (e) {
      setTestResult(`✗ 网络错误: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  const detectModels = async () => {
    setDetecting(true);
    setModelList([]);
    // 从 /chat/completions 推导 /models 端点
    const baseUrl = endpoint.replace(/\/chat\/completions\/?$/, '');
    const modelsUrl = `${baseUrl}/models`;
    try {
      const resp = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      if (!resp.ok) {
        const err = await resp.text();
        setTestResult(`✗ 获取模型列表失败: ${resp.status} ${err.slice(0, 100)}`);
        return;
      }
      const data = await resp.json();
      const models: string[] = (data.data || [])
        .map((m: { id: string }) => m.id)
        .filter((id: string) => id && !id.startsWith('dall-e') && !id.startsWith('tts') && !id.startsWith('whisper') && !id.startsWith('omni'))
        .sort();
      setModelList(models);
      if (models.length === 0) {
        setTestResult('⚠ 未检测到可用模型，请手动输入');
      } else {
        setTestResult(`✓ 检测到 ${models.length} 个模型`);
      }
    } catch (e) {
      setTestResult(`✗ 网络错误: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setDetecting(false);
    }
  };

  const refreshSaves = () => setSaves(listSaves());

  return (
    <div className="settings-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="settings-panel ink-border">
        <h2>设置</h2>

        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--ink-lighter)' }}>
          <button
            onClick={() => setTab('llm')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === 'llm' ? '2px solid var(--cinnabar)' : '2px solid transparent',
              padding: '8px 0',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              letterSpacing: '2px',
              color: tab === 'llm' ? 'var(--ink-black)' : 'var(--ink-light)',
            }}
          >
            AI 模型
          </button>
          <button
            onClick={() => { setTab('saves'); refreshSaves(); }}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === 'saves' ? '2px solid var(--cinnabar)' : '2px solid transparent',
              padding: '8px 0',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              letterSpacing: '2px',
              color: tab === 'saves' ? 'var(--ink-black)' : 'var(--ink-light)',
            }}
          >
            存档管理
          </button>
        </div>

        {tab === 'llm' && (
          <>
            {/* 预设模型 */}
            <div className="settings-group">
              <label>快速选择</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {PRESET_MODELS.map((preset) => (
                  <button
                    key={preset.label}
                    className="btn-outline"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => handlePreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div className="settings-group">
              <label>API Key</label>
              <input
                className="input-ink"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>

            {/* Endpoint */}
            <div className="settings-group">
              <label>API 端点</label>
              <input
                className="input-ink"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://api.openai.com/v1/chat/completions"
              />
            </div>

            {/* Model */}
            <div className="settings-group">
              <label>模型名称</label>
              <input
                className="input-ink"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>

            {/* Temperature */}
            <div className="settings-group">
              <label>创造性 (Temperature): {temperature}</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Max Tokens */}
            <div className="settings-group">
              <label>最大输出长度 (Max Tokens)</label>
              <input
                className="input-ink"
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 2048)}
                min={256}
                max={128000}
                step={1024}
              />
            </div>

            {/* 测试连接 & 检测模型 */}
            <div className="settings-group">
              <button
                className="btn-outline"
                onClick={testConnection}
                disabled={testing || !apiKey}
                style={{ marginRight: '8px' }}
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              <button
                className="btn-outline"
                onClick={detectModels}
                disabled={detecting || !apiKey}
              >
                {detecting ? '检测中...' : '检测可用模型'}
              </button>
              {testResult && (
                <div style={{
                  color: testResult.startsWith('✓') ? 'var(--jade)' : testResult.startsWith('⚠') ? 'var(--gold)' : 'var(--cinnabar)',
                  fontSize: '13px',
                  marginTop: '8px',
                }}>
                  {testResult}
                </div>
              )}
            </div>

            {/* 模型列表 */}
            {modelList.length > 0 && (
              <div className="settings-group" style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid var(--paper-dark)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px',
              }}>
                <label>可用模型（点击选择）</label>
                {modelList.map((m) => (
                  <div
                    key={m}
                    onClick={() => setModel(m)}
                    style={{
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      background: model === m ? 'var(--ink-black)' : 'transparent',
                      color: model === m ? 'var(--paper-white)' : 'var(--ink-black)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '2px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {m}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'saves' && (
          <div>
            {saves.length === 0 ? (
              <p style={{ color: 'var(--ink-light)', fontStyle: 'italic', textAlign: 'center', padding: '32px 0' }}>
                暂无存档
              </p>
            ) : (
              saves.map(({ slot, data }) => (
                <div
                  key={slot}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    borderBottom: '1px solid var(--paper-dark)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {data.character.name} · Lv.{data.character.level}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-light)' }}>
                      {new Date(data.timestamp).toLocaleString()} · {data.meta.totalMessages} 条对话
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn-outline"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => {
                        onLoadGame(data);
                        onClose();
                      }}
                    >
                      读取
                    </button>
                    <button
                      className="btn-outline"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => {
                        exportSave(slot);
                      }}
                    >
                      导出
                    </button>
                    <button
                      className="btn-outline"
                      style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--cinnabar)', borderColor: 'var(--cinnabar)' }}
                      onClick={() => {
                        if (confirm('确定删除此存档？')) {
                          deleteSave(slot);
                          refreshSaves();
                        }
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 底部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--ink-lighter)' }}>
          <button className="btn-outline" onClick={onClose}>取消</button>
          <button className="btn-ink" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
