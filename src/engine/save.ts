// ===== 存档/读档系统 =====

import type { Character } from './character/types';
import type { ChatMessage } from './llm/types';
import type { LLMConfig } from './llm/types';
import type { WorldState } from './world';

/** 存档数据结构 */
export interface SaveData {
  /** 版本号 */
  version: string;
  /** 保存时间 */
  timestamp: number;
  /** 角色数据 */
  character: Character;
  /** 对话历史 */
  history: ChatMessage[];
  /** LLM 配置（保留端点/模型，不保存 API Key） */
  llmSettings: Omit<LLMConfig, 'apiKey'>;
  /** 世界状态 */
  worldState?: WorldState;
  /** 游戏元数据 */
  meta: {
    playTime: number;
    totalMessages: number;
    scene: string;
  };
}

const SAVE_VERSION = '1.0.0';
const SAVE_PREFIX = 'wuxia_save_';
const CHAR_PREFIX = 'wuxia_char_';

/** 生成存档文件名 */
function getSaveFileName(slot: number): string {
  return `${SAVE_PREFIX}${slot}.json`;
}

/** 读取存档 */
export function loadSave(slot: number): SaveData | null {
  try {
    const raw = localStorage.getItem(getSaveFileName(slot));
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!data.version || !data.character || !data.history) {
      throw new Error('存档格式无效');
    }
    return data;
  } catch (e) {
    console.error('读取存档失败:', e);
    return null;
  }
}

/** 保存存档 */
export function saveGame(
  slot: number,
  character: Character,
  history: ChatMessage[],
  llmSettings: Omit<LLMConfig, 'apiKey'>,
  meta: SaveData['meta'],
  worldState?: WorldState,
): boolean {
  try {
    const data: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      character,
      history,
      llmSettings,
      worldState,
      meta,
    };
    localStorage.setItem(getSaveFileName(slot), JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('保存失败:', e);
    return false;
  }
}

/** 删除存档 */
export function deleteSave(slot: number): void {
  localStorage.removeItem(getSaveFileName(slot));
}

/** 列出所有存档槽位 */
export function listSaves(): { slot: number; data: SaveData }[] {
  const saves: { slot: number; data: SaveData }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SAVE_PREFIX)) {
      const slot = parseInt(key.replace(SAVE_PREFIX, '').replace('.json', ''), 10);
      if (!isNaN(slot)) {
        const data = loadSave(slot);
        if (data) saves.push({ slot, data });
      }
    }
  }
  return saves.sort((a, b) => b.data.timestamp - a.data.timestamp);
}

/** ===== 人物卡管理 ===== */

export function saveCharacter(slot: number, character: Character): boolean {
  try {
    localStorage.setItem(`${CHAR_PREFIX}${slot}`, JSON.stringify(character));
    return true;
  } catch { return false; }
}

export function loadCharacter(slot: number): Character | null {
  try {
    const raw = localStorage.getItem(`${CHAR_PREFIX}${slot}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function deleteCharacter(slot: number): void {
  localStorage.removeItem(`${CHAR_PREFIX}${slot}`);
}

export function listCharacters(): { slot: number; data: Character }[] {
  const chars: { slot: number; data: Character }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CHAR_PREFIX)) {
      const slot = parseInt(key.replace(CHAR_PREFIX, ''), 10);
      if (!isNaN(slot)) {
        const data = loadCharacter(slot);
        if (data) chars.push({ slot, data });
      }
    }
  }
  return chars.sort((a, b) => (b.data.pendingAttrPoints || 0) - (a.data.pendingAttrPoints || 0));
}

/** 导出存档为 JSON 文件（Tauri 环境下载到本地） */
export async function exportSave(slot: number): Promise<boolean> {
  const data = loadSave(slot);
  if (!data) return false;

  try {
    const json = JSON.stringify(data, null, 2);
    // 使用浏览器的下载能力
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wuxia_save_${slot}_${new Date(data.timestamp).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** 从 JSON 文件导入存档 */
export function importSave(jsonStr: string, slot: number): boolean {
  try {
    const data = JSON.parse(jsonStr) as SaveData;
    if (!data.version || !data.character || !data.history) {
      throw new Error('存档格式无效');
    }
    return saveGame(slot, data.character, data.history, data.llmSettings, data.meta);
  } catch (e) {
    console.error('导入失败:', e);
    return false;
  }
}
