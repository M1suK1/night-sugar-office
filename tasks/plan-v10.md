# 夜糖事务所 · v10 方案：内容工坊

> 目标：给委托、魔物、技能、弹窗事件、装备与消耗品提供一套**人工设计**的编辑器，让作者不写代码也能造内容、试跑、保存、投放，并能导出成包分享。
> 原则：结构化字段、强校验、可预览、不引入自由脚本；内置内容只读，自制内容独立成库。

---

## 0. 结论先行

1. **五类内容共用一座「内容工坊」**：左侧分类、中间列表、右侧表单、底部预览/试跑。不再为每类内容单独做入口。
2. **数据放在独立内容库**（localStorage），不塞进 `GameState`，因此**不需要升存档版本**；游戏内通过 ID 引用，运行时把库注册进现有数组/Map。
3. **按依赖顺序实施**：技能 → 装备/消耗品 → 魔物 → 委托 → 弹窗。界面分类顺序可以按你的列表排，但魔物要引用技能，委托要引用魔物，弹窗要引用委托/辖区，倒着做会反复返工。
4. **每个编辑器都带三件事**：字段校验、真实组件预览、一键试跑（生成一份临时委托 / 进战斗 / 弹一次 / 上架一次）。
5. **先解决三个现有缺口**再开编辑器，否则会做出「填了但没用」的字段：
   - `MonsterTemplate.trait` 目前是纯文本，战斗里只对内置魔物按 id 硬编码（`src/combat.ts:210/215/218/262/275/276/291`）。
   - `Equipment.damageBonus` / `initiativeBonus` 目前只被 LLM 导入解析，战斗与装备结算没有读取。
   - 未知 id 的 `getSkill()` 会静默回退到 `skills[0]`，内容缺失时会把「星屑穿刺」当成任意技能使用。

---

## 1. 现状与可复用资产

### 1.1 数据与注册表

| 内容 | 类型 | 现有存放 | 查询 |
| --- | --- | --- | --- |
| 技能 | `Skill` | `src/content/skills.ts` 的 `skills: Skill[]` | `skillById`、`getSkill()`、`effectText()` |
| 魔物 | `MonsterTemplate` | `src/content/monsters.ts` 的 `monsters: MonsterTemplate[]` | `monsterById`、`getMonster()`、`rankOrder` |
| 装备/消耗品 | `Equipment` | `src/content/items.ts` 的 `items: Equipment[]` | `itemById`、`getItem()`、`registerItem()` |
| 委托模板 | `Mission`（种子） | `src/content/seed-pack.ts` 的 `seedMissions` | `src/game.ts:481` 的 `commissionPool` |
| 弹窗事件 | `Incident` / `IncidentEffect` | 运行时生成，存 `state.incidents` | `resolveIncident`、`applyIncidentEffect` |
| 议会提案 | `Opinion` | 运行时生成，存 `state.opinions` | `makeOpinion`、`decideOpinion` |
| 角色事件 | `CharacterEvent` | 运行时生成，存 `state.events` | `beginStoryEvent`、`finishStoryEvent` |

### 1.2 已经能直接借用的东西

- `createSeedPack()` 产出 `ContentPack`（`schemaVersion: 3`），是可参考的内置内容基线。
- `makeCommission()` 已按辖区、时段、长期/紧急窗口生成委托；自定义委托只要替换「模板来源」即可。
- `missionTemplates()` 已经在给蓝图「阶段委托」节点提供下拉选项，扩展它就能让蓝图直接引用自制委托。
- `MonsterGlyph` 能按 `MonsterSpec`（体型、核心、配色、光环、纹样）实时画魔物预览。
- `IncidentDialog` 已有完整的弹窗卡片与选项样式，预览可以直接复用。
- 蓝图检查器已经支持从现有委托导入，以及选装备 / 技能 / 特性；内容库接上后这些下拉会自动出现自制项。

### 1.3 需要先补的缺口

| 缺口 | 影响 | 方案 |
| --- | --- | --- |
| 魔物 `trait` 无结构化效果 | 自制魔物的特性只是说明文字 | M2 增加可选 `rule`（见 3.5），未填则明确标注「仅图鉴描述」 |
| 装备 `damageBonus` / `initiativeBonus` 未接线 | 表单填了也不生效 | M1 先接线，或在表单中隐藏并注明「暂未实现」 |
| 未知技能静默回退 | 删库/导入缺内容时用错技能 | M0 增加严格查询 `findSkill/findMonster/findItem`，运行时缺失要报错并跳过，不静默替换 |
| `commissionPool` 是模块级常量 | 自制委托无法进入轮转池 | M3 改为可变注册表，`registerMissionTemplates()` 追加 |
| 自定义内容没有「来源」标记 | 无法区分内置与自制 | 注册表维护 `customIds` 集合，不污染类型 |

