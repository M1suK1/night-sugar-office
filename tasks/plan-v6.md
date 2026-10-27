# 夜糖事务所 v6 方案：长期委托、空白档案、魔女立绘、故事线、议会、辖区、角色事件

基线：`main` @ v5/v6 完成态（存档 v8，51 项状态测试、32 组浏览器流程）。
本方案只描述**要做什么、改哪里、怎么验证**；不改变既有非目标（无后端、无账号、无支付、战斗不可手动干预）。

---

## 0. 总览

| # | 需求 | 一句话方案 | 主要新增 |
| --- | --- | --- | --- |
| 1 | 长期任务 2–7 天、跨日保留 | `long` 委托改为按「业务日」计的天级窗口，打烊不再清场 | `Mission.longDays`、`closeShift`、`shift.ts` |
| 2 | 全空档案 + `.cmd` 启动器 | 新开局模式：空事务所 + 启动资金；`start.cmd` 一键起服 | `createBlankState`、`StartDialog`、`start.cmd` |
| 3 | 衣柜里的魔女化立绘 | 衣柜第 5 格「魔女形态」，侵蚀 ≥ 40 解锁，可导入/描述 | `Girl.witchForm`、`WardrobeDialog`、`GirlPortrait` |
| 4 | 角色故事线框架 | 详情页按钮触发 LLM 生成 4 幕故事线，逐幕解锁内容 | `Storyline`、`generateStoryline`、`StorylineTab` |
| 5 | 独立议会界面 | 独立页面：左状态 / 中立绘 / 右助手 / 下议题，含会客厅背景 | `CouncilView`、`CouncilBackdrop`、`council` 页 |
| 6 | 强制决策弹窗事件 | 三方要求 / 环境异变 / 少女状态，阻塞推进直到选择 | `Incident`、`IncidentDialog`、每日 LLM 生成 |
| 7 | 自定义特性 + 立绘提示 | 特性改为手写三项；立绘生成增加一句话参考 | `GirlDraft.traits`、`portraitHint`、profile schema |
| 8 | 三方势力辖区 | 9 个辖区开局随机归属三方，玩家选择可易主 | `territories`、`setTerritory`、地图着色 |
| 9 | 议会切换演出 | 决议后中间立绘淡出、下一位进场，左栏状态同步刷新 | `CouncilView` 状态机、CSS 过渡 |
| 10 | 特殊角色事件 | 详情页进入，剧情由故事线指引、LLM 编排全篇，头像加角标 | `CharacterEvent`、`CharacterEventDialog` |
| 11 | 故事线联动 | 选项可触发任务/决议/对话/角色事件/弹窗/易主 | `StoryTrigger`、`applyStoryTrigger` |
| 12 | 立绘去背景 | 本地键控抠图，容差可调、可撤销 | `src/image.ts`、立绘页按钮 |

存档从 **v8 → v9**，全部新增字段可缺省，旧档自动补齐。

---

## 1. 长期委托：2–7 天、跨日保留

### 现状
- `shift.ts`：`deadlineFor(kind, day, spawnedAt)`，`long` = 当晚打烊 `02:00`。
- `game.ts:546 closeShift()` 只保留 `done | active`，隔夜后**所有未接委托清空**；`syncShift` 再按 `deadlineAt` 标记过期。
- 结果：每晚 20:00 放号、02:00 全清，地图上长期委托没有「长期」感。

### 设计
- `Mission` 增加 `longDays?: number`（2–7）。`window === 'long'` 时：
  - `longDays = 2 + hash(day, wave, slot) % 6`；
  - `deadlineAt = shiftCloseAt(day + longDays - 1)`，即「第 N 天放号，第 N+longDays-1 天 02:00 截止」；
  - 奖励随天数增长：`reward = round(base * (0.9 + 0.22 * longDays))`；`target += (longDays - 2) * 2`。
- `closeShift()`：保留 `status === 'done'`、`'active'`，以及**未过期的 `long` 且 `status === 'open'`**；只清 `urgent` 与已过期的。
- `syncShift()` 不变（它已按 `deadlineAt` 判过期），但过期日志区分「长期委托到期」。
- `dispatch`：长期委托在任意夜晚都可接下；接下后按 `duration` 正常占用，跨夜不打断。
- **已接下的委托跨夜**：`endNight` 不会重置 `status === 'active'` 的编队与 `remaining`，少女保持 `mission` 状态；下一晚开门后继续扣时间、到点结算。现有规则没有「中途撤回」，长委托因此需要玩家自己估编队强度。
- `windowNote.long` 文案改为「2–7 天内有效，可跨夜保留」。
- 展示：
  - `missionDeadlineLabel` 增加天级文案：> 24h 显示 `剩 3 天`，< 24h 仍显示 `剩 5 小时`；
  - 地图图钉 `pin-deadline` 显示 `长期 · 剩 4 天`；
  - 列表筛选 `long` 单独一类；
  - `MissionDialog` 显示「截止：第 18 日 02:00」。
- 上限：地图上同时存在的 `long` 委托 ≤ 8，超出时放号跳过并在日志说明，避免长期委托堆积。

### 兼容
- 迁移 v8→v9：已有 `long` 委托补 `longDays = 2`，`deadlineAt` 重算为「放号日 + 1 天」；`urgent` 不动。

### 测试
- 长期委托在 `endNight` 后仍在且 `status === 'open'`；
- 到达 `deadlineAt` 后变 `expired`；
- 紧急委托仍在当晚打烊清场；
- `longDays` 落在 2–7，奖励随天数单调增长。

---

