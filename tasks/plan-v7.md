# v7 方案：世界书、剧情引擎、使魔札记、诊所重做

> 目标版本：`0.7`（存档 v10）
> 本轮需求
> 1. 去背景后要有预览。
> 2. 故事线由 LLM 给出明确任务目标并发布特殊委托；完成阶段委托后触发分幕羁绊剧情：长文本 + 选项 + 自由输入，按选择与输入续写直到结束；独立弹窗、独立接口、SillyTavern 预设。
> 3. 补上「战斗使魔札记」：把战斗日志扩写成可读的战斗剧情，独立弹窗，要求同特殊事件。
> 4. 特殊事件与札记全文保存，保证连贯。
> 5. 设置里新增玩家档案。
> 6. 字数与描写要求放进预设词条，玩家可改。
> 7. 预设改为 ST 式词条列表，可启用、排序、新增。
> 8. **新增世界书菜单**（在设置旁边），像 ST 世界书一样管理世界观设定：生命、共情、侵蚀、势力、辖区、委托、诊所等都可编辑；附「数值规则」页签，关键平衡数值也能改。
> 9. **诊所重做**：移除快速治疗与深度疗养，统一为「治疗」——按时间恢复固定血量并收费、不恢复疲劳；只列出受伤角色、用头像；新增「治疗癖好」，收费且治疗期间不能派遣（黑暗地牢式）。

---

## 0. 结构总览

```
设置 ─┬─ 玩家档案（{{player}}）
      ├─ 剧情引擎（独立接口）
      └─ 对话补全预设（ST 式词条）

世界书（新菜单，设置旁）──┬─ 设定词条（ST 世界书格式，关键词/常驻/优先级）
                          └─ 数值规则（诊所单价、治疗速度、疲劳恢复、侵蚀阈值…）

剧情 ── 故事线 4 幕（每幕带任务）→ 故事委托 → 完成 → 分幕剧情（选项 + 自由输入）
        └─ 战斗札记（战报扩写为 1000–1800 字）

诊所 ── 只列受伤角色 → 选治疗/治疗癖好 → 扣费 + 占用 → 按小时回血 → 到期解除
```

默认值：

1. 每段剧情 4 幕（3–5 自适应），总字数下限 1200，由预设词条控制。
2. 剧情引擎默认复用主接口，填独立字段才切换。
3. 世界书内置 6 条常驻设定 + 8 条关键词条目，全部可改；数值规则 10 项可改。
4. 诊所只做治疗与治疗癖好，疲劳交给宿舍。

---

## 1. 去背景预览

`cutBackground()` 后进入预览态：左原图、右去背景结果（棋盘格底），显示移除比例与容差；按钮「应用这一版 / 保留原图 / 重新计算」。改容差后旧结果标记过期，需重算。入口卡片与立绘步骤共用 `CutoutPreview`。

文件：新增 `src/components/CutoutPreview.tsx`；`CustomGirlDialog` 增 `cut` 状态。

验收：两图 `src` 不同；应用后为 PNG data URL；撤销回到上一版；容差 12/90 均可用。

---

## 2. 预设词条系统（ST 式）

```ts
export type PromptRole = 'system' | 'user' | 'assistant';

export interface PromptEntry {
  id: string; name: string; content: string;
  role: PromptRole; enabled: boolean;
  marker?: boolean; builtin?: boolean;
}

export interface ChatPreset {
  id: string; name: string; description?: string;
  settings: Record<string, unknown>;
  prompts: PromptEntry[];   // 顺序即顺序
  createdAt: string; updatedAt: string; builtin?: boolean;
}
```

- 变量：`{{world}} {{player}} {{char}} {{story}} {{worldbook}} {{history}} {{context}}`。
- 拼装：按序替换、连续 system 合并、user/assistant 独立成消息、保证末条为 user。
- 内置词条（剧情档）：世界观、玩家档案、角色卡、`{{worldbook}}`、分隔、文风、字数要求、描写要求、选项要求、分隔、越权禁止、本次任务。
- 字数下限从词条正则 `不少于\s*(\d{3,4})\s*字` 读取，默认 1200；改词条即改阈值。
- 编辑器照 ST：拖拽手柄 + `⬆⬇`、图标区分普通/分隔/内置、token 计数（CJK×1、其他÷4）、开关、展开编辑、新增/新增分隔/复制/删除/恢复默认；顶部显示合计占 `max_context` 比例，超 70% 警告。
- ST 导入导出：`prompts[]` 的 `identifier/name/content/role/system_prompt/marker` 保真往返。
- `PresetBinding` 增 `story`，默认 `builtin-balanced`，旧绑定回落 `chat`。
- 额度：`maxTokens < 1800` 提示并抬到 2600；`finish_reason:'length'` 以 3000 重试并追加「接着上一段继续写」。

