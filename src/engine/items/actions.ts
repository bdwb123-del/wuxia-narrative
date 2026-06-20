// ===== 物品使用动作 =====
import type { EquipSlot } from '../character/types';
import type { GameState, StateChange } from '../state/types';
import { recalcBuffs, defaultBuffs, normalizeCategory } from '../combat/calc';

/** 品质 → 最高等级 */
const QUALITY_MAX_LEVEL: Record<string, number> = {
  '垃圾': 3, '普通': 5, '良好': 7, '优秀': 9, '史诗': 12, '传说': 15, '神话': 20,
};

/** 使用丹药 */
export function usePotion(index: number, state: GameState): StateChange & { used: boolean } {
  const item = state.worldState.items[index];
  if (!item || item.type !== '丹药') return { messages: [], used: false };
  // 简单丹药恢复
  let hpRecover = 0, qiRecover = 0;
  if (/金疮/.test(item.name)) hpRecover = 20;
  else if (/回气|聚气/.test(item.name)) qiRecover = 15;
  else if (/大还|九转|续命/.test(item.name)) { hpRecover = 50; qiRecover = 30; }
  else if (/真气/.test(item.name)) qiRecover = 25;
  else if (/疗伤|续骨|活血/.test(item.name)) hpRecover = 15;
  else { hpRecover = 10; qiRecover = 5; }
  const newItems = [...state.worldState.items];
  newItems.splice(index, 1);
  const c = {
    ...state.character,
    combat: {
      ...state.character.combat,
      生命值: Math.min(state.character.combat.最大生命值, state.character.combat.生命值 + hpRecover),
      内力值: Math.min(state.character.combat.最大内力值, state.character.combat.内力值 + qiRecover),
    },
  };
  return { character: c, worldState: { ...state.worldState, items: newItems }, messages: [{ role: 'user', content: `服用了${item.name}，生命+${hpRecover} 内力+${qiRecover}` }], used: true };
}

/** 装备物品 */
export function equipItem(index: number, state: GameState): StateChange & { used: boolean } {
  const item = state.worldState.items[index];
  if (!item || !item.slot) return { messages: [], used: false };
  const slot = item.slot as EquipSlot;
  const old = state.character.equipment[slot];
  const newItems = [...state.worldState.items];
  newItems.splice(index, 1);
  const newSlots = { ...state.character.equipment, [slot]: { name: item.name, slot, description: item.description, effects: {}, quality: item.quality } };
  // 卸下的装备放回背包
  const equipItems: any[] = [...newItems];
  if (old) equipItems.push({ name: old.name, type: '装备' as const, quantity: 1, description: old.description, slot: old.slot, quality: (old as any).quality, acquiredAt: Date.now() });
  const c = recalcBuffs({ ...state.character, equipment: newSlots as any });
  return { character: c, worldState: { ...state.worldState, items: equipItems }, messages: [{ role: 'user', content: `装备了${item.name}（${slot}）` + (old ? `，卸下了${old.name}` : '') }], used: true };
}

/** 使用/研读/端详 物品总入口 */
export function useItem(index: number, state: GameState): StateChange & { used: boolean } {
  const item = state.worldState.items[index];
  if (!item) return { messages: [], used: false };
  if (item.type === '丹药') return usePotion(index, state);
  if (item.type === '食物') return useFood(index, state);
  if (item.type === '装备') return equipItem(index, state);
  if (item.type === '秘籍') return useManual(index, state);
  return { messages: [], used: false };
}

/** 食用食物——恢复饥饿+临时buff */
export function useFood(index: number, state: GameState): StateChange & { used: boolean } {
  const item = state.worldState.items[index];
  if (!item || item.type !== '食物') return { messages: [], used: false };
  const desc = item.description || '';
  // 解析描述中的饥饿恢复值（格式：饥饿-25 = 减少25点饥饿）
  const hungerM = desc.match(/饥饿[＝=]?\s*(-?\d+)/);
  const hungerRecover = hungerM ? parseInt(hungerM[1]) : -15;
  const buffDesc = desc.replace(/饥饿[+-]?\d+/g, '').trim();
  // 临时buff：持续3-8回合
  const duration = 3 + Math.floor(Math.random() * 6);
  const newItems = [...state.worldState.items];
  newItems.splice(index, 1);
  const newEffect: import('../character/types').StatusEffect | null = buffDesc ? {
    name: item.name,
    description: buffDesc,
    duration,
    effects: {},
  } : null;
  let c = { ...state.character, hunger: Math.max(0, (state.character.hunger || 0) + hungerRecover) };
  if (newEffect) {
    c.statusEffects = [...c.statusEffects, newEffect];
  }
  return {
    character: c,
    worldState: { ...state.worldState, items: newItems },
    messages: [{ role: 'user', content: `吃下了${item.name}，饥饿值 ${hungerRecover > 0 ? '+' : ''}${hungerRecover}（当前${c.hunger}）${buffDesc ? `。获得临时效果：${buffDesc}（持续${duration}回合）` : ''}` }],
    used: true,
  };
}