## 2. 全空档案 + `.cmd` 启动器

### 2.1 空白档案
- 新增 `createBlankState(): GameState`：
  - `version: 9`、`day: 14`、`minutes: 20:00`、`gold: 6000`（启动资金）、`reputation: 0`；
  - 无少女、无候选、无委托、无数值生成内容；
  - 房间只有 `会客厅 lv1`（诊所/宿舍/星象台需自行扩建）；
  - 势力声望全 0、`shift { day: 14, wave: 0 }`、`blank: true`；
  - 首条日志：「事务所只剩一张桌子和六千星砂。今晚开始，名字要自己填。」
- `GameState.blank?: boolean`，用于空态引导：
  - 名册为空 → 「还没有契约者。去市场登记，或用 300 星砂撰写一份新契约。」
  - 地图无委托 → 「今晚还没有信号。推进时间，或让叙事者生成一夜。」
- 开局选择：无存档时显示 `StartDialog`（两张卡）：**标准开局**（现有 7 委托 + 4 人）/ **空白档案**（只有启动资金）。两卡都需二次确认；确认后写入 `SAVE_KEY` 并进入游戏。
- 设置页新增「以空白档案重开」入口（走现有 `ResetDialog` 的确认模式）。
- 空白档案不降低任何门槛，但需要一条合法的第一条契约路径：`createGirl` 的 `reputation ≥ 40` 检查在 `blank === true` 时放行（只在空白档案里生效），并保留 300 星砂登记费；等安定度涨到 40 之后行为与标准档一致。

### 2.2 `start.cmd`
- 仓库根新增 `start.cmd`（Windows，ASCII 文件名，内容 UTF-8 + `chcp 65001`）：
  1. `cd /d "%~dp0"`；
  2. 检查 `node`（提示需要 Node 20+）；
  3. `node_modules` 不存在时执行 `npm install`；
  4. 后台 `start "" http://127.0.0.1:5173` 打开浏览器；
  5. `call npm run dev`，退出后 `pause`。
- 附 `start-prod.cmd`（可选）：`npm run build` 后用新增的 `scripts/serve.mjs`（提交进仓库，纯 `node:http` 静态服务器，`.tmp/serve.mjs` 只是它的临时副本）起 `dist`，适合不装开发依赖的机器；端口同为 5173。
- README 增加「双击 start.cmd」的启动说明；`.gitignore` 不忽略 `.cmd`。

### 测试
- Node 测试：`start.cmd` 存在且包含 `npm run dev` 与 `node_modules` 检查；
- 状态测试：`createBlankState()` 无少女/无委托、金币 6000、安定度 0、`blank === true`；空白档案下 `createGirl` 不受安定度 40 限制，扣 300 星砂后候选 +1。
- 浏览器：清空存档后进入 `StartDialog`，选择空白档案 → 首页显示空态引导。

---

## 3. 衣柜中的魔女化立绘

### 设计
- `Outfit` 增加 `form?: 'normal' | 'witch'`（缺省 `normal`）。
- `Girl` 增加 `witchForm?: Outfit`（`id: 'witch'`、`form: 'witch'`、`name: '魔女形态'`）；**不计入四格上限**。
- 解锁条件：`girl.corruption >= 40 || girl.witch`；未解锁时格子显示「侵蚀 40 解锁」，不可选。
- 衣柜 UI（`CharacterDialog` 外观页 + `WardrobeDialog`）：四格之后新增第 5 格：
  - 已解锁且已有立绘：显示缩略图，点击 `#dossier-outfit-witch` 切换；
  - 已解锁未设置：显示「导入魔女立绘」；
  - 未解锁：灰格 + 进度（`侵蚀 37 / 40`）。
- `GirlPortrait`：
  - `outfitId === 'witch'` 时优先用 `girl.witchForm.portrait`；
  - 无图时走程序化 SVG，使用 `witch` 配色（暗红/紫黑）并叠加角、裂光、逆光环；
  - 普通形态保持现状。
- `changeOutfit` 接受 `'witch'`；`GirlCard` 导出/导入带 `witchForm`；`WardrobeDialog` 支持只为魔女形态导入（不影响四格）。
- LLM 只写**文字描述**（不生成图片）：`generateWitchForm(girl)` 输出 `description`、`palette`、`motifNote`，失败时用模板。

### 测试
- 侵蚀 < 40 时不可切换、≥ 40 可切换；
- 切换后 `outfitId === 'witch'`，`GirlPortrait` 选到 `witchForm.portrait`；
- 导入衣柜不会把魔女格算进四格上限。

---

## 4. 角色故事线框架（LLM 编写）

### 数据
```ts
interface StoryEffect {
  gold?: number; reputation?: number; bond?: number; corruption?: number;
  trait?: { name: string; description: string };
  trigger?: StoryTrigger;   // 见 §11
}
interface StoryChoice { id: string; label: string; intent: string; effect: StoryEffect }
interface StoryBeat {
  id: string; index: number; title: string; summary: string; scene: string;
  hook: string; choices: StoryChoice[]; resolvedChoiceId?: string; resolvedAt?: string;
}
interface Storyline {
  id: string; girlId: string; title: string; premise: string; tone: string;
  beats: StoryBeat[]; stage: number; status: 'active' | 'done' | 'abandoned';
  createdAt: string; day: number; source: 'llm' | 'template';
}
```
- `GameState.storylines: Storyline[]`（每名少女最多 1 条进行中）。