---

## 2. 总体架构

```
┌────────────────────────────┐
│ ContentWorkshopDialog      │  编辑、校验、预览、试跑、导入/导出
└─────────────┬──────────────┘
              │ 读写
┌─────────────▼──────────────┐
│ ContentLibrary（独立 JSON）│  localStorage: night-sugar:content:v1
└─────────────┬──────────────┘
              │ hydrate / register
┌─────────────▼──────────────┐
│ 运行时注册表               │  skills / monsters / items / missionPool / incidentCards
└─────────────┬──────────────┘
              │ 被引用
┌─────────────▼───────────────────────────────────────┐
│ 委托池 · 战斗 · 图鉴 · 商店 · 蓝图检查器 · 弹窗队列 │
└─────────────────────────────────────────────────────┘
```

### 2.1 三层职责

1. **内容库**：唯一事实来源，纯 JSON，可导出。
2. **注册表**：启动时把库里的内容追加到现有数组/Map，游戏逻辑不关心来源。
3. **工坊**：只改内容库，保存后统一 rehydrate；不直接改运行时数组，避免半保存状态。

### 2.2 启动时机

`src/main.tsx` 在 React 挂载前调用 `hydrateContentLibrary()`：

- 读 `night-sugar:content:v1`；
- 解析失败把原文备份到 `night-sugar:content:broken`，然后按空库启动；
- 注册自制技能 / 魔物 / 装备 / 委托模板 / 弹窗卡；
- 注册是**幂等**的：先移除上一轮注册的 id，再加入当前库，避免 HMR 与重复导入产生重复项。

---

## 3. 数据模型

### 3.1 内容库

```ts
// src/content/library.ts
export interface ContentLibrary {
  format: 'night-sugar/content-library';
  version: 1;
  updatedAt: string;
  skills: Skill[];
  monsters: MonsterTemplate[];
  items: Equipment[];
  missions: MissionTemplate[];
  incidents: IncidentCard[];
}
```

说明：

- 只存**自制内容**；内置内容仍由 `createSeedPack()` 提供，导出时可选择「仅自制」。
- 不存图片/二进制，只存文字、颜色、枚举与数值，避免 localStorage 超限。
- 数量上限建议：技能 60、魔物 40、装备 40、委托 40、弹窗 40；超过时阻止新建并提示导出。

### 3.2 委托模板

现有 `Mission` 混着运行时字段（`status`、`squad`、`attempts`、`girlId`）。编辑器用干净的模板类型，注册时再转成 `Mission` 快照：

```ts
export interface MissionTemplate {
  id: string;
  title: string; category: string; description: string;
  difficulty: '低危' | '中危' | '高危' | '绝望';
  duration: number;              // 分钟，15 的倍数
  requirement: StatKey; target: number;
  work: 'combat' | 'investigation';
  enemyIds?: string[]; rounds?: number;
  recommendedLevel: number;
  district?: DistrictId;         // 留空则按轮转辖区
  window?: CommissionWindow;     // 'urgent' | 'long'
  reward?: number;               // 留空按基准公式
  color?: string;
  source: 'custom';
}
```

转换：`toMission(template, district, day)` 填 `x/y`（`districtPin`）、`status:'open'`、`squad:[]`、`attempts:0`。这样 `makeCommission()` 只改「从哪里取模板」，其余逻辑不变。

### 3.3 弹窗事件卡

```ts
export interface IncidentCard {
  id: string;
  title: string; body: string;
  kind: 'faction' | 'environment' | 'girl';
  faction?: FactionId; district?: DistrictId;
  options: { label: string; hint: string; effect: IncidentEffect }[]; // 2–3 个
  trigger: 'manual' | 'pool';
  weight?: number;               // 1–20，pool 时生效
  oncePerDay?: boolean;
  source: 'custom';
}
```

运行时投放时**快照**成 `Incident` 塞进 `state.incidents`，因此之后删除事件卡不会破坏已有存档。

### 3.4 弹窗效果（复用 `IncidentEffect`）