---

## 3. 世界书（新菜单）

### 3.1 入口

侧边栏「设置」上方新增 `#nav-worldbook`（BookOpen 图标，`page === 'worldbook'`），与设置并列；也支持从设置页的「打开世界书」跳转。

### 3.2 数据

```ts
export interface WorldbookEntry {
  id: string;
  name: string;          // 词条名，例如「侵蚀度与魔女化」
  keys: string[];        // 触发词，空数组 = 常驻
  content: string;
  enabled: boolean;
  constant: boolean;     // 常驻注入
  priority: number;      // 越大越先注入
  order: number;
  comment?: string;      // 仅备注，不发送
  builtin?: boolean;
}

export interface BalanceRules {
  clinicBase: number;        // 诊所起步价
  clinicPerHp: number;       // 每点血单价
  clinicKinkFee: number;     // 治疗癖好附加费
  clinicHpPerHour: number;   // 每小时恢复
  dormFatiguePerHour: number;// 宿舍每小时疲劳恢复
  corruptionThreshold: number; // 魔女化阈值
  squadLimit: number;        // 每队上限
  territoryLimit: number;    // 单势力辖区上限
  longMinDays: number;       // 长期委托最短天数
  longMaxDays: number;       // 长期委托最长天数
}
```

存储：`night-sugar:worldbook`、`night-sugar:balance`；默认值见 §7。

### 3.3 注入

`worldbookContext(state, triggerText, budget)`：

1. 常驻词条按 priority 降序全部纳入。
2. 关键词词条：`keys.some(k => triggerText.includes(k))`，按 priority 取到预算上限（默认 1200 字）。
3. 触发文本 = 当前请求 + 角色名 + 辖区名 + 任务标题。
4. 结果拼成 `{{worldbook}}` 段，注入在「世界观」之后、「玩家档案」之前。
5. 叙事引擎面板显示命中的词条名与字数，方便排查。

### 3.4 内置词条（可改可停用不可删）

| 词条 | 触发 | 内容要点 |
| --- | --- | --- |
| 生命与受伤 | 常驻 | 生命上限、受伤后战力下降、疤痕规则 |
| 共情与羁绊 | 常驻 | 羁绊 0–100、20 解锁故事线、事件加减幅度 |
| 侵蚀与魔女化 | 常驻 | 侵蚀来源、阈值 40 解锁魔女化、代价 |
| 星砂与安定度 | 常驻 | 货币用途、安定度区间与影响 |
| 三方势力 | 常驻 | 月蚀/星灯/市役所的立场、辖区上限、易主方式 |
| 夜班规则 | 常驻 | 20:00–02:00、三批委托、打烊结算 |
| 九辖区 | 辖区名 | 每片的地形、气质、环境修正 |
| 委托与时限 | 委托 | 紧急 2 小时、长期 2–7 天、故事委托不过期 |
| 议会 | 议会 | 议题来源、三种决议的差别 |
| 宿舍 | 宿舍 | 只恢复疲劳、不恢复生命 |
| 诊所与治疗 | 诊所 | 只在诊所回血、按时间收费、治疗期间不可派遣 |
| 治疗癖好 | 治疗癖好 | 附加服务、费用、结束时的特性/羁绊变化 |
| 故事线 | 故事线 | 每角色一条、完成委托触发剧情 |
| 战斗札记 | 战斗札记 | 战报转叙事、不改结果 |

默认只启用 6 条常驻（生命/共情/侵蚀/势力/夜班/诊所），其余按关键词命中，避免上下文膨胀。

### 3.5 编辑器

左列词条列表（搜索、启用开关、常驻徽标、序号），右侧编辑：标题、关键词（逗号分隔）、常驻开关、优先级、内容（等宽大字、token 计数）、保存/复制/删除/恢复默认。顶部：新建词条、导入 ST 世界书 JSON、导出。ST 字段映射：`key → keys`、`content`、`constant`、`disable → !enabled`、`order`、`comment`。

