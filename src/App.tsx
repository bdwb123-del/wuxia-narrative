// ===== 江湖夜雨 =====
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ChatScreen } from './components/ChatScreen';
import { CharacterCreation } from './components/CharacterCreation';
import { SettingsPanel } from './components/SettingsPanel';
import { LobbyScreen } from './components/LobbyScreen';
import { TopBar } from './components/TopBar';
import { GamePanel } from './components/GamePanel';
import { NpcPanel } from './components/NpcPanel';
import { useLLM } from './hooks/useLLM';
import { useGameLoop } from './hooks/useGameLoop';
import { buildSystemPrompt, createNewGameHistory, DEFAULT_WORLD_SETTING } from './engine/context';
import { saveGame } from './engine/save';
import { defaultLLMConfig } from './engine/llm/types';
import { createDefaultCharacter } from './engine/character/system';
import { guessSlot, classifyItem } from './engine/items/identify';
import { recalcBuffs, defaultBuffs } from './engine/combat/calc';
import type { LLMConfig } from './engine/llm/types';
import type { Character } from './engine/character/types';
import type { SaveData } from './engine/save';
import type { WorldState } from './engine/world';
import type { ItemState } from './engine/world';
import './styles/theme.css';
import './styles/components.css';

function loadConfig(): LLMConfig {
  const saved = localStorage.getItem('wuxia_llm_config');
  if (!saved) return defaultLLMConfig();
  try {
    const p = JSON.parse(saved);
    const m = { ...defaultLLMConfig(), ...p };
    if (!Number.isFinite(m.maxTokens) || m.maxTokens < 1) m.maxTokens = 4096;
    if (m.temperature < 0 || m.temperature > 2) m.temperature = 0.8;
    return m;
  } catch { return defaultLLMConfig(); }
}

function sanitize(c: Character): Character {
  const co = c.combat || {} as any;
  return {
    ...c,
    combat: {
      最大生命值: Number(co.最大生命值) || 55, 生命值: Number(co.生命值) || 55,
      最大内力值: Number(co.最大内力值) || 33, 内力值: Number(co.内力值) || 33,
      最大气力值: Number(co.最大气力值) || 26, 气力值: Number(co.气力值) || 26,
      攻击力: Number(co.攻击力) || 5, 防御力: Number(co.防御力) || 3, 速度: Number(co.速度) || 5,
      暴击率: Number(co.暴击率) || 5, 暴击伤害: Number(co.暴击伤害) || 150, 闪避率: Number(co.闪避率) || 5, 命中率: Number(co.命中率) || 80,
    },
    age: Number(c.age) || 20,
    pendingAttrPoints: Number(c.pendingAttrPoints) || 0,
    karma: Number(c.karma) || 0,
  };
}