编辑器不发明新效果，只做可视化行编辑：

- 星砂 ±3000、声望 ±10；
- 势力好感 `{ id, standing }`；
- 少女 `{ fatigue, spirit, corruption, bond }`；
- 辖区参数 `{ id, targetPct, rewardPct, untilDay }`；
- 辖区易主 `{ id, faction }`；
- 生成委托 `missionId`（从当前存档或委托库选）。

### 3.5 魔物可选规则（M2 新增，需拍板）

现状是纯文本 + 按 id 硬编码。若希望自制魔物有真实特性，增加：

```ts
export type MonsterRule =
  | { trigger: 'roundStart'; effect: 'heal'; amount: number; unlessEmpathyDamage?: boolean }
  | { trigger: 'roundStart'; effect: 'buff'; stat: StatKey; amount: number; belowHpPct?: number }
  | { trigger: 'hit'; effect: 'debuffAttacker'; stat: StatKey | 'hit'; amount: number; duration: number }
  | { trigger: 'always'; effect: 'immuneStun' }
  | { trigger: 'always'; effect: 'damageReduce'; pct: number }
  | { trigger: 'hit'; effect: 'dot'; amount: number; duration: number };

// MonsterTemplate 增加
rule?: MonsterRule;
```

这 6 条正好覆盖现有 6 只内置魔物的硬编码行为，可顺手把 `combat.ts` 的 id 判断替换成规则读取。未填 `rule` 时，表单显示「特性只写入图鉴，不参与战斗」。

---

## 4. 工坊界面

### 4.1 入口

- 左侧栏新增 `#open-workshop`（图标用现有的 `Wand2` / `Blocks` 一类），位置在世界书与设置之间。
- 事务所终端（`Ctrl+K`）增加命令「内容工坊」。
- 快捷入口：蓝图检查器的「从内容库导入」、商店空态、图鉴空态都可跳到对应分类。

### 4.2 布局