### 3.6 数值规则页签

同一页面的第二个页签「数值规则」，10 个数字输入 + 每项一句说明 + 「恢复默认」。保存后立即生效（诊所报价、治疗速度、宿舍恢复、侵蚀阈值、队伍上限、辖区上限、长期委托天数范围都从 `balance` 读取）。改动会写进日志「数值规则已更新」。

---

## 4. 玩家档案

```ts
export interface PlayerProfile {
  name: string; alias?: string; pronoun?: string;
  appearance: string; personality: string; background: string; relation?: string;
}
```

设置 → 通用新增区块，字段 `#settings-player-name/alias/pronoun/appearance/personality/background/relation` 与保存按钮；存储 `night-sugar:player-profile`。以 `{{player}}` 注入对话、剧情、札记、议会旁白；未填写用中性描述。

---

## 5. 故事线：目标 + 特殊委托 + 完成触发

```ts
export interface StoryMissionSpec {
  title: string; goal: string; category: string;
  difficulty: number; duration: number; district?: DistrictId;
  requirement?: StatKey; target?: number;
}
export interface StoryBeat {
  mission?: StoryMissionSpec; missionId?: string;
  status: 'locked' | 'open' | 'done'; eventId?: string;
}
export interface Mission { storyBeatId?: string; storyGoal?: string; }
```

- LLM 每幕必须给 `mission`：目标一句可验证的话、难度 1–5、时长 30–120、辖区为九辖区之一；缺失则整条故事线用模板。
- 奖励 `260 + difficulty×120`、目标 `45 + difficulty×7` 本地算。
- 生命周期：发布委托（`longDays` 取 `balance.longMaxDays`，不随打烊清理、不可删）→ 完成 → 幕 done、建事件占位、角标 → 首次打开才生成第 1 幕 → 终幕解锁下一幕。
- 失败回到 `open` 可重试，故事线不倒退。

---

## 6. 特殊事件：分幕 + 选项 + 自由输入

```ts
export interface StoryScene {
  id: string; index: number; title: string;
  narration: string;                    // 350–700 字
  lines: EventLine[];                   // 4–10 句
  choices: { id: string; label: string; intent: string }[];
  pickedChoiceId?: string;
  freeText?: string;                    // ≤200 字
  at: string;
}
export interface CharacterEvent {
  mode: 'story'; scenes: StoryScene[]; stage: number;
  status: 'active' | 'done'; summary: string; pending: boolean;
}
```

- 首次打开 `generateEventOpening`；选择或自由输入后 `generateEventNext`，输入含前序各幕全文、选择 `intent` 或玩家原话、剩余幕数；终幕额外给 `epilogue/summary/effect`。
- 字数守卫：单幕低于 `max(240, minChars/4)` 重写一次；全段低于 `minChars` 在终幕前补一幕余韵。
- 无 Key：已生成文本 + 本地续写与默认选项，不卡死。
- 弹窗：左立绘/状态/当前幕目标，右正文（衬线 15px/1.9）+ 回看前文 + 2–3 个大选项 + 常驻输入框（发送即续写）；生成中禁用；终幕「结束这段」应用 bond ±8 / corruption ±6（clamp）并写摘要；`1/2/3` 选择、`Enter` 发送、`Esc` 收起。

---

## 7. 战斗使魔札记

```ts
export interface BattleNote {
  id: string; battleId: string; title: string;
  text: string; summary: string;
  source: 'llm' | 'fallback'; model: string; createdAt: string;
}
```

- 1000–1800 字，第三人称分段；写战况（回合、技能、受创、翻盘、结局）与关系（配合、拌嘴、挡刀、疤痕、羁绊变化）；不改结果、不新增奖励、不虚构角色。
- 输入：任务与辖区、编队与关系、敌人、结局、逐轮事件、疤痕、奖励变化；超预算按轮次等距抽样保留首尾与转折。
- 不足 900 字重试扩写；无 Key 用本地模板分五段（开场/交手/受创/转折/收束）约 900–1100 字。
- 入口：战斗记录行 `#av-battle-note-<id>`、战斗回放顶部 `#battle-note-open`；弹窗左右分栏、生成/重写/复制。

---

## 8. 诊所重做

### 8.0 现状（改造起点）