### 生成
- 详情页新增 tab「故事线」，首次进入显示按钮 `#dossier-story-start`「开启角色故事线」。
- 点击 → 二次确认（说明会消耗一次模型调用）→ `generateStoryline(config, prompts, { girl, state, direction? })`：
  - 输入：姓名/称号/元素/职阶、`personality/appearance/goal/traits/scars`、最高羁绊对象、侵蚀、当前势力声望、当前日期；
  - 可选 `direction`：玩家一句话方向（也可留空）；
  - 输出 schema：`title`、`premise`、`tone`、`beats[4]`（每幕：`title/summary/scene/hook/choices[2–3]`）；
  - 校验：3–5 幕、每幕 2–3 个选项、单段 ≤ 220 字、总长 ≤ 4000 字；不合法时截断/补模板；
  - 失败或无 API Key：使用本地模板生成（按元素/职阶选 4 幕），标记 `source: 'template'`。
- 调用自动进入叙事引擎控制台（请求分段、思维链、usage）。

### 推进
- 每幕在以下时机推进：关联委托 `done`、`endNight` 结算、或玩家在故事线页点「推进下一幕」。
- 玩家选择通过 `decideStoryChoice { storylineId, beatId, choiceId }` 应用 `effect`：
  - 资源/羁绊/侵蚀直接结算；
  - `trait` 写入 `girl.traits`；
  - `trigger` 交给 §11 的分发器（任务/决议/事件/对话/弹窗/易主）。
- 4 幕结束：`status: 'done'`，奖励一次性 trait + 编年史条目；若期间侵蚀 ≥ 80，结局改写为「魔女化前夜」，解锁魔女形态立绘格。

### UI
- 详情页 tab：幕列表（已完成/当前/未解锁）、当前幕正文、选项按钮 `#story-choice-<id>`、生成状态与「重新生成」（仅在未开始时可用）。
- 地图与日志：故事线委托加 `storyline` 角标；完成时写编年史。

### 测试
- 无故事线时按钮可见；生成后 `storylines.length === 1`、4 幕；
- 选择选项后资源/特性生效且该幕 `resolvedChoiceId` 落库；
- 第 4 幕结束 `status === 'done'`；
- 重复点击「开启」不会生成第二条。

---

## 5. 独立议会界面

### 入口
- `Page` 增加 `'council'`，侧栏新增 `#nav-council`（Users 图标，未决议题数角标）。
- `BaseView` 会客厅模块顶部加按钮 `#enter-council`「进入议会」；`RoomDialog` 的 `council` tab 改为跳转按钮。

### 布局（桌面）
```
┌───────────────────────────────────────────────────────────┐
│ 会客厅背景（SVG：沙发、落地灯、雨窗、地毯）                 │
│ ┌─────────┐   ┌──────────────────┐   ┌──────────────────┐ │
│ │ 左：状态 │   │ 中：提出者立绘     │   │ 右：助手立绘      │ │
│ │ Lv/HP/SP │   │ 姓名 / 称号       │   │ 助手备注          │ │
│ │ 疲劳/侵蚀│   │ 所属势力 · 占区数  │   │ 未任命占位        │ │
│ │ 势力声望 │   │                  │   │                  │ │
│ └─────────┘   └──────────────────┘   └──────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ 议题标题 / 正文 / 请求 / 三个选项 / 已决记录           │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```
- 左栏：提出者的等级、HP/SP 条、疲劳、侵蚀、与助手关系、所属势力占区数、待议数。
- 中栏：`GirlPortrait variant="full"`，脚下名牌 + 议题所属 `topic`。
- 右栏：`assistantId` 对应少女的 `GirlPortrait`；未任命时显示空椅与「任命一位值班助理」。
- 下方：`opinion.text`、`opinion.request`、`assistantNote`、三个选项按钮 `#council-option-accept/defer/reject`，键盘 1/2/3；决策后走 §9 的切换演出。
- 背景 `CouncilBackdrop.tsx`：纯 SVG（沙发、灯、窗、雨线、地毯），`prefers-reduced-motion` 下停止雨动画；CSS 变量沿用现有 token。
- 决议历史：右下列表显示本夜已决条目与结果。

### 测试
- 浏览器：`#nav-council` 进入 → 三栏可见 → 选择「批准」→ 资源变化、历史 +1；
- 移动端 390px：三栏纵向堆叠无横向溢出；
- 议会页可处理全部 pending，处理完显示结束态。

---

## 6. 强制决策弹窗事件（Incident）

### 数据
```ts
interface IncidentOption { id: string; label: string; hint: string; effect: IncidentEffect }
interface IncidentEffect {
  gold?: number; reputation?: number;
  faction?: { id: FactionId; standing: number };
  girl?: { fatigue?: number; spirit?: number; corruption?: number; bond?: number };
  district?: { id: DistrictId; targetPct?: number; rewardPct?: number; untilDay: number };
  territory?: { id: DistrictId; faction: FactionId };   // 见 §8
  mission?: string;
}
interface Incident {
  id: string; day: number; kind: 'faction' | 'environment' | 'girl';
  source: 'llm' | 'rule'; title: string; body: string;
  faction?: FactionId; girlId?: string; district?: DistrictId;
  options: IncidentOption[]; status: 'pending' | 'resolved';
  choiceId?: string; resolvedAt?: string;
}
```
- `GameState.incidents: Incident[]`；`pendingIncident` = 第一条 `pending`。

### 触发
1. **每日 LLM**：`generateDaily` schema 增加 `incident` 块（kind/title/body/2–3 options/effects），每晚最多 1 条；
2. **规则触发**（保证没有 API Key 也有事件）：
   - 势力来使日且声望 < 30：三方之一提出要求（交钱/接委托/让出辖区）；
   - 22:00 放号时环境异变：某辖区当晚 `targetPct +8` 或 `rewardPct -10`；
   - 少女侵蚀 ≥ 60 或疲劳 ≥ 90：状态事件（休息/用药/硬撑）。