```
┌ 内容工坊 ──────────────────────────────── 校验 保存 导出 导入 关闭 ┐
│ 分类        │ 列表（搜索 / 新建 / 复制） │ 表单                     │
│ 委托  12    │ ▸ 糖果街的失眠电波 [内置]  │ 标题 [________]          │
│ 魔物   6    │ ▸ 末班车          [内置]  │ 分类 [________]          │
│ 技能  25    │ ▸ 星屑穿刺        [内置]  │ ...                      │
│ 弹窗   3    │ ▸ 我的夜巡        [自制]  │                          │
│ 装备  12    │                            │                          │
├─────────────┴────────────────────────────┴──────────────────────────┤
│ 预览 / 试跑：地图钉 · 魔物立绘 · 弹窗卡片 · 商店卡片 · 战斗沙盒     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 交互规则

- **内置只读**：点内置项只读展示，顶部提示「内置内容 · 复制后可编辑」；复制生成新 id，标题加「副本」。
- **未保存保护**：切换条目 / 关闭 / 导入前检测 dirty，弹确认。
- **保存**：`Ctrl+S`；先跑整库校验，错误阻止保存，警告允许保存但标黄。
- **删除**：显示「当前存档引用数」；有引用时默认禁用，需勾选「仍然删除」并二次确认。
- **搜索**：按标题 / id / 标签过滤；列表项显示来源、等级/阶级、引用数。
- **空态**：每类都有「新建一个」与「从内置复制」两个按钮。
- **键盘**：`Esc` 关闭（dirty 时确认），`Ctrl+Enter` 试跑当前条目。

### 4.4 预览与试跑

| 内容 | 预览 | 试跑 |
| --- | --- | --- |
| 技能 | 名称、消耗、目标、效果文本、伤害/治疗估算 | 进战斗沙盒，对 3 个木桩放一次 |
| 魔物 | `MonsterGlyph` + 图鉴卡 + 属性条 | 与默认小队打一场，输出战报 |
| 装备 | 商店卡片、装备前后属性差 | 给指定少女装备/使用一次 |
| 委托 | 地图钉、奖励、推荐等级、敌人列表 | 立即投放一份到当前夜晚 |
| 弹窗 | 复用 `IncidentDialog` 的卡片样式 | 直接弹一次，选项结算后回滚（或明确写入测试存档） |

> 试跑默认在**内存副本**上做，不污染当前存档；「立即投放」是显式按钮，会写入当前存档并记日志。

---

## 5. 五个编辑器

### 5.1 委托设计

| 字段 | 控件 | 校验 / 说明 |
| --- | --- | --- |
| 标题 | 文本 | 2–24 字 |
| 分类 | 文本 + 常用标签 | 如「异象调查 / 紧急委托 / 结界修复 / 市民求助 / 心愿回收」 |
| 描述 | 多行 | 8–300 字；建议写清「现象 + 目击者 + 异常点」 |
| 难度 | 下拉 | 低危 / 中危 / 高危 / 绝望 |
| 时长 | 数字 / 滑杆 | 15–240，步进 15 |
| 判定属性 | 下拉 | 魔力 / 洞察 / 敏捷 / 共情 |
| 目标值 | 数字 | 30–120；与推荐等级联动提示 |
| 类型 | 单选 | 调查 / 战斗 |
| 敌人 | 多选 | 战斗时 1–3 只，来自魔物库（含自制） |
| 轮数 | 数字 | 战斗时 2–8 |
| 推荐等级 | 数字 | 1–12，用于派遣提示与奖励基准 |
| 辖区 | 下拉（可空） | 空则按原有轮转逻辑；指定则固定在辖区生成 |
| 窗口 | 单选 | 紧急 / 长期；长期 2–7 天 |
| 报酬 | 自动 + 可改 | 默认按「时长 × 等级」基准带；偏离 ±30% 标黄 |
| 颜色 | 取色 | 默认沿用难度色 |

- **校验**：战斗委托必须至少 1 只敌人；敌人 id 必须存在；长期委托时长 ≤ 240；奖励不能为负。
- **试跑**：点「投放测试」在当前夜晚生成一份该委托（`source: 'custom'` 标记），日志写「内容工坊投放」。
- **运行时**：进入 `commissionPool` 轮转；也可在蓝图「阶段委托」里直接选到。

### 5.2 技能设计

| 字段 | 控件 | 校验 |
| --- | --- | --- |
| 名称 | 文本 | 2–12 字 |
| 流派 | 文本 / 下拉 | 允许新流派，建议复用「星光系 / 糖霜系 / 月影系 / 梦境系 / 自然系 / 赤焰系」 |
| 资源 | 单选 | 血量 / 共情值 |
| 对象 | 单选 | 敌方 / 我方 |
| 目标数 | 数字 | 1–3 |
| 倍率 | 数字 | 0–2.5，步进 0.05 |
| 冷却 | 数字 | 0–6 轮；奥义建议 ≥3 |
| 阶级 | 下拉 | 基础 / 本职 / 奥义 |
| 效果 | 行编辑 | 0–3 条；类型、属性、数值、持续、概率 |
| 描述 | 多行 | 4–120 字 |

- 效果类型沿用 `SkillEffect`：持续伤害、眩晕、护盾、增益、减益、持续恢复；属性支持魔力/洞察/敏捷/共情/命中/洞察。
- **预览**：用现有 `effectText()` 生成文案；按 80 魔力、目标 0 减伤估算一次伤害/治疗，标明「估算」。
- **试跑**：战斗沙盒对木桩释放，显示命中、伤害、效果。
- **运行时**：进 `skills` 与 `skillById`，角色创建、装备附带技能、魔物技能下拉都能选。

### 5.3 魔物设计

| 字段 | 控件 | 校验 / 说明 |
| --- | --- | --- |
| 名称 / 别称 | 文本 | 2–12 / 2–20 字 |
| 阶级 | 下拉 | 碎屑 / 游荡 / 灾厄 / 王座 |
| 属性 | 下拉 | 六大元素 |
| 颜色 | 取色 | 影响立绘与图鉴 |
| 生命 / 共情 | 数字 | 40–800 / 0–300 |
| 四维 | 数字 | 20–120；与阶级中位数偏差 >35% 标黄 |
| 技能 | 多选 | 2–4 个，来自技能库 |
| 特性 | 文本 + 可选规则 | 文本 ≤80；规则见 3.5 |
| 图鉴描述 | 多行 | 40–240 字 |
| 习性 / 弱点 | 两行 | 各 ≤80 字，写进图鉴 |
| 外形 | 体型 / 比例 / 附肢 / 核心 / 配色 / 光环 / 纹样 | 实时 `MonsterGlyph` 预览 |

- **外形默认值**：按阶级给一套预设（如王座 → 大体型 + 余烬光环），作者只调颜色也能出图。
- **试跑**：与默认 3 人小队打一场，战报里能看到技能与特性是否触发。
- **运行时**：进 `monsters` / `monsterById`，图鉴、委托敌人、战斗都会出现。

### 5.4 装备与消耗品设计

| 字段 | 控件 | 校验 |
| --- | --- | --- |
| 名称 | 文本 | 2–14 字 |
| 阵营 | 下拉 | 月蚀庭 / 星灯协会 / 市役所 |
| 槽位 | 单选 | 武器 / 护符 / 消耗品 |
| 价格 / 声望门槛 | 数字 | 0–9999 / 0–100 |
| 描述 | 多行 | 4–120 字 |
| 四维加成 | 四格数字 | 合计 ≤20 |
| 生命 / 共情上限 | 数字 | 0–60 |
| 附带技能 | 下拉（可空） | 仅武器/护符；来自技能库 |
| 每场侵蚀 | 数字 | 0–5 |
| 被动说明 | 文本 | ≤40 字；**仅展示**，需在说明里提醒作者 |
| 消耗品效果 | 下拉 + 数值 | 治疗 / 净化 / 抑制 / 签约折扣 / 税补 |

- **明确区分**「展示文本」与「真实字段」：`passive` 只是说明，真正生效的是 `stats`、`maxHpBonus`、`spiritBonus`、`corruptionPerBattle`、`skillId`、`effect/amount`。
- `damageBonus` / `initiativeBonus` 未接线前不放进表单；接线后再加「伤害加成 %」「先手」。
- **预览**：商店卡片 + 选中少女的装备前后属性差。
- **试跑**：给一名少女装备/使用一次，显示结算日志；试跑后可一键还原。
- **运行时**：进 `items` / `itemById`，商店池按阵营自动上架；买下后进背包。

### 5.5 弹窗事件设计

| 字段 | 控件 | 校验 |
| --- | --- | --- |
| 标题 | 文本 | 2–40 字 |
| 正文 | 多行 | 8–320 字 |
| 类型 | 下拉 | 势力 / 环境 / 少女 |
| 势力 / 辖区 | 下拉（可空） | 与类型联动 |
| 选项 | 2–3 行 | 标签 2–16 字；提示 ≤40 字 |
| 选项效果 | 行编辑 | 见 3.4，至少一项非零 |
| 投放方式 | 单选 | 手动 / 进入随机池 |
| 权重 / 每日一次 | 数字 / 开关 | 随机池时生效 |

- **预览**：直接渲染弹窗卡片与选项，点选项显示「将会发生什么」。
- **试跑**：弹一次，选项结算在内存副本；确认后可「立即投放」到当前存档。
- **挂蓝图**：蓝图「强制弹窗」节点增加「从事件库导入」，把标题/正文/选项/效果复制进节点（节点仍自带快照，不依赖库）。
- **随机池**：M4 先做手动投放；随机池在 M4b 接入每日/时段判定，避免一开始就改调度器。

---

## 6. 运行时接入点

| 系统 | 接入方式 |
| --- | --- |
| 委托轮转 | `commissionPool` 改为 `getCommissionPool()`：内置 + 自制；`makeCommission()` 用池；自制模板转 `Mission` 快照 |
| 蓝图阶段委托 | `missionTemplates()` 并入自制模板；下拉加「自制」徽标 |
| 战斗 | 技能/魔物注册表已可查；`MonsterRule` 替代按 id 硬编码 |
| 图鉴 | 图鉴列表改用注册表；自制魔物加「自制」标 |
| 商店 | `makeFactionStock()` 的 `items` 改用注册表；自制装备按阵营进入货架 |
| 背包/装备 | `getItem()` 查注册表；缺失 id 显示「内容已删除」而不是静默替换 |
| 角色创建 | 技能选择改用全部技能；自制技能可选 |
| 弹窗 | 新增 `injectIncident` 动作/命令，把事件卡快照塞进 `state.incidents`；随机池后续接 |
| 蓝图弹窗节点 | 检查器增加「从事件库导入」，复制为节点快照 |
| 设置 | 内容库占用、备份、清空（二次确认） |

### 6.1 严格查询（M0）

```ts
export function findSkill(id: string): Skill | undefined;
export function findMonster(id: string): MonsterTemplate | undefined;
export function findItem(id: string): Equipment | undefined;
```

- 编辑器、导入、删除检查一律用 `find*`。
- 战斗 / 商店等运行时路径遇到缺失：记录一条 `console.warn`，跳过该单位/商品，不回退到内置第一项。
- 保留 `getSkill` 等旧接口做兼容，但内部先查自制再查内置，最后才回退。

---

## 7. 存档、导入导出与删除保护

### 7.1 存储

- 键：`night-sugar:content:v1`。
- 值：`ContentLibrary` JSON；写入前 `sanitizeLibrary()`，丢弃未知字段。
- 体积：只存文本与数字；超过 1 MB 警告，超过 4 MB 阻止保存并提示导出。
- 备份：每次保存前把上一版写 `night-sugar:content:backup`（只留一份）。

### 7.2 导出 / 导入

```json
{
  "format": "night-sugar/content-library",
  "version": 1,
  "exportedAt": "2026-10-27T…",
  "skills": [], "monsters": [], "items": [], "missions": [], "incidents": []
}
```

- 导出默认「仅自制」；可选「包含内置」（便于做完整内容包，但体积大）。
- 导入先校验，再显示差异：新增 / 同名冲突 / 非法条目。
- 冲突策略：跳过 / 覆盖 / 另存为新 id（默认「另存为新 id」）。
- 导入完成后重新 hydrate，刷新工坊列表。

### 7.3 删除保护

工坊能读到当前 `GameState` 的引用计数：

- 技能：少女 `skills`、魔物 `skillIds`、装备 `skillId`；
- 魔物：当前/模板委托 `enemyIds`、Boss；
- 装备：背包、商店库存、少女装备、委托奖励；
- 弹窗：只在队列中的快照，不阻止删除（快照已独立）。

有引用时默认禁用删除；勾选「仍然删除」后只删库，不清理存档，并在下次加载时给缺失引用打「已失效」标。

### 7.4 存档兼容

- 不改 `GameState.version`（仍 10）。
- 内容库独立版本 `version: 1`，未来迁移在 `migrateLibrary()` 做。
- 存档里的委托、弹窗都是快照，删除内容库不会让旧存档直接崩；只是引用字段可能失效。

---

## 8. 实施里程碑

> 界面分类按「委托 / 魔物 / 技能 / 弹窗 / 装备」排；实施按依赖顺序做。

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **M0 内容库地基** | `library.ts`（类型、sanitize、加载/保存/备份、注册/注销、导出/导入骨架）；严格查询；`main.tsx` 启动 hydrate；工坊空壳 + 分类导航 | 单测覆盖损坏 JSON、重复 id、注册幂等；刷新后库仍在 |
| **M1 技能 + 装备** | 技能编辑器、装备/消耗品编辑器；注册表接入战斗/商店/背包 | 新建技能给少女、新建装备上架并购买使用；导出/导入往返 |
| **M2 魔物** | 魔物编辑器 + `MonsterGlyph` 预览 + 阶级基准提示；可选 `MonsterRule` 与战斗接线 | 自制魔物出现在图鉴、可被委托选中、战斗可跑 |
| **M3 委托** | 委托编辑器 + 地图钉预览 + 投放测试；`commissionPool` 接入自制模板；蓝图下拉出现自制 | 自制委托可投放、可轮转、可在蓝图阶段委托选中 |
| **M4 弹窗** | 弹窗编辑器 + 预览 + 手动投放；蓝图弹窗节点「从事件库导入」 | 弹窗可弹出、选项结算正确；导入节点字段完整 |
| **M5 打包与收口** | 内容包导出/导入、冲突处理、删除保护、体积提示、文档、截图 | 两个浏览器流程：造一套内容并试跑；导出后清空再导入恢复 |

每个里程碑结束都跑：

```powershell
npx tsc -b --pretty false
npm test
node node_modules/vite/bin/vite.js build --logLevel error
# serve + node tests/browser.mjs，数 ^PASS
```

---

## 9. 测试计划

### 9.1 单测

- `sanitizeLibrary`：夹取数值、丢弃坏枚举、拒绝重复 id、保留合法引用。
- 注册表：hydrate 幂等；重复 hydrate 不产生重复项；删除后注销。
- 严格查询：缺失 id 返回 `undefined`，运行时跳过而不是回退第一项。
- 委托转换：`MissionTemplate → Mission` 的字段、辖区钉、窗口、奖励。
- 弹窗投放：快照进 `state.incidents`，选项结算只应用一次。
- 导出/导入：round-trip 保真；冲突策略三种。
- 魔物规则（若做）：6 条规则各一条战斗断言。

### 9.2 浏览器流程（建议新增 6 条）

1. 打开工坊 → 新建技能 → 保存 → 刷新 → 仍在；角色创建里能选到。
2. 新建装备 → 商店可见 → 购买 → 装备生效 / 消耗品结算。
3. 新建魔物 → 图鉴可见 → 委托编辑器敌人下拉可见 → 战斗可跑。
4. 新建委托 → 投放测试 → 地图出现 → 蓝图阶段委托下拉可见。
5. 新建弹窗 → 预览 → 投放 → 选项结算；蓝图导入字段一致。
6. 导出内容包 → 清空库 → 导入 → 全部恢复；非法 JSON 报错不崩。

### 9.3 手工检查

- 1280 / 1440 宽度下表单不溢出；滚动与焦点正常。
- 内置项只读、复制后可编辑；删除保护提示准确。
- 空库、坏库、缺引用三种状态都有可读提示。
- 试跑不写存档；「立即投放」写存档并留日志。

---

## 10. 风险与处理

| 风险 | 处理 |
| --- | --- |
| 五个编辑器范围失控 | 共用列表/表单/预览骨架；每类只做核心字段，先不做批量导入、版本对比 |
| 填了不生效（passive、未接线字段） | 表单明确分「展示文本 / 真实效果」；未接线字段先隐藏 |
| 自制内容破坏平衡 | 只给基准带提示，不硬拦；试跑给出与内置中位数的对比 |
| 删内容导致旧存档缺引用 | 删除前引用计数 + 二次确认；运行时缺失跳过并提示 |
| localStorage 超限 | 只存文本；数量上限；体积检查与导出提醒 |
| 内置内容被误改 | 内置只读，编辑必须复制；注册表只追加 `source: 'custom'` |
| HMR / 重复导入出现重复项 | 注册前按 id 注销旧的自制项；hydrate 幂等 |
| 改动 `commissionPool` 影响旧委托 | 旧委托是快照；池只影响之后生成的委托 |

---

## 11. 非目标

- 不做自由脚本 / 公式语言 / 事件图灵机；所有效果都落在现有枚举与字段上。
- 不做图片上传、像素编辑、AI 生成立绘；魔物外形仍用 `MonsterSpec` 程序化绘制。
- 不做在线市场、云同步、多人协作。
- 不做内置内容的直接修改；只能复制成自制。
- 不做「任意新战斗机制」；新技能/魔物只能用现有 `SkillEffect` 与 `MonsterRule`。
- 不在本期做议会提案与多场景角色事件的完整编辑器（可复用同一框架，放到 M6）。

---

## 12. 待拍板

1. **魔物特性**：M2 是否做结构化 `MonsterRule`（推荐做，6 条规则覆盖现有内置行为），还是 V1 只写图鉴描述？
2. **弹窗范围**：只做即时抉择弹窗（`Incident`，推荐先做），还是同时做多场景角色事件（`CharacterEvent`）？
3. **内容归属**：内容库独立于存档（推荐），还是随每个存档各存一份？
4. **自制委托的入场方式**：默认进入每日轮转池（推荐，权重 1），还是默认「只在工坊手动投放」，勾选后才进池？

---

## 13. 预计改动文件

新增：

- `src/content/library.ts`：类型、sanitize、持久化、注册/注销、导入导出。
- `src/content/editor.ts`：id 生成、校验、基准对比、模板转换。
- `src/components/ContentWorkshopDialog.tsx`：外壳、分类、列表、脏状态。
- `src/components/workshop/SkillEditor.tsx`
- `src/components/workshop/ItemEditor.tsx`
- `src/components/workshop/MonsterEditor.tsx`
- `src/components/workshop/MissionEditor.tsx`
- `src/components/workshop/IncidentEditor.tsx`
- `src/components/workshop/EffectRows.tsx`、`PreviewPane.tsx`（共用）
- `tests/library.test.ts`

修改：

- `src/main.tsx`：启动 hydrate。
- `src/game.ts`：委托池改为注册表；`injectIncident`；蓝图检查器引用自制项。
- `src/combat.ts`：可选 `MonsterRule`；严格查询。
- `src/content/skills.ts` / `monsters.ts` / `items.ts`：注册与严格查询。
- `src/components/Shell.tsx`：`#open-workshop`。
- `src/components/StoryGraphDialog.tsx`：委托/弹窗从库导入。
- `src/views/MarketView.tsx` / `AuxViews.tsx` / `ArchiveDialogs.tsx`：使用注册表。
- `src/styles.css` / `dialogs.css`：工坊样式。
- `README.md` / `tasks/todo.md`：文档与进度。

