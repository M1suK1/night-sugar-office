# 夜糖事务所 · v9 方案：可编程的故事线（蓝图式）

> 目标：把「手工四幕清单」升级为**有向图**。故事线可以在任意节点发布阶段委托、打开强制弹窗、发布议会提案、触发角色事件、发奖励，并用类似 UE 蓝图的画布自由连线。
> 原则：节点类型化、不引入自由脚本；图是唯一事实来源，旧的四幕会自动编译成图。

---

## 0. 现状与差距

现在的手稿是 `StoryPlan { title, premise, tone, beats: StoryBeat[4] }`：

- 每幕只能挂**一个** `mission`，完成委托 → 生成一个 `CharacterEvent` → 事件结束 → 下一幕。
- 不能在一幕里连续做「弹窗 → 议会 → 委托 → 奖励」。
- 不能分叉：选项只影响 `StoryEffect`，不能把流程导到不同节点。
- 编辑器是四段固定表单，不能增删分支。

v9 要补的正是这三件事：**多节点、分支、任意先后**。

---

## 1. 总体设计

两层：

1. **图（编辑期）**：`StoryGraph`，节点 + 连线，存在 `Girl.storyPlan.graph`，随契约卡导出。
2. **运行时（游戏期）**：`StoryRun` 保存「当前停在哪个节点、在等什么」，由现有系统的事件回调推进。

```
[开始] → [场景] → [选择] ─┬─→ [阶段委托] → [强制弹窗] → [议会提案] → [奖励] → [结束]
                          └─→ [角色事件] → [奖励] → [结束]
```

一张图**只有一个入口**（start），至少一个出口（end）。运行到等待类节点就停住，等对应系统回报后再继续；一次推进最多走 64 步，防止环。

---

## 2. 数据模型（`src/types.ts`）

```ts
export type StoryNodeKind =
  | 'start' | 'scene' | 'choice' | 'mission' | 'incident'
  | 'opinion' | 'event' | 'reward' | 'wait' | 'end';

export interface StoryNode {
  id: string;                 // n1, n2…
  kind: StoryNodeKind;
  x: number; y: number;       // 画布坐标（px）
  title: string;              // 节点显示名
  note?: string;              // 作者备注，不进运行时
  data: StoryNodeData;        // 按 kind 区分的联合类型
}

export type StoryNodeData =
  | { kind: 'start' }
  | { kind: 'scene'; narration: string; lines: { speaker: string; tone?: string; text: string }[] }
  | { kind: 'choice'; prompt?: string; options: { id: string; label: string; intent?: string; effect?: StoryEffect }[] }
  | { kind: 'mission'; spec: StoryMissionSpec }
  | { kind: 'incident'; spec: StoryIncidentSpec }
  | { kind: 'opinion'; spec: StoryOpinionSpec }
  | { kind: 'event'; title: string; hook: string; passages: StoryPassage[] }
  | { kind: 'reward'; effect: StoryEffect; equipmentId?: string; trait?: { name: string; description: string } }
  | { kind: 'wait'; days?: number; minutes?: number }
  | { kind: 'end'; summary?: string };

export interface StoryEdge {
  id: string;
  from: string; fromPort: string;  // 普通节点固定 'out'；choice 为选项 id
  to: string;
}

export interface StoryGraph {
  version: 1;
  nodes: StoryNode[];
  edges: StoryEdge[];
  entry: string;              // start 节点 id
  meta?: { layout?: 'auto' | 'manual' };
}
```

新增 spec（节点专用，避免和运行时对象耦合）：

```ts
export interface StoryIncidentSpec {
  kind: 'faction' | 'environment' | 'girl';
  title: string; body: string;
  faction?: FactionId; district?: DistrictId;
  options: { label: string; hint: string; effect: IncidentEffect }[];
}
export interface StoryOpinionSpec {
  topic: Opinion['topic']; title: string; text: string; request: string;
  options: { id: 'accept' | 'defer' | 'reject'; label: string; effect: string; shift?: { district: DistrictId; faction: FactionId } }[];
}
```