/** 研读秘籍——本地骰子判定，直接习得或失败 */
export function useManual(index: number, state: GameState): StateChange & { used: boolean } {
  const item = state.worldState.items[index];
  if (!item || item.type !== '秘籍') return { messages: [], used: false };
  const desc = item.description || '';
  const parts = desc.split('·');
  const catPart = parts[0] || '';
  const power = parseInt(parts.find(p => p.includes('威力'))?.replace(/\D/g, '') || '10', 10);
  const cost = parseInt(parts.find(p => p.includes('消耗'))?.replace(/\D/g, '') || '5', 10);
  const descText = parts.slice(1).join('·') || parts.join('·');
  const a = state.character.attributes;
  const itemName = item.name.replace('秘籍', '');
  const cat = normalizeCategory(catPart) as import('../character/types').SkillCategory;

  // 消耗物品
  const newItems = [...state.worldState.items];
  newItems.splice(index, 1);

  // 掷骰 d20 + 悟性 + 根骨
  const d20 = Math.floor(Math.random() * 20) + 1;
  const total = d20 + a.悟性 + a.根骨;
  const difficulty = 12 + Math.floor(power / 4); // 威力越高越难
  const success = total >= difficulty;

  if (success) {
    // 习得武功
    const maQuality = item.quality || '普通';
    const newMA = {
      name: itemName,
      category: cat,
      level: 1,
      proficiency: Math.floor(Math.random() * 20) + 20, // 20-39 初始熟练
      maxLevel: QUALITY_MAX_LEVEL[maQuality] || 5,
      内力消耗: cost,
      威力: power,
      description: descText,
      active: true,
      quality: maQuality,
      buffs: defaultBuffs({ category: cat, level: 1, 威力: power, quality: maQuality }),
    };
    const updatedChar: any = {
      ...state.character,
      martialArts: [...state.character.martialArts, newMA],
      chronicle: [...state.character.chronicle, { timestamp: Date.now(), age: state.character.age, event: `研读秘籍习得 ${itemName}`, category: '习武' as const }],
    };
    const c = recalcBuffs(updatedChar);

    const crit = d20 === 20 ? ' 🎯 大成功！初始熟练+20' : '';
    return {
      character: c,
      worldState: { ...state.worldState, items: newItems },
      messages: [{
        role: 'system',
        content: `[系统] 📜 研读《${itemName}》——掷 d20=${d20} + 悟性${a.悟性} + 根骨${a.根骨} = **${total}**（难度 ${difficulty}）→ ✅ 领悟成功！\n习得：${itemName}（${cat}·威力${power}·消耗${cost}）${crit}`
      }],
      used: true,
    };
  } else {
    const msg = d20 === 1
      ? `[系统] 📜 研读《${itemName}》——掷 d20=1 + 悟性${a.悟性} + 根骨${a.根骨} = **${total}**（难度 ${difficulty}）→ ❌ 大失败！秘籍在手中化为灰烬...`
      : `[系统] 📜 研读《${itemName}》——掷 d20=${d20} + 悟性${a.悟性} + 根骨${a.根骨} = **${total}**（难度 ${difficulty}）→ ❌ 失败。翻了几页，太过深奥，未能领悟。秘籍可再次研读。`;
    // 大失败才消耗秘籍，普通失败保留
    const w = d20 === 1 ? { ...state.worldState, items: newItems } : state.worldState;
    return { worldState: d20 === 1 ? w : undefined, messages: [{ role: 'system', content: msg }], used: true };
  }
}
