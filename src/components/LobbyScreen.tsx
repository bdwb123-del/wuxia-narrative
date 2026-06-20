// ===== 一站式大厅 v3：干净布局 + 多槽位 =====
import { useState, useEffect } from 'react';
import type { Character } from '../engine/character/types';
import { realmName } from '../engine/growth';
import type { LLMConfig } from '../engine/llm/types';
import type { SaveData } from '../engine/save';
import { listSaves, listCharacters, saveCharacter, loadCharacter, deleteCharacter, deleteSave } from '../engine/save';
import { validateAPIKey } from '../engine/llm/adapter';
import { WORLD_PRESETS } from '../engine/context';

interface Props { character: Character; setCharacter: (c: Character) => void; config: LLMConfig; worldSetting: string; onWorldChange: (ws: string) => void; onStartGame: () => void; onEditCharacter: () => void; onOpenSettings: () => void; onLoadGame: (save: SaveData) => void; }

export function LobbyScreen(p: Props) {
  const { character, setCharacter, config, worldSetting, onWorldChange, onStartGame, onEditCharacter, onOpenSettings, onLoadGame } = p;
  const [apiOk, setApiOk] = useState<'idle'|'check'|'ok'|'fail'>('idle');
  const [saves, setSaves] = useState<{ slot: number; data: SaveData }[]>([]);
  const [chars, setChars] = useState<{slot:number;data:Character}[]>([]);

  const refresh = () => {
    setSaves(listSaves().sort((a, b) => b.data.timestamp - a.data.timestamp));
    setChars(listCharacters());
  };
  useEffect(refresh, []);
  useEffect(() => {
    if (!config.apiKey) { setApiOk('idle'); return; }
    setApiOk('check'); validateAPIKey(config).then(o => setApiOk(o?'ok':'fail'));
  }, [config]);

  const saveChar = () => { if(!character.name) return; const used = new Set(listCharacters().map(c=>c.slot)); let s=0; while(used.has(s))s++; saveCharacter(s,{...character}); refresh(); };

  const dotC: Record<string,string> = { idle:'#888', check:'#daa520', ok:'#40c060', fail:'#c04040' };
  const dotL: Record<string,string> = { idle:'未配置', check:'检测中', ok:'已连接', fail:'失败' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'24px 32px', overflowY:'auto', alignItems:'center' }}>
      <div style={{ textAlign:'center', marginBottom:'20px' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'44px', letterSpacing:'14px', color:'var(--ink-black)' }}>江湖夜雨</div>
        <div style={{ color:'var(--ink-light)', fontSize:'13px', letterSpacing:'8px', marginTop:'2px', fontStyle:'italic' }}>十年灯</div>
      </div>

      <div style={{ display:'flex', gap:'16px', maxWidth:'1000px', width:'100%', flexWrap:'wrap', justifyContent:'center' }}>
        {/* 人物卡 */}
        <div style={{ flex:'1 1 300px', minWidth:'280px', maxWidth:'500px', display:'flex', flexDirection:'column', gap:'12px' }}>
          <Card title="👤 人物卡" right={<div style={{display:'flex',gap:'4px'}}><B onClick={onEditCharacter}>编辑</B><B onClick={saveChar} disabled={!character.name}>保存</B></div>}>
            <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              <div className="seal" style={{ width:'48px', height:'48px', fontSize:'20px', flexShrink:0 }}>侠</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'15px' }}>{character.name||'未创建'}{character.title?` · ${character.title}`:''}</div>
                <div style={{ fontSize:'11px', color:'var(--ink-gray)' }}>{[character.gender,character.sect,`${character.age}岁`].filter(Boolean).join(' · ')||'—'}</div>
                <div style={{ fontSize:'11px', color:'var(--gold)', fontWeight:700 }}>{realmName(character.attributes)} · {Object.values(character.attributes).reduce((a:number,b:number)=>a+b,0)} 属性</div>
              </div>
            </div>
            <div style={{ marginTop:'8px', borderTop:'1px solid var(--paper-dark)', paddingTop:'8px' }}>
              <div style={{ fontSize:'11px', color:'var(--ink-light)', marginBottom:'4px' }}>已保存 ({chars.length})</div>
              {chars.length === 0 ? (
                <div style={{ fontSize:'11px', color:'var(--ink-lighter)', fontStyle:'italic' }}>点击右上角「保存」存储当前角色</div>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                  {chars.map(c => (
                    <span key={c.slot} style={{ display:'inline-flex', alignItems:'center', gap:'2px', padding:'3px 6px', background:'var(--paper-white)', border:'1px solid var(--paper-dark)', borderRadius:'4px', fontSize:'11px' }}>
                      <span onClick={()=>{const d=loadCharacter(c.slot);if(d)setCharacter(d)}} style={{ cursor:'pointer' }}>{c.data.name||'?'}</span>
                      <span onClick={()=>{deleteCharacter(c.slot);refresh()}} style={{ cursor:'pointer', color:'var(--cinnabar)', fontWeight:700, fontSize:'10px', padding:'0 2px' }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="⚙ 连接">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'11px', color:dotC[apiOk] }}>● {dotL[apiOk]}</span>
              <B onClick={onOpenSettings}>配置 API</B>
            </div>
          </Card>
        </div>

        {/* 存档 */}
        <div style={{ flex:'1 1 300px', minWidth:'280px', maxWidth:'500px' }}>
          <Card title={`💾 存档 (${saves.length})`}>
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'11px', color:'var(--ink-light)', marginBottom:'4px' }}>🌍 世界</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'3px' }}>
                {WORLD_PRESETS.map(p => (
                  <button key={p.name} onClick={()=>onWorldChange(p.setting)}
                    style={{ padding:'3px 8px', fontSize:'10px', fontFamily:'var(--font-body)', letterSpacing:'1px',
                      background:worldSetting===p.setting?'var(--ink-black)':'transparent',
                      color:worldSetting===p.setting?'#fff':'var(--ink-gray)',
                      border:worldSetting===p.setting?'1px solid var(--ink-black)':'1px solid var(--ink-lighter)', borderRadius:'3px', cursor:'pointer' }}>{p.name}</button>
                ))}
              </div>
              {worldSetting && !WORLD_PRESETS.some(p=>p.setting===worldSetting) && (
                <textarea className="input-ink" value={worldSetting} onChange={e=>onWorldChange(e.target.value)} rows={2} style={{ fontSize:'11px', marginTop:'4px', width:'100%' }} />
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px' }}>
              {saves.map((s, i) => {
                const d = s.data;
                return (
                <div key={i} style={{ padding:'8px 10px', borderRadius:'4px', cursor:'pointer',
                    background:'var(--paper-light)', border:'1px solid var(--paper-dark)',
                    fontSize:'11px', minHeight:'44px', position:'relative' }}>
                  <div onClick={() => onLoadGame(d)}>
                    <span onClick={e => { e.stopPropagation(); deleteSave(s.slot); refresh(); }} style={{ position:'absolute', top:'2px', right:'4px', cursor:'pointer', color:'var(--cinnabar)', fontSize:'10px' }}>✕</span>
                    <div style={{ fontWeight:600, marginBottom:'2px' }}>{d.character.name}</div>
                    <div style={{ color:'var(--ink-light)', fontSize:'10px' }}>{d.meta?.totalMessages||0}条 · {d.meta?.scene||''}</div>
                  </div>
                </div>
              );})}
            </div>
          </Card>
        </div>
      </div>

      <button className="btn-ink" onClick={onStartGame}
        style={{ marginTop:'24px', padding:'14px 64px', fontSize:'20px', fontFamily:'var(--font-display)', letterSpacing:'12px' }}>
        踏入江湖
      </button>
      <div style={{ marginTop:'12px', fontSize:'10px', color:'var(--ink-lighter)', letterSpacing:'3px' }}>v0.3 · 武侠 AI 跑团</div>
    </div>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ink-border" style={{ padding:'14px', background:'var(--paper-white)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <span style={{ fontSize:'13px', fontWeight:700, letterSpacing:'2px' }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}
function B({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button className="btn-outline" onClick={onClick} disabled={disabled} style={{ padding:'3px 10px', fontSize:'10px', opacity:disabled?0.4:1 }}>{children}</button>;
}
