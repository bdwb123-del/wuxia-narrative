// ===== NPC 交互面板 =====
import { useState, useMemo } from 'react';
import type { WorldState } from '../engine/world';

interface NpcPanelProps {
  worldState: WorldState;
  history: { role: string; content: string }[];
  onInteract: (npcName: string, action: string) => void;
}

export function NpcPanel({ worldState, history, onInteract }: NpcPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dialog, setDialog] = useState<{ action: string; npc: string } | null>(null);
  const [dialogInput, setDialogInput] = useState('');
  const [subTab, setSubTab] = useState<'all' | 'friends'>('all');

  const befriended = useMemo(() => worldState.npcs.filter(n => n.befriended), [worldState.npcs]);

  const handleAction = (npcName: string, action: string) => {
    if (action === '询问') {
      setDialog({ action, npc: npcName });
    } else if (action === '赠礼') {
      setDialog({ action, npc: npcName });
    } else if (action === '飞鸽传书') {
      setDialog({ action, npc: npcName });
    } else if (action === '交谈') {
      setDialog({ action, npc: npcName });
    } else {
      onInteract(npcName, action);
    }
  };

  const submitDialog = () => {
    if (!dialog) return;
    if (dialog.action === '询问') {
      onInteract(dialog.npc, `询问：${dialogInput}`);
    } else if (dialog.action === '赠礼') {
      onInteract(dialog.npc, `赠礼：${dialogInput}`);
    } else if (dialog.action === '飞鸽传书') {
      onInteract(dialog.npc, `飞鸽传书：${dialogInput}`);
    } else if (dialog.action === '交谈') {
      onInteract(dialog.npc, `交谈：${dialogInput}`);
    }
    setDialog(null);
    setDialogInput('');
  };

  // 从最近聊天中检测当前互动的 NPC
  const activeNpc = useMemo(() => {
    const recent = history.slice(-4).map(m => m.content).join(' ');
    for (const npc of worldState.npcs) {
      if (recent.includes(npc.name)) return npc.name;
    }
    return null;
  }, [history, worldState.npcs]);

  const currentNpc = useMemo(() => worldState.npcs.find(n => n.name === selected), [worldState.npcs, selected]);
  const locals = useMemo(() => worldState.npcs.filter(n => n.location === worldState.currentLocation || worldState.currentLocation === '未知'), [worldState.npcs, worldState.currentLocation]);
  const others = useMemo(() => worldState.npcs.filter(n => n.location !== worldState.currentLocation), [worldState.npcs, worldState.currentLocation]);
  const displayNpcs = expanded ? worldState.npcs : locals;

  const relColor: Record<string, string> = {
    '陌生': '#888', '相识': '#aaa', '友善': '#4a8', '尊敬': '#48a', '敌对': '#c44', '仇恨': '#f44',
  };
  const statusStyle = (s: string) => {
    const map: Record<string,{icon:string;color:string;bg:string}> = {
      '正常': {icon:'',color:'',bg:''}, '中毒': {icon:'🟣',color:'#c6f',bg:'rgba(200,100,255,0.15)'},
      '受伤': {icon:'🟡',color:'#ea0',bg:'rgba(200,160,0,0.15)'}, '沉睡': {icon:'🔵',color:'#8af',bg:'rgba(100,150,255,0.15)'},
      '尸体': {icon:'💀',color:'#888',bg:'rgba(100,100,100,0.15)'},
      '狂怒': {icon:'🔴',color:'#f44',bg:'rgba(255,60,60,0.15)'}, '恐惧': {icon:'🟠',color:'#f80',bg:'rgba(255,130,0,0.15)'},
    };
    return map[s] || {icon:'',color:'',bg:''};
  };
  const isDead = (npc: typeof worldState.npcs[0]) => npc.status === '尸体';

  return (
    <div style={{ width: '200px', minWidth: '200px', height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--ink-lighter)', background: '#f8f5f0', overflow: 'hidden', fontFamily: 'var(--font-body)', position: 'relative' }}>
      {/* 标题栏 */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--ink-lighter)', background: 'var(--paper-white)', flexShrink: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '2px', marginBottom: '4px' }}>
          📍 {worldState.currentLocation || '未知'}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--ink-light)' }}>
          {locals.length} 人在此 · 共 {worldState.npcs.length} 人相识
        </div>
      </div>

      {/* 子标签 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ink-lighter)', flexShrink: 0 }}>
        {[
          { key: 'all' as const, label: `附近(${locals.length})` },
          { key: 'friends' as const, label: `已结交(${befriended.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{
            flex: 1, padding: '5px 0', fontSize: '10px', fontFamily: 'var(--font-body)',
            background: subTab === t.key ? 'var(--paper-white)' : 'transparent',
            color: subTab === t.key ? 'var(--ink-black)' : 'var(--ink-light)',
            border: 'none', borderBottom: subTab === t.key ? '2px solid var(--cinnabar)' : '2px solid transparent',
            cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* NPC 列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {(subTab === 'friends' ? befriended : displayNpcs).length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-lighter)', padding: '24px 12px', fontSize: '12px', fontStyle: 'italic' }}>
            {subTab === 'friends' ? '尚未结交任何人' : '尚未结识任何人'}
          </div>
        ) : (
          (subTab === 'friends' ? befriended : displayNpcs).map(npc => (
            <div
              key={npc.name}
              onClick={() => setSelected(npc.name === selected ? null : npc.name)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: selected === npc.name ? '#fff' : activeNpc === npc.name ? '#fffef5' : 'transparent',
                borderLeft: selected === npc.name ? '3px solid var(--cinnabar)' : activeNpc === npc.name ? '3px solid var(--gold-pale)' : '3px solid transparent',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{npc.name}</span>
                {npc.befriended && <span style={{ fontSize: '9px', color: '#da4', marginLeft: '2px' }}>⭐</span>}
                <span style={{ fontSize: '9px', color: relColor[npc.relation] || '#888' }}>[{npc.relation}]</span>
              </div>
              {/* 状态标签 */}
              {npc.status && npc.status !== '正常' && (
                <div style={{ fontSize: '9px', marginTop: '2px', color: statusStyle(npc.status).color, background: statusStyle(npc.status).bg, padding: '1px 4px', borderRadius: '2px', display: 'inline-block' }}>
                  {statusStyle(npc.status).icon} {npc.status}{npc.statusNote ? ` — ${npc.statusNote}` : ''}
                </div>
              )}
              {npc.befriended && subTab === 'friends' && (
                <button onClick={() => handleAction(npc.name, '飞鸽传书')}
                  style={{ padding: '2px 6px', fontSize: '9px', background: '#48a', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer', marginTop: '2px' }}>🕊 传书</button>
              )}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '1px' }}>
                <div style={{ flex: 1, height: '3px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${Math.abs(npc.affection || 0)}%`, background: (npc.affection || 0) >= 0 ? '#4a8' : '#c44', borderRadius: '2px' }} />
                </div>
                <span style={{ fontSize: '8px', color: (npc.affection || 0) >= 0 ? '#4a8' : '#c44', minWidth: '24px', textAlign: 'right' }}>{npc.affection > 0 ? '+' : ''}{npc.affection || 0}</span>
              </div>
              {npc.title && <div style={{ fontSize: '10px', color: 'var(--ink-light)', marginTop: '1px' }}>{npc.title}</div>}
              <div style={{ fontSize: '9px', color: 'var(--ink-lighter)', marginTop: '1px' }}>
                {npc.location !== worldState.currentLocation && worldState.currentLocation !== '未知' ? <>📍 {npc.location}</> : ''}
                {npc.notes ? (npc.location !== worldState.currentLocation ? ' · ' : '') + npc.notes : ''}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 展开/收起 */}
      {others.length > 0 && (
        <div style={{ padding: '4px 12px', borderTop: '1px solid var(--ink-lighter)', flexShrink: 0 }}>
          <button onClick={() => setExpanded(!expanded)} style={{
            width: '100%', padding: '4px 0', fontSize: '10px', fontFamily: 'var(--font-body)',
            background: 'none', border: 'none', color: 'var(--ink-light)', cursor: 'pointer',
            letterSpacing: '1px',
          }}>
            {expanded ? '▲ 仅显示本地' : `▼ 全部 NPC (${others.length} 人在外地)`}
          </button>
        </div>
      )}

      {/* 交互栏 */}
      {currentNpc && (
        <div style={{ padding: '8px 12px', borderTop: '2px solid var(--cinnabar)', background: 'var(--paper-white)', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>与 {currentNpc.name} 互动{isDead(currentNpc) ? '（已无法互动）' : ''}</div>
          {!isDead(currentNpc) && (<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {[
              { label: '💬 交谈', action: '交谈' },
              { label: '🤝 询问', action: '询问' },
              { label: '⚔ 切磋', action: '切磋' },
              { label: '🎁 赠礼', action: '赠礼' },
            ].map(act => (
              <button key={act.action} onClick={() => handleAction(currentNpc.name, act.action)}
                style={{ padding: '4px 6px', fontSize: '10px', fontFamily: 'var(--font-body)', background: 'var(--ink-black)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>{act.label}</button>
            ))}
            <span style={{ width: '100%', height: '1px', background: 'rgba(0,0,0,0.1)', margin: '2px 0' }} />
            {[
              { label: '🕵 偷窃', action: '偷窃' },
              { label: '☠ 下毒', action: '下毒' },
              { label: '💀 杀死', action: '杀死' },
            ].map(act => (
              <button key={act.action} onClick={() => handleAction(currentNpc.name, act.action)}
                style={{ padding: '4px 6px', fontSize: '10px', fontFamily: 'var(--font-body)', background: '#c44', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>{act.label}</button>
            ))}
          </div>
          )}
        </div>
      )}

      {/* 弹出式交互对话框 */}
      {dialog && (
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '12px', background: '#1a1a1a', borderTop: '2px solid var(--cinnabar)', zIndex: 50 }}>
          <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '6px' }}>
            {dialog.action === '询问' ? `向 ${dialog.npc} 询问什么？` : dialog.action === '赠礼' ? `送给 ${dialog.npc} 什么礼物？` : dialog.action === '交谈' ? `与 ${dialog.npc} 聊什么？` : `给 ${dialog.npc} 飞鸽传书：`}
          </div>
          <input autoFocus value={dialogInput} onChange={e => setDialogInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitDialog(); if (e.key === 'Escape') { setDialog(null); setDialogInput(''); } }}
            placeholder={dialog.action === '询问' ? '输入你想问的问题...' : '输入物品名称...'}
            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', fontFamily: 'var(--font-body)' }} />
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button onClick={submitDialog} disabled={!dialogInput.trim()} style={{ flex: 1, padding: '5px', fontSize: '11px', background: 'var(--cinnabar)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>确定</button>
            <button onClick={() => { setDialog(null); setDialogInput(''); }} style={{ padding: '5px 12px', fontSize: '11px', background: '#444', color: '#aaa', border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