- 诊所在基地楼层：`RoomDialog` 的 `clinic` 页签（标签「快速诊疗」，`room.type === 'clinic'`），手术页签单独放重塑/复制。
- 两个旧动作在 `CharacterDialog` 的 `.clinic-grid`（`#clinic-heal` 240 星砂、`#clinic-rest` 360 星砂）与 `RoomDialog` 的 `#room-heal-<id>` / `#room-rest-<id>`，逻辑在 `game.ts` 的 `case 'clinic'`（约 1447 行）；`rest` 会设 `status:'resting'` + `girl.clinicRest`，三天后由 `advanceClock` 一次补满。
- 宿舍页签的「休息」也复用 `'rest'`，所以这次要把它拆成独立的 `dormRest`，否则移除深度疗养会连带弄丢宿舍功能。
- 重塑（4000）与复制（18000）属于手术页签，本次不动。

### 8.1 规则

- 移除「快速治疗」「深度疗养」，只保留一个动作：**治疗**。
- 只列出**受伤角色**（`hp < 有效最大生命`），用头像；健康角色不出现。
- 费用 = `balance.clinicBase + 缺失生命 × balance.clinicPerHp`；治疗癖好额外 `balance.clinicKinkFee`。
- 时长 = `max(60, ceil(缺失生命 / balance.clinicHpPerHour × 60))` 分钟，上限 480。
- 治疗期间 `girl.status = 'clinic'`，**不能派遣、不能参与议会、不能出战**；宿舍与日常互动也不可用。
- 按分钟恢复：`clinicHpPerHour` 线性回血，到期时补满到治疗时承诺的目标（不超上限）。
- **不恢复疲劳**；诊所界面明确写「疲劳请去宿舍」。
- 治疗中不占用夜晚的派遣额度，但占用角色本身。

### 8.2 治疗癖好

- 勾选后加收 `clinicKinkFee`，时长 ×1.5，期间同样不可派遣。
- 结束时：若角色没有「治疗癖好」特性则获得（正/中性别由内容决定，标签 `治疗`），羁绊 +4、侵蚀 +3（clamp）；已拥有则羁绊 +6、侵蚀 +2。
- 写日志与档案：「<名字> 接受了治疗癖好护理。」
- 特性描述进角色卡，后续剧情与札记可引用。

### 8.3 数据与结算

```ts
export interface Treatment {
  id: string; girlId: string;
  startedAt: number;   // 绝对分钟
  endsAt: number;
  paid: number;
  hpTarget: number;
  kink: boolean;
  status: 'active' | 'done';
}
```

`GameState.treatments: Treatment[]`（v10 新增）。`advanceClock` 每分钟推进：

```
for t of treatments where status==='active':
  ratio = clamp((to - startedAt)/(endsAt - startedAt), 0, 1)
  girl.hp = min(maxHp, round(startHp + (hpTarget-startHp)*ratio))
  if to >= endsAt: status='done'; girl.status='idle'; 结算癖好; log '完成治疗'
```

- `dispatch` 拒绝 `status==='clinic'`；`decideOpinion` 的出席人也过滤。
- 提前打烊不影响治疗：`endNight` 跳到次日 20:00，治疗按绝对分钟继续，`advanceClock` 会一次补齐。

### 8.4 界面（改造 `RoomDialog` 诊所页签 + `ClinicPanel`）

不新开全屏弹窗，诊所仍是基地里的房间页：`room.type === 'clinic'` 时页签为 `成员 / 治疗 / 手术`。治疗页抽成 `src/components/ClinicPanel.tsx`，角色详情页的诊所区块也嵌同一个组件（替换 `#clinic-heal` / `#clinic-rest` 两个按钮为「前往诊所」或内嵌面板）。

```
诊所 · 只剩伤口需要时间
星砂 12,840 · 今晚可用 3 人
┌ 头像 ┐ 月见桃   32 / 100   [✓ 治疗]  [ ] 治疗癖好
│      │ 预计 3 小时 20 分 · 780 星砂（含癖好 +320）
├──────┼────────────────────────────────
┌ 头像 ┐ 零青     61 / 100   …
合计：1,100 星砂 · 最早 2 小时后结束
[ 开始治疗 ]
正在治疗：月见桃 · 剩 1 小时 12 分（不可派遣）
```