- 每晚上限 3 条；同类不重复。
- 辖区事件优先指名**当前归属势力**，选项里可以「交出辖区 / 用钱摆平 / 拒绝」，直接调用 §8 的 `setTerritory`。

### 阻塞
- `advance` 与 `endNight` 在存在 pending incident 时返回失败：「先处理会客厅里的紧急事件。」（自动推进同样停住）。
- `IncidentDialog`：
  - `Dialog` 增加 `blocking` 参数（隐藏关闭按钮、忽略 Esc/遮罩点击）；
  - 顶部显示来源（势力徽记/辖区名/少女头像）、标题、正文；
  - 2–3 个选项按钮 `#incident-option-<id>`，每个显示后果预览；
  - 选定后 `resolveIncident` 应用效果，写日志 + 编年史，队列下一条。
- App 层：`pendingIncident` 存在时自动打开且不可关闭；选择完成后才允许推进。

### 测试
- pending 时 `advance` 失败、`endNight` 失败；
- 解决后效果落地、`status === 'resolved'`；
- 规则触发：侵蚀 ≥ 60 的少女在换日时产生 `girl` 类事件；
- LLM 返回非法 schema 时丢弃该条，不影响当晚其他内容。

---

## 7. 自定义魔法少女：自定义特性 + 立绘提示

### 7.1 特性改为「手写」
- `GirlDraft.traits` 从 `string[]`（内置 id）改为：
```ts
traits: { name: string; description: string; polarity: TraitPolarity }[]
```
- `CustomGirlDialog` 步骤 3：
  - 三个特性槽，每槽 `名称` + `描述` 输入（`#custom-trait-name-<i>` / `#custom-trait-desc-<i>`）；
  - 保留内置特性 chips 作为「快速填充」，点击填入槽位，仍可改字；
  - 校验：3 项都需非空名称，描述 ≤ 60 字。
- `createGirl`：不再 `traitById.get(id)`，直接构造 `Trait { id: 'tr-'+hash, name, description, polarity, tags: [] }`，上限仍 3。
- 旧存档无影响（Girl.traits 已是对象数组）。

### 7.2 立绘提示（portraitHint）
- `GirlDraft.portraitHint?: string`、`Girl.portraitHint?: string`、`GirlCard.girl.portraitHint?: string`。
- `CustomGirlDialog` 步骤 4 增加输入 `#custom-portrait-hint`：「一句话描述你想要的立绘（发色、姿态、气质……）」，≤ 60 字。
- `generateGirlProfile(config, prompts, portrait?, preset?, hint?)`：把 hint 作为 `视觉参考` 注入 system prompt，并写入输出 `portraitHint`。
- 特性生成：schema 改为 `traits: [{ name, description, polarity }]`，提示词要求「根据立绘与气质**新写**三条特性，不要从既有列表挑选」；解析时保留顺序、去重、截断 3 条。
- UI：生成后三个特性槽直接填入，可逐条「重写这一项」。
- 立绘本身仍由玩家导入（当前无图像生成接口）；hint 同时用于未来接入绘图 API 的 `prompt` 字段。

### 测试
- `createGirl` 接受手写特性并写入 `girl.traits`；
- profile schema 解析手写特性（非 id）；
- `portraitHint` 进入请求快照（可在 `requestSnapshot` 断言中看到）。

---

## 8. 三方势力辖区（新）

### 数据
```ts
type TerritoryOwner = FactionId;                       // 'witch' | 'association' | 'government'
// GameState
territories: Record<DistrictId, TerritoryOwner>;        // 9 个辖区，每格必有所属
```
- 玩家侧另有一个派生视图 `territoryCounts(state)`（三方各占几区），用于图例与议会左栏。

### 开局分配
- `assignTerritories(seed: string): Record<DistrictId, FactionId>`：
  - 以 `seed` 打乱 9 个辖区，前三给 `witch`、中三给 `association`、后三给 `government`；
  - 标准档 seed = `packHash`；空白档 seed = `'blank'`；两者都**不要求连通**，允许飞地；
  - 开局面板显示「本局版图：月蚀 3 · 星灯 3 · 市役所 3」。
- `createInitialState` / `createBlankState` 末尾调用 `assignTerritories`。

### 势力对辖区的影响
辖区效果 = `districts.ts` 的环境效果 **+** 归属势力层（在 `annotateMission` 与 `DistrictPanel` 里合成，不写进静态 `District.effect`）：

| 归属 | 额外修正 | 理由 |
| --- | --- | --- |
| 月蚀（witch） | `targetPct +6`、`rewardPct +12` | 怪物活跃，赏金高、风险高 |
| 星灯（association） | `rewardPct +8`、`fatigueFlat +2` | 公会买单，但排班更累 |
| 市役所（government） | `targetPct -4`、`reputationFlat +1` | 治安支援，收益稳定 |

- `effectiveDistrictEffect(state, districtId): DistrictEffect`：合并环境 + 势力；`effectLines` 增加来源标签（「月蚀辖区」）。
- **已放出的委托不追溯**：易主只影响之后 `annotateMission` 的新委托；地图面板即时显示新修正。这条写进 UI 提示，避免玩家误解。

