// ===== 角色创建 v2：卡片式 + AI 一键生成 =====

import { useState } from 'react';
import type { Character, Element } from '../engine/character/types';
import { ATTRIBUTE_NAMES, BASE_ATTRIBUTE_POINTS } from '../engine/character/types';
import { createDefaultCharacter } from '../engine/character/system';
import type { LLMConfig } from '../engine/llm/types';

interface CharacterCreationProps {
  onComplete: (character: Character, startingItems: string[], startingMartialArts: any[]) => void;
  onCancel: () => void;
  initial?: Character;
  config: LLMConfig;
}

const ELEMENTS: Element[] = ['金', '木', '水', '火', '土'];
const SECTS = ['无门派', '少林', '武当', '峨眉', '丐帮', '华山', '逍遥', '唐门', '明教', '古墓', '昆仑', '崆峒', '桃花岛', '日月神教', '大理段氏', '姑苏慕容'];

export function CharacterCreation({ onComplete, onCancel, initial, config }: CharacterCreationProps) {
  const [char, setChar] = useState<Character>(initial ?? createDefaultCharacter(''));
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const setAttr = (key: string, value: number) => {
    setChar(prev => ({ ...prev, attributes: { ...prev.attributes, [key]: Math.max(0, Math.min(100, value)) } }));
  };
  const setField = (key: keyof Character, value: string) => { setChar(prev => ({ ...prev, [key]: value })); };

  const totalPoints = Object.values(char.attributes).reduce((s, v) => s + v, 0);
  const remaining = Math.max(0, BASE_ATTRIBUTE_POINTS - totalPoints);

  const handleGenerate = async () => {
    setGenerating(true); setGenError('');
    try {
      const resp = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [{
            role: 'user',
            content: `请发挥创意，生成一个完整的武侠角色卡JSON。字段：name(侠名，可复姓)、title(称号)、gender、age(16-40)、sect(门派)、element(五行)、birthplace、appearance、personality、background(身世故事100-200字)、ambition、weakness。attributes分配${BASE_ATTRIBUTE_POINTS}点给6项：{"体魄":n,"内力":n,"身法":n,"悟性":n,"根骨":n,"元气":n}，总和=${BASE_ATTRIBUTE_POINTS}。items 为3-6件初始物品数组["名称|描述"]，根据角色背景搭配，武功以秘籍形式给：["太极拳秘籍|拳掌·威力8·消耗3·以柔克刚"]。martialArts 同时返回武功数据供系统使用[{"name":"太极拳","category":"拳掌","power":8,"cost":3,"desc":"以柔克刚","buffs":{"体魄":2}}]。${char.name ? `已有角色基础上丰富：${JSON.stringify({name:char.name,title:char.title,gender:char.gender,age:char.age,sect:char.sect,element:char.element,birthplace:char.birthplace,appearance:char.appearance,personality:char.personality,background:char.background,ambition:char.ambition,weakness:char.weakness,attrs:char.attributes,items:(char as any).startingItems||[]})}` : '全新生成'}。只输出JSON。`,
          }],
          temperature: 0.9, max_tokens: 4000,
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      let text = data.choices?.[0]?.message?.content || '';
      // 清理
      text = text.replace(/```json|```/g, '').replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
      // 提取 JSON
      let start = text.indexOf('{'); const end = text.lastIndexOf('}');
      if (start < 0) start = 0;
      if (end > start) text = text.slice(start, end + 1);
      // 修复
      text = text.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      let json: any;
      try { json = JSON.parse(text); } catch {
        // 去换行 + 补尾括号
        const cleaned = text.replace(/[\n\r]/g, '').replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        try { json = JSON.parse(cleaned); } catch {
          const ended = cleaned.endsWith('}') ? cleaned : cleaned + '}';
          try { json = JSON.parse(ended); } catch { throw new Error('AI 返回格式异常，请重试'); }
        }
      }
      // 解析初始物品和武功
      const items: string[] = json.items?.length > 0 ? json.items : ['铁剑|一把普通的铁剑', '金疮药|恢复20生命的伤药', '布衣|寻常的布衣'];
      const martialArts: any[] = json.martialArts || [];
      setChar(prev => ({
        ...prev,
        name: prev.name || json.name || '',
        title: prev.title || json.title || '',
        gender: prev.gender || json.gender || '',
        age: json.age || prev.age,
        sect: prev.sect || json.sect || '',
        element: prev.element !== '土' ? prev.element : (json.element || '土'),
        birthplace: prev.birthplace || json.birthplace || '',
        appearance: prev.appearance || json.appearance || '',
        personality: prev.personality || json.personality || '',
        background: prev.background || json.background || '',
        ambition: prev.ambition || json.ambition || '',
        weakness: prev.weakness || json.weakness || '',
        startingItems: items,
        startingMartialArts: martialArts,
        attributes: {
          体魄: prev.attributes.体魄 || json.attributes?.体魄 || 0,
          内力: prev.attributes.内力 || json.attributes?.内力 || 0,
          身法: prev.attributes.身法 || json.attributes?.身法 || 0,
          悟性: prev.attributes.悟性 || json.attributes?.悟性 || 0,
          根骨: prev.attributes.根骨 || json.attributes?.根骨 || 0,
          元气: prev.attributes.元气 || json.attributes?.元气 || 0,
        },
      }));
    } catch (e: any) { setGenError(e.message || '生成失败'); }
    finally { setGenerating(false); }
  };

  const canDone = char.name.trim().length > 0;

  return (
    <div className="creation-overlay">
      <div className="creation-panel ink-border">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', textAlign: 'center', letterSpacing: '8px', marginBottom: '4px' }}>人物创建</h1>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button className="btn-ink" onClick={handleGenerate} disabled={generating || !config.apiKey} style={{ padding: '10px 24px', fontSize: '15px' }}>
            {generating ? 'AI 构思中...' : '🤖 AI 一键生成'}
          </button>
          <button className="btn-outline" onClick={() => setChar(createDefaultCharacter(''))} style={{ padding: '10px 16px', fontSize: '13px', marginLeft: '8px' }}>
            🗑 清空
          </button>
          {genError && <div style={{ color: 'var(--cinnabar)', fontSize: '12px', marginTop: '4px' }}>{genError}</div>}
          {!config.apiKey && <div style={{ color: 'var(--ink-light)', fontSize: '11px', marginTop: '4px' }}>需先在设置中配置 API Key</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '50vh', overflowY: 'auto', paddingRight: '8px' }}>
          {/* 名号 */}
          <Field label="姓名" value={char.name} onChange={v => setField('name', v)} placeholder="2-3字侠名" />
          <Field label="称号" value={char.title} onChange={v => setField('title', v)} placeholder="如：一剑无血" />
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>性别</label>
              <select value={char.gender} onChange={e => setField('gender', e.target.value)} style={selectStyle}>
                <option value="">未选择</option><option>男</option><option>女</option><option>其他</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>年龄</label>
              <input className="input-ink" type="number" value={char.age} onChange={e => setField('age', e.target.value)} min={16} max={40} style={{ width: '100%' }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>门派</label>
            <select value={char.sect} onChange={e => setField('sect', e.target.value)} style={selectStyle}>
              {SECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>五行</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {ELEMENTS.map(el => (
                <button key={el} onClick={() => setField('element', el)}
                  style={{ flex: 1, padding: '6px 0', fontFamily: 'var(--font-display)', fontSize: '14px', background: char.element === el ? 'var(--ink-black)' : 'transparent', color: char.element === el ? '#fff' : 'var(--ink-gray)', border: '1px solid var(--ink-lighter)', borderRadius: '4px', cursor: 'pointer' }}>
                  {el}
                </button>
              ))}
            </div>
          </div>
          <Field label="出生地" value={char.birthplace} onChange={v => setField('birthplace', v)} placeholder="如：洛阳" />
          <Field label="外貌" value={char.appearance} onChange={v => setField('appearance', v)} placeholder="简述容貌体态" />
          <Field label="性格" value={char.personality} onChange={v => setField('personality', v)} placeholder="如：豪爽耿直" />
          <Field label="志向" value={char.ambition} onChange={v => setField('ambition', v)} placeholder="如：成为天下第一剑" />
          <Field label="弱点" value={char.weakness} onChange={v => setField('weakness', v)} placeholder="如：嗜酒如命" />
          <Field label="身世" value={char.background} onChange={v => setField('background', v)} placeholder="简述来历" textarea />
          <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--ink-lighter)', paddingTop: '8px' }}>
            <label style={labelStyle}>🎒 初始物品（逗号分隔，AI 自动填写。秘籍自动识别）</label>
            <textarea className="input-ink" value={(char as any).startingItems?.join(', ') || ''} 
              onChange={e => setChar(prev => ({ ...prev, startingItems: e.target.value.split(',').map((s:string) => s.trim()).filter(Boolean) }))}
              placeholder="AI 自动生成，可手动修改" rows={2} style={{ width: '100%' }} />
          </div>
        </div>

        {/* 属性分配 */}
        <div style={{ marginTop: '20px', borderTop: '2px solid var(--ink-black)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, letterSpacing: '2px' }}>天赋属性</span>
            <span style={{ color: remaining < 0 ? 'var(--cinnabar)' : remaining === 0 ? 'var(--jade)' : 'var(--gold)', fontWeight: 700 }}>
              {remaining} / {BASE_ATTRIBUTE_POINTS}
            </span>
          </div>
          {ATTRIBUTE_NAMES.map(name => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ width: '36px', fontSize: '13px', color: 'var(--ink-gray)' }}>{name}</span>
              <button onClick={() => setAttr(name, char.attributes[name] - 1)} disabled={char.attributes[name] <= 0}
                style={{ width: '24px', height: '24px', border: '1px solid var(--ink-lighter)', background: 'transparent', cursor: 'pointer', borderRadius: '4px', fontSize: '14px' }}>−</button>
              <div style={{ flex: 1, height: '6px', background: 'var(--paper-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(char.attributes[name]/100)*100}%`, background: ['#c04040','#4169e1','#5b8c5a','#b8860b','#00aaaa'][ATTRIBUTE_NAMES.indexOf(name)], borderRadius: '3px' }} />
              </div>
              <span style={{ width: '24px', textAlign: 'center', fontWeight: 700 }}>{char.attributes[name]}</span>
              <button onClick={() => setAttr(name, char.attributes[name] + 1)} disabled={remaining <= 0 || char.attributes[name] >= 100}
                style={{ width: '24px', height: '24px', border: '1px solid var(--ink-lighter)', background: 'transparent', cursor: 'pointer', borderRadius: '4px', fontSize: '14px' }}>+</button>
            </div>
          ))}
        </div>

        {/* 按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          <button className="btn-outline" onClick={onCancel}>返回</button>
          <button className="btn-ink" onClick={() => onComplete({ ...char, pendingAttrPoints: remaining }, (char as any).startingItems || [], (char as any).startingMartialArts || [])} disabled={!canDone}>
            确认创建
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', letterSpacing: '1px', color: 'var(--ink-gray)', marginBottom: '4px' };
const selectStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '13px', padding: '8px 10px', background: 'var(--paper-white)', border: '1px solid var(--ink-lighter)', color: 'var(--ink-black)', outline: 'none', width: '100%', boxSizing: 'border-box', borderRadius: '4px' };

function Field({ label, value, onChange, placeholder, textarea }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; textarea?: boolean }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {textarea ? (
        <textarea className="input-ink" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} style={{ width: '100%' }} />
      ) : (
        <input className="input-ink" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%' }} />
      )}
    </div>
  );
}
