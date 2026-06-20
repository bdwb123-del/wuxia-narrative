// ===== 世界状态追踪器 =====
// 记录 NPC、地点、任务、物品、事件，注入 AI prompt 保持一致性

export interface NPCState {
  name: string;
  title?: string;
  faction?: string;
  relation: '陌生' | '相识' | '友善' | '尊敬' | '敌对' | '仇恨';
  location: string;
  notes: string;
  metAt: number;
  /** 好感度 −100(仇) ~ +100(至交) */
  affection: number;
  /** 是否已结交（好友列表固定） */
  befriended: boolean;
  /** 上次互动时间 */
  lastContact: number;
  /** 当前状态 */
  status: '正常' | '中毒' | '受伤' | '沉睡' | '尸体' | '狂怒' | '恐惧';
  /** 状态备注 */
  statusNote?: string;
}

export interface LocationState {
  name: string;
  description: string;
  visited: boolean;
  visitedAt?: number;
  notes: string;
}

export interface QuestState {
  name: string;
  description: string;
  status: '待接取' | '进行中' | '已完成' | '失败';
  giver?: string; // NPC name
  rewards?: string;
  startedAt?: number;
  completedAt?: number;
  notes: string;
}

export interface ItemState {
  name: string;
  type: '装备' | '丹药' | '食物' | '秘籍' | '奇物' | '杂物';
  quantity: number;
  description: string;
  slot: import('./character/types').EquipSlot | null;
  quality?: import('./character/types').Quality;
  acquiredAt: number;
}

export interface EventRecord {
  summary: string;
  location: string;
  timestamp: number;
  importance: 'minor' | 'notable' | 'major';
}

export interface WorldState {
  npcs: NPCState[];
  locations: LocationState[];
  quests: QuestState[];
  items: ItemState[];
  events: EventRecord[];
  currentLocation: string;
  gameDay: number;
  year: number;
  season: '春' | '夏' | '秋' | '冬';
  gold: number;
  hour: number;
}

/** 创建空白世界状态 */
export function createWorldState(): WorldState {
  return {
    npcs: [],
    locations: [],
    quests: [],
    items: [],
    events: [],
    currentLocation: '未知',
    gameDay: 1, year: 1, season: '春', gold: 0, hour: 8,
  };
}

/** 添加 NPC */
export function addNPC(ws: WorldState, npc: Partial<NPCState> & { name: string }): WorldState {
  const existing = ws.npcs.find(n => n.name === npc.name);
  const defaults = { affection: 0, befriended: false, lastContact: Date.now(), metAt: Date.now(), relation: '相识' as const, location: ws.currentLocation, notes: '', status: '正常' as const, statusNote: '' };
  if (existing) {
    return { ...ws, npcs: ws.npcs.map(n => n.name === npc.name ? { ...n, ...defaults, ...npc } : n) };
  }
  return { ...ws, npcs: [...ws.npcs, { ...defaults, ...npc }] };
}

/** 添加地点 */
export function addLocation(ws: WorldState, loc: Omit<LocationState, 'visited'>): WorldState {
  const existing = ws.locations.find(l => l.name === loc.name);
  if (existing) {
    return {
      ...ws,
      locations: ws.locations.map(l =>
        l.name === loc.name ? { ...l, ...loc, visited: true, visitedAt: Date.now() } : l,
      ),
    };
  }
  return {
    ...ws,
    locations: [...ws.locations, { ...loc, visited: true, visitedAt: Date.now() }],
  };
}

/** 添加/更新任务 */
export function upsertQuest(ws: WorldState, quest: QuestState): WorldState {
  const existing = ws.quests.find(q => q.name === quest.name);
  if (existing) {
    return { ...ws, quests: ws.quests.map(q => q.name === quest.name ? quest : q) };
  }
  return { ...ws, quests: [...ws.quests, quest] };
}

/** 添加物品 */
export function addItem(ws: WorldState, item: Omit<ItemState, 'acquiredAt'>): WorldState {
  const existing = ws.items.find(i => i.name === item.name && i.type === item.type);
  if (existing) {
    return {
      ...ws,
      items: ws.items.map(i =>
        i.name === item.name && i.type === item.type
          ? { ...i, quantity: i.quantity + item.quantity }
          : i,
      ),
    };
  }
  return { ...ws, items: [...ws.items, { ...item, acquiredAt: Date.now() }] };
}