### 易主
- `setTerritory(state, districtId, faction, source)`：改归属、写日志（「月蚀接管了玻璃温室」）、写编年史、toast。
- 触发来源（四处，全部走同一函数）：
  1. `IncidentEffect.territory`（§6）——势力当面索要；
  2. `OpinionOption.shift?: { district, faction }`（§5 议会）——议员提案把辖区交给某方；
  3. `StoryEffect` 的 `territory` 触发器（§11）；
  4. 完成某势力的使节委托：接下的 envoy 委托 `done` 时，该势力取得委托所在辖区（原属他人则易主）。
- 平衡：同一势力占区上限 5；超过时易主改为「索要金钱」，避免一局被单方吞完。

### UI
- 地图 `district-fill` 按归属着色（月蚀紫 `#a06bd8`、星灯粉 `#f3aec9`、市役所青 `#7fc8c0`，透明度 10–14%），悬停加深；新增 `district-owner` 徽记（小圆点 + 首字）。
- 地图底部图例 `#faction-legend`：三个 chip，显示「月蚀 3」并随易主更新；点击 chip 只高亮该势力辖区（筛选，不是导航）。
- `DistrictPanel` 头部加一行「势力 · 月蚀（3 区）」，效果列表分「环境」「势力」两段。
- 记录页新增「版图变迁」条目（最近 10 次易主）。
- 详情/议会无需显示，避免信息过载。

### 迁移
- 旧档无 `territories`（或某辖区缺键）→ `assignTerritories(packHash + day)` 确定性补齐；已有键保留。

### 测试
- 标准档初始 3/3/3 且 9 键齐全；
- `setTerritory` 改变归属并写日志；同一势力 > 5 区时被拒绝；
- `effectiveDistrictEffect` 把势力层叠加进 target/reward；
- 使节委托完成 → 辖区易主；
- 浏览器：点 `#faction-legend` chip → 高亮数 = 该势力区数。

---

## 9. 议会切换演出（新）

### 目标
决议选定后，中间议员不是「瞬间换人」：先淡出、左栏数字跟着刷新、下一位从下方淡入。整段 ≤ 700ms，不阻塞输入超过 400ms。

### 状态机（`CouncilView` 内）
```ts
type Phase = 'idle' | 'leaving' | 'entering';
// refs: timer, decidedRef 防止双击重复决议
```
1. 点击选项 → 立即 `disabled` 全部选项，`phase = 'leaving'`：
   - `.council-speaker` 加 `.leaving`：`opacity .32 → 0`、`translateY(0 → 10px)`、`filter: blur(0 → 3px)`，320ms `ease-in`；
   - `.council-topic`、`.council-options` 同步淡到 0.25；
   - 助手立绘保持（它是旁观者，不换人）。
2. 320ms 后：`dispatch('decideOpinion')` → 取新的 `pendingOpinions[0]`：
   - 有下一位：`phase = 'entering'`，key 换成新 `opinion.id`，`.council-speaker` 加 `.entering`（`opacity 0 → 1`、`translateY(-8px → 0)`，260ms）；
   - 无下一位：中间换成 `#council-empty`「今晚的议事结束了」（淡入），选项区隐藏。
3. 左栏 `.council-stats` 的数值用 React 重渲染 + CSS `transition: color/width 240ms`：HP/SP 条宽度、疲劳/侵蚀/声望数字变化时加一次 `.flash`（背景高亮 400ms 后移除）。
4. `phase` 回到 `idle`；历史列表新增一条（滑入）。

### 细节
- 计时器存 `useRef`，组件卸载/切换议题时 `clearTimeout`；
- `prefers-reduced-motion: reduce` → 所有时长 0，直接切换（不显示 leaving 类）；
- 键盘 1/2/3 在 `leaving` 期间忽略；
- 助手 `assistantNote` 随议题交叉淡入（160ms），避免文字闪跳。

### 测试
- 浏览器：选「批准」后 50ms 内 `.council-speaker.leaving` 存在；400ms 后 `.council-speaker.entering` 或 `#council-empty` 存在；
- 左栏 `#council-左栏疲劳值` 文本在新议题后变化（选一条会改疲劳的议题作为夹具）；
- 连点两次只产生一条决议记录；
- reduced-motion 下不出现 `.leaving`（可直接断言最终状态）。

---

## 10. 特殊角色事件（新）

### 定位
故事线负责「指引」，角色事件负责「完整的一幕戏」：3 个场景、对白、玩家选择、结算。由玩家主动从详情页进入，触发后在头像上加角标提醒。

### 数据
```ts
interface EventLine { speaker: string; tone?: string; text: string }
interface EventScene {
  id: string; title: string; narration: string;
  lines: EventLine[]; choices?: StoryChoice[];   // 复用 StoryChoice/StoryEffect
}
interface CharacterEvent {
  id: string; girlId: string; storylineId?: string;
  title: string; hook: string; scenes: EventScene[];
  stage: number; status: 'active' | 'done' | 'abandoned';
  day: number; source: 'llm' | 'template'; badge: boolean;
}
```
- `GameState.events: CharacterEvent[]`（保留最近 12 条，`done` 可裁剪）；
- `Girl.eventBadge?: boolean`（派生也可，但显式字段便于迁移与角标计数）。

### 进入与角标
- `CharacterDialog` 概览页新增按钮 `#dossier-event-enter`：
  - 有 `active` 事件 → 「进入角色事件 · {title}」；
  - 无事件 → 灰按钮「暂无特殊事件（推进故事线后出现）」。
- 角标：`.event-badge`（粉色圆点 + Sparkles）叠加在：
  - 名册 `Roster` 头像右上角；
  - 详情页头像右上角；
  - 顶栏通知铃旁（有事件时 +1，点击跳名册）。
