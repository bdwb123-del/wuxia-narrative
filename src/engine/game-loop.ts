// ===== 游戏主循环 v3 —— AI JSON 驱动 =====
import { EMPTY_EQUIPMENT } from './character/types';

/** 品质 → 最高等级 */
const QUALITY_MAX_LEVEL: Record<string, number> = {
  '垃圾': 3, '普通': 5, '良好': 7, '优秀': 9, '史诗': 12, '传说': 15, '神话': 20,
};

/** 品质 → 每级所需熟练度 */
const QUALITY_PROF_PER_LEVEL: Record<string, number> = {
  '垃圾': 50, '普通': 70, '良好': 100, '优秀': 140, '史诗': 200, '传说': 280, '神话': 400,
};
import type { ChatMessage } from './llm/types';
import { advanceTime, advanceHours } from './world';
import { ageAdjustedCombat, realmName, applyAttrDelta } from './growth';

/** 境界 → 每日修炼上限 */
const REALM_TRAIN_LIMIT: Record<string, number> = {
  '不堪一击': 1, '毫不足虑': 1, '不足挂齿': 2, '初学乍练': 2, '勉勉强强': 2,
  '初窥门径': 3, '初出茅庐': 3, '略知一二': 3, '普普通通': 4, '平平无奇': 4,
  '渐入佳境': 4, '已有小成': 5, '炉火纯青': 5, '出类拔萃': 6, '技压群雄': 6,
  '出神入化': 7, '傲视群雄': 7, '登峰造极': 8, '一代宗师': 9, '震古铄今': 10,
};
import { parseItem } from './items/identify';
import { recalcBuffs, defaultBuffs, normalizeCategory } from './combat/calc';
import type { GameState, StateChange } from './state/types';

// ===== JSON 解析 =====

