// ===== 游戏侧面板 v5 —— 全功能 =====
import { useState } from 'react';
import type { Character } from '../engine/character/types';
import { ATTRIBUTE_NAMES, EQUIP_SLOTS, MARTIAL_CATEGORIES, QUALITY_COLORS } from '../engine/character/types';
import type { Quality } from '../engine/character/types';
import { realmName } from '../engine/growth';
import type { WorldState } from '../engine/world';
import { equipStats } from '../engine/items/identify';

type Tab = 'status' | 'equip' | 'martial' | 'quests' | 'bag' | 'chronicle' | 'profile';
type EquipSlot = import('../engine/character/types').EquipSlot;

interface GamePanelProps {
  character: Character; worldState: WorldState;
  onUseItem: (index: number) => void;
  onLevelUp: (attr: keyof import('../engine/character/types').Attributes) => void;
  onToggleMA: (index: number) => void; onTrainMA: (index: number) => void; onForgetMA: (index: number) => void;
  onUnequip: (slot: EquipSlot) => void; onExamine: (index: number) => void;
}

export function GamePanel({ character, worldState, onUseItem, onLevelUp, onToggleMA, onTrainMA, onForgetMA, onUnequip, onExamine }: GamePanelProps) {
  const [tab, setTab] = useState<Tab>('status');
  const [showFormulas, setShowFormulas] = useState(false);
  const [bagFilter, setBagFilter] = useState<string>('全部');
  const qStyle = (q?: Quality) => q ? QUALITY_COLORS[q] : QUALITY_COLORS['普通'];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'status', label: '状态' },
    { key: 'equip', label: '装备' },
    { key: 'martial', label: `武功${character.martialArts.length > 0 ? `(${character.martialArts.length})` : ''}` },
    { key: 'quests', label: `任务${worldState.quests.filter(q => q.status === '进行中').length > 0 ? `(${worldState.quests.filter(q => q.status === '进行中').length})` : ''}` },
    { key: 'bag', label: `背包${worldState.items.length > 0 ? `(${worldState.items.length})` : ''}` },
    { key: 'chronicle', label: `经历${character.chronicle.length > 0 ? `(${character.chronicle.length})` : ''}` },
    { key: 'profile', label: '人物' },
  ];

  return (
    <div style={{ width: '240px', minWidth: '240px', height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--ink-lighter)', background: 'var(--paper-white)', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ink-lighter)', overflowX: 'auto', flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: '0 0 auto', padding: '8px 4px', fontSize: '10px', letterSpacing: '0',
            background: tab === t.key ? 'var(--ink-black)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--ink-gray)', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', borderBottom: tab === t.key ? '2px solid var(--cinnabar)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {tab === 'status' && <StatusTab character={character} worldState={worldState} onLevelUp={onLevelUp} showFormulas={showFormulas} setShowFormulas={setShowFormulas} />}
        {tab === 'equip' && <EquipTab character={character} onUnequip={onUnequip} qStyle={qStyle} />}
        {tab === 'martial' && <MartialTab character={character} onToggleMA={onToggleMA} onTrainMA={onTrainMA} onForgetMA={onForgetMA} qStyle={qStyle} />}
        {tab === 'quests' && <QuestTab quests={worldState.quests} />}
        {tab === 'bag' && <BagTab items={worldState.items} bagFilter={bagFilter} setBagFilter={setBagFilter} onUseItem={onUseItem} onExamine={onExamine} qStyle={qStyle} />}
        {tab === 'chronicle' && <ChronicleTab chronicle={character.chronicle} />}
        {tab === 'profile' && <ProfileTab character={character} worldState={worldState} />}
      </div>
    </div>
  );
}

