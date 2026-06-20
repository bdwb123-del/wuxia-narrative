// ===== 战斗数值计算 =====
import type { Character, Attributes, CombatStats } from '../character/types';
import { MARTIAL_CATEGORIES, QUALITY_MULTIPLIER } from '../character/types';
import { equipStats } from '../items/identify';

/** 武功 buff 默认值（AI 不给 buffs 时的 fallback） */
export function defaultBuffs(ma: { category: string; level: number; 威力: number; quality?: import('../character/types').Quality }): Partial<Attributes> {
  const mul = ma.quality ? (QUALITY_MULTIPLIER[ma.quality] ?? 1) : 1;
  return { 体魄: Math.max(1, Math.round(mul)) };
}

/** 规范化武功分类到标准 12 类 */
export function normalizeCategory(raw: string): string {
  if (/内功/.test(raw)) return '内功';
  if (/轻功/.test(raw)) return '轻功';
  if (/格挡|防御/.test(raw)) return '格挡';
  if (/绝技|奥义/.test(raw)) return '绝技';
  if (/拳|掌|爪/.test(raw)) return '拳掌';
  if (/剑/.test(raw)) return '剑法';
  if (/刀/.test(raw)) return '刀法';
  if (/棍|棒|杖/.test(raw)) return '棍法';
  if (/鞭/.test(raw)) return '鞭法';
  if (/指|点穴/.test(raw)) return '指法';
  if (/暗器|镖|箭/.test(raw)) return '暗器';
  if (/奇门|音|琴|箫|笛|扇/.test(raw)) return '奇门';
  return '内功'; // fallback
}

/** 从根基重新计算：基础属性 + 激活武功的属性加成 → 战斗数值 */
export function recalcBuffs(char: Character): Character {
  const arts = char.martialArts || [];
  let bonusTi = 0, bonusNei = 0, bonusShen = 0, bonusWu = 0, bonusGen = 0, bonusQi = 0;
  const buffs: import('../character/types').Buff[] = [];
  for (const ma of arts) {
    if (!ma.active || !ma.buffs) continue;
    const b = ma.buffs as any;
    const scale = ma.level || 1; // buffs 随等级缩放
    if (b.体魄) bonusTi += b.体魄 * scale; if (b.内力) bonusNei += b.内力 * scale; if (b.身法) bonusShen += b.身法 * scale;
    if (b.悟性) bonusWu += b.悟性 * scale; if (b.根骨) bonusGen += b.根骨 * scale; if (b.元气) bonusQi += b.元气 * scale;
    const eff: any = {};
    if (b.体魄) eff.体魄 = b.体魄 * scale; if (b.内力) eff.内力 = b.内力 * scale; if (b.身法) eff.身法 = b.身法 * scale;
    if (b.悟性) eff.悟性 = b.悟性 * scale; if (b.根骨) eff.根骨 = b.根骨 * scale; if (b.元气) eff.元气 = b.元气 * scale;
    if (Object.keys(eff).length > 0) buffs.push({ name: `${ma.name} Lv.${ma.level}`, source: ma.name, effects: eff, type: 'buff', icon: MARTIAL_CATEGORIES.find(c => c.key === ma.category)?.icon || '⚔' });
  }
  // 装备加成
  let eqAtk = 0, eqDef = 0, eqSpd = 0;
  const eq = char.equipment || {} as any;
  for (const slot of Object.values(eq)) {
    if (!slot) continue;
    const es = equipStats({ name: slot.name, description: slot.description, slot: slot.slot, quality: (slot as any).quality });
    eqAtk += es.attackBonus; eqDef += es.defenseBonus; eqSpd += es.speedBonus;
  }
  // 有效属性 = 根基 + 武功加成
  const a = char.attributes;
  const e = { 体魄: a.体魄 + bonusTi, 内力: a.内力 + bonusNei, 身法: a.身法 + bonusShen, 悟性: a.悟性 + bonusWu, 根骨: a.根骨 + bonusGen, 元气: ((a as any).元气 || 0) + bonusQi };
  const base = {
    攻击力: 5 + e.体魄 * 2 + e.内力,
    防御力: 3 + e.体魄 * 1.5 + e.根骨,
    速度: 5 + e.身法 * 2,
    最大生命值: 50 + e.体魄 * 15 + char.level * 5,
    最大内力值: 30 + e.内力 * 10 + char.level * 3,
    最大气力值: 20 + e.内力 * 3 + (e as any).元气 * 2,
  };
  const combat: CombatStats = {
    攻击力: Math.max(0, base.攻击力 + eqAtk),
    防御力: Math.max(0, base.防御力 + eqDef),
    速度: Math.max(1, base.速度 + eqSpd),
    最大生命值: base.最大生命值,
    生命值: Math.min(char.combat.生命值 || base.最大生命值, base.最大生命值),
    最大内力值: base.最大内力值,
    内力值: Math.min(char.combat.内力值 || base.最大内力值, base.最大内力值),
    最大气力值: base.最大气力值,
    气力值: Math.min(char.combat.气力值 || base.最大气力值, base.最大气力值),
    暴击率: Math.min(80, 5 + e.悟性 * 1.5),
    暴击伤害: 150 + e.内力,
    闪避率: Math.min(60, 5 + e.身法),
    命中率: Math.min(95, 80 + e.身法 * 0.5),
  };

  // 饥饿 debuff：轻度惩罚
  const h = char.hunger || 0;
  if (h > 30) {
    const factor = h > 90 ? 0.90 : h > 70 ? 0.93 : h > 50 ? 0.96 : 0.98;
    combat.攻击力 = Math.round(combat.攻击力 * factor);
    combat.防御力 = Math.round(combat.防御力 * factor);
    combat.速度 = Math.round(combat.速度 * factor);
    if (h > 90) {
      combat.最大生命值 = Math.round(combat.最大生命值 * 0.95);
      combat.生命值 = Math.min(combat.生命值, combat.最大生命值);
      combat.生命值 = Math.max(1, combat.生命值 - 1);
    }
  }
  return { ...char, buffs, combat };
}

/** 从属性/装备/武功完整导出战斗值（同名便捷函数） */
export const deriveCombat = recalcBuffs;
