// ===== 角色成长系统 v3 —— 经验移除，AI 直接分属性 =====
import type { Character, Attributes } from './character/types';
import { deriveCombatStats } from './character/types';

// ==================== 境界系统 ====================

export const REALM_NAMES = [
  '不堪一击', '毫不足虑', '不足挂齿', '初学乍练', '勉勉强强',
  '初窥门径', '初出茅庐', '略知一二', '普普通通', '平平无奇',
  '渐入佳境', '已有小成', '炉火纯青', '出类拔萃', '技压群雄',
  '出神入化', '傲视群雄', '登峰造极', '一代宗师', '震古铄今',
];

const THRESHOLDS = [20,25,35,50,70,95,125,160,200,250,310,380,470,580,720,890,1090,1350,1700,2200];

function attrSum(attrs: Attributes): number {
  return attrs.体魄 + attrs.内力 + attrs.身法 + attrs.悟性 + attrs.根骨 + (attrs.元气 || 0);
}

export function realmLevel(attrs: Attributes): number {
  const total = attrSum(attrs);
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) if (total >= THRESHOLDS[i]) return i + 1;
  return 1;
}

export function realmName(attrs: Attributes): string {
  return REALM_NAMES[Math.min(realmLevel(attrs) - 1, REALM_NAMES.length - 1)] || '未知';
}

// ==================== 年龄 ====================

export function ageModifiers(age: number): { 体魄: number; 内力: number; 身法: number; 悟性: number; 根骨: number; 元气: number } {
  if (age <= 5)  return { 体魄: -5, 内力: -5, 身法: -5, 悟性: -5, 根骨: -5, 元气: -5 };
  if (age <= 10) return { 体魄: -4, 内力: -4, 身法: -3, 悟性: -2, 根骨: -2, 元气: -4 };
  if (age <= 15) return { 体魄: -2, 内力: -1, 身法: 0, 悟性: 1, 根骨: 1, 元气: -2 };
  if (age <= 40) return { 体魄: 0, 内力: 0, 身法: 0, 悟性: 0, 根骨: 0, 元气: 0 };
  if (age <= 60) return { 体魄: -1, 内力: 1, 身法: -1, 悟性: 1, 根骨: 0, 元气: 1 };
  if (age <= 80) return { 体魄: -3, 内力: 2, 身法: -3, 悟性: 2, 根骨: -1, 元气: 2 };
  return { 体魄: -4, 内力: 3, 身法: -4, 悟性: 3, 根骨: -2, 元气: 2 };
}

export function ageAdjustedCombat(base: Attributes, _level: number, age: number) {
  const m = ageModifiers(age);
  const e = { 体魄: Math.max(0, base.体魄 + m.体魄), 内力: Math.max(0, base.内力 + m.内力), 身法: Math.max(0, base.身法 + m.身法), 悟性: Math.max(0, base.悟性 + m.悟性), 根骨: Math.max(0, base.根骨 + m.根骨), 元气: Math.max(0, (base.元气 || 0) + (m.元气 || 0)) };
  return { 最大生命值: 50+e.体魄*15+1*5, 生命值: 50+e.体魄*15+1*5, 最大内力值: 30+e.内力*10+1*3, 内力值: 30+e.内力*10+1*3, 最大气力值: 20+e.内力*3+e.元气*2, 气力值: 20+e.内力*3+e.元气*2, 攻击力: 5+e.体魄*2+e.内力, 防御力: 3+e.体魄*1.5+e.根骨, 速度: 5+e.身法*2, 暴击率: Math.min(80, 5+e.悟性*1.5), 暴击伤害: 150+e.内力, 闪避率: Math.min(60, 5+e.身法), 命中率: Math.min(95, 80+e.身法*0.5) };
}

// ==================== 旧接口兼容 ====================

/** @deprecated 不再使用经验值 */
export function xpForLevel(_x: number): number { return 0; }

// ==================== 属性变更 ====================

/** AI 直接分配属性增量。返回新角色和是否突破境界 */
export function applyAttrDelta(char: Character, delta: Partial<Attributes>): { char: Character; oldRealm: string; newRealm: string; brokeThrough: boolean } {
  const oldRealm = realmName(char.attributes);
  const newAttrs = { ...char.attributes };
  for (const k of Object.keys(delta) as (keyof Attributes)[]) {
    newAttrs[k] = Math.min(100, Math.max(0, newAttrs[k] + (delta[k] || 0)));
  }
  const combat = deriveCombatStats(newAttrs, 1);
  const newChar = { ...char, attributes: newAttrs, combat: { ...combat, 生命值: char.combat.生命值, 内力值: char.combat.内力值, 气力值: char.combat.气力值 } };
  const newRealm = realmName(newChar.attributes);
  return { char: newChar, oldRealm, newRealm, brokeThrough: oldRealm !== newRealm };
}

// ==================== 技能/武学 ====================

export function learnSkill(char: Character, skill: import('./character/types').Skill): Character {
  const existing = char.skills.find(s => s.name === skill.name);
  if (existing) return { ...char, skills: char.skills.map(s => s.name === skill.name ? { ...s, level: Math.min(10, s.level + 1) } : s) };
  return { ...char, skills: [...char.skills, skill] };
}
