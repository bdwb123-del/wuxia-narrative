// ===== 角色卡管理系统 =====

import type {
  Character,
  Attributes,
  CombatStats,
} from './types';
import {
  BASE_ATTRIBUTE_POINTS,
  MAX_ATTRIBUTE,
  MIN_ATTRIBUTE,
  deriveCombatStats,
  EMPTY_EQUIPMENT,
} from './types';
import { realmName } from '../growth';

/** 创建默认角色卡 */
export function createDefaultCharacter(name: string = ''): Character {
  const baseAttrs: Attributes = { 体魄: 0, 内力: 0, 身法: 0, 悟性: 0, 根骨: 0, 元气: 0 };
  const level = 1;
  return {
    name, title: '', gender: '', age: 20, sect: '无门派', element: '土', birthplace: '',
    appearance: '', personality: '', background: '', ambition: '', weakness: '',
    attributes: baseAttrs,
    combat: deriveCombatStats(baseAttrs, level),
    skills: [], martialArts: [],
    equipment: { ...EMPTY_EQUIPMENT },
    statusEffects: [], karma: 0, hunger: 0, buffs: [], chronicle: [],
    level, experience: 0, pendingAttrPoints: 25,
  };
}

/** 验证属性分配是否合法 */
export function validateAttributes(attrs: Attributes): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let total = 0;

  for (const [key, value] of Object.entries(attrs)) {
    total += value;
    if (value < MIN_ATTRIBUTE || value > MAX_ATTRIBUTE) {
      errors.push(`${key} 必须在 ${MIN_ATTRIBUTE} 到 ${MAX_ATTRIBUTE} 之间`);
    }
  }

  if (total > BASE_ATTRIBUTE_POINTS) {
    errors.push(`属性总和不能超过 ${BASE_ATTRIBUTE_POINTS}`);
  }

  return { valid: errors.length === 0, errors };
}

/** 分配属性点 */
export function allocateAttribute(
  attrs: Attributes,
  key: keyof Attributes,
  delta: number,
): Attributes {
  const newAttrs = { ...attrs };
  const newValue = newAttrs[key] + delta;
  if (newValue >= MIN_ATTRIBUTE && newValue <= MAX_ATTRIBUTE) {
    const totalOthers = Object.entries(newAttrs)
      .filter(([k]) => k !== key)
      .reduce((sum, [, v]) => sum + v, 0);
    if (totalOthers + newValue <= BASE_ATTRIBUTE_POINTS) {
      newAttrs[key] = newValue;
    }
  }
  return newAttrs;
}

/** 获取剩余可分配属性点 */
export function getRemainingPoints(attrs: Attributes): number {
  const total = Object.values(attrs).reduce((sum, v) => sum + v, 0);
  return BASE_ATTRIBUTE_POINTS - total;
}

/** 更新战斗属性（受状态效果影响后） */
export function recalculateCombat(
  char: Character,
): CombatStats {
  const base = deriveCombatStats(char.attributes, char.level);

  // 应用装备效果
  for (const slot of Object.values(char.equipment)) {
    if (!slot) continue;
    if (slot.effects.攻击力) base.攻击力 += slot.effects.攻击力;
    if (slot.effects.防御力) base.防御力 += slot.effects.防御力;
    if (slot.effects.速度) base.速度 += slot.effects.速度;
    if (slot.effects.最大生命值) base.最大生命值 += slot.effects.最大生命值;
    if (slot.effects.最大内力值) base.最大内力值 += slot.effects.最大内力值;
  }

  // 应用状态效果
  for (const se of char.statusEffects) {
    if (se.effects.攻击力) base.攻击力 += se.effects.攻击力;
    if (se.effects.防御力) base.防御力 += se.effects.防御力;
    if (se.effects.速度) base.速度 += se.effects.速度;
  }

  return base;
}

/** 生成角色卡描述文本（注入 AI prompt 用） */
export function characterToPromptText(char: Character): string {
  const lines: string[] = [
    `【角色档案】`,
    `姓名：${char.name}${char.title ? ` · ${char.title}` : ''}`,
    `性别：${char.gender || '未知'} · 年龄：${char.age} 岁`,
    `门派：${char.sect || '无门无派'} · 五行：${char.element}`,
    `出生：${char.birthplace || '未知'} · 善恶：${char.karma >= 0 ? '+' : ''}${char.karma} · 饥饿：${char.hunger || 0}/100`,
    `外貌：${char.appearance || '未设定'}`,
    `性格：${char.personality || '未设定'}`,
    `志向：${char.ambition || '未设定'}`,
    `弱点：${char.weakness || '未设定'}`,
    char.background ? `身世：${char.background}` : '',
    `境界：${realmName(char.attributes)}`,
    ``,
    `【属性】`,
    `体魄 ${char.attributes.体魄} | 内力 ${char.attributes.内力} | 身法 ${char.attributes.身法} | 悟性 ${char.attributes.悟性} | 根骨 ${char.attributes.根骨} | 气力 ${(char.attributes as any).气力 || 0}`,
    ``,
    `【战斗数据】`,
    `生命 ${char.combat.生命值}/${char.combat.最大生命值} | 内力 ${char.combat.内力值}/${char.combat.最大内力值} | 气力 ${char.combat.气力值 || 0}/${char.combat.最大气力值 || 26}`,
    `攻击 ${char.combat.攻击力} | 防御 ${char.combat.防御力} | 速度 ${char.combat.速度}`,
  ];

  if (char.skills.length > 0) {
    lines.push(``);
    lines.push(`【技能】`);
    for (const sk of char.skills) {
      lines.push(`${sk.category}·${sk.name} Lv.${sk.level}`);
    }
  }

  if (char.martialArts.length > 0) {
    lines.push(``);
    lines.push(`【武学】`);
    for (const ma of char.martialArts) {
      lines.push(`${ma.name} (威力${ma.威力}·内力消耗${ma.内力消耗}${ma.effects ? '·' + ma.effects : ''})`);
    }
  }

  const equipped = Object.entries(char.equipment).filter(([, eq]) => eq);
  if (equipped.length > 0) {
    lines.push('');
    lines.push('【装备】');
    const slotLabels: Record<string, string> = { 武器: '主手', 副手: '副手', 头部: '头', 身躯: '身', 腿部: '腿', 足部: '足', 护手: '手', 披风: '披', 饰品1: '饰1', 饰品2: '饰2', 饰品3: '饰3', 饰品4: '饰4' };
    for (const [slot, eq] of equipped) {
      lines.push(`${slotLabels[slot] || slot}：${eq!.name}`);
    }
  }

  if (char.background) {
    lines.push(``);
    lines.push(`【身世】${char.background}`);
  }
  if (char.personality) {
    lines.push(`【性格】${char.personality}`);
  }

  return lines.join('\n');
}