// ====== 状态 Tab ======
function StatusTab({ character, worldState, onLevelUp, showFormulas, setShowFormulas }: any) {
  const a = character.attributes;
  return (
    <div>
      <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>{character.name} · {realmName(a)}</div>
      <div style={{ fontSize: '11px', color: 'var(--ink-gray)', marginBottom: '8px' }}>
        💰 {worldState.gold}两 · 善恶 {character.karma >= 0 ? '+' : ''}{character.karma} · 自由点 {character.pendingAttrPoints || 0}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: '11px', marginBottom: '10px' }}>
        <div>❤ 生命 <b>{character.combat.生命值}/{character.combat.最大生命值}</b></div>
        <div>💧 内力 <b>{character.combat.内力值}/{character.combat.最大内力值}</b></div>
        <div>⚡ 气力 <b>{character.combat.气力值}/{character.combat.最大气力值}</b></div>
        <div>⚔ 攻击 <b>{character.combat.攻击力}</b></div>
        <div>🛡 防御 <b>{character.combat.防御力}</b></div>
        <div>💨 速度 <b>{character.combat.速度}</b></div>
        <div>🎯 命中 <b>{character.combat.命中率}%</b></div>
        <div>💥 暴击 <b>{character.combat.暴击率}%</b></div>
        <div>🌀 闪避 <b>{character.combat.闪避率}%</b></div>
      </div>
      <div style={{ fontSize: '11px' }}>
        {(() => {
          const bonus: Record<string,number> = { 体魄:0, 内力:0, 身法:0, 悟性:0, 根骨:0, 元气:0 };
          for (const ma of character.martialArts) {
            if (!ma.active || !ma.buffs) continue;
            const b = ma.buffs as Record<string,number>;
            for (const k of Object.keys(b)) { bonus[k] = (bonus[k]||0) + b[k] * (ma.level||1); }
          }
          return ATTRIBUTE_NAMES.map(name => (
            <div key={name} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', borderBottom:'1px dotted var(--paper-dark)' }}>
              <span>{name}：{a[name]}{bonus[name] > 0 ? <span style={{ color:'var(--jade)', fontSize:'10px' }}> +{bonus[name]}</span> : ''}</span>
              {character.pendingAttrPoints > 0 && a[name] < 100 && <button onClick={() => onLevelUp(name)} style={{ fontSize:'10px', padding:'0 6px', background:'var(--gold)', color:'#fff', border:'none', borderRadius:'2px', cursor:'pointer' }}>+</button>}
            </div>
          ));
        })()}
      </div>
      <div onClick={() => setShowFormulas(!showFormulas)} style={{ cursor: 'pointer', fontSize: '10px', marginTop: '6px', color: 'var(--ink-light)' }}>
        📐 {showFormulas ? '收起' : '展开'}公式
      </div>
      {showFormulas && (
        <div style={{ fontSize: '10px', color: 'var(--ink-gray)', lineHeight: '1.8' }}>
          <div>生命 = 50 + 体魄×15 + Lv×5</div>
          <div>内力 = 30 + 内力×10 + Lv×3</div>
          <div>气力值 = 20 + 内力×3 + 元气×2</div>
          <div>攻击 = 5 + 体魄×2 + 内力</div>
          <div>防御 = 3 + 体魄×1.5 + 根骨</div>
          <div>速度 = 5 + 身法×2</div>
          <div>命中 = 80 + 身法×0.5% (上限95%)</div>
          <div>暴击 = 5 + 悟性×1.5% (上限80%)</div>
          <div>闪避 = 5 + 身法% (上限60%)</div>
        </div>
      )}
    </div>
  );
}