---

## 12. 实施记录（M0–M2，已完成）

按 m00744 的范围只做了 M0 / M1 / M2，M3（委托编辑器）与 M4（弹窗编辑器）暂不做。

落地与方案的差异：

- 五类编辑器没有拆成独立文件，而是合并为一座 `ContentWorkshopDialog`（三个页签：技能、装备与消耗品、魔物）。共用列表、表单与预览，后续接委托/弹窗时只需加页签。
- 内容库为 `src/content/library.ts`，localStorage 键 `night-sugar:content:v1`，schema 1；启动时 `initContentLibrary()` 注册进 `skills` / `items` / `monsters` 三个数组与 Map，不升 `GameState` 版本。
- 装备栏的 `damageBonus` / `initiativeBonus` 仍未接线；工坊表单只暴露实际生效的 `stats`、`maxHpBonus`、`spiritBonus`、`corruptionPerBattle`、`skillId`、消耗品效果。
- `getSkill` 的静默回退尚未改成严格查询，避免影响既有存档与 LLM 生成链路；内容库只接受 `custom-<kind>-` 前缀 id，删除前用 `contentUsage` 挡住存档引用。

新增文件：

- `src/content/library.ts`
- `src/components/workshop/ContentWorkshopDialog.tsx`

修改文件：