`StoryPlan` 增 `graph?: StoryGraph`；`beats` 保留为**编译产物**（旧 UI/旧档仍能看）。

运行时：

```ts
export interface StoryRun {
  storylineId: string;
  cursor: string;                 // 当前节点
  waiting?:
    | { kind: 'mission'; ref: string }
    | { kind: 'incident'; ref: string }
    | { kind: 'opinion'; ref: string }
    | { kind: 'event'; ref: string }
    | { kind: 'wait'; until: number };  // absolute minutes
  visited: string[];
  steps: number;
}
```

`Storyline` 增 `graph?: StoryGraph; run?: StoryRun;`。旧故事线没有 `run` 时按 `stage` 走老路径，互不干扰。

---

## 3. 运行时（新文件 `src/story-runtime.ts`）

纯函数，便于测试：

```ts
export function startRun(story: Storyline): StoryRun
export function stepRun(state: GameState, story: Storyline): Storyline   // 推进到下一个等待点
export function resolveWaiting(state, story, kind, ref): Storyline      // 系统回报后继续
export function validateGraph(graph: StoryGraph): GraphIssue[]
```

推进规则：

1. 从 `cursor` 取节点；
2. `scene/reward` → 应用 effect、记 log、沿 `out` 走；
3. `choice` → **停住**，等玩家在剧情面板点选项（`chooseStoryPort` action）；
4. `mission` → 发布 `Mission`（`storyMissionForBeat` 的通用版 `publishStoryMission`），`waiting={kind:'mission',ref}`，停；
5. `incident/opinion/event` → 建对象并停（弹窗/议会/事件各自阻塞）；
6. `wait` → 停到绝对分钟；
7. `end` → 故事线 `done` + archive + 清 run。

回调接线：

| 事件 | 位置 | 动作 |
| --- | --- | --- |
| 委托完成 | `completeStoryMission` | `resolveWaiting(...,'mission',mission.id)` |
| 弹窗处理完 | `resolveIncident` | `resolveWaiting(...,'incident',incident.id)` |
| 议会决议 | `decideOpinion` | `resolveWaiting(...,'opinion',opinion.id)` |
| 角色事件结束 | `finishStoryEvent` | `resolveWaiting(...,'event',event.id)` |
| 时间推进 | `advanceClock` | 检查 `wait.until` |

> 关键：运行时只在**回调里继续**，不做轮询；`advance` 不因为剧情而阻塞（弹窗本身已有阻塞规则）。

---

## 4. 蓝图编辑器（新文件 `src/components/StoryGraphEditor.tsx`）

不引入第三方画布库（保持零新依赖），自研轻量画布：

- **布局**：三栏——左节点库、中画布、右检查器；底部校验条。
- **画布**：`<div class="graph-canvas">`（`transform: translate/scale`）+ 一层 `<svg>` 画所有连线 + 绝对定位节点卡片。
- **交互**：
  - 拖节点改 `x/y`；空白拖动平移；滚轮缩放（0.5–1.6）。
  - 连线：点节点右侧输出口 → 点目标节点左侧入口；choice 节点每个选项一个输出口，颜色区分。
  - 选中节点 → 右侧检查器按 `kind` 渲染字段（复用现有表单控件）。
  - 快捷键：Delete 删节点、Ctrl+D 复制、Ctrl+Z 撤销、F 适配视图。
  - 工具栏：`+ 节点`、自动排版（按拓扑分列）、校验、试跑、切回「幕列表」。
- **校验**（`validateGraph`）：恰一个 start、至少一个 end、所有出口有连线、choice 每个选项都连线、必填字段非空、从 start 可达所有节点、无非法环（只允许 reward/scene 自环？不允许，直接禁）。
- **试跑**：不写存档，按图推演，路径高亮并在右侧打印「第几步做了什么」，用于检查先后顺序。
- **幕列表视图**：把图按拓扑排序压平成「第 N 步」列表，给不想连线的作者用；两种视图共享同一份 graph。