// ====== 装备 Tab ======
function EquipTab({ character, onUnequip, qStyle }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {EQUIP_SLOTS.map(slotDef => {
        const eq = character.equipment[slotDef.key];
        return (
          <div key={slotDef.key} style={{ padding: '6px 8px', border: eq ? '1px solid var(--gold-pale)' : '1px dashed var(--ink-lighter)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '40px', background: eq ? 'var(--paper-light)' : 'transparent' }}>
            <span style={{ fontSize: '16px', opacity: eq ? 1 : 0.3 }}>{slotDef.icon}</span>
            <div style={{ flex: 1, fontSize: '12px' }}>
              {eq ? <>
                <div style={{ fontWeight: 600 }}>{eq.name} {eq.quality ? <span style={{ fontSize:'9px', color: qStyle((eq as any).quality).text }}>{(eq as any).quality}</span> : null}</div>
                {(() => { const es = equipStats({ name: eq.name, description: eq.description || '', slot: eq.slot, quality: (eq as any).quality }); return (es.attackBonus !== 0 || es.defenseBonus !== 0 || es.speedBonus !== 0) ? <div style={{ fontSize:'10px', color:'var(--gold)' }}>{[es.attackBonus ? `攻击+${es.attackBonus}`:'',es.defenseBonus ? `防御+${es.defenseBonus}`:'',es.speedBonus ? `速度${es.speedBonus>0?'+':''}${es.speedBonus}`:''].filter(Boolean).join(' ')}</div> : null; })()}
              </> : <div style={{ color: 'var(--ink-lighter)', fontStyle: 'italic' }}>{slotDef.label} - 空</div>}
            </div>
            {eq && <button onClick={() => onUnequip(slotDef.key)} style={{ fontSize:'10px', color:'var(--cinnabar)', background:'none', border:'1px solid var(--cinnabar)', borderRadius:'3px', cursor:'pointer', padding:'2px 6px' }}>卸下</button>}
          </div>
        );
      })}
    </div>
  );
}

// ====== 武功 Tab ======
function MartialTab({ character, onToggleMA, onTrainMA, onForgetMA, qStyle }: any) {
  if (character.martialArts.length === 0) return <div style={{ textAlign: 'center', color: 'var(--ink-light)', padding: '32px 0', fontSize: '13px' }}>尚未习得武功<br/>去拜师学艺吧</div>;
  return (
    <div>
      {character.martialArts.map((ma: any, i: number) => {
        const catMeta = MARTIAL_CATEGORIES.find((c:any) => c.key === ma.category);
        return (
        <div key={i} style={{ padding: '8px', marginBottom: '6px', background: qStyle(ma.quality).bg, borderRadius: '4px', borderLeft: `3px solid ${qStyle(ma.quality).border}`, boxShadow: qStyle(ma.quality).glow, color: '#ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span><span style={{ fontSize:'14px' }}>{catMeta?.icon||'⚔'}</span> <b>{ma.name}</b> <span style={{ fontSize:'9px', color:qStyle(ma.quality).text, background:'rgba(0,0,0,0.3)', padding:'1px 4px', borderRadius:'2px' }}>{ma.quality||'普通'}</span></span>
            <span style={{ fontSize:'10px', color:'#f88' }}>Lv.{ma.level}/{ma.maxLevel||10}</span>
          </div>
          <div style={{ fontSize:'10px', color:'#bbb', marginBottom:'4px' }}>⚔ 威力{ma.威力} · 💧 消耗{ma.内力消耗} · {catMeta?.label||ma.category}</div>
          <div style={{ height:'3px', background:'#333', borderRadius:'2px', marginBottom:'4px' }}>
            <div style={{ height:'100%', width:`${ma.proficiency||0}%`, background:'linear-gradient(90deg,#48a,#c44)', borderRadius:'2px' }} />
          </div>
          <div style={{ fontSize:'9px', color:'#999', textAlign:'right', marginBottom:'4px' }}>熟练 {ma.proficiency||0}/{({垃圾:50,普通:70,良好:100,优秀:140,史诗:200,传说:280,神话:400} as any)[ma.quality||'普通']||100}{ma.proficiency>=(({垃圾:50,普通:70,良好:100,优秀:140,史诗:200,传说:280,神话:400} as any)[ma.quality||'普通']||100)?' →可突破':''}</div>
          {ma.description && <div style={{ fontSize:'10px', color:'#bbb', marginBottom:'4px', fontStyle:'italic' }}>{ma.description}</div>}
          {ma.effects && <div style={{ fontSize:'9px', color:'#da4', marginBottom:'4px', background:'rgba(255,255,255,0.05)', padding:'2px 4px', borderRadius:'2px' }}>✨ {ma.effects}</div>}
          {ma.buffs && Object.keys(ma.buffs).length > 0 && (
            <div style={{ fontSize:'9px', color:'#8c8', marginBottom:'4px' }}>
              ⬆ {Object.entries(ma.buffs as Record<string,number>).map(([k,v]) => `${k}+${v}`).join(' · ')}
            </div>
          )}
          <div style={{ display:'flex', gap:'4px' }}>
            <button onClick={() => onToggleMA(i)} style={{ fontSize:'9px', padding:'2px 6px', background:ma.active?'var(--jade)':'#444', color:'#fff', border:'none', borderRadius:'2px', cursor:'pointer' }}>{ma.active?'激活中':'激活'}</button>
            <button onClick={() => onTrainMA(i)} style={{ fontSize:'9px', padding:'2px 6px', background:'#555', color:'#fff', border:'none', borderRadius:'2px', cursor:'pointer' }}>修炼</button>
            <button onClick={() => { if(confirm('确定遗忘此武功？')) onForgetMA(i); }} style={{ fontSize:'9px', padding:'2px 6px', background:'transparent', color:'#c44', border:'1px solid #c44', borderRadius:'2px', cursor:'pointer' }}>✕</button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ====== 任务 Tab ======
function QuestTab({ quests }: any) {
  if (quests.length === 0) return <div style={{ textAlign:'center', color:'var(--ink-light)', padding:'32px 0', fontSize:'13px' }}>暂无任务</div>;
  return (
    <div>
      {quests.map((q: any, i: number) => (
        <div key={i} style={{ padding:'8px', marginBottom:'6px', background:'var(--paper-light)', borderRadius:'4px', borderLeft:`3px solid ${q.status==='进行中'?'var(--cinnabar)':q.status==='已完成'?'var(--jade)':'var(--ink-lighter)'}` }}>
          <div style={{ fontWeight:600, fontSize:'12px', marginBottom:'2px' }}>
            <span style={{ fontSize:'10px', marginRight:'4px' }}>{q.status==='进行中'?'📜':q.status==='已完成'?'✅':'⏳'}</span>
            {q.name}
          </div>
          <div style={{ fontSize:'10px', color:'var(--ink-light)', marginBottom:'2px' }}>{q.description}</div>
          {q.giver && <div style={{ fontSize:'9px', color:'var(--ink-lighter)' }}>来自：{q.giver}</div>}
        </div>
      ))}
    </div>
  );
}

// ====== 背包 Tab ======
function BagTab({ items, bagFilter, setBagFilter, onUseItem, onExamine, qStyle }: any) {
  const types = ['全部','装备','丹药','食物','秘籍','杂物'];
  const counts: Record<string,number> = {};
  for (const t of types) counts[t] = t==='全部' ? items.length : items.filter((i:any) => i.type===t).length;
  const filtered = bagFilter==='全部' ? items : items.filter((i:any) => i.type===bagFilter);
  return (
    <div>
      <div style={{ display:'flex', gap:'3px', marginBottom:'8px', flexWrap:'wrap' }}>
        {types.map(t => (
          <button key={t} onClick={() => setBagFilter(t)} style={{ padding:'2px 6px', fontSize:'10px', fontFamily:'var(--font-body)', background:bagFilter===t?'var(--ink-black)':'transparent', color:bagFilter===t?'#fff':'var(--ink-gray)', border:bagFilter===t?'1px solid var(--ink-black)':'1px solid var(--ink-lighter)', borderRadius:'2px', cursor:'pointer' }}>{t}({counts[t]})</button>
        ))}
      </div>
      {filtered.length===0 ? <div style={{ textAlign:'center', color:'var(--ink-light)', padding:'32px 0' }}>空空如也</div> : filtered.map((item:any, i:number) => (
        <div key={i} style={{ padding:'8px', marginBottom:'6px', background:'var(--paper-light)', borderRadius:'4px', fontSize:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'4px' }}>
            <span style={{ fontSize:'14px' }}>{item.type==='丹药'?'💊':item.type==='食物'?'🍖':item.type==='装备'?(item.slot?EQUIP_SLOTS.find((s:any)=>s.key===item.slot)?.icon||'📦':'📦'):item.type==='秘籍'?'📜':'📦'}</span>
            <span style={{ fontWeight:600 }}>{item.name.replace(new RegExp(`${item.type}$`),'')||item.name}</span>
            <span style={{ fontSize:'9px', color:'var(--ink-light)' }}>{item.type}</span>
            {item.quality && <span style={{ fontSize:'9px', color:qStyle(item.quality).text, background:'rgba(0,0,0,0.2)', padding:'0 2px', borderRadius:'2px' }}>{item.quality}</span>}
          </div>
          {item.type==='装备' && item.slot && (()=>{const es=equipStats({name:item.name,description:item.description||'',slot:item.slot,quality:item.quality});return(es.attackBonus!==0||es.defenseBonus!==0||es.speedBonus!==0)?<div style={{fontSize:'10px',color:'var(--gold)',marginBottom:'4px'}}>{[es.attackBonus?`攻击+${es.attackBonus}`:'',es.defenseBonus?`防御+${es.defenseBonus}`:'',es.speedBonus?`速度${es.speedBonus>0?'+':''}${es.speedBonus}`:''].filter(Boolean).join(' ')}</div>:null})()}
          <div style={{ display:'flex', gap:'4px' }}>
            {item.type==='丹药'&&<button onClick={()=>onUseItem(i)} style={{fontSize:'10px',padding:'2px 6px',background:'var(--cinnabar)',color:'#fff',border:'none',borderRadius:'2px',cursor:'pointer'}}>使用</button>}
            {item.type==='食物'&&<button onClick={()=>onUseItem(i)} style={{fontSize:'10px',padding:'2px 6px',background:'#d80',color:'#fff',border:'none',borderRadius:'2px',cursor:'pointer'}}>食用</button>}
            {item.type==='秘籍'&&<button onClick={()=>onUseItem(i)} style={{fontSize:'10px',padding:'2px 6px',background:'var(--qi-blue)',color:'#fff',border:'none',borderRadius:'2px',cursor:'pointer'}}>研读</button>}
            {item.type==='装备'&&item.slot&&<button onClick={()=>onUseItem(i)} style={{fontSize:'10px',padding:'2px 6px',background:'var(--gold)',color:'#fff',border:'none',borderRadius:'2px',cursor:'pointer'}}>装备</button>}
            <button onClick={()=>onExamine(i)} style={{fontSize:'10px',padding:'2px 4px',background:'none',border:'1px solid var(--ink-lighter)',borderRadius:'2px',cursor:'pointer'}}>🔍</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ====== 经历 Tab ======
function ChronicleTab({ chronicle }: any) {
  if (!chronicle || chronicle.length === 0) return <div style={{ textAlign:'center', color:'var(--ink-light)', padding:'32px 0', fontSize:'13px' }}>江湖路长，暂无记录</div>;
  const catC: Record<string,string> = { 升级:'var(--gold)', 习武:'var(--cinnabar)', 战斗:'#c44', 任务:'var(--jade)', 轮回:'#48c', 奇遇:'#da4', 关系:'#48a', 休息:'#88c', 其他:'var(--ink-light)' };
  return (
    <div>
      {[...chronicle].reverse().map((evt: any, i: number) => (
        <div key={i} style={{ padding:'4px 0', borderBottom:'1px dotted var(--paper-dark)', fontSize:'11px', display:'flex', gap:'6px', alignItems:'flex-start' }}>
          <span style={{ color:'var(--ink-light)', fontSize:'9px', minWidth:'28px' }}>{evt.age}岁</span>
          <span style={{ color:catC[evt.category]||'var(--ink-gray)', fontSize:'9px', minWidth:'32px' }}>[{evt.category}]</span>
          <span style={{ color:'var(--ink-black)' }}>{evt.event}</span>
        </div>
      ))}
    </div>
  );
}

// ====== 人物 Tab ======
function ProfileTab({ character, worldState }: any) {
  const rows = [
    ['姓名', character.name],
    ['称号', character.title || '无'],
    ['性别', character.gender || '未知'],
    ['年龄', `${character.age} 岁`],
    ['门派', character.sect || '无门无派'],
    ['五行', character.element],
    ['出生', character.birthplace || '未知'],
    ['境界', realmName(character.attributes)],
    ['善恶', `${character.karma >= 0 ? '+' : ''}${character.karma}`],
    ['金钱', `${worldState.gold} 两`],
  ];
  return (
    <div>
      <div style={{ textAlign:'center', marginBottom:'10px' }}>
        <div className="seal" style={{ width:'48px', height:'48px', fontSize:'22px', margin:'0 auto 4px' }}>侠</div>
        <div style={{ fontSize:'16px', fontWeight:700 }}>{character.name}</div>
        {character.title && <div style={{ fontSize:'11px', color:'var(--ink-light)' }}>{character.title}</div>}
      </div>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display:'flex', padding:'3px 0', borderBottom:'1px dotted var(--paper-dark)', fontSize:'11px' }}>
          <span style={{ color:'var(--ink-light)', minWidth:'48px' }}>{k}</span>
          <span style={{ color:'var(--ink-black)', fontWeight:500 }}>{v}</span>
        </div>
      ))}
      {character.appearance && <div style={{ marginTop:'8px' }}><div style={{ fontSize:'10px', color:'var(--ink-light)', marginBottom:'2px' }}>外貌</div><div style={{ fontSize:'11px', color:'var(--ink-gray)', fontStyle:'italic' }}>{character.appearance}</div></div>}
      {character.personality && <div style={{ marginTop:'6px' }}><div style={{ fontSize:'10px', color:'var(--ink-light)', marginBottom:'2px' }}>性格</div><div style={{ fontSize:'11px', color:'var(--ink-gray)', fontStyle:'italic' }}>{character.personality}</div></div>}
      {character.background && <div style={{ marginTop:'6px' }}><div style={{ fontSize:'10px', color:'var(--ink-light)', marginBottom:'2px' }}>身世</div><div style={{ fontSize:'11px', color:'var(--ink-gray)', fontStyle:'italic' }}>{character.background}</div></div>}
      {character.ambition && <div style={{ marginTop:'6px' }}><div style={{ fontSize:'10px', color:'var(--ink-light)', marginBottom:'2px' }}>志向</div><div style={{ fontSize:'11px', color:'var(--ink-gray)', fontStyle:'italic' }}>{character.ambition}</div></div>}
      {character.weakness && <div style={{ marginTop:'6px' }}><div style={{ fontSize:'10px', color:'var(--ink-light)', marginBottom:'2px' }}>弱点</div><div style={{ fontSize:'11px', color:'var(--ink-gray)', fontStyle:'italic' }}>{character.weakness}</div></div>}
    </div>
  );
}
