# v34 方案：叙事者弹窗进工坊、蓝图明确出场角色、角色剧情改成可对话的分幕

> 目标一句话：模型写的弹窗事件要能在内容工坊里看到并复用；故事蓝图的事件节点要写清「谁在场」并给一段约 300 字的开场白；进入角色剧情后先看开场白，再一句一句地由玩家行动、模型续写，旁白与台词用对话框+立绘表情呈现，只有按「结束事件」才真正退出。

## 1. 范围

| # | 需求 | 主要落点 | 规模 |
|---|---|---|---|
| 1 | LLM 编写的弹窗事件在工坊里显示 | `ContentWorkshopDialog` 的弹窗页签、`state.incidentPool`、`content/library.ts` | 只读来源 + 一键登记/复制 |
| 2 | 蓝图事件节点写明参与角色与约 300 字开场白 | `llm.ts` 的蓝图提示词、`storygraph.ts` 的节点数据与校验、`StoryGraphDialog` | 数据字段 + 提示词 + 编辑器 |
| 3 | 角色剧情改为「开场白 → 玩家行动 → 模型续写」的循环，带参考选项与结束按钮；台词用对话框、立绘随表情变化；玩家用灰色框、只显示名字 | `types.ts` 的 `CharacterEvent`、`llm.ts` 新增续写调用、`game.ts` 的 reducer、`CharacterDialog` 的剧情面板、`App.tsx` | 新会话模式 + 富文本回合 + 交互面板 |

不做：

- 不改战斗、委托、议会、市场与数值规则。
- 不把角色剧情做成无限聊天：单次事件有回合上限，结束后仍按原来的方式推进故事线。
- 不删除旧的 `scenes` / `passages` 模式；旧存档照旧能看完。
- 不让模型改数值：续写只允许极小幅度羁绊变化，其余结算仍由本地负责。

## 2. 现状

### 2.1 弹窗事件

- 叙事者生成的弹窗由 `generateIncidentBatch` 产出，经 `mergeIncidentPool` 写进 `state.incidentPool`（运行时队列，最多 10 条）。
- 内容工坊的弹窗页签只读 `library.incidents`，也就是玩家自己在工坊里做的 `IncidentCard`。
- 结果：模型写的弹窗在游戏里能弹出来，但工坊里一条都看不到，也没法复用。

### 2.2 蓝图事件节点

- `StoryNodeData` 的 event 只有 `{ kind: 'event'; title; hook }`。
- 蓝图提示词只说「event: title + hook」，既没说谁出场，也没要求开场白。
- 进游戏后由 `generateStoryArc` 一次生成 4–5 段剧情，角色靠模型自由发挥，容易写出「路过的同事」这种没有档案的人。

### 2.3 角色剧情

- 进入事件后 `mode: 'story'` 一次性给出全部 passages，玩家只能点已有选项或「继续」，没有自由输入。
- 结束依赖把 passages 走完，没有显式的「结束事件」。
- 剧情是纯文字段落，没有立绘、没有表情，也没有「谁在说话」的视觉区分；玩家的行动只是选项标签。

## 3. 设计

### 3.1 工坊显示叙事者弹窗

工坊弹窗页签分成两段：

1. **我的弹窗**：现有的 `library.incidents`（可编辑、可删除）。
2. **叙事者生成**：`state.incidentPool` 里 `source === 'llm'` 的条目，加上 `state.incidents` 里最近 20 条 `source === 'llm'` 的记录，按标题去重。

行为：

- 只读展示标题、类型、势力/辖区、选项数与触发方式（叙事者条目固定「随机池」）。
- 每张卡提供两个动作：
  - **登记到内容库**：转成 `IncidentCard`（`source: 'custom'`，`trigger: 'pool'`，`weight: 1`，`oncePerDay: false`），之后可在工坊里编辑；同标题已登记过则提示重复。
  - **投放测试**：复用现有 `deployIncidentCard` 快照到当前夜晚。
- 顶部计数改为「我的 N 条 · 叙事者 M 条」。

不改存档结构：叙事者条目仍只存在于 `incidentPool`/`incidents`；「登记」是显式动作，避免内容库被自增长塞满。

### 3.2 蓝图：事件节点带出场角色与开场白

数据结构：

```ts
| { kind: 'event'; title: string; hook: string; cast?: string[]; opening?: string }
```

- `cast`：角色 id 数组，1–3 人，必须来自值夜名册或三方首领；默认第一位是故事线主角。
- `opening`：250–350 字开场白，写地点、在场的人、她正在做什么，把话头留给玩家。