- 进入后 `CharacterEventDialog` 打开；关闭不丢进度（`stage` 落库）。

### LLM 编排
- `generateCharacterEvent(config, prompts, { girl, storyline, state })`：
  - system：故事线 `premise`、当前幕 `summary/scene/hook`、少女性格/外观/羁绊/侵蚀、最近 5 条日志；
  - 输出 schema：`title`、`hook`、`scenes[3]`（每场 `title/narration ≤ 180 字/lines 2–4 条/最后一场 choices 2–3 个）；
  - 校验：场景数 3、行数、字数上限；不合法丢弃并重试 1 次，仍失败用模板（按元素生成 3 场）。
- 生成入口：故事线选项的 `event` 触发器（§11），以及侵蚀 ≥ 60 / 羁绊 ≥ 80 的规则触发（每晚最多 1 条）。
- 调用进叙事引擎控制台，带「角色事件」kind。

### 演出
- `CharacterEventDialog`：全屏 `.event-stage`（会客厅/街区渐变背景 + 暗角），左侧立绘、中央旁白与对白、右下「继续」。
- 对白逐条显示（点击/空格），当前行高亮，已读行降低透明度；场景标题在顶部 `场景 1 / 3`。
- 最后一场出现 2–3 个选项（`#event-choice-<id>`）；选择后应用 `StoryEffect`，事件 `done`、徽标清除、写编年史、故事线推进 1 幕。
- `Esc` 可中途退出（不结算），下次从 `stage` 恢复；`prefers-reduced-motion` 下取消淡入。

### 测试
- 创建事件后 `girl.eventBadge === true`，名册出现 `.event-badge`；
- 进入后逐行推进，`stage` 落库；关闭重开回到同一场；
- 完成最后选择 → `status === 'done'`、角标消失、资源变化；
- 故事线第 2 幕的 `event` 触发器会生成事件并设置角标。

---

## 11. 故事线联动（新）

### 触发器
```ts
type StoryTrigger =
  | { kind: 'mission'; title: string; description: string; district?: DistrictId; duration?: number }
  | { kind: 'opinion'; topic: Opinion['topic']; title: string; text: string; request: string;
      shift?: { district: DistrictId; faction: FactionId } }
  | { kind: 'incident'; title: string; body: string; kind2: Incident['kind']; options: IncidentOption[] }
  | { kind: 'event'; title: string; hook: string }
  | { kind: 'dialogue'; topic: string; prompt: string }
  | { kind: 'territory'; district: DistrictId; faction: FactionId };
```
- `StoryEffect.trigger?: StoryTrigger`；每个选项最多 1 个触发器。
- LLM schema 里 `trigger` 用 `kind` 判别；不认识的 kind 丢弃（不阻断选项本身）。

### 分发（`applyStoryTrigger(state, girl, storyline, trigger)`）
| kind | 落地 |
| --- | --- |
| `mission` | `makeStoryMission` → 地图新增委托，带 `storylineId` 与「故事线」角标，奖励按辖区计算 |
| `opinion` | 追加到 `opinions`（pending），议会页 `#nav-council` 角标 +1 |
| `incident` | 生成 blocking 事件（§6），立即阻塞推进 |
| `event` | 生成 `CharacterEvent`（§10），设置 `girl.eventBadge` |
| `dialogue` | `girl.pendingTalk = { topic, prompt, day }`：名册与详情页出现「有话想说」角标，`TalkDialog` 预载 prompt，聊完清除 |
| `territory` | `setTerritory`（§8），日志 + 编年史 |

### 约束
- 同一晚最多 1 条故事线触发任务、1 条决议、1 条事件、1 条对话、1 条弹窗；超出降级为资源效果并记录「延后到下一夜」。
- 触发器生成的实体都带 `sourceStorylineId`，便于测试与清理。
- 选项按钮下显示后果预览（图标 + 一句话），避免玩家盲选。

### 测试
- `mission` 触发器 → `missions` 有新项且 `storylineId` 正确；
- `opinion` 触发器 → `opinions` pending +1；
- `incident` 触发器 → `advance` 被拒；
- `dialogue` 触发器 → `girl.pendingTalk` 且名册出现角标；
- `territory` 触发器 → 归属变化；
- 超限时降级且日志说明。

---

## 12. 立绘去背景（新）

### 目标
导入的立绘常带纯色/渐变背景。提供一个**本地、无依赖、可撤销**的简单抠图：只去掉与图片边缘连通的背景色，保留主体内部的同色区域（白衬衫不会被吃掉）。

### 算法（`src/image.ts`）
```ts
export interface CutoutOptions { tolerance?: number; maxEdge?: number; feather?: boolean }
export async function removeImageBackground(source: HTMLImageElement, options?: CutoutOptions): Promise<{ dataUrl: string; removedRatio: number }>
```
1. 画到 `maxEdge`（默认 1600）内的 canvas，取 `ImageData`；
2. 采样四边像素，取出现频率最高的颜色作为背景色（角点优先）；
3. 从所有边缘像素做 BFS 洪水填充，颜色距离（RGB 欧氏）≤ `tolerance`（默认 36）的像素标记透明；
4. 只在「与边缘连通」的区域内扩散 → 主体内部同色区域保留；
5. `feather` 开启时，对被移除像素相邻的保留像素把 alpha 降到 180，避免锯齿；
6. 输出 PNG dataURL（保留原尺寸比例）。

性能：1600×2000 ≈ 3.2M 像素，用 `Uint8ClampedArray` + 队列，单次 < 400ms；超过 12MB 的图先拒绝（沿用现有校验）。

