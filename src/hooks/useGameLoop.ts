// ===== 游戏主循环 Hook =====
// 包装 engine/game-loop 的 React 状态管理

import { useState, useCallback, useRef } from 'react';
import type { Character } from '../engine/character/types';
import type { ChatMessage } from '../engine/llm/types';
import type { WorldState } from '../engine/world';
import { createWorldState } from '../engine/world';
import { processAIMessage, levelUpAttr, toggleMartialArt, trainMartialArt, forgetMartialArt, unequipItem, restCharacter, handleNpcAction } from '../engine/game-loop';
import { useItem } from '../engine/items/actions';

interface Snapshot { history: ChatMessage[]; character: Character; worldState: WorldState; timestamp: number; preview: string; }

export interface GameLoopState {
  character: Character;
  worldState: WorldState;
  setCharacter: (c: Character) => void;
  setWorldState: (ws: WorldState | ((prev: WorldState) => WorldState)) => void;
  /** 处理 AI 消息：解析标记、更新状态、返回清理后的消息 */
  handleAIMessage: (content: string, history: ChatMessage[]) => {
    cleanContent: string;
    systemMessages: ChatMessage[];
    rawJSON: string;
    history: ChatMessage[];
  };
  /** 使用物品 */
  handleUseItem: (index: number, history: ChatMessage[]) => {
    messages: ChatMessage[];
    history: ChatMessage[];
    used: boolean;
  };
  /** 升级属性 */
  handleLevelUp: (attr: keyof import('../engine/character/types').Attributes, history: ChatMessage[]) => {
    history: ChatMessage[];
  };
  /** 武功操作 */
  handleToggleMA: (index: number, history: ChatMessage[]) => { history: ChatMessage[] };
  handleTrainMA: (index: number, history: ChatMessage[]) => { history: ChatMessage[] };
  handleForgetMA: (index: number, history: ChatMessage[]) => { history: ChatMessage[] };
  handleUnequip: (slot: import('../engine/character/types').EquipSlot, history: ChatMessage[]) => { history: ChatMessage[] };
  handleRest: (history: ChatMessage[]) => { history: ChatMessage[] };
  handleNpcAction: (npcName: string, action: string) => { messages: ChatMessage[] };
  /** 快照管理 */
  snapshots: Snapshot[];
  takeSnapshot: (preview: string) => void;
  restoreSnapshot: (index: number) => { history: ChatMessage[]; character: Character; worldState: WorldState } | null;
  /** 重置状态 */
  reset: () => void;
}

export function useGameLoop(initialCharacter: Character): GameLoopState {
  const [character, setCharacter] = useState<Character>(initialCharacter);
  const [worldState, setWorldState] = useState<WorldState>(createWorldState);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const stateRef = useRef({ character, worldState });
  stateRef.current = { character, worldState };

  const takeSnapshot = useCallback((preview: string) => {
    setSnapshots(prev => [...prev.slice(-19), { history: [], character: stateRef.current.character, worldState: stateRef.current.worldState, timestamp: Date.now(), preview }]);
  }, []);

  const handleAIMessage = useCallback((content: string, history: ChatMessage[]) => {
    const { cleanContent, change, rawJSON } = processAIMessage(content, stateRef.current);
    const newHistory = history.map((msg, i) =>
      i === history.length - 1 ? { ...msg, content: cleanContent } : msg,
    );
    if (change.character) setCharacter(change.character);
    if (change.worldState) setWorldState(change.worldState);
    const fullHistory = [...newHistory];
    for (const msg of change.messages) fullHistory.push(msg);
    return { cleanContent, systemMessages: change.messages, rawJSON: rawJSON, history: fullHistory };
  }, []);

  const handleUseItem = useCallback((index: number, history: ChatMessage[]) => {
    const result = useItem(index, stateRef.current);
    if (!result.used) return { messages: [], history, used: false };
    if (result.character) setCharacter(result.character);
    if (result.worldState) setWorldState(result.worldState);
    const newHistory = [...history];
    for (const msg of result.messages) newHistory.push(msg);
    return { messages: result.messages, history: newHistory, used: true };
  }, []);

  const handleLevelUp = useCallback((attr: keyof import('../engine/character/types').Attributes, history: ChatMessage[]) => {
    const result = levelUpAttr(stateRef.current, attr);
    if (!result.character) return { history };
    setCharacter(result.character);
    const newHistory = [...history];
    for (const msg of result.messages) newHistory.push(msg);
    return { history: newHistory };
  }, []);

  const handleToggleMA = useCallback((index: number, history: ChatMessage[]) => {
    const result = toggleMartialArt(stateRef.current, index);
    if (result.character) setCharacter(result.character);
    const newHistory = [...history];
    for (const msg of result.messages) newHistory.push(msg);
    return { history: newHistory };
  }, []);

  const handleTrainMA = useCallback((index: number, history: ChatMessage[]) => {
    const result = trainMartialArt(stateRef.current, index);
    if (result.character) setCharacter(result.character);
    const newHistory = [...history];
    for (const msg of result.messages) newHistory.push(msg);
    return { history: newHistory };
  }, []);

  const handleForgetMA = useCallback((index: number, history: ChatMessage[]) => {
    const result = forgetMartialArt(stateRef.current, index);
    if (result.character) setCharacter(result.character);
    const newHistory = [...history];
    for (const msg of result.messages) newHistory.push(msg);
    return { history: newHistory };
  }, []);

  const handleUnequip = useCallback((slot: import('../engine/character/types').EquipSlot, history: ChatMessage[]) => {
    const result = unequipItem(stateRef.current, slot);
    if (result.character) setCharacter(result.character);
    if (result.worldState) setWorldState(result.worldState);
    const newHistory = [...history];
    for (const msg of result.messages) newHistory.push(msg);
    return { history: newHistory };
  }, []);

  const handleRest = useCallback((history: ChatMessage[]) => {
    const result = restCharacter(stateRef.current);
    if (result.character) setCharacter(result.character);
    if (result.worldState) setWorldState(result.worldState);
    const newHistory = [...history];
    for (const msg of result.messages) newHistory.push(msg);
    return { history: newHistory };
  }, []);

  const handleNpcActionFn = useCallback((npcName: string, action: string) => {
    const result = handleNpcAction(stateRef.current, npcName, action);
    if (result.character) setCharacter(result.character);
    if (result.worldState) setWorldState(result.worldState);
    return { messages: result.messages };
  }, []);

  const restoreSnapshot = useCallback((index: number) => {
    const snap = snapshots[index];
    if (!snap) return null;
    setCharacter(snap.character);
    setWorldState(snap.worldState);
    return { history: snap.history, character: snap.character, worldState: snap.worldState };
  }, [snapshots]);

  const reset = useCallback(() => {
    setWorldState(createWorldState());
  }, []);

  return {
    character,
    worldState,
    setCharacter,
    setWorldState,
    handleAIMessage,
    handleUseItem,
    handleLevelUp,
    handleToggleMA,
    handleTrainMA,
    handleForgetMA,
    handleUnequip,
    handleRest,
    handleNpcAction: handleNpcActionFn,
    snapshots,
    takeSnapshot,
    restoreSnapshot,
    reset,
  };
}
