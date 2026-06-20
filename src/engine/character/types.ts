// ===== 武侠角色卡类型定义 =====

/** 五行属性 */
export type Element = '金' | '木' | '水' | '火' | '土';

/** 基础属性 */
export interface Attributes {
  体魄: number;  // 生命/耐力
  内力: number;  // 真气/内功
  身法: number;  // 轻功/闪避
  悟性: number;  // 学习/洞察
  根骨: number;  // 资质/潜力
  元气: number;  // 影响气力值上限
}

/** 战斗属性 */
export interface CombatStats {
  生命值: number;
  最大生命值: number;
  内力值: number;
  最大内力值: number;
  攻击力: number;
  防御力: number;
  速度: number;
  气力值: number;
  最大气力值: number;
  暴击率: number;
  暴击伤害: number;
  闪避率: number;
  命中率: number;
}

/** 技能 */
export interface Skill {
  name: string;
  category: SkillCategory;
  level: number;      // 1-10
  description: string;
}

export type SkillCategory =
  | '拳掌' | '剑法' | '刀法' | '指法'
  | '奇门' | '暗器' | '内功' | '轻功'
  | '格挡' | '绝技' | '棍法' | '鞭法'
  | '通用';

/** 武功分类元数据 */
export const MARTIAL_CATEGORIES: { key: SkillCategory; label: string; icon: string; desc: string; passiveType: boolean }[] = [
  { key: '拳掌', label: '拳掌', icon: '👊', desc: '徒手搏击，刚猛霸道', passiveType: false },
  { key: '剑法', label: '剑法', icon: '⚔', desc: '剑走轻灵，以巧取胜', passiveType: false },
  { key: '刀法', label: '刀法', icon: '🔪', desc: '刀势沉猛，大开大合', passiveType: false },
  { key: '棍法', label: '棍法', icon: '🏒', desc: '长兵横扫，一力降十会', passiveType: false },
  { key: '鞭法', label: '鞭法', icon: '🪢', desc: '软兵缠绕，以柔克刚', passiveType: false },
  { key: '指法', label: '指法', icon: '☝', desc: '点穴截脉，精妙入微', passiveType: false },
  { key: '奇门', label: '奇门', icon: '🌀', desc: '奇异兵器，出奇制胜', passiveType: false },
  { key: '暗器', label: '暗器', icon: '🎯', desc: '百步穿杨，防不胜防', passiveType: false },
  { key: '内功', label: '内功', icon: '🧘', desc: '修习真气，提升内力上限', passiveType: true },
  { key: '轻功', label: '轻功', icon: '💨', desc: '身法飘逸，提升闪避速度', passiveType: true },
  { key: '格挡', label: '格挡', icon: '🛡', desc: '防御招架，化解攻击', passiveType: false },
  { key: '绝技', label: '绝技', icon: '💥', desc: '终极奥义，威力惊人', passiveType: false },
];

/** 武学（可装备的武功招式） */
export interface MartialArt {
  name: string;
  category: SkillCategory;  // 武功分类
  level: number;            // 武功等级 1-10
  proficiency: number;      // 熟练度 0-100
  maxLevel: number;         // 最高等级
  内力消耗: number;
  威力: number;
  description: string;
  active: boolean;
  buffs?: Partial<Attributes>;  // AI 设定的属性加成
  quality?: Quality;            // 品质等级（影响数值倍率）
  effects?: string;             // 特殊战斗效果描述（如"中毒""眩晕""吸血"）
}

/** 人生大事记 */
export interface LifeEvent {
  timestamp: number;
  age: number;
  event: string;
  category: '升级' | '习武' | '战斗' | '任务' | '轮回' | '奇遇' | '关系' | '休息' | '其他';
}

/** 装备槽位 */
export type EquipSlot = '武器' | '副手' | '头部' | '身躯' | '腿部' | '足部' | '护手' | '披风' | '饰品1' | '饰品2' | '饰品3' | '饰品4';

/** 品质等级 */
export type Quality = '垃圾' | '普通' | '良好' | '优秀' | '史诗' | '传说' | '神话';

/** 品质颜色映射 */
export const QUALITY_COLORS: Record<Quality, { bg: string; border: string; text: string; glow: string }> = {
  '垃圾': { bg: '#2a2a2a', border: '#555', text: '#999', glow: 'none' },
  '普通': { bg: '#2a2a2a', border: '#888', text: '#ccc', glow: 'none' },
  '良好': { bg: '#1a2a1a', border: '#4a8', text: '#8c8', glow: '0 0 4px #4a8' },
  '优秀': { bg: '#1a1a2a', border: '#48a', text: '#8af', glow: '0 0 6px #48a' },
  '史诗': { bg: '#2a1a2a', border: '#a4a', text: '#c8f', glow: '0 0 8px #a4a' },
  '传说': { bg: '#2a1a0a', border: '#f80', text: '#fc8', glow: '0 0 10px #f80' },
  '神话': { bg: '#2a0a0a', border: '#f44', text: '#faa', glow: '0 0 12px #f44' },
};

/** 品质数值倍率 */
export const QUALITY_MULTIPLIER: Record<Quality, number> = {
  '垃圾': 0.3, '普通': 0.6, '良好': 1.0, '优秀': 1.5, '史诗': 2.2, '传说': 3.0, '神话': 4.5,
};

/** 品质排序权重 */
export const QUALITY_ORDER: Record<Quality, number> = {
  '垃圾': 0, '普通': 1, '良好': 2, '优秀': 3, '史诗': 4, '传说': 5, '神话': 6,
};