### UI（`CustomGirlDialog` 第 5 步「立绘」）
- 按钮 `#custom-cutout-run`「一键去背景」；容差滑杆 `#custom-cutout-tolerance`（12–90，默认 36）；
- `#custom-cutout-undo`「撤销」：回到去背景前的 source；
- 预览容器加 `.checker` 棋盘格底，透明区域可见；
- 提示文案：「适合纯色/渐变背景；发丝和复杂背景会留下边缘。」
- 去背景后的 dataURL 继续走现有 4:5 裁剪（`cropToDataUrl`），最终随 `portrait` 存档。
- 顺手把 `cropToDataUrl` 从 `src/components/CustomGirlDialog.tsx:18` 抽到 `src/image.ts`，去背景与裁剪共用同一份实现（行为不变，现有浏览器流程应继续通过）。
- 复用：`WardrobeDialog` 导入图片时同样显示这两个按钮（共用 `image.ts`）。

### 测试
- 单测（canvas 不可用则跳过）：构造 400×500 白底 + 中央红方块，`removeImageBackground` 后角点 alpha 0、中心 alpha 255、`removedRatio` 在 0.5–0.95；
- 容差 12 时渐变背景只去掉最外圈（removedRatio 更小）；
- 浏览器：导入白底 fixture → 点 `#custom-cutout-run` → 预览 canvas 角点透明 → `#custom-cutout-undo` 恢复；
- 无 `canvas` 环境（Node）时测试用 `ctx === null` 直接 skip，不阻塞套件。

---

## 13. 存档与迁移

- `GameState.version: 9`；新增字段：`incidents: Incident[]`、`storylines: Storyline[]`、`events: CharacterEvent[]`、`territories: Record<DistrictId, FactionId>`、`blank?: boolean`。
- `Girl` 新增 `witchForm?: Outfit`、`portraitHint?: string`、`eventBadge?: boolean`、`pendingTalk?: { topic: string; prompt: string; day: number }`。
- `Mission` 新增 `longDays?: number`、`storylineId?: string`。
- `loadState` 白名单加 9；`< 9` 迁移：
  - `incidents ??= []`、`storylines ??= []`、`events ??= []`；
  - `territories` 缺键 → `assignTerritories(packHash + day)` 补齐；
  - `long` 委托补 `longDays = 2` 并重算 `deadlineAt`；
  - `blank ??= false`。
- `importState` 接受 `[1,3,4,5,6,7,8,9]`。
- 体积：故事线 ≤ 1 条/人、事件 ≤ 12 条、事件 ≤ 20 条历史、易主日志 ≤ 10 条；超出裁剪，避免存档膨胀。

---

## 14. 文件改动表

| 文件 | 改动 |
| --- | --- |
| `src/types.ts` | `Outfit.form`、`Girl.witchForm/portraitHint/eventBadge/pendingTalk`、`Mission.longDays/storylineId`、`Incident*`、`Storyline*`、`CharacterEvent*`、`StoryTrigger`、`territories`、`GirlDraft.traits` 结构、`GameState.version 9`、新 action |
| `src/territories.ts`（新） | `assignTerritories`、`setTerritory`、`effectiveDistrictEffect`、`territoryCounts`、势力配色 |
| `src/image.ts`（新） | `removeImageBackground`、`resizeImage`、`cropToDataUrl` 迁移 |
| `src/shift.ts` | `deadlineFor` 支持 `longDays`、`remainingLabel` 天级文案 |
| `src/game.ts` | `createBlankState`、`closeShift` 保留 long、`makeCommission` 天级窗口、`resolveIncident`、`startStoryline/decideStoryChoice`、`applyStoryTrigger`、`startCharacterEvent/advanceEvent/resolveEvent`、`createGirl` 手写特性、迁移、`advance/endNight` 阻塞、使节委托易主 |
| `src/llm.ts` | `generateStoryline`、`generateCharacterEvent`、`generateWitchForm`、`generateDaily.incident`、profile schema（traits/portraitHint）、请求快照标签 |
| `src/App.tsx` | `StartDialog`、`council` 页、`IncidentDialog` 自动弹出、`CharacterEventDialog` 路由、故事线动作接线、空白档案入口 |
| `src/views/CouncilView.tsx`（新） | 议会三栏 + 背景 + 决议 + 切换状态机 |
| `src/components/CouncilBackdrop.tsx`（新） | 会客厅 SVG |
| `src/components/IncidentDialog.tsx`（新） | 强制决策弹窗 |
| `src/components/StorylineTab.tsx`（新） | 故事线幕列表与选项 |
| `src/components/CharacterEventDialog.tsx`（新） | 角色事件演出 |
| `src/components/StartDialog.tsx`（新） | 标准/空白开局选择 |
| `src/components/CharacterDialog.tsx` | 故事线 tab、事件入口、魔女格入口 |
| `src/components/WardrobeDialog.tsx` | 魔女形态第五格、导入去背景 |
| `src/components/CustomGirlDialog.tsx` | 手写特性、portraitHint、去背景 |
| `src/components/GirlPortrait.tsx` | 魔女形态渲染 |
| `src/components/Roster.tsx` | 事件角标、有话想说角标 |
| `src/components/Shell.tsx` | `council` 导航 |
| `src/components/Dialog.tsx` | `blocking` 参数 |
| `src/views/AuxViews.tsx` | 会客厅「进入议会」按钮、空态引导、版图变迁 |
| `src/map.css` / `src/components/DispatchMap.tsx` | 势力着色、图例、所属徽记、`DistrictPanel` 势力段 |
| `src/cards.ts` | 卡片带 `witchForm/portraitHint` |
| `src/views/council-view.css`（新） | 议会布局、演出、移动端 |
| `start.cmd` / `start-prod.cmd`（新） | 启动器 |
| `scripts/serve.mjs`（新） | 生产预览用的静态服务器（`start-prod.cmd` 依赖） |
| `README.md`、`tasks/plan-v6.md`、`tasks/todo.md` | 文档与清单 |