节点字段直接复用：
- mission → 现在的 `StoryMissionSpec` 表单（标题/目标/难度/辖区/同行/魔物/专属装备/后续事件）。
- incident → 标题/正文/三类选项（沿用 `IncidentDialog` 的字段）。
- opinion → 议题/正文/请求/三个选项 + 辖区易主。
- event → 标题/钩子 + 可选「让叙事者写」（复用 `generateStoryArc`）。
- reward → 星砂/安定度/羁绊/侵蚀/装备/特性。

---

## 5. 与现有 UI 的接线

- `CharacterDialog` 故事面板：入口按钮改为「打开蓝图」（旧「编辑手稿」保留为列表模式）。
- 剧情播放器：`StoryPlayerDialog` 增 `choice` 节点渲染（多选项 + 跳转），不再只依赖 `passages`。
- 地图：故事委托仍走 `storylineId` 标记，不打烊清理。
- 议会/弹窗：节点创建的 `Opinion/Incident` 带 `storyNodeId`，UI 不变，只是源头多一个。

---

## 6. 存档与契约卡

- `GameState.version: 11`，新增 `Storyline.run`、`graph` 可选；`loadState` 迁移：旧 `StoryPlan.beats` → 线性图（scene→choice→mission→event→…→end），旧故事线继续走 `stage`。
- `GirlCard.version: 2`：`girl.storyPlan.graph` 随卡导出；导入时 `validateGraph`，坏图退回 `beats` 线性图并提示。
- 体积：节点上限 80、边 160；导出前去掉 `note` 与坐标小数。

---

## 7. 测试

状态测试（`tests/game.test.ts`，目标 +12）：

1. 旧 `beats` 自动编译成图且入口/出口唯一。
2. 图推进：scene → reward 应用数值后到 end。
3. mission 节点发委托、完成后才继续。
4. incident 节点创建 pending 弹窗，`advance` 被阻塞，处理完继续。
5. opinion 节点进议会，决议后继续。
6. event 节点生成 `CharacterEvent`，结束回调推进。
7. choice 分叉：两个选项分别到不同 end。
8. 环检测 / 断线 / 缺 end 校验报错。
9. 步数上限 64 保护。
10. 卡片导出导入图保真；坏图回退。

浏览器流程（+3）：拖两个节点并连线、校验面板报错后修复、试跑路径高亮。

---

## 8. 里程碑

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| M1 | `StoryGraph` 类型、`compileBeatsToGraph`、迁移与卡片携带 | tsc + 单测 |
| M2 | `story-runtime.ts` 推进与四个回调接线 | 单测覆盖 6 类节点 |
| M3 | 画布编辑器（拖动/连线/检查器/校验） | 浏览器可建 3 节点图 |
| M4 | 节点字段表单（mission/incident/opinion/event/reward） | 每类节点能配出可运行图 |
| M5 | 试跑、自动排版、幕列表视图、文档 | 全量 90+ 单测、48+ 流程 |

---

## 9. 风险

| 风险 | 处理 |
| --- | --- |
| 图编辑器复杂度失控 | 先做「连线 + 检查器」，不做框选/对齐线/分组；上限 80 节点 |
| 运行时与旧 `stage` 双轨 | 有 `run` 走图，无 `run` 走旧逻辑，两套互斥 |
| 节点创建对象泄漏（弹窗不处理就卡死） | 每个等待节点都进 `pending` 队列，打烊前必须处理；`wait` 超时自动跳过可配 |
| 卡片被塞入恶意/坏图 | 导入 `validateGraph` + 字段夹取，失败回退线性图 |
| 复杂度对玩家不友好 | 默认给「模板图」：委托→事件→奖励→结束，玩家只改文案 |

---

## 10. 非目标

- 不做 UE 级变量/表达式/函数库；不做任意 JS 节点（安全与可测性）。
- 不做多人协作、版本分支合并。
- 不做图内实时战斗编排（战斗仍由 `combat.ts` 结算）。
- 不把图存到服务端；仍随本地存档/卡片走。

---

## 11. 实施记录

### M1 蓝图运行时 + M2 画布雏形（2026-10-27）