- 头像用 `GirlPortrait variant="avatar"`，血条按缺失比例着色（>60% 红、30–60% 琥珀）。
- 报价随勾选实时更新；星砂不足禁用确认并提示差额。
- 治疗中的条目显示剩余时间与「不可派遣」标签；列表底部给出「今晚可用人数」。
- 空态：「今晚没有人需要缝针。」
- 宿舍页签的「休息」独立为 `dormRest`：只降疲劳、不碰生命，仍占用到次日。

---

## 9. 全文存档与连续性

| 数据 | 位置 | 上限 |
| --- | --- | --- |
| 事件各幕 | `state.events[].scenes` | 6 幕 / 40000 字 |
| 事件摘要 | `state.events[].summary` | 250 字 |
| 战斗札记 | `state.battleNotes[]` | 40 条 / 单条 12000 字 |
| 治疗记录 | `state.treatments` | 20 条（完成的滚动清理） |

`storyContext(state, girl)`：世界观 → 玩家档案 → 世界书命中 → 角色卡 → 故事线状态 → 最近 2 条事件摘要 → 最近 2 条札记摘要 → 本次各幕全文。

导出/导入原样携带；超过 4.6 MB 提示并优先清最旧札记。

---

## 10. 存档 v10

- `GameState.version: 10`；新增必填 `battleNotes`、`treatments`、`playerProfile?`（也单独存 localStorage）。
- `CharacterEvent` 增 `mode / scenes[].pickedChoiceId / freeText / summary`；旧事件迁 `scenes`。
- `StoryBeat` 增 `status / mission / missionId / eventId`；`Mission` 增 `storyBeatId / storyGoal`。
- 活动故事线缺委托时补建。
- `loadState / importState` 接受 `[3..10]`；旧预设迁移为词条；旧世界书为空时写入内置条目。
- 治疗中的角色状态 `clinic` 若旧档不存在则保持原状态（不凭空造治疗）。

---

## 11. 文件改动

| 文件 | 改动 |
| --- | --- |
| `src/types.ts` | v10、`BattleNote`、`StoryScene`、`StoryMissionSpec`、`PromptEntry`、`PlayerProfile`、`WorldbookEntry`、`BalanceRules`、`Treatment`、action |
| `src/presets.ts` | 词条模型、拼装、token 估算、字数解析、ST 词条导入导出、story 绑定、迁移 |
| `src/worldbook.ts` | 新增：读写、关键词匹配、ST 世界书导入导出、默认词条 |
| `src/balance.ts` | 新增：默认数值、读写、校验 |
| `src/player.ts` | 新增：玩家档案读写 |
| `src/llm.ts` | `StoryConfig`、`storyChat`、事件生成器、札记生成器、`{{worldbook}}`/`{{player}}` 注入、日志 kind |
| `src/game.ts` | 故事委托与事件生命周期、`battleNotes`、治疗结算、诊所报价、v10 迁移、派遣守卫 |
| `src/components/CutoutPreview.tsx` | 新增 |
| `src/components/StoryPlayerDialog.tsx` | 新增（分幕 + 选项 + 自由输入） |
| `src/components/BattleNoteDialog.tsx` | 新增 |
| `src/components/WorldbookView.tsx` | 新增（词条列表 + 编辑器 + 数值规则页签） |
| `src/components/ClinicPanel.tsx` | 新增：受伤头像列表、治疗/癖好勾选、实时报价、进行中 |
| `src/components/RoomDialog.tsx` | 诊所页签换 `ClinicPanel`，标签「快速诊疗」→「治疗」；宿舍页签的休息改 `dormRest` |
| `src/components/CharacterDialog.tsx` | `.clinic-grid` 的 `#clinic-heal` / `#clinic-rest` 改为内嵌治疗入口（手术按钮保留） |
| `src/components/PresetDialog.tsx` | 提示词页改为词条编辑器 |
| `src/components/UtilityDialogs.tsx` | 玩家档案、剧情引擎、世界书入口 |
| `src/components/Shell.tsx` | `Page` 增 `worldbook`、侧栏入口 |
| `src/views/AuxViews.tsx` / `BattleReport.tsx` | 札记入口 |
| `src/App.tsx` | 世界书页面、诊所、两个弹窗、配置 |
| 样式 | 预览、剧情、札记、词条编辑器、世界书、诊所 |
| `tests/game.test.ts` | 词条拼装与迁移、世界书命中与导入、数值规则联动、玩家档案注入、故事任务、分幕与自由输入、札记上限、治疗结算与守卫、v10 |
| `tests/browser.mjs` | 去背景预览、词条增删排序、世界书编辑、玩家档案、剧情委托→分幕→自由输入→结束、札记、诊所治疗与不可派遣 |

