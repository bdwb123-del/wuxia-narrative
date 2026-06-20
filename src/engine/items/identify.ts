// ===== 物品识别与分类 =====
import type { EquipSlot } from '../character/types';
import { QUALITY_MULTIPLIER } from '../character/types';
import type { ItemState } from '../world';

/** 根据名称推断装备槽位 */
export function guessSlot(name: string): EquipSlot | null {
  const raw = name.includes('|') ? name.split('|')[0] : name;
  if (/剑|刀|枪|棍|棒|鞭|斧|锤|钩|叉|刺/.test(raw)) return '武器';
  if (/盾|弩|弓|镖|匕|飞刀|短剑|折扇/.test(raw)) return '副手';
  if (/盔|冠|帽|巾|簪|钗|笠|斗笠|发带/.test(raw)) return '头部';
  if (/甲|衣|袍|铠|衫|褂|袄/.test(raw)) return '身躯';
  if (/披风|斗篷|大氅/.test(raw)) return '披风';
  if (/裤|裙|腿|胫|护腿/.test(raw)) return '腿部';
  if (/鞋|靴|履|屐/.test(raw)) return '足部';
  if (/护腕|护手|手套|臂|腕|掌套/.test(raw)) return '护手';
  if (/戒|环|佩|坠|链|玉|珠|符|印|镯|指环|项链/.test(raw)) return '饰品1';
  return null;
}

/** 根据名称推断物品类型 */
export function classifyItem(name: string): ItemState['type'] {
  const raw = name.includes('|') ? name.split('|')[0] : name;
  if (/谱|经|法|诀|功|典|卷|秘籍|秘笈|残卷/.test(raw)) return '秘籍';
  if (/食|肉|鱼|饭|面|饼|汤|酒|茶|果|瓜|米|面|包|鸡|鸭|牛|羊|兔|蛇/.test(raw)) return '食物';
  if (/丹|药|丸|散|膏|剂/.test(raw)) return '丹药';
  if (guessSlot(raw)) return '装备';
  return '杂物';
}

/** 从 "名称|描述" 解析物品信息 */
export function parseItem(raw: string): { name: string; type: ItemState['type']; slot: EquipSlot | null; description: string } {
  const [n, d = ''] = raw.split('|');
  const tp = classifyItem(raw);
  return { name: n, type: tp, slot: tp === '装备' ? guessSlot(raw) : null, description: d };
}

/** 从物品名+描述推算装备属性加成（含品质倍率） */
export function equipStats(item: { name: string; description: string; slot: EquipSlot | null; quality?: import('../character/types').Quality }): { attackBonus: number; defenseBonus: number; speedBonus: number } {
  let a = 0, d = 0, s = 0;
  const desc = item.description;
  if (item.slot === '武器') { a = 2; if (/锋利|削铁|寒光|名|宝|精良/.test(desc)) a = 4; if (/玄铁|大巧|传说|碧血|打狗|稀有/.test(desc)) a = 6; if (/轻盈|轻|薄|快|柳叶/.test(desc)) s = 2; if (/重|沉|巨/.test(desc)) { s = -1; a += 1; } }
  if (item.slot && ['头部', '身躯', '腿部', '足部', '护手'].includes(item.slot)) { d = 1; if (/精良|上好|铁|护/.test(desc)) d = 2; if (/金丝|传说|稀有|宝/.test(desc)) d = 3; if (/重|沉重/.test(desc)) s = -1; }
  if (item.slot?.startsWith('饰品')) { if (/攻|力|锋/.test(desc)) a = 1; if (/防|守|固/.test(desc)) d = 1; if (/速|轻|快/.test(desc)) s = 1; }
  // 品质倍率
  const q = item.quality || '普通';
  const mul = QUALITY_MULTIPLIER[q] ?? 1;
  return { attackBonus: Math.round(a * mul), defenseBonus: Math.round(d * mul), speedBonus: Math.round(s * mul) };
}