/** 装备槽定义 */
export interface EquipSlotDef {
  key: EquipSlot;
  label: string;
  icon: string;
}

export const EQUIP_SLOTS: EquipSlotDef[] = [
  { key: '武器', label: '主手', icon: '⚔' },
  { key: '副手', label: '副手', icon: '🗡' },
  { key: '头部', label: '头部', icon: '⛑' },
  { key: '身躯', label: '身躯', icon: '👘' },
  { key: '腿部', label: '腿部', icon: '🦵' },
  { key: '足部', label: '足部', icon: '👢' },
  { key: '护手', label: '护手', icon: '🧤' },
  { key: '披风', label: '披风', icon: '🧣' },
  { key: '饰品1', label: '饰品①', icon: '💍' },
  { key: '饰品2', label: '饰品②', icon: '💍' },
  { key: '饰品3', label: '饰品③', icon: '💍' },
  { key: '饰品4', label: '饰品④', icon: '💍' },
];

/** 单件装备 */
export interface Equipment {
  name: string;
  slot: EquipSlot;
  description: string;
  effects: Partial<CombatStats>;
  quality?: Quality;
}

/** 角色身上装备（按槽位存储，null=未装备） */
export type EquipmentSlots = Record<EquipSlot, Equipment | null>;

export const EMPTY_EQUIPMENT: EquipmentSlots = {
  武器: null, 副手: null, 头部: null, 身躯: null, 腿部: null, 足部: null, 护手: null, 披风: null, 饰品1: null, 饰品2: null, 饰品3: null, 饰品4: null,
};

/** 状态 */
export interface StatusEffect {
  name: string;
  description: string;
  duration: number;   // 剩余回合
  effects: Partial<CombatStats>;
}

/** 武功被动 Buff/Debuff */
export interface Buff {
  name: string;
  source: string;
  effects: Partial<Attributes>;
  type: 'buff' | 'debuff';
  icon: string;
}

/** 完整角色卡 */
export interface Character {
  // 基本信息
  name: string;
  title: string;       // 称号
  gender: string;      // 性别
  age: number;
  sect: string;        // 门派
  element: Element;    // 五行属性
  birthplace: string;  // 出生地

  // 详细描述
  appearance: string;  // 外貌
  personality: string; // 性格
  background: string;  // 身世
  ambition: string;    // 志向
  weakness: string;    // 弱点/缺陷

  // 属性
  attributes: Attributes;
  combat: CombatStats;

  // 技能
  skills: Skill[];
  martialArts: MartialArt[];

  // 装备
  equipment: EquipmentSlots;

  // 状态
  statusEffects: StatusEffect[];
  karma: number;
  /** 饱食度 0-100，越高越饿 */
  hunger: number;
  buffs: Buff[];
  chronicle: LifeEvent[];

  // 数值
  level: number;
  experience: number;
  pendingAttrPoints: number;
}

/** 可分配给玩家的属性点 */
export const BASE_ATTRIBUTE_POINTS = 30;

/** 属性上限 */
export const MAX_ATTRIBUTE = 100;
export const MIN_ATTRIBUTE = 0;

/** 属性名称列表 */
export const ATTRIBUTE_NAMES: (keyof Attributes)[] = [
  '体魄', '内力', '身法', '悟性', '根骨', '元气'
];

/** 属性中文描述 */
export const ATTRIBUTE_DESCRIPTIONS: Record<keyof Attributes, string> = {
  体魄: '影响生命值、抗性和力量',
  内力: '影响内力值、内功威力和气力值上限',  元气: '影响气力值、招架、压制',
  身法: '影响闪避、速度和轻功效果',
  悟性: '影响技能学习速度和洞察力',
  根骨: '影响修炼效率和潜力上限',
};

/** 属性战斗公式 */
export const ATTRIBUTE_FORMULAS: Record<keyof Attributes, string[]> = {
  体魄: ['生命 = 50 + 体魄×15', '攻击 = 5 + 体魄×2 + 内力', '防御 = 3 + 体魄×1.5 + 根骨'],
  内力: ['内力值 = 30 + 内力×10', '攻击 = 5 + 体魄×2 + 内力', '气力上限 = 20 + 内力×3'],
  身法: ['速度 = 5 + 身法×2'],
  悟性: ['影响秘籍研读成功率'],
  根骨: ['防御 = 3 + 体魄×1.5 + 根骨', '影响修炼效率'],
  元气: ['气力值 = 20 + 内力×3 + 元气×2', '武学消耗 = 气力值 + 内力消耗'],
};

/** 从基础属性计算战斗属性 */
export function deriveCombatStats(attrs: Attributes, level: number): CombatStats {
  return {
    最大生命值: 50 + attrs.体魄 * 15 + level * 5,
    生命值: 50 + attrs.体魄 * 15 + level * 5,
    最大内力值: 30 + attrs.内力 * 10 + level * 3,
    内力值: 30 + attrs.内力 * 10 + level * 3,
    最大气力值: 20 + attrs.内力 * 3 + (attrs.元气 || 0) * 2,
    气力值: 20 + attrs.内力 * 3 + (attrs.元气 || 0) * 2,
    攻击力: 5 + attrs.体魄 * 2 + attrs.内力,
    防御力: 3 + attrs.体魄 * 1.5 + attrs.根骨,
    速度: 5 + attrs.身法 * 2,
    暴击率: Math.min(80, 5 + attrs.悟性 * 1.5),
    暴击伤害: 150 + attrs.内力,
    闪避率: Math.min(60, 5 + attrs.身法),
    命中率: Math.min(95, 80 + attrs.身法 * 0.5),
  };
}