---

## 12. 里程碑

| 阶段 | 内容 | 完成标准 |
| --- | --- | --- |
| M1 | 去背景预览 | 预览/应用/撤销/重算可用 |
| M2 | 词条预设 + 玩家档案 | ST 往返保真、增删排序、注入可见 |
| M3 | 世界书 + 数值规则 | 常驻/关键词命中、导入导出、10 项数值生效 |
| M4 | 存档 v10 + 故事任务生命周期 | `tsc` 干净，创建/完成/解锁有测试 |
| M5 | 剧情引擎 + 分幕弹窗 | 3 幕以上、选项与自由输入都能续写、终幕收束 |
| M6 | 战斗札记 | 双入口、≥1000 字、无 Key 兜底 |
| M7 | 诊所重做 | 只列伤者、按时间回血、癖好、派遣拦截 |
| M8 | 测试、文档、构建、浏览器 | ≥ 88 项状态测试、≥ 44 组浏览器流程 |

---

## 13. 风险与不做的事

**风险**

- 词条 + 世界书叠加会挤占上下文：注入预算 1200 字，超 70% 警告，常驻条目默认只开 6 条。
- 世界书自动匹配可能误触发：关键词区分大小写可选，命中结果在叙事引擎面板可见。
- 数值可调会让平衡失真：范围校验（如诊所单价 1–60、每小时回血 1–60），并在改动时提示影响。
- 治疗占用角色可能导致夜里无人可派：诊所界面显示「今晚可用人数」，并在派遣页提示。
- 旧存档/旧预设/旧世界书都需要迁移测试。

**不做**

- 不做流式输出、不做自由事件编辑器。
- 不把叙事文本写回战斗数值或任务状态，只写摘要与小幅 effect。
- 不做多角色同场剧情。
- 不让世界书改写代码逻辑（它只影响提示词与展示），数值只走「数值规则」。

---

## 14. 实施记录

### M1 去背景预览（2026-10-26）

- 新增 `src/components/CutoutPreview.tsx`：原图 / 去背景双栏对比，棋盘格底，显示移除比例与当前容差，三个动作（应用、保留原图、重新计算）。
- `CustomGirlDialog`：`cut` 状态取代「立即替换」；容差变化会作废预览并提示重算；gate 与立绘步骤共用同一预览块；有待确认的预览时「让使魔补全」禁用。
- 样式：`.cutout-preview / -figures / -figure / -copy / -actions`，≤860px 单列。
- 验收：`tsc -b` 通过；`npm test` 62/62；`npm run build` 通过（index 443.39 kB）；`node tests/browser.mjs` 33/33（「只导入立绘后可手动完成登记」新增预览断言）。
- 截图：`artifacts/cutout-preview.png`。
### M1.5 衣柜导入的去背景与 AI 描述（2026-10-26）

- `WardrobeDialog` 的待写入列表改为逐套可编辑：名称输入、描述文本域、去背景、让叙事者写描述、移出。
- 去背景复用 `CutoutPreview`（原图 / 棋盘格 / 应用 / 保留 / 重算），应用只影响待写入的这一套；预览会自动滚入视口。
- 新增 `generateOutfitDescription`（`src/llm.ts`）：把立绘作为图像内容发送，返回 4–10 字典雅套装名 + 50–90 字材质/剪裁/配饰描述；失败按图像不支持 / JSON 截断分别提示。
- 衣柜槽位删除按钮补「删除」文案；详情页始终提供「管理衣柜 · 导入 / 删除」入口。
- 验收：`npm test` 63/63（新增服装词条用例）、`npm run build` 通过（index 448.75 kB）、`node tests/browser.mjs` 35/35（新增去背景预览与删除两条流程）。截图 `artifacts/wardrobe-stage.png`。
### M2 词条预设 + 玩家档案（2026-10-26）