- `src/types.ts`：`MonsterRule`、`MonsterTemplate.rules`。
- `src/combat.ts`：MonsterRule 驱动再生、低血增益、加速、减益攻击者、持续伤害、免疫眩晕与伤害减免。
- `src/content/monsters.ts`：六只内置魔物的规则化特性。
- `src/App.tsx`、`src/components/Shell.tsx`、`src/main.tsx`：工坊入口、内容库状态与启动注册。
- `src/dialogs.css`：工坊样式。
- `README.md`、`tests/game.test.ts`、`tests/browser.mjs`。

验证：tsc 0、单测 91/91、浏览器 48/48、构建通过。截图见 `artifacts/workshop.png`、`artifacts/workshop-skill.png`、`artifacts/workshop-monster.png`。

下一步：M3 委托编辑器、M4 弹窗编辑器；以及 `src/game.ts` 的门面化拆分（先做门面 + labels/save，再逐模块搬 `act`）。

---

## 13. 实施记录（M3，已完成）

按 m01211「ok继续」继续做到 M3 委托编辑器；M4 弹窗编辑器仍未开工。

落地：

- 数据模型新增 `MissionTemplate`（`src/types.ts`）：id / 标题 / 分类 / 描述 / 难度 / 时长 / 判定属性与目标值 / 战斗或调查 / 敌人 id / 轮数 / 推荐等级 / 可空辖区 / 可空接取窗口 / 报酬 / 颜色；`Mission.templateId` 记录来源模板，用于删除前引用检查。
- 内容库 schema 增 `missions` 数组，`sanitizeMission` 只收 `custom-mission-` 前缀，战斗委托至少保留一只合法敌人；保存时先建「内置 + 本次自制魔物」池，再清洗敌人 id。
- `applyLibrary` 同步 `customMissionTemplates()`；`missionTemplates()` 与 `makeCommission` 的轮转池改为「内置 + 自制」；自制模板固定辖区/窗口时覆盖自动轮转，否则沿用原逻辑。`deployMissionTemplate` 供「投放测试」立刻生成一份委托。
- 工坊新增「委托」页签（放在首位）：完整表单、敌人多选（1–3 只）、预览卡片、投放测试按钮；删除前用 `contentUsage` 检查当前夜晚是否还有该模板生成的委托。
- 内置委托只读，可复制为自制；保存后蓝图「阶段委托」模板下拉也能选到自制委托。

修改文件：`src/types.ts`、`src/content/library.ts`、`src/game.ts`、`src/components/workshop/ContentWorkshopDialog.tsx`、`src/App.tsx`、`tests/game.test.ts`、`tests/browser.mjs`、`README.md`。

验证：tsc 0、单测 92/92、浏览器 48/48、构建通过。截图见 `artifacts/workshop.png`。

下一步：M4 弹窗编辑器；以及 `src/game.ts` 的门面化拆分。