/** 添加事件 */
export function addEvent(ws: WorldState, event: Omit<EventRecord, 'timestamp'>): WorldState {
  return {
    ...ws,
    events: [...ws.events, { ...event, timestamp: Date.now() }],
  };
}

/** 移动地点 */
export function moveTo(ws: WorldState, location: string): WorldState {
  const newWs = addLocation(ws, { name: location, description: '', notes: '' });
  return { ...newWs, currentLocation: location };
}

/** 流逝天数 */
export function advanceTime(ws: WorldState, days: number = 1): WorldState {
  return advanceHours(ws, days * 24);
}

/** 流逝小时，自动处理日期跨度和四季 */
export function advanceHours(ws: WorldState, hours: number): WorldState {
  let h = (ws.hour || 8) + hours;
  let d = ws.gameDay;
  let y = ws.year;
  let s = ws.season;
  const seasons: WorldState['season'][] = ['春', '夏', '秋', '冬'];
  const seasonLen = [91, 91, 91, 92];
  let si = seasons.indexOf(s);
  while (h >= 24) { h -= 24; d++; }
  while (d > seasonLen[si]) { d -= seasonLen[si]; si = (si + 1) % 4; if (si === 0) y++; }
  return { ...ws, hour: h, gameDay: d, season: seasons[si], year: y };
}

/** 时辰名称 */
const HOUR_NAMES = ['子时','丑时','寅时','卯时','辰时','巳时','午时','未时','申时','酉时','戌时','亥时'];
export function currentTimeName(hour: number): string {
  const idx = Math.floor(((hour + 1) % 24) / 2);
  return HOUR_NAMES[idx % 12];
}

/** 将世界状态转为提示词文本片段 */
export function worldStateToPrompt(ws: WorldState, maxNPCs: number = 10, maxItems: number = 10): string {
  const lines: string[] = [];

  lines.push(`【当前状态】`);
  lines.push(`位置：${ws.currentLocation}`);
  lines.push(`第 ${ws.year} 年 · ${ws.season} · 第 ${ws.gameDay} 天 · ${currentTimeName(ws.hour || 8)} · 金钱：${ws.gold} 两`);
  lines.push('');

  // NPC
  const knownNPCs = ws.npcs.slice(-maxNPCs);
  if (knownNPCs.length > 0) {
    lines.push(`【已知人物】`);
    for (const npc of knownNPCs) {
      const rel = npc.relation === '陌生' ? '' : ` [${npc.relation}]`;
      const st = npc.status && npc.status !== '正常' ? ` -${npc.status}${npc.statusNote ? `(${npc.statusNote})` : ''}` : '';
      lines.push(`· ${npc.name}${npc.title ? `（${npc.title}）` : ''}${rel}${st} - ${npc.notes || npc.location}`);
    }
    lines.push('');
  }

  // 任务
  const activeQuests = ws.quests.filter(q => q.status === '进行中' || q.status === '待接取');
  if (activeQuests.length > 0) {
    lines.push(`【当前任务】`);
    for (const q of activeQuests) {
      lines.push(`· [${q.status}] ${q.name}：${q.description}`);
    }
    lines.push('');
  }

  // 物品
  const notableItems = ws.items.slice(0, maxItems);
  if (notableItems.length > 0) {
    lines.push(`【携带物品】`);
    for (const item of notableItems) {
      lines.push(`· ${item.type}·${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}：${item.description}`);
    }
    lines.push('');
  }

  // 近期事件
  const recentEvents = ws.events.slice(-5);
  if (recentEvents.length > 0) {
    lines.push(`【近期大事】`);
    for (const evt of recentEvents) {
      lines.push(`· [${evt.location}] ${evt.summary}`);
    }
    lines.push('');
  }

  // 已访问地点
  const visitedLocs = ws.locations.filter(l => l.visited);
  if (visitedLocs.length > 0) {
    lines.push(`【已探索】${visitedLocs.map(l => l.name).join('、')}`);
  }

  return lines.join('\n');
}
