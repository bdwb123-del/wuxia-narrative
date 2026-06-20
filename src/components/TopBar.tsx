// ===== 顶部状态条 =====

import { useState } from 'react';
import type { Character } from '../engine/character/types';
import type { WorldState } from '../engine/world';
import { currentTimeName } from '../engine/world';

const timeIcon = (hour: number) => {
  if (hour >= 5 && hour < 7) return '🌅';
  if (hour >= 7 && hour < 11) return '☀️';
  if (hour >= 11 && hour < 13) return '🔆';
  if (hour >= 13 && hour < 17) return '🌤';
  if (hour >= 17 && hour < 19) return '🌇';
  if (hour >= 19 && hour < 21) return '🌙';
  if (hour >= 21 && hour < 23) return '🌛';
  if (hour >= 23 || hour < 1) return '🌑';
  if (hour >= 1 && hour < 3) return '🌜';
  return '🌄';
};

interface TopBarProps {
  character: Character;
  worldState: WorldState;
  inCombat: boolean;
  onSave: () => void;
  onSettings: () => void;
  onRest: () => void;
  snapshots: { timestamp: number; preview: string }[];
  onRestore: (index: number, history: any[]) => void;
}

export function TopBar({ character, worldState, inCombat, onSave, onSettings, onRest, snapshots, onRestore }: TopBarProps) {
  const [showSnaps, setShowSnaps] = useState(false);
  const hpPct = Math.round(((character.combat.生命值 || 0) / (character.combat.最大生命值 || 1)) * 100) || 0;
  const qiPct = Math.round(((character.combat.内力值 || 0) / (character.combat.最大内力值 || 1)) * 100) || 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '8px 20px',
      background: 'linear-gradient(180deg, rgba(26,26,26,0.95) 0%, rgba(44,44,44,0.9) 100%)',
      color: 'var(--paper-white)',
      fontSize: '13px',
      borderBottom: `2px solid ${inCombat ? 'var(--cinnabar)' : 'var(--gold-pale)'}`,
      zIndex: 10,
      flexShrink: 0,
      minHeight: '52px',
    }}>
      {/* 地点 + 天数 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '160px' }}>
        <span style={{ fontSize: '14px' }}>📍</span>
        <span style={{ fontWeight: 600, letterSpacing: '2px' }}>{worldState.currentLocation}</span>
        <span style={{ opacity: 0.5, fontSize: '11px' }}>第{worldState.year}年·{worldState.season}·{worldState.gameDay}日 · {currentTimeName(worldState.hour || 8)} {timeIcon(worldState.hour || 8)}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* HP 条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '180px' }}>
        <span style={{ color: 'var(--cinnabar-light)', fontSize: '12px', width: '22px' }}>HP</span>
        <div style={{
          flex: 1,
          height: '10px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '5px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{
            height: '100%',
            width: `${hpPct}%`,
            background: hpPct > 50
              ? 'linear-gradient(90deg, #c04040, #e06060)'
              : hpPct > 25
                ? 'linear-gradient(90deg, #d08020, #e0a040)'
                : 'linear-gradient(90deg, #cc2020, #ff4040)',
            borderRadius: '4px',
            transition: 'width 0.5s ease',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }} />
        </div>
        <span style={{ fontSize: '11px', minWidth: '55px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
          {character.combat.生命值}/{character.combat.最大生命值}
        </span>
      </div>

      {/* Qi 条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '180px' }}>
        <span style={{ color: 'var(--qi-blue)', fontSize: '12px', width: '22px' }}>Qi</span>
        <div style={{
          flex: 1,
          height: '10px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '5px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{
            height: '100%',
            width: `${qiPct}%`,
            background: 'linear-gradient(90deg, #3040c0, #5080e0)',
            borderRadius: '4px',
            transition: 'width 0.5s ease',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }} />
        </div>
        <span style={{ fontSize: '11px', minWidth: '55px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
          {character.combat.内力值}/{character.combat.最大内力值}
        </span>
      </div>

      {/* 饥饿条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
        <span style={{ color: '#d80', fontSize: '12px', width: '22px' }}>🍖</span>
        <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ height: '100%', width: `${100 - (character.hunger || 0)}%`, background: (character.hunger || 0) > 90 ? 'linear-gradient(90deg, #c44, #f44)' : (character.hunger || 0) > 50 ? 'linear-gradient(90deg, #d80, #ea0)' : 'linear-gradient(90deg, #4a8, #6c8)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontSize: '11px', minWidth: '28px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: (character.hunger || 0) > 90 ? '#f44' : (character.hunger || 0) > 50 ? '#ea0' : '#aaa' }}>
          {character.hunger || 0}
        </span>
      </div>

      {/* 战斗标识 */}
      {inCombat && (
        <div style={{
          padding: '3px 12px',
          background: 'var(--cinnabar)',
          borderRadius: '3px',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '2px',
          animation: 'blink 0.8s ease infinite',
        }}>
          ⚔ 战斗中
        </div>
      )}

      {/* 操作按钮 */}
      <button
        onClick={onSave}
        style={{
          padding: '4px 10px',
          fontSize: '11px',
          background: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '3px',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        💾 存档
      </button>
      <button onClick={onRest} style={{ padding:'4px 10px', fontSize:'11px', background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'3px', cursor:'pointer', fontFamily:'var(--font-body)' }}>🛏 休息</button>
      <button onClick={() => setShowSnaps(!showSnaps)} disabled={snapshots.length===0} style={{ padding:'4px 10px', fontSize:'11px', background:'rgba(255,255,255,0.1)', color:snapshots.length>0?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'3px', cursor:snapshots.length>0?'pointer':'default', fontFamily:'var(--font-body)' }}>⏪ {snapshots.length}</button>
      <button
        onClick={onSettings}
        style={{
          padding: '4px 10px',
          fontSize: '11px',
          background: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '3px',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        ⚙
      </button>
      {showSnaps && snapshots.length > 0 && (
        <div style={{ position:'absolute', top:'100%', right:'60px', background:'#1a1a1a', border:'1px solid #333', borderRadius:'4px', padding:'6px 0', zIndex:100, minWidth:'200px', maxHeight:'300px', overflowY:'auto' }}>
          {snapshots.slice().reverse().map((s, i) => (
            <div key={i} onClick={() => { onRestore(snapshots.length-1-i, []); setShowSnaps(false); }} style={{ padding:'6px 12px', fontSize:'11px', color:'#aaa', cursor:'pointer', borderBottom:'1px solid #222' }}>
              {new Date(s.timestamp).toLocaleTimeString()} {s.preview}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