- 类型：`StoryGraph/StoryNode/StoryEdge/StoryRun` 等；`StoryPlan.graph`、`Storyline.graph/run`、`Incident/Opinion.storylineId`、`CharacterEvent.storyNodeId`、`chooseStoryPort`。
- `src/storygraph.ts`：图校验、编译（幕 → 场景/委托/事件/选项/奖励/等待/结束）、可达性与端口检查。
- `src/game.ts`：`startStoryGraph / advanceStoryGraph / resolveStoryWait`；委托完成、事件结束、弹窗解决、议案决议、等待到期都会把游标推到下一节点。
- `src/components/StoryGraphDialog.tsx`：SVG 连线 + 可拖节点 + 左侧节点面板 + 右侧检查器（场景旁白、委托目标/难度/时长、事件钩子、弹窗与议案文本、奖励数值、选项增删、等待天数、收束语）+ 校验面板 + 保存进契约卡。
- 档案页新增「蓝图编辑」入口（`#dossier-story-graph`），保存后写回 `girl.storyPlan.graph`。
- 验收：`tsc` 0、`npm test` 86/86、browser 47/47；截图 `artifacts/story-graph.png`。
- 已知限制：画布未做缩放/框选，节点较多时需要横向滚动；试跑与自动布局留待 M3。
### 蓝图交互补强（2026-10-27）

- 节点支持复制 / 粘贴 / 原地副本：工具栏按钮，或选中节点后 `Ctrl+C` / `Ctrl+V`，`Delete` 删除（开始节点不可删）。
- 连线改为拖拽：按住节点右侧端口拖到目标节点松手即可；也保留「点端口再点目标」的点击式连法。
- 画布与节点视觉整理：按节点类型区分强调色与图标、选中描边、连线箭头、拖拽中的虚线预览、目标节点高亮；顶部按钮补文字标签，画布底部校验按钮区分「问题 / 提醒」。
- 拖拽连线、复制粘贴均纳入浏览器流程（蓝图流程现在会复制、粘贴、键盘粘贴并拖一条边，保存后校验边确实写入卡片）。
### 连线与入口修正（2026-10-27）

- 每个节点新增左侧入口环：多条边可汇入同一节点，允许形成回环；运行时对回环有步数上限保护。
- 近距离连线改用二次曲线绕上方，节点贴得很近时不再出现打结的小环；目标在左侧时直接跨过去而不是绕大圈。
- 同一条出口重新连线会直接覆盖旧边，不必先删；“点端口再点目标”和拖拽两种方式都适用。
- 浏览器流程补了覆盖重连断言（边数不变、目标被替换）与回环场景截图。
### M3 画布工具（2026-10-27）

- 缩放：画布左上角 `− / 百分比 / +`，范围 50%–160%；画布内 `Ctrl + 滚轮` 也可缩放。节点拖拽与连线坐标已按缩放换算。
- 自动整理：按入口出发的 BFS 深度分列，每列最多 6 个，自动换列并滚动回入口；循环与不可达节点排在最后一列。
- 试跑：按图从入口走一遍，默认选每个分岔的第一个选项，列出经过的节点、选择与停滞原因，最多 40 步并检测回环。
- 模板选项补了文案（接住这句话 / 先不追问），空选项会在旧存档一次清洗时回落为「选择 N」。
- 验收：tsc 0、状态 86/86、浏览器 47/47（新增缩放、自动整理、试跑断言）、构建通过；截图 `artifacts/story-graph-m3.png`。
### M4 / M5 收口（2026-10-27）

- 检查器已覆盖 mission / incident / opinion / event / reward / wait / end 各类节点的关键字段，按类型渲染对应表单。
- 新增「幕概览」：把场景与角色事件按横坐标压平成列表，点一项即选中对应节点；配合试跑可以快速定位第几幕。
- 框选多选、Shift 加选、整组拖动、Delete 批量删除、适应窗口（fit view）全部可用；画布工具条为 − / 百分比 / + / 适应 / 自动整理 / 试跑 / 幕概览。
- 验收：tsc 0、状态 86/86、浏览器 47/47（缩放、fit、框选、试跑、幕概览均有断言）、构建通过。