- `src/presets.ts` 重写：`PromptEntry` 词条模型（role / enabled / marker / builtin）、`presetPrompts()` 迁移（`preset.prompts` → `settings.prompts[]` → `main/jailbreak`）、`promptTokens()`、`renderPresetSystem()`、`PROMPT_VARIABLES` 七个变量、`PresetBinding` 增 `story`、`boundPreset('chat'|'generate'|'story')`。
- 导出写回 SillyTavern 的 `prompts[]`（identifier/name/content/role/system_prompt/marker/disable），导入读回并转成可编辑词条；`main/jailbreak` 不再丢失，迁移后仍可见可改。
- `src/player.ts`：`PlayerProfile`（名字/称呼/代词/外貌/性格/背景/关系），存 `night-sugar:player-profile`，`playerSummary()` 供 `{{player}}` 与系统提示兜底。
- UI：预设弹窗新增「提示词词条」页（增删、启停、上下移、分隔标记、恢复默认、token 估算、变量快捷插入）与第三个绑定「故事线 / 剧情使用」；设置「一般」页新增玩家档案区块。
- `src/llm.ts`：三处系统提示词拼装改走 `withPresetPrompts(...).system`，变量含 `{{player}}`/`{{char}}`/`{{context}}`；`EMPTY_RUNTIME` 补 `entries`。
- 验收：`tsc -b` 通过；`npm test` 66/66（新增词条往返、变量替换、旧预设迁移与玩家档案 3 例）；`npm run build` 成功（index 459.72 kB）；`node tests/browser.mjs` 37/37（新增词条增删排序与剧情绑定、玩家档案刷新保留 2 组）。
- 截图：`artifacts/preset-entries.png`、`artifacts/player-profile.png`。
### M3 世界书 + 数值规则（2026-10-26）

- 新增 `src/worldbook.ts`：14 条内置词条（6 条默认常驻）、ST 世界书导入导出、`worldbookContext()` 预算装配与命中原因。
- 新增 `src/balance.ts`：10 项平衡数值，世界书页第二个页签直接编辑，保存即生效；接入派遣上限、势力辖区上限、长期委托天数、魔女化阈值。
- `src/llm.ts`：`promptVars()` 现在同时注入 `{{player}}` 与 `{{worldbook}}`；对话与 JSON 链路都会把命中词条以「【世界书】」段追加进 system（若预设词条已引用则不重复）。
- 新增 `src/views/WorldbookView.tsx` + `worldbook.css`：三栏（列表 / 编辑 / 命中预览）、新建 / 删除 / 恢复内置 / 导入导出、预算条、数值页签。
- `Shell`：`Page` 增 `worldbook`，侧栏底部新增 `#open-worldbook`（Library 图标，设置旁），页面标题「先定下这世界的说法。」
- `App`：新增 worldbook 分支与 `PageHeading`。
- 测试：状态 70/70（新增世界书 4 项：内置 14 与常驻 6、关键词命中与预算、ST 往返与字段夹取、数值夹取与上下限修正）；浏览器 38/38（新增「世界书：编辑词条、命中预览、数值规则持久化」）。
- 截图：`artifacts/worldbook-entries.png`、`artifacts/worldbook.png`。
### M4 诊所重做（2026-10-26）

- 删除「快速治疗」与「深度疗养」，统一为按缺失血量计费、按小时线性回血的「治疗」；治疗中 `status='healing'`，派遣/议会/日常全部拒绝，打烊跳日不中断。
- `Treatment` 写入存档（v10），`settleTreatments` 随 `advanceClock` 推进；结束恢复 `idle`，癖好治疗额外给「治疗癖好」特性（羁绊 +4 / 侵蚀 +3，已有则 +6 / +2）。
- 宿舍只负责疲劳恢复（`dormFatiguePerHour × 1.5`，最低 10）并小幅降低侵蚀，不再回血。
- 新增 `ClinicPanel`：只列 `hp < 有效最大生命` 的契约者，头像 + 血条 + 缺失点数 + 价格；`#clinic-kink-<id>` 与普通治疗并列（后改为独立 2 小时疗程，见下方补充）。角色详情页把诊所区块移到成长页全宽位置；房间详情诊所页签与基地快捷面板共用同一组件。
- 验收：`tsc -b` 通过；`npm test` 72/72（诊所计费/回血/癖好特性/宿舍只回疲劳）；`npm run build` 成功（index 480.69 kB）；`node tests/browser.mjs` 39/39（含诊所流程）；截图 `artifacts/clinic.png`。
**M4 补充（同日）**：普通治疗改为 30 分钟一档（`ceil(raw/30)*30`，最少 30、封顶 300 分钟）；「治疗癖好」拆成独立疗程——固定 2 小时、320 星砂、不回血，结束后只提升羁绊 +4 / 侵蚀 +3，不再留下永久特性。`ClinicPanel` 每行改为两个按钮（普通治疗 / 癖好护理），不再用勾选框。诊所的「记忆重塑与复制」「抑制剂与净化」以及宿舍列表都补了 32×38 的头像格（只占一格，`.av-module-face` / `.room-clinic-row`）。
### M5 故事线委托（2026-10-26）