---

## 15. 里程碑

| 阶段 | 内容 | 出口条件 |
| --- | --- | --- |
| M1 数据层 | types、存档 v9、长期委托、空白档案、辖区分配、incident/storyline/event 结构 | `tsc` 通过；旧档迁移测试通过 |
| M2 议会 | `CouncilView` + 背景 + 导航 + 决议接线 + §9 切换演出 | 浏览器流程：进入议会、批准一条、看到淡出/进场 |
| M3 事件 | 规则触发 + `IncidentDialog` + 阻塞推进 + 辖区易主效果 | 状态测试：pending 时无法推进；事件改变归属 |
| M4 衣柜与登记 | 魔女格、手写特性、portraitHint、去背景 | 浏览器流程：衣柜出现魔女格；去背景后角点透明 |
| M5 故事线与角色事件 | 故事线生成、幕推进、6 类触发器、角色事件演出与角标 | 浏览器流程：开启故事线 → 触发事件 → 完成并清角标 |
| M6 收尾 | `.cmd`、README、测试补齐、build + 浏览器全量 | 状态 ≥ 72、浏览器 ≥ 42 全绿 |

---

## 16. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 长期委托堆积，地图过满 | 同类上限 8；放号跳过并记录日志；列表可按类型筛选 |
| 空白档案无事可做 | 初始 6000 星砂，`blank` 档放行第一次自定义登记（300 星砂），空态文案给出下一步 |
| 故事线/事件/弹窗 LLM 失控 | schema 校验 + 长度裁剪 + 本地模板兜底；故事线 4 幕、事件 3 场、每场 4 行封顶 |
| 强制弹窗打断自动推进 | 自动推进检测到 pending 立即停下并打开弹窗；不支持关闭 |
| 议会页在窄屏挤压 | 三栏 → 纵向堆叠；立绘高度上限 40vh；选项全宽 |
| 切换演出拖慢操作 | 固定 320+260ms，选项在离开阶段立刻禁用；reduced-motion 下 0ms |
| 魔女格绕过四格限制 | `witchForm` 独立字段，`WARDROBE_LIMIT` 只统计 `form !== 'witch'` |
| 势力版图随机导致开局不公平 | 固定 3/3/3；单势力上限 5 区；易主只影响新委托，不追溯 |
| 去背景误伤主体 | 只删边缘连通区域 + 容差可调 + 可撤销；文案说明不适用发丝/复杂背景 |
| 事件角标过多 | 每名少女同时最多 1 个事件角标；顶栏只显示总数 |
| `.cmd` 只在 Windows 可用 | README 注明；附 `start.sh` 可选说明（不承诺测试） |

---

## 17. 非目标

- 不接图像生成 API（魔女立绘仍是导入或程序化；hint 只作未来字段）。
- 不做多结局树持久化（故事线 4 幕线性推进 + 每幕分支选择；角色事件 3 场单线）。
- 不做议会投票/多议员系统（仍是「提出者 + 助手 + 玩家」）。
- 不做势力自治模拟（辖区只由玩家选择改变，势力不会自行开战/扩张）。
- 不做专业级抠图（不处理发丝、半透明、复杂背景；只做边缘连通键控）。
- 不做 `.cmd` 之外的分发打包（安装包/Steam 等）。

---

## 17. 实施记录（v6 完成版）

- 实际交付：长期委托 2–7 天、空白档案 + `start.cmd` / `start-prod.cmd`、衣柜第五格魔女化、四幕故事线与六类触发、独立会客厅页、强制事件（规则 + LLM）、三方势力辖区、角色事件、手写特性、一句话画面要求与边缘去背景。
- 与原计划的差异：
  - 浏览器流程从目标的 42 组收敛为 33 组（新增会客厅、空白开局路径并入既有流程，未逐项拆成独立用例）。
  - 状态测试 61 项（目标 72 项），覆盖辖区、长期委托、空白档案、魔女化、故事线、强制事件、角色事件与迁移。
  - LLM 每日事件只在配置了 API Key 时生成；没有密钥时完全由规则事件驱动，避免无网络的空转。
  - 开局选择写入 `sessionStorage`，因此刷新不会重复弹窗；设置里的「重置演示进度」仍可直接回到标准开局。
  - 议会切换使用 260ms / 320ms 的入场、退场过渡，`prefers-reduced-motion` 下会跳过动画。
- 验收：`npx tsc -b` 通过；`npm test` 62/62；`npm run build` 成功；`node tests/browser.mjs` 33/33。
- 新增截图：`artifacts/council.png`（会客厅）、`artifacts/command-console.png`、`artifacts/districts.png`。
- 返工记录（用户反馈）：特性三行输入框改用 `av-input` / `av-select` 并补 `.custom-trait-row` 栅格；一句话画面要求从「立绘」步骤移到「只导入立绘 → 让使魔补全」入口，空白向导不再出现该输入。
- 叙事引擎加固：JSON 解析失败且 `finish_reason: length` 时自动把 max_tokens 放大到 3200 重试一次；面板支持拖动左上角调整宽高并写入 localStorage；「去背景」同时出现在只导入立绘入口。