export function extractJSON(content: string): { pre: any; post: any } {
  const matches = [...content.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
  if (matches.length > 0) {
    return { pre: matches.length >= 2 ? tryParse(matches[0][1]) : null, post: tryParse(matches.length >= 2 ? matches[matches.length - 1][1] : matches[0]?.[1] || '') };
  }
  // 回退：直接在文本中找最后一个 { } 块
  const lastBrace = content.lastIndexOf('{');
  const lastClose = content.lastIndexOf('}');
  if (lastBrace >= 0 && lastClose > lastBrace) {
    const maybe = content.slice(lastBrace, lastClose + 1);
    const parsed = tryParse(maybe);
    if (parsed) return { pre: null, post: parsed };
  }
  return { pre: null, post: null };
}
function tryParse(s: string): any { try { return JSON.parse(s); } catch { return null; } }

export function cleanContent(content: string): string {
  return content.replace(/```json[\s\S]*?```/g, '').replace(/\n{4,}/g, '\n\n').trim();
}

// ===== 主处理 =====



export function processAIMessage(content: string, state: GameState): { cleanContent: string; rawJSON: string; change: StateChange } {
  const json = extractJSON(content);
  const clean = cleanContent(content);
  const msgs: ChatMessage[] = [];
  let c = state.character;
  let w = state.worldState;
  if (!json.post) json.post = {}; // 即使无 JSON 也继续处理，提取位置/NPC

  // HP / Qi — 仅处理数值型
  const hpNum = typeof json.post.hp === 'number' ? json.post.hp : 0;
  const qiNum = typeof json.post.qi === 'number' ? json.post.qi : 0;
  if (hpNum !== 0 || qiNum !== 0) {
    c = { ...c, combat: { ...c.combat,
      生命值: Math.max(0, Math.min(c.combat.最大生命值, c.combat.生命值 + hpNum)),
      内力值: Math.max(0, Math.min(c.combat.最大内力值, c.combat.内力值 + qiNum)) }};
    if (c.combat.生命值 > 0 && c.combat.生命值 <= c.combat.最大生命值 * 0.2) msgs.push({ role: 'user', content: '你已身负重伤，生命垂危！' });
  }
  // XP 已移除，改为 AI 直接分配属性
  if (json.post.attributes) {
    const { char: nc, newRealm, brokeThrough } = applyAttrDelta(c, json.post.attributes);
    c = nc;
    if (brokeThrough) {
      const oldRealm = realmName(c.attributes);
      c = { ...c, chronicle: [...c.chronicle, { timestamp: Date.now(), age: c.age, event: `突破至「${newRealm}」`, category: '升级' as const }] };
      msgs.push({ role: 'user', content: `身体一轻——突破了！${oldRealm} → **${newRealm}**！` });
    }
  }
  // AI 也可以给自由属性点
  if (json.post.attrPoints) c = { ...c, pendingAttrPoints: (c.pendingAttrPoints || 0) + json.post.attrPoints };
  // Gold
  if (json.post.gold) w = { ...w, gold: Math.max(0, w.gold + json.post.gold) };
  // Location — JSON 优先
  if (json.post.location) w = { ...w, currentLocation: json.post.location };
  // 回退：从叙述中提取地名
  if (!json.post.location) {
    const locPatterns = [
      /【(.+?)】/, /「(.+?)」/, /来到(.+?)[，。\s]/, /抵达(.+?)[，。\s]/, /走进(.+?)[，。\s]/,
      /(.+?镇)/, /(.+?城)/, /(.+?村)/, /(.+?山)/, /(.+?谷)/,
      /(.+?庄)/, /(.+?帮)/, /(.+?派)/, /(.+?楼)/, /(.+?阁)/, /(.+?岛)/,
      /(.+?寺)/, /(.+?庙)/, /(.+?洞)/, /(.+?湖)/, /(.+?林)/,
    ];
    for (const re of locPatterns) {
      const m = clean.match(re);
      if (m) { const found = m[1]; if (found && found.length >= 2 && found.length <= 8 && !/一剑|一刀|一掌|一拳|一声/.test(found)) { w = { ...w, currentLocation: found }; break; } }
    }
  }
  // 时间
  if (json.post.rest) {
    w = advanceHours(w, 8);
  } else if (json.post.time) {
    w = advanceTime(w, json.post.time);
    c = { ...c, age: c.age + Math.floor(json.post.time / 365) };
  } else {
    w = advanceHours(w, 0.5);
  }
  // Age (rebirth)
  if (json.post.age) c = { ...c, age: json.post.age };
  // Rest
  if (json.post.rest) {
    c = { ...c, combat: { ...c.combat, 生命值: c.combat.最大生命值, 内力值: c.combat.最大内力值, 气力值: c.combat.最大气力值 } };
    msgs.push({ role: 'user', content: '休息了一晚，生命内力气力完全恢复，天亮了。' });
  }

  // Items
  for (const raw of (json.post.items || [])) {
    const it = parseItem(raw);
    // 从描述中提取品质
    let quality: import('./character/types').Quality | undefined;
    const desc = it.description.toLowerCase();
    if (/神话|神品/.test(desc)) quality = '神话';
    else if (/传说|仙品/.test(desc)) quality = '传说';
    else if (/史诗|极品/.test(desc)) quality = '史诗';
    else if (/优秀|上品/.test(desc)) quality = '优秀';
    else if (/良好|中品/.test(desc)) quality = '良好';
    else if (/垃圾|劣品|破旧/.test(desc)) quality = '垃圾';
    else if (/普通|凡品/.test(desc)) quality = '普通';
    // 无匹配时根据 AI 传入的 quality 字段，否则默认普通
    if (!quality) quality = json.post.itemsQuality?.[raw] || '普通';
    const ex = w.items.find(i => i.name === it.name);
    if (ex) w = { ...w, items: w.items.map(i => i.name === it.name ? { ...i, quantity: i.quantity + 1 } : i) };
    else w = { ...w, items: [...w.items, { name: it.name, type: it.type, quantity: 1, description: it.description, slot: it.slot, quality, acquiredAt: Date.now() }] };
  }
  // Quest
  if (json.post.questStart) {
    if (!w.quests.find(q => q.name === json.post.questStart.name)) {
      w = { ...w, quests: [...w.quests, { name: json.post.questStart.name, description: json.post.questStart.desc, status: '进行中' as const, startedAt: Date.now(), notes: '' }] };
      msgs.push({ role: 'user', content: `接到新任务：${json.post.questStart.name}` });
    }
  }
  if (json.post.questComplete) {
    w = { ...w, quests: w.quests.map(q => q.name === json.post.questComplete ? { ...q, status: '已完成' as const, completedAt: Date.now() } : q) };
    msgs.push({ role: 'user', content: `任务完成：${json.post.questComplete}` });
    c = { ...c, chronicle: [...c.chronicle, { timestamp: Date.now(), age: c.age, event: `完成任务：${json.post.questComplete}`, category: '任务' as const }] };
  }
  // Skills
  for (const sk of (json.post.skills || [])) {
    const exSk = c.skills.find((s: any) => s.name === sk.name);
    if (exSk) c = { ...c, skills: c.skills.map((s: any) => s.name === sk.name ? { ...s, level: Math.min(10, s.level + sk.level) } : s) };
    else c = { ...c, skills: [...c.skills, { name: sk.name, category: '通用' as const, level: sk.level, description: sk.desc }] };
    msgs.push({ role: 'user', content: `习得技能：${sk.name} Lv.${sk.level}` });
  }
  // Martial Arts — 支持习得 + 熟练度提升
  for (const ma of (json.post.martialArts || [])) {
    const existing = c.martialArts.find((m: any) => m.name === ma.name);
    if (existing) {
      // 提升熟练度
      const profNeeded = QUALITY_PROF_PER_LEVEL[existing.quality || '普通'] || 100;
      const newProf = Math.min(profNeeded, (existing.proficiency || 0) + (ma.proficiency || 10));
      const newLevel = newProf >= profNeeded && existing.level < (existing.maxLevel || 10) ? existing.level + 1 : existing.level;
      const finalProf = newProf >= 100 ? 0 : newProf;
      c = { ...c, martialArts: c.martialArts.map((m: any) => m.name === ma.name ? { ...m, proficiency: finalProf, level: newLevel, 威力: ma.power || m.威力, 内力消耗: ma.cost || m.内力消耗 } : m) };
      if (newLevel > existing.level) {
        msgs.push({ role: 'user', content: `${ma.name} 突破至 Lv.${newLevel}！（威力${ma.power || existing.威力}）` });
        c = { ...c, chronicle: [...c.chronicle, { timestamp: Date.now(), age: c.age, event: `${ma.name} 突破至 Lv.${newLevel}`, category: '习武' as const }] };
      }
    } else {
      const catRaw = ma.category || '内功';
      const cat = normalizeCategory(catRaw) as import('./character/types').SkillCategory;
      const maQuality = (ma.quality || '普通') as import('./character/types').Quality;
      if (!c.martialArts) c = { ...c, martialArts: [] };
      c = { ...c, martialArts: [...c.martialArts, { name: ma.name, category: cat, level: 1, proficiency: 0, maxLevel: QUALITY_MAX_LEVEL[maQuality] || 5, 内力消耗: ma.cost || 5, 威力: ma.power || 10, description: ma.desc || '', effects: ma.effects || '', active: true, quality: maQuality, buffs: (ma.buffs && Object.keys(ma.buffs).length > 0) ? ma.buffs : defaultBuffs({ category: cat, level: 1, 威力: ma.power || 10, quality: maQuality }) }] };
      msgs.push({ role: 'user', content: `习得武学：${ma.name}（${cat}·威力${ma.power || 10}，消耗${ma.cost || 5}内力）` });
      c = { ...c, chronicle: [...c.chronicle, { timestamp: Date.now(), age: c.age, event: `习得 ${ma.name}`, category: '习武' as const }] };
    }
  }
  // 重新计算所有武功的被动 buff
  c = recalcBuffs(c);
  // NPCs — JSON 优先
  for (const npc of (json.post.npcs || [])) {
    const exN = w.npcs.find((n: any) => n.name === npc.name);
    if (exN) w = { ...w, npcs: w.npcs.map((n: any) => n.name === npc.name ? { ...n, relation: npc.relation || n.relation, notes: npc.note || n.notes, status: npc.status || n.status, statusNote: npc.statusNote || n.statusNote, affection: Math.max(-100, Math.min(100, (n.affection || 0) + (npc.affection || 0))), lastContact: Date.now() } : n) };
    else w = { ...w, npcs: [...w.npcs, { name: npc.name, relation: npc.relation || '相识', location: w.currentLocation, notes: npc.note || '', metAt: Date.now(), affection: npc.affection || 0, befriended: false, lastContact: Date.now(), status: npc.status || '正常', statusNote: npc.statusNote || '' }] };
  }
  // 自动提取：叙述中的新 NPC（如"一个叫张三的剑客"/"李四道："）
  if (!json.post.npcs || json.post.npcs.length === 0) {
    const npcPatterns = clean.matchAll(/[「「](.+?)[」」].*?[：:]|(.+?)道[：:；;]|叫(.+?)[，。的\s]|一位(.+?)[，。\s]|名叫(.+?)[，。\s]|(.+?)说[：:；;道]/g);
    for (const m of [...npcPatterns]) {
      const name = m[1] || m[2] || m[3] || m[4] || m[5] || m[6];
      if (name && name.length >= 2 && name.length <= 6 && !/[你我问他说她它些这那哪怎谁啥何什么怎么多少各位大家]/g.test(name) && !w.npcs.find((n: any) => n.name === name)) {
        w = { ...w, npcs: [...w.npcs, { name, relation: '相识', location: w.currentLocation, notes: '', metAt: Date.now(), affection: 0, befriended: false, lastContact: Date.now(), status: '正常' as const, statusNote: '' }] };
        msgs.push({ role: 'user', content: `结识了 ${name}` });
      }
    }
  }
  // Title
  if (json.post.title) { c = { ...c, title: json.post.title }; msgs.push({ role: 'user', content: `获得称号：${json.post.title}` }); c = { ...c, chronicle: [...c.chronicle, { timestamp: Date.now(), age: c.age, event: `获得称号：${json.post.title}`, category: '奇遇' as const }] }; }
  // Shop
  if (json.post.shopBuy) {
    if (w.gold >= json.post.shopBuy.price) {
      w = { ...w, gold: w.gold - json.post.shopBuy.price };
      const it = parseItem(`${json.post.shopBuy.name}|${json.post.shopBuy.name}`);
      w = { ...w, items: [...w.items, { name: it.name, type: it.type, quantity: 1, description: it.description, slot: it.slot, quality: (json.post.shopBuy.quality || '普通'), acquiredAt: Date.now() }] };
      msgs.push({ role: 'user', content: `购买了 ${json.post.shopBuy.name}，花费 ${json.post.shopBuy.price} 两` });
    } else msgs.push({ role: 'user', content: `银两不足！买不起 ${json.post.shopBuy.name}` });
  }
  if (json.post.shopSell) {
    const idx = w.items.findIndex((i: any) => i.name === json.post.shopSell.name);
    if (idx >= 0) { w = { ...w, gold: w.gold + json.post.shopSell.price, items: w.items.filter((_: any, i: number) => i !== idx) }; msgs.push({ role: 'user', content: `出售了 ${json.post.shopSell.name}，获得 ${json.post.shopSell.price} 两` }); }
  }

  // Karma
  if (json.post.karma) c = { ...c, karma: c.karma + json.post.karma };

  // 饥饿：每流逝1小时 +2（时间系统自动驱动）
  if (json.post.rest) {
    c = { ...c, hunger: Math.min(100, (c.hunger || 0) + 16) };
  } else if (json.post.time) {
    c = { ...c, hunger: Math.min(100, (c.hunger || 0) + Math.floor(json.post.time * 24 * 2)) };
  } else {
    c = { ...c, hunger: Math.min(100, (c.hunger || 0) + 1) }; // 0.5h → +1
  }
  if (json.post.hunger) {
    // AI 可能搞反方向：正数 → 应该是进食（减饥饿）
    const hv = json.post.hunger;
    c = { ...c, hunger: Math.max(0, Math.min(100, c.hunger + (hv > 50 ? -Math.abs(hv) : hv))) };
  }

  // 状态效果回合递减
  if (c.statusEffects && c.statusEffects.length > 0) {
    c = { ...c, statusEffects: c.statusEffects.map(e => ({ ...e, duration: e.duration - 1 })).filter(e => e.duration > 0) };
  }

  // Death
  if (c.combat.生命值 <= 0) {
    const k = c.karma;
    const attrs = { 体魄: 0, 内力: 0, 身法: 0, 悟性: 0, 根骨: 0, 元气: 0 };
    const combat = ageAdjustedCombat(attrs, 1, 0);
    c = { ...c, level: 1, experience: 0, pendingAttrPoints: 0, age: 0, karma: 0, attributes: attrs, martialArts: [], skills: [], equipment: { ...EMPTY_EQUIPMENT }, combat, statusEffects: [], chronicle: [...c.chronicle, { timestamp: Date.now(), age: c.age, event: `轮回（善恶${k > 0 ? '+' : ''}${k}）`, category: '轮回' as const }] };
    w = { ...w, gold: 0, items: [], currentLocation: '未知', quests: [], events: [] };
    const hint = k >= 100 ? '善行昭彰，请安排富贵投胎。地点自由发挥。' : k >= 0 ? '无功无过，安排普通人家即可。地点自由发挥。' : k >= -30 ? '业债缠身，安排贫苦出身。地点自由发挥。' : k >= -100 ? '恶贯满盈，罚入畜生道受苦数年再转人。地点自由发挥。' : '罪大恶极，打入地狱受刑数十载！';
    msgs.push({ role: 'user', content: `你死了。前世善恶：${k > 0 ? '+' : ''}${k}。${hint} 请叙述投胎场景并在JSON中设定新角色（location、age、gold、items）。` });
  }

  // 数值校对：确保 combat 与属性+装备+武功一致
  c = recalcBuffs(c);

  return { cleanContent: clean, rawJSON: JSON.stringify(json.post), change: { character: c !== state.character ? c : undefined, worldState: w !== state.worldState ? w : undefined, messages: msgs } };
}

/** 默认武功 buffs（AI 未提供时使用） */
// (imported from combat/calc.ts)

/** 一键休息：恢复全部生命/内力/气力到最大值 */
export function restCharacter(state: GameState): StateChange {
  if ((state.character.hunger || 0) >= 90) return { messages: [{ role: 'system', content: '[系统] ❌ 腹中空空，饿得睡不着！先找些吃的吧。' }] };
  const c = { ...state.character, combat: { ...state.character.combat, 生命值: state.character.combat.最大生命值, 内力值: state.character.combat.最大内力值, 气力值: state.character.combat.最大气力值 } };
  c.hunger = Math.min(100, (c.hunger || 0) + 16); // 睡眠8h消耗+16，饿了得自己找吃的
  c.chronicle = [...c.chronicle, { timestamp: Date.now(), age: c.age, event: '休息恢复', category: '休息' as const }];
  const w = advanceHours(state.worldState, 8);
  return { character: c, worldState: w, messages: [{ role: 'user', content: `休息了一晚，状态完全恢复，饥饿值 +16（当前${c.hunger}），天亮该找吃的了。` }] };
}

// ===== NPC 交互动作引擎 =====

export function handleNpcAction(state: GameState, npcName: string, action: string): { messages: ChatMessage[]; character?: import('./character/types').Character; worldState?: import('./world').WorldState } {
  const npcIdx = state.worldState.npcs.findIndex(n => n.name === npcName);
  if (npcIdx < 0) return { messages: [{ role: 'user', content: `找不到 ${npcName}，可能已经离开了。` }] };
  const msgs: ChatMessage[] = [];
  const npc = { ...state.worldState.npcs[npcIdx], lastContact: Date.now() };
  const d20 = () => Math.floor(Math.random() * 20) + 1;
  const a = state.character.attributes;

  switch (action) {
    case '切磋': {
      const r = d20() + a.体魄, diff = 10 + Math.abs(npc.affection||0) / 5;
      if (r >= diff) msgs.push({role:'user',content:`${npcName}接受了你的切磋请求（d20+体魄=${r}≥${diff}）！请展开战斗叙事，并根据战斗结果在JSON中调整好感度和善恶值。`});
      else msgs.push({role:'user',content:`${npcName}婉拒了你的切磋请求（d20+体魄=${r}<${diff}）。请描述对方反应，并在JSON中适当调整好感度。`});
      break;
    }
    case '偷窃': {
      const r = d20() + a.身法, diff = 12 + Math.abs(npc.affection||0) / 10;
      if (r >= diff) msgs.push({role:'user',content:`你趁${npcName}不注意，成功偷走了他身上的东西（d20+身法=${r}≥${diff}）！请用JSON发放随机物品，并根据情况调整好感度和善恶值。`});
      else msgs.push({role:'user',content:`你试图偷窃${npcName}，但被当场抓获（d20+身法=${r}<${diff}）！对方勃然大怒。请展开叙事，并在JSON中调整好感度和善恶值。`});
      break;
    }
    case '下毒': {
      const r = d20() + a.身法 + a.悟性, diff = 15;
      npc.status = '中毒'; npc.statusNote = r >= diff ? '身中剧毒' : '察觉被下毒';
      if (r >= diff) msgs.push({role:'user',content:`你悄悄在${npcName}的茶水中下毒，对方毫无察觉（d20+身法+悟性=${r}≥${diff}）！请描述中毒反应，并在JSON中调整好感度和善恶值。`});
      else msgs.push({role:'user',content:`你试图给${npcName}下毒，但被对方识破（d20+身法+悟性=${r}<${diff}）！请展开冲突叙事，并在JSON中调整好感度和善恶值。`});
      break;
    }
    case '杀死': {
      npc.status = '尸体'; npc.statusNote = '已死亡';
      msgs.push({role:'user',content:`你突然对${npcName}痛下杀手！对方已死。请在JSON中大幅扣减善恶值，并展开后续叙事。`});
      break;
    }
    case '结交': {
      if ((npc.affection||0) >= 60) { npc.befriended = true; msgs.push({role:'user',content:`${npcName}欣然接受了你的结交请求！你们从此结为好友。请展开叙事。`}); }
      else msgs.push({role:'user',content:`你想和${npcName}结交，但对方对你还不够信任（好感${npc.affection}，需要≥60）。请描述对方的反应。`});
      break;
    }
  }

  const w = {...state.worldState, npcs: state.worldState.npcs.map((n,i) => i===npcIdx ? npc : n)};
  return { messages: msgs, worldState: w };
}

// ==================== 武功管理 ====================

const WEAPON_REQUIRED: Record<string, string> = { 剑法: '剑', 刀法: '刀', 棍法: '棍', 鞭法: '鞭' };

export function levelUpAttr(state: GameState, attr: keyof import('./character/types').Attributes): StateChange {
  const c = state.character;
  if (c.pendingAttrPoints <= 0 || c.attributes[attr] >= 100) return { messages: [] };
  const newAttrs = { ...c.attributes, [attr]: c.attributes[attr] + 1 };
  const newC = recalcBuffs({ ...c, attributes: newAttrs });
  return { character: { ...newC, pendingAttrPoints: c.pendingAttrPoints - 1 }, messages: [{ role: 'system', content: `[系统] ${attr} +1 → ${newAttrs[attr]}（剩余 ${c.pendingAttrPoints - 1} 点）` }] };
}

export function toggleMartialArt(state: GameState, index: number): StateChange {
  const ma = state.character.martialArts[index];
  if (!ma) return { messages: [] };
  if (!ma.active) {
    const needed = WEAPON_REQUIRED[ma.category];
    if (needed) {
      const weapon = state.character.equipment['武器'];
      if (!weapon || !weapon.name.includes(needed)) return { messages: [{ role: 'system', content: `[系统] 「${ma.name}」需要装备${needed}类武器才能激活` }] };
    }
  }
  const updated = state.character.martialArts.map((m, i) => i === index ? { ...m, active: !m.active } : m);
  const c = recalcBuffs({ ...state.character, martialArts: updated });
  return { character: c, messages: [{ role: 'user', content: `${ma.name} ${ma.active ? '已取消激活' : '已激活'}` }] };
}

// 品质映射见文件顶部


export function trainMartialArt(state: GameState, index: number): StateChange {
  const ma = state.character.martialArts[index];
  if (!ma) return { messages: [] };
  const maxLv = ma.maxLevel || QUALITY_MAX_LEVEL[ma.quality || '普通'] || 5;
  if (ma.level >= maxLv) return { messages: [{ role: 'system', content: `[系统] 「${ma.name}」已达品质上限 Lv.${maxLv}，无法继续修炼` }] };
  // 每日限修：境界越高次数越多。休息后重置
  const lastRest = [...state.character.chronicle].reverse().find(e => e.category === '休息');
  const sinceRest = (e: typeof state.character.chronicle[0]) => !lastRest || e.timestamp > lastRest.timestamp;
  const trainedToday = state.character.chronicle.filter(
    e => e.category === '习武' && sinceRest(e)
  ).length;
  const realm = realmName(state.character.attributes);
  const maxTrain = REALM_TRAIN_LIMIT[realm] || 3;
  if (trainedToday >= maxTrain) return { messages: [{ role: 'system', content: `[系统] 今日修炼已达上限（${maxTrain}次），休息后再来` }] };

  const a = state.character.attributes;
  // 关联属性
  const relAttr = ({ '内功': a.内力, '轻功': a.身法, '格挡': a.根骨, '拳掌': a.体魄, '剑法': a.身法, '刀法': a.体魄, '棍法': a.体魄, '鞭法': a.身法, '指法': a.内力, '暗器': a.身法, '奇门': a.悟性, '绝技': a.体魄 } as Record<string,number>)[ma.category] || a.体魄;
  // 难度 = 10 + 当前等级×2（越高级越难）
  const difficulty = 10 + ma.level * 2;
  const d20 = Math.floor(Math.random() * 20) + 1;
  const total = d20 + a.悟性 + Math.floor(relAttr / 2);
  const success = total >= difficulty;

  if (!success) {
    const msg = d20 === 1
      ? `[系统] 🏋 修炼「${ma.name}」——掷 d20=1 + 悟性${a.悟性} + 关联${Math.floor(relAttr/2)} = **${total}**（难度 ${difficulty}）→ ❌ 大失败！走火入魔，内力受损！`
      : `[系统] 🏋 修炼「${ma.name}」——掷 d20=${d20} + 悟性${a.悟性} + 关联${Math.floor(relAttr/2)} = **${total}**（难度 ${difficulty}）→ ❌ 失败。心法未通，还需时日。`;
    const penalty = d20 === 1 ? { ...state.character.combat, 内力值: Math.max(0, state.character.combat.内力值 - 10) } : state.character.combat;
    return { character: { ...state.character, combat: penalty }, messages: [{ role: 'system', content: msg }] };
  }

  // 成功——熟练度收益曲线：基础 12~18 − 等级衰减
  const baseGain = 12 + Math.floor(Math.random() * 7); // 12-18
  const decay = Math.floor(ma.level * 1.5);
  const profGain = Math.max(3, baseGain - decay);
  // 大成功额外
  const critBonus = d20 === 20 ? Math.floor(profGain * 0.5) : 0;
  const totalGain = profGain + critBonus;

  const profNeeded = QUALITY_PROF_PER_LEVEL[ma.quality || '普通'] || 100;
  const newProf = Math.min(profNeeded, ma.proficiency + totalGain);
  const leveled = newProf >= profNeeded && ma.level < maxLv;
  const newLevel = leveled ? ma.level + 1 : ma.level;
  const finalProf = leveled ? 0 : newProf;

  const qm = ({ '垃圾':0.3,'普通':0.6,'良好':1.0,'优秀':1.5,'史诗':2.2,'传说':3.0,'神话':4.5 } as Record<string,number>)[ma.quality||'普通']||1;
  const updated = state.character.martialArts.map((m, i) =>
    i === index ? { ...m, proficiency: finalProf, level: newLevel,
      威力: newLevel > ma.level ? m.威力 + Math.round(1 + qm) : m.威力,
      内力消耗: Math.max(1, m.内力消耗 - (newLevel > ma.level && m.内力消耗 > 2 ? 1 : 0)),
      buffs: newLevel > ma.level && m.buffs ? Object.fromEntries(Object.entries(m.buffs as Record<string,number>).map(([k,v]) => [k, v + Math.max(1, Math.round(qm * 0.5))])) : m.buffs,
      maxLevel: maxLv,
    } : m
  );
  const c = recalcBuffs({ ...state.character, martialArts: updated, combat: { ...state.character.combat, 内力值: Math.max(0, state.character.combat.内力值 - 3) } });
  c.hunger = Math.min(100, (c.hunger || 0) + 2); // 修炼约1小时

  // 突破时永久提升基础属性
  if (leveled) {
    const attrBoost = Math.max(1, Math.round(qm));
    const newAttrs = { ...c.attributes };
    // 根据武功 buffs 类型提升对应属性
    if (ma.buffs) {
      for (const k of Object.keys(ma.buffs)) {
        (newAttrs as any)[k] = Math.min(100, ((newAttrs as any)[k] || 0) + attrBoost);
      }
    } else {
      newAttrs.体魄 = Math.min(100, newAttrs.体魄 + attrBoost);
      newAttrs.内力 = Math.min(100, newAttrs.内力 + attrBoost);
    }
    c.attributes = newAttrs;
    c.pendingAttrPoints = (c.pendingAttrPoints || 0) + attrBoost;
  }

  c.chronicle = [...c.chronicle, { timestamp: Date.now(), age: c.age, event: `修炼 ${ma.name}（+${totalGain}熟练）`, category: '习武' }];
  if (leveled) c.chronicle = [...c.chronicle, { timestamp: Date.now(), age: c.age, event: `${ma.name} 突破至 Lv.${newLevel}`, category: '习武' }];

  const critMsg = d20 === 20 ? ' 🎯 大成功！' : '';
  const lvMsg = leveled ? ` ⚔ 突破至 **Lv.${newLevel}**！威力+${Math.round(1+qm)}，消耗${ma.内力消耗 > 2 ? '-1' : '不变'}，属性全面提升！` : '';
  return { character: c, messages: [{ role: 'user', content: `修炼了${ma.name}——掷 d20=${d20} + 悟性 ${a.悟性} + 关联${Math.floor(relAttr/2)} = **${total}**（难度 ${difficulty}）${critMsg}\n熟练度 +${totalGain}（${ma.proficiency} → ${finalProf}/${profNeeded}）${lvMsg}` }] };
}

export function forgetMartialArt(state: GameState, index: number): StateChange {
  const ma = state.character.martialArts[index];
  if (!ma) return { messages: [] };
  const updated = state.character.martialArts.filter((_, i) => i !== index);
  const c = recalcBuffs({ ...state.character, martialArts: updated });
  return { character: c, messages: [{ role: 'system', content: `[系统] 已遗忘 ${ma.name}` }] };
}

export function unequipItem(state: GameState, slot: import('./character/types').EquipSlot): StateChange {
  const eq = state.character.equipment[slot];
  if (!eq) return { messages: [] };
  const newSlots = { ...state.character.equipment, [slot]: undefined as any };
  const c = recalcBuffs({ ...state.character, equipment: newSlots });
  const newItem: import('./world').ItemState = { name: eq.name, type: '装备', quantity: 1, description: eq.description, slot, quality: (eq as any).quality, acquiredAt: Date.now() };
  return { character: c, worldState: { ...state.worldState, items: [...state.worldState.items, newItem] }, messages: [{ role: 'system', content: `[系统] 卸下了 ${eq.name}` }] };
}
