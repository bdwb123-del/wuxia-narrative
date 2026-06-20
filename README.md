# 江湖夜雨

AI 驱动的武侠文字跑团游戏。基于 React + TypeScript，LLM 作为 DM。

## 快速开始

```bash
git clone https://github.com/bdwb123-del/wuxia-narrative.git
cd wuxia-narrative
npm install
npx vite --host
```

浏览器打开 `http://localhost:5173`

## 玩法

1. **设置 API** — 点击 ⚙ 填入 DeepSeek / OpenAI 兼容 API
2. **创建角色** — 手动填卡 或 🤖 AI 一键生成
3. **踏入江湖** — AI 叙事，你输入行动或选择编号选项
4. **交互系统** — NPC 面板支持交谈/询问/切磋/赠礼/偷窃/下毒

## 功能表

| 系统 | 说明 |
|------|------|
| AI 叙事 | 金庸/古龙风，编号选项，JSON 状态同步 |
| 角色系统 | 6属性(体魄/内力/身法/悟性/根骨/元气)，20级境界 |
| 武功系统 | 12分类，品质7级(垃圾→神话)，熟练度+等级倍率 |
| 装备系统 | 12槽位，品质倍率0.3x~4.5x |
| NPC 交互 | 好感度(−100~100)，交谈/切磋/偷窃/下毒，状态标签 |
| 食物/饥饿 | 时间驱动消耗，食物恢复+临时buff |
| 时间系统 | 十二时辰，四季365天 |
| 死亡/轮回 | 善恶影响投胎，天道/人道/畜生道/地狱道 |
| 存档 | 多槽位，localStorage |

## 技术栈

- React 19 + TypeScript
- Vite 8
- OpenAI-compatible streaming API
- CSS 水墨风主题

## 项目结构

```
src/
├── engine/          # 游戏引擎
│   ├── game-loop.ts  # AI JSON → 状态变更主循环
│   ├── combat/       # 战斗计算
│   ├── character/    # 角色卡系统
│   ├── items/        # 物品识别+使用
│   ├── llm/          # LLM 适配器
│   └── world.ts      # 世界状态
├── components/      # React UI
│   ├── ChatScreen    # 聊天界面
│   ├── GamePanel     # 7Tab 侧面板
│   ├── NpcPanel      # NPC 交互面板
│   ├── TopBar        # 顶栏(H/Qi/饥饿/时间)
│   └── ...
├── hooks/           # React Hooks
└── styles/          # CSS 主题
```

## 环境变量

无需。API Key 在游戏设置面板中配置，存入 localStorage。