- 数据：`StoryMissionSpec`、`StoryBeat.mission/missionId/status/eventId`、`Mission.storyBeatId/storyGoal`；`GameState` 版本保持 10。
- 逻辑：`storyMissionForBeat` / `spawnStoryBeat` / `completeStoryMission` / `finishStoryEvent`；`startStoryline`、`addStoryline` 立刻发第一幕委托；`syncShift` 与 `closeShift` 对 `storylineId` 的委托豁免过期与清理；`deleteMission` 拒绝故事委托。
- LLM：故事线 schema 每幕必带 `mission`（title/goal 必填），解析后缺目标会拒绝并回落到模板；模板故事线的 goal 为「完成『幕名』：钩子」。
- UI：角色详情的故事面板展示委托卡与「查看这份委托」；`MissionDialog` 增加「故事委托 · 这一幕的明确目标」区块。
- 验收：`tsc -b` 0；`npm test` 74/74（新增「故事线每一幕发布带明确目标的特殊委托」「故事委托完成后生成剧情事件，事件结束才推进下一幕」）；`npm run build` 成功（index 487.33 kB）；`node tests/browser.mjs` 40/40（新增故事线流程，含打烊后委托保留断言）。
- 截图：`artifacts/story-panel.png`、`artifacts/story-mission.png`。
### M6a 剧情注入物（2026-10-26）

- `StoryMissionSpec` 新增 `requiredGirlId`、`companion`、`monsters`、`rewardEquipment`、`followUpIncident`、`followUpEvent`；`Mission` 新增 `requiredGirlId`、`rewardEquipmentId`。
- `storyMissionForBeat` 会先落一位候选者（`sg-*`，保留 7 天）、登记专属魔物进 `customMonsters` 并把委托转为战斗、登记专属装备；`dispatch` 拒绝缺少指定同行者的编队；`completeStoryMission` 发放装备进背包、摆出强制事件，并把 `followUpEvent` 追加成额外场次。
- LLM：故事线 schema 增加上述可选字段，`parseStoryCompanion/parseStoryMonster/parseStoryEquipment/parseStoryFollowUp` 做白名单与夹取；无字段时行为不变。
- UI：委托详情显示「同行 / 专属装备」；故事面板显示注入物标签。
- 验收：`tsc -b` 0；`npm test` 75/75（新增「故事委托可以指定同行者、专属魔物与专属装备」）；`npm run build` 成功（index 495.13 kB）；`node tests/browser.mjs` 40/40。
### M6b 分幕剧情弹窗（2026-10-26）

- 数据：`StoryPassage`、`CharacterEvent.mode='story'`（`passages/passageIndex/chosen/summary/pending`）；动作 `beginStoryEvent` / `chooseStoryPassage`。
- 生成：`generateStoryArc`（4 段、每段 260–520 字、2–3 选项、全文 ≥1200 字，effect 限于 bond/corruption/gold/rep ±6）；无 Key 或不足 900 字时用 `buildTemplateArc` 的四幕模板（约 1100 字）。
- 播放：`StoryPlayerDialog` 左侧立绘与状态、右侧分幕正文与对白、底部选项；选完后自动进入下一幕，末幕写摘要、羁绊 +5、归档并解锁故事线下一幕。
- 入口：故事委托完成 → 生成 `mode:'story'` 事件 + 头像角标 → 详情页 `#dossier-event-enter` → 播放器。
- 验收：`tsc -b` 通过；`npm test` 76/76；browser 41/41（新增分幕剧情流程）；`node node_modules/vite/bin/vite.js build` 成功（index 510.11 kB / gzip 171.45 kB）。
- 截图：`artifacts/story-player.png`、`artifacts/story-player-end.png`。
- 备注：`npm run build`（tsc + vite 包装脚本）在本机沙箱下偶发 esbuild 空错误，直接调用 `node_modules/vite/bin/vite.js build` 可绕过。