蓝图提示词（`generateStoryBlueprint`）追加：

- event 节点必须写 `cast`（名册里的 id）与 `opening`（250–350 字，用「你」称呼所长，结尾留一个可回应的空档）。
- cast 里的人必须与同一张图里的 scene 一致，不允许凭空出现新角色。
- 事件节点最多 3 个，每个事件的 cast 至少包含故事线主角。

本地校验（`parseStoryBlueprintGraph` / `storygraph.sanitizeData`）：

- `cast` 过滤不在名册/首领表里的 id；为空时补主角并记 warning。
- `opening` 截断到 400 字；不足 80 字记 warning（不阻塞保存，进游戏时再补生成）。
- `StoryGraphDialog` 的 event 节点编辑区显示 cast 多选与开场白文本框。

### 3.3 角色剧情：带着立绘与对话框的交互式会话

#### 3.3.1 新的事件模式与回合结构

`CharacterEvent.mode` 增加 `'session'`，并新增字段：

```ts
interface StoryLine {
  speakerId: string;          // 少女 id，或玩家固定写 'player'
  speakerName: string;
  expression: Expression;     // 玩家行没有立绘，但仍带一个，方便高亮
  text: string;
  mode?: 'speech' | 'thought';
}

interface StoryTurn {
  id: string;
  role: 'narrator' | 'player';
  /** 旁白正文；玩家行动写玩家输入的原话。单轮上限 3000 字。 */
  text: string;
  /** 这一轮里说出口的话；旁白本身不再重复台词。 */
  lines?: StoryLine[];
  /** 模型给下一轮的参考选项；玩家仍可自由输入。 */
  options?: string[];
  at?: number;
}

interface CharacterEvent {
  turns?: StoryTurn[];
  cast?: string[];       // 含主角；玩家不在 cast 里，固定以 'player' 出现
  opening?: string;
  sessionDone?: boolean;
}
```

旧的 `scenes` / `passages` 保持不变；`mode` 缺省时按旧逻辑渲染。

#### 3.3.2 进入事件

1. 蓝图走到 event 节点、或玩家在档案里点「开始这段剧情」时，激活事件并写入 `mode: 'session'`、`cast`、`opening`。
2. 节点没有 opening（旧图或生成失败）时先调 `generateStoryOpening` 补出来；失败用 hook 兜底并提示。
3. 面板先一次性显示开场白（旁白 + 台词 + 立绘），然后停在输入框，**不自动继续**。

#### 3.3.3 每一轮

新增 reducer：

```ts
| { type: 'appendStoryTurn'; eventId: string; turn: StoryTurn }
| { type: 'finishStorySession'; eventId: string }
```

流程：

1. 玩家写行动（或点参考选项）提交后，立刻写入 `role: 'player'` 的 turn，玩家那句话同时作为一条 `speakerId: 'player'` 的 `lines` 显示成灰色气泡。
2. `App` 调 `generateStoryTurn(config, state, event, action, preset)`：
   - 输入：事件标题/开场白、cast 的档案摘要、最近 8 轮、玩家这一句。
   - 输出 JSON：
     ```json
     {"narration":"900–3000字","lines":[{"speakerId":"","expression":"calm|smile|surprise|sad|angry|shy","text":"","mode":"speech|thought"}],"options":["参考行动1","参考行动2","参考行动3"],"bond":0}
     ```
   - 本地校验：narration 200–3000 字（超出截断、过短拒绝）、lines 2–8 条且说话人必须在 cast 或 `player` 内、options 2–3 条且每条 ≤24 字、bond 夹在 −2..2。
3. 成功则追加一条 `role: 'narrator'` 的 turn；失败保留玩家输入并提示重试，不写空 turn。
4. 回合上限 12；到达上限后只允许「结束事件」。

#### 3.3.4 台词、立绘与表情

渲染方式对齐战斗札记：

- 中栏：旁白段落 + 该轮台词气泡，气泡按发言人左右交错；气泡左侧显示名字，心声带「心声」标记。
- 左右两侧：`cast` 的立绘（最多 3 个）；立绘表情跟着「当前高亮台词」的 `expression` 变，悬停某条台词即可预览该表情。
- 玩家角色（所长）也用同一套气泡与框：**灰色系边框与底色，框内只显示名字「所长」，不显示立绘**，永远排在对话流里，不和少女抢立绘位。
- 复用现有 `GirlPortrait` 与 `.battle-note-portrait` 的边框/表情机制，新增 `.story-portrait.player` 变体（灰框、名字居中）。