export default function App() {
  const [screen, setScreen] = useState<'creation'|'game'>('game');
  const [config, setConfig] = useState<LLMConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [worldSetting, setWorldSetting] = useState(DEFAULT_WORLD_SETTING);
  const gt = useRef(Date.now());

  const { character: rawChar, setCharacter: rawSetChar, worldState, setWorldState, handleAIMessage, handleUseItem, handleLevelUp, handleToggleMA, handleTrainMA, handleForgetMA, handleUnequip, handleRest, handleNpcAction, snapshots, takeSnapshot, restoreSnapshot } = useGameLoop(createDefaultCharacter());
  // 一次性修复已有武功的空 buffs
  useEffect(() => {
    if (rawChar.martialArts.length > 0 && rawChar.martialArts.some(ma => !ma.buffs || Object.keys(ma.buffs).length === 0)) {
      const fixed = rawChar.martialArts.map(ma => {
        if (ma.buffs && Object.keys(ma.buffs).length > 0) return ma;
        return { ...ma, buffs: defaultBuffs({ category: ma.category, level: ma.level, 威力: ma.威力 }) };
      });
      rawSetChar(recalcBuffs({ ...rawChar, martialArts: fixed }));
    }
  }, []); // eslint-disable-line
  const character = sanitize(rawChar);
  const setCharacter = useCallback((c: Character) => rawSetChar(sanitize(c)), [rawSetChar]);
  const sp = useMemo(() => buildSystemPrompt(character, worldSetting, worldState), [character, worldState, worldSetting]);
  const { history, streaming, streamContent, sendMessage: rawSend, loadHistory, abort } = useLLM({ config, systemPrompt: sp, character });

  const processingRef = useRef(false);
  const lastLen = useRef(history.length);
  if (history.length > lastLen.current && !processingRef.current && !streaming) {
    const last = history[history.length - 1];
    if (last.role === 'assistant') {
      const { history: updated, rawJSON } = handleAIMessage(last.content, history);
      // 存入最后一条消息的 rawJSON
      if (rawJSON && rawJSON !== '{}') {
        updated[updated.length - 1] = { ...updated[updated.length - 1], rawJSON };
      }
      // 如果 AI 没输出 JSON，追加提醒
      if (!last.content.includes('```json') && !last.content.match(/\{[^{]*"hp"|"qi"|"location"/)) {
        updated.push({ role: 'user', content: '(你上次回复没有JSON！请在本轮回复末尾用```json输出状态变更)' });
      }
      loadHistory(updated);
      // 自动快照
      const preview = last.content.slice(0, 30).replace(/\n/g, ' ');
      takeSnapshot(preview);
    }
    lastLen.current = history.length;
    processingRef.current = true;
  }
  if (!streaming) processingRef.current = false;

  const sendMessage = useCallback(async (c: string) => {
    await rawSend(c + '\n\n(请用```json输出hp/qi/location/npcs等状态变更)');
  }, [rawSend]);

  const startGame = useCallback(() => {
    loadHistory(createNewGameHistory());
    // 保留物品，只重置位置和剧情
    setWorldState(prev => {
      let ws = { ...prev, quests: [], events: [] };
      // 注入初始物品
      if (ws.items.length === 0 && (character as any).startingItems?.length > 0) {
        ws.items = (character as any).startingItems.map((raw: string) => {
          const [n, d = ''] = raw.split('|');
          const tp = classifyItem(raw);
          const q = /神话|神品/.test(raw) ? '神话' : /传说|仙品/.test(raw) ? '传说' : /史诗|极品/.test(raw) ? '史诗' : /优秀|上品/.test(raw) ? '优秀' : /良好|中品/.test(raw) ? '良好' : /垃圾|劣品|破旧/.test(raw) ? '垃圾' : '普通';
          return { name: n, type: tp, quantity: 1, description: d, slot: tp === '装备' ? guessSlot(n) : null, quality: q as any, acquiredAt: Date.now() };
        });
      }
      // 武功转为秘籍物品加入背包
      if ((character as any).startingMartialArts?.length > 0) {
        const existing = new Set(ws.items.map((i: any) => i.name));
        const toAdd = (character as any).startingMartialArts
          .filter((m: any) => !existing.has(m.name + '秘籍'))
          .map((m: any) => ({
            name: m.name + '秘籍',
            type: '秘籍' as const,
            quantity: 1,
            description: `${m.category||'内功'}·威力${m.power||10}·消耗${m.cost||5}·${m.desc||''}`,
            slot: null,
            quality: m.quality || '普通',
            acquiredAt: Date.now(),
          }));
        ws.items = [...ws.items, ...toAdd];
      }
      return ws;
    });
    // 确保武功被动已生效
    rawSetChar(recalcBuffs(character));
    setGameStarted(true);
    gt.current = Date.now();
    lastLen.current = 0;
    setTimeout(() => rawSend('开始'), 100);
  }, [loadHistory, rawSend, character]);

  const useItem = useCallback((i: number) => {
    const { history: u } = handleUseItem(i, history);
    loadHistory(u);
  }, [history, handleUseItem, loadHistory]);

  const levelUp = useCallback((a: keyof import('./engine/character/types').Attributes) => {
    const { history: u } = handleLevelUp(a, history);
    loadHistory(u);
  }, [history, handleLevelUp, loadHistory]);
  const toggleMA = useCallback((i: number) => { const { history: u } = handleToggleMA(i, history); loadHistory(u); }, [history, handleToggleMA, loadHistory]);
  const trainMA = useCallback((i: number) => { const { history: u } = handleTrainMA(i, history); loadHistory(u); }, [history, handleTrainMA, loadHistory]);
  const forgetMA = useCallback((i: number) => { const { history: u } = handleForgetMA(i, history); loadHistory(u); }, [history, handleForgetMA, loadHistory]);
  const unequip = useCallback((s: import('./engine/character/types').EquipSlot) => { const { history: u } = handleUnequip(s, history); loadHistory(u); }, [history, handleUnequip, loadHistory]);
  const doRest = useCallback(() => { const { history: u } = handleRest(history); loadHistory(u); }, [history, handleRest, loadHistory]);
  const examine = useCallback((index: number) => {
    const item = worldState.items[index];
    if (!item) return;
    sendMessage(`[端详] 你仔细查看**${item.name}**：${item.description || '一件普通的物品'}。请以 AI DM 的身份详细描述这件物品的外观、来历、可能的用途。如果它有什么隐藏的秘密或故事，请揭示。`);
  }, [worldState, sendMessage]);

  const save = useCallback(() => {
    const slot = Date.now();
    if (saveGame(slot, character, history, { endpoint: config.endpoint, model: config.model, temperature: config.temperature, maxTokens: config.maxTokens }, { playTime: Math.floor((Date.now() - gt.current) / 1000), totalMessages: history.length, scene: worldState.currentLocation }, worldState))
      loadHistory([...history, { role: 'system', content: '[系统] 存档成功' }]);
  }, [character, history, config, loadHistory, worldState]);

  const loadGame = useCallback((save: SaveData) => {
    setCharacter(sanitize(save.character));
    loadHistory(save.history);
    if (save.worldState) setWorldState(save.worldState);
    if (save.llmSettings) setConfig(p => ({ ...p, ...save.llmSettings }));
    setScreen('game'); setGameStarted(true);
    gt.current = Date.now() - save.meta.playTime * 1000;
    lastLen.current = save.history.length;
  }, [setCharacter, loadHistory, setWorldState]);

  if (screen === 'creation') {
    // 编辑时从世界状态提取当前物品和武功作为初始值
    const editChar = { ...character };
    if (worldState.items.length > 0) {
      (editChar as any).startingItems = worldState.items.map(i => `${i.name}|${i.description}`);
    }
    if (editChar.martialArts.length > 0) {
      (editChar as any).startingMartialArts = editChar.martialArts.map((m: any) => ({ name: m.name, category: m.category, power: m.威力, cost: m.内力消耗, desc: m.description }));
    }
    return <CharacterCreation initial={editChar} onComplete={(c: Character, items: string[], ma: any[]) => {
      if (items.length > 0) {
        const newItems: ItemState[] = items.map(raw => {
          const [n, d = ''] = raw.split('|');
          return { name: n, type: classifyItem(raw), quantity: 1, description: d, slot: guessSlot(n), acquiredAt: Date.now() };
        });
        setWorldState((prev: WorldState) => {
          const existing = new Set(prev.items.map(i => i.name));
          const toAdd = newItems.filter(i => !existing.has(i.name));
          return { ...prev, items: [...prev.items, ...toAdd] };
        });
      }
      if (ma.length > 0) {
        // 暂存武功数据，开局时转为秘籍物品放入背包
        (c as any).startingMartialArts = ma;
      }
      setCharacter(c); setScreen('game');
    }} onCancel={() => setScreen('game')} config={config} />;
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {gameStarted
        ? <TopBar character={character} worldState={worldState} inCombat={false} onSave={save} onSettings={() => setShowSettings(true)} onRest={doRest} snapshots={snapshots.map(s => ({ timestamp: s.timestamp, preview: s.preview }))} onRestore={(i: number) => { const r = restoreSnapshot(i); if (r) loadHistory([...history.slice(0, -1), { role: 'assistant', content: '[已回溯]' }]); }} />
        : <div className="top-bar"><h1 style={{ fontSize:'20px', margin:0 }}>江湖夜雨</h1><div className="top-bar-actions"><button className="btn-outline" style={{ padding:'6px 12px', fontSize:'12px' }} onClick={() => setShowSettings(true)}>设置</button></div></div>
      }
      <div style={{ flex:1, display:'flex', overflow:'auto', justifyContent:'center' }}>
        <div style={{ width:'100%', maxWidth:'1400px', display:'flex' }}>
          {gameStarted
            ? <div style={{ display:'flex', flex:1, minWidth:0 }}>
                <NpcPanel worldState={worldState} history={history} onInteract={(name, action) => {
                  if (['交谈','询问','赠礼','交易'].includes(action.split('：')[0])) {
                    sendMessage(`[与${name}${action}]`);
                    return;
                  }
                  const { messages } = handleNpcAction(name, action);
                  if (messages.length === 0) return;
                  loadHistory([...history, ...messages]);
                  // 等 React 提交后再触发 AI
                  requestAnimationFrame(() => {
                    sendMessage('[继续]');
                  });
                }} />
                <ChatScreen history={history} streaming={streaming} streamContent={streamContent} onSend={sendMessage} onAbort={abort} />
                <GamePanel character={character} worldState={worldState} onUseItem={useItem} onLevelUp={levelUp} onToggleMA={toggleMA} onTrainMA={trainMA} onForgetMA={forgetMA} onUnequip={unequip} onExamine={examine} />
              </div>
            : <LobbyScreen character={character} setCharacter={setCharacter} config={config} worldSetting={worldSetting} onWorldChange={setWorldSetting} onStartGame={startGame} onEditCharacter={() => setScreen('creation')} onOpenSettings={() => setShowSettings(true)} onLoadGame={loadGame} />
          }
        </div>
      </div>
      {showSettings && <SettingsPanel config={config} onConfigChange={(c: LLMConfig) => { setConfig(c); localStorage.setItem('wuxia_llm_config', JSON.stringify(c)); }} onClose={() => setShowSettings(false)} onLoadGame={loadGame} />}
    </div>
  );
}