#### 3.3.5 结束

- 「结束事件」按钮任何时刻可用，点击后二次确认：
  - `finishStorySession`：`status = 'done'`、清角标、按轮数给一次性羁绊（最多 +4）、写日志与编年史摘要。
  - 调用 `finishStoryEvent` 推进故事线（与 passages 走完等价）。
- 关闭对话框、切页、推进时间都**不会**结束事件；事件保持 `active`，头像继续挂角标，回来还能接着说。

#### 3.3.6 界面

- 顶部：事件标题 + 在场角色头像条 + 轮数计数。
- 主体：可滚动对话流（旁白 + 台词气泡），每条旁白下方显示参考选项按钮（点击即作为这一轮行动提交）。
- 底部：输入框 + 「行动」按钮 + 「结束事件」按钮（次要样式）。
- 生成中显示「她在等你的下一步」并禁用输入；失败恢复输入并提示。

## 4. 兼容与迁移

- `mode` 新增可选值；旧事件不受影响，`turns` 为空时回退旧渲染。
- 蓝图 event 的 `cast`/`opening` 可选；旧图缺字段时进游戏补生成一次，结果写回节点。
- 工坊显示叙事者弹窗是只读派生，不写存档；「登记到内容库」才写 `night-sugar:content:v1`。
- `StoryTurn.lines` 缺失（旧数据）时只渲染 `text`。

## 5. 测试

### 5.1 单元

- 工坊：`incidentPool` 两条 llm 条目能列出来；登记后内容库 +1 且 `source === 'custom'`；重复登记被拒绝。
- 蓝图：event 缺 `cast` 补主角并 warning；非法 id 被过滤；`opening` 超长截断、过短 warning。
- 会话：`appendStoryTurn` 顺序正确；第 12 轮后拒绝；`finishStorySession` 只结束一次、羁绊 ≤ +4、触发 `finishStoryEvent`。
- 续写校验：narration 低于 200 或高于 3000 的处理、lines 说话人越界被拒、options 为空被拒、bond 越界夹取。
- 玩家台词：`speakerId: 'player'` 的 line 能存进 turn，且不要求有立绘。
- 旧事件：`mode: 'story'` 仍按 passages 推进。

### 5.2 浏览器

- 工坊弹窗页出现「叙事者生成」分段，登记后进入「我的弹窗」。
- 蓝图编辑区能给 event 节点选 cast、改开场白并保存。
- 进入剧情：先看到开场白与输入框，不自动续写；提交后出现新旁白 + 台词气泡 + 3 个参考选项。
- 立绘随台词切换表情；玩家气泡是灰色、框内只有「所长」。
- 关掉对话框再进来，对话不丢；只有「结束事件」（二次确认）才结束并推进故事线。

## 6. 风险

| 风险 | 处理 |
|---|---|
| 3000 字一轮导致等待与截断 | 输出预算 6000 tokens、超时 600 秒；提示词允许长段落但要求先写完旁白再写台词；本地超过 3000 字截断并提示 |
| 模型替玩家说话 | 提示词：玩家台词只能来自玩家这一句输入；其他 `speakerId` 必须属于 cast |
| 立绘太多压垮排版 | cast 上限 3 人；玩家不占立绘位；窄屏折叠成头像条 |
| 模型续写跑题 | 只带最近 8 轮 + cast 档案摘要；本地截断与选项校验 |
| 工坊被叙事者条目撑满 | 只读分区 + 最多 20 条 + 按标题去重；登记需手动 |
| 回合过多卡住故事线 | 12 轮上限 + 随时可结束；结束才推进 |

## 7. 实施顺序

1. `types.ts`：event 节点 cast/opening、`StoryLine`/`StoryTurn`、`mode: 'session'`、新 action。
2. `storygraph.ts`：draft 的 cast/opening 解析与校验、`sanitizeData`、节点工厂默认值。
3. `llm.ts`：蓝图提示词加 cast/opening；新增 `generateStoryOpening`、`generateStoryTurn`（含 3000 字与 lines 校验）。
4. `game.ts`：`startStorySession`、`appendStoryTurn`、`finishStorySession`；蓝图 event 节点进入会话模式。
5. `CharacterDialog`：会话面板（旁白、台词气泡、立绘表情、灰框玩家、参考选项、输入框、结束按钮）。
6. `ContentWorkshopDialog`：叙事者弹窗分区与登记。
7. `StoryGraphDialog`：event 节点 cast 选择与开场白编辑。
8. 测试、构建、浏览器验收、README/todo 记录。
