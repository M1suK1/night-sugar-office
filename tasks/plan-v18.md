# v18 方案：让 LLM 直接生成可编辑的故事蓝图

> 状态：已实现（v18）  
> 目标：把「LLM 写四段故事线」改成「LLM 直接写一张可编辑、可校验、可直接开场的蓝图」；不再保留「自己写一条」手稿入口，旧 beats-only 计划仍可开场。

## 1. 一句话结论

让 LLM 的输出对象从 `StoryBeat[]` 变成 `StoryGraph`，写入 `girl.storyPlan.graph`；蓝图编辑器直接读取并修改这张图，保存后点「按蓝图开场」才真正创建 `Storyline`。生成与运行彻底分开，生成结果不再只存在于 `state.storylines` 里。

## 2. 现状与问题

当前有两条互不相通的故事链：

1. **LLM 四段故事**
   - `generateStoryline` 返回 `title/premise/tone/beats`，不返回 graph。
   - `App.startStory` 在没有 `girl.storyPlan` 时，直接把结果 `addStoryline` 写进 `state.storylines`。
   - 这条故事线没有写回角色卡，`girl.storyPlan` 仍是空。

2. **蓝图编辑器**
   - `StoryGraphDialog` 只从 `girl.storyPlan.graph` 或 `girl.storyPlan.beats` 初始化。
   - 它不读取 `state.storylines`。
   - 保存时只把 graph 写回 `girl.storyPlan`，不会修改正在运行的那条 LLM 故事线。

因此现在“LLM 生成的故事”无法进入蓝图编辑；蓝图编辑的又是另一份角色卡计划。要满足「LLM 直接生成蓝图，且可通过蓝图手动编辑」，必须把生成结果落到 `storyPlan.graph`，并让运行时优先使用这张图。

## 3. 目标与非目标

### 目标

- LLM 一次生成完整的 `StoryGraph`，不是先生成 beats 再由前端硬编译。
- 生成结果先保存到角色卡，再打开蓝图编辑器；用户可增删节点、改连线、改文案、改选择效果。
- 蓝图保存后可从角色档案直接开场，运行的是用户最后编辑的那张图。
- 无 Key、请求失败或校验失败时，有本地可编辑的蓝图兜底，不把用户卡死。
- 旧的纯 beats 计划、旧存档、已导出的契约卡继续可读、可开场。
- 蓝图可以通过契约卡导出/导入。

### 非目标

- 不做“生成后自动开场”。生成和运行分开，避免用户还没看蓝图就被推进故事。
- 不把正在运行的 `Storyline` 实时热替换成新蓝图；编辑只影响下一次开场。
- 不生成 `incident` / `opinion` 这两类需要势力、辖区、舆论上下文的节点；它们仍可在蓝图编辑器里手动添加。
- 不允许 LLM 生成环、悬空节点或不可达分支。
- 不新增依赖，不新增数据库，不改变 localStorage 体系。
- 不新增 prompt 用途页；继续使用现有「故事线」词条。

## 4. 数据模型

### 4.1 `StoryPlan` 的语义调整

```ts
interface StoryPlan {
  title: string;
  premise: string;
  tone: string;
  beats: StoryBeat[];   // 旧格式；graph 存在时仅作历史/摘要
  graph?: StoryGraph;   // 新格式；存在时是运行时唯一事实来源
}
```

规则：

- `graph` 存在时，`beats` 允许为空数组 `[]`。
- `graph` 存在时，`startStoryline` / `planToStoryline` 必须使用 `graph`，不能用 beats 重新编译。
- `graph` 不存在时，维持现有行为：`beats` 必须非空，运行时用 `ensureGraph` 编译。
- 不提升 `GameState.version`；`storyPlan` 已是可选字段，旧存档无需迁移。
- 不新增 `state.storylines` 字段；生成阶段不创建 `Storyline`。

### 4.2 需要新增/调整的判定

在 `src/storyplan.ts` 增加：

```ts
export function hasStoryGraph(plan?: StoryPlan | null): plan is StoryPlan & { graph: StoryGraph };
export function playableStoryPlan(plan?: StoryPlan | null): boolean;
```

- `playableStoryPlan` 在 `graph` 有 start/end，或 `beats` 非空时为 true。
- `sanitizeStoryPlan` 改为：只要 graph 合法，就允许 `beats: []`；graph 与 beats 都为空才返回 null。
- `storyPlanIssues` 在有 graph 时改为调用 `validateGraph`，不再要求 beats 的 hook/choices 完整。

## 5. LLM 输出契约

### 5.1 新函数

在 `src/llm.ts` 增加：

```ts
export async function generateStoryBlueprint(
  config: LlmConfig,
  girl: Girl,
  direction?: string,
  preset?: PresetRuntime,
): Promise<
  | { ok: true; data: { title: string; premise: string; tone: string; graph: StoryGraph } }
  | { ok: false; message: string }
>;
```

- 复用 `chatJson(..., 'storyline', ..., 5200)`。
- 仍使用现有「故事线」scope；不新增 `blueprint` 用途。
- 请求体包含：角色 brief、当前人格/魔女化人格、已有故事计划（若有）、用户的一句话方向。
- 输出只接受 JSON；不接受 markdown、解释、注释、坐标。

### 5.2 LLM 返回的 JSON 形状

```json
{
  "title": "末班车之后",
  "premise": "……",
  "tone": "潮湿、克制、带一点甜",
  "nodes": [
    { "id": "start", "kind": "start", "title": "开场", "data": { "kind": "start" } },
    {
      "id": "s1",
      "kind": "scene",
      "title": "空站台",
      "data": {
        "kind": "scene",
        "narration": "……",
        "lines": [{ "speaker": "月见桃", "tone": "很轻", "text": "……" }]
      }
    },
    {
      "id": "c1",
      "kind": "choice",
      "title": "要不要回头",
      "data": {
        "kind": "choice",
        "prompt": "……",
        "options": [
          { "id": "a", "label": "回头", "intent": "……", "effect": { "bond": 3 } },
          { "id": "b", "label": "继续走", "intent": "……", "effect": { "corruption": 2 } }
        ]
      }
    },
    {
      "id": "m1",
      "kind": "mission",
      "title": "找回遗失的车票",
      "data": {
        "kind": "mission",
        "spec": {
          "title": "找回遗失的车票",
          "goal": "在末班车开走前找回车票",
          "category": "调查",
          "difficulty": "普通",
          "duration": 2,
          "district": "南十字"
        }
      }
    },
    {
      "id": "r1",
      "kind": "reward",
      "title": "口袋里的糖",
      "data": { "kind": "reward", "effect": { "bond": 4, "gold": 120 } }
    },
    {
      "id": "end1",
      "kind": "end",
      "title": "末班车之后",
      "data": { "kind": "end", "summary": "她第一次没有目送列车离开。" }
    }
  ],
  "edges": [
    { "from": "start", "to": "s1" },
    { "from": "s1", "to": "c1" },
    { "from": "c1", "fromPort": "a", "to": "m1" },
    { "from": "c1", "fromPort": "b", "to": "r1" },
    { "from": "m1", "fromPort": "success", "to": "r1" },
    { "from": "m1", "fromPort": "failure", "to": "end1" },
    { "from": "r1", "to": "end1" }
  ]
}
```

说明：

- 不返回 `x/y`，不返回边 id，不返回颜色；布局由本地算法完成。
- `entry` 可省略；解析器取唯一的 start 节点。
- `data` 必须与现有 `StoryNodeData` 对应；不认识的字段丢弃，不认识的 `kind` 直接判错。
- 场景台词只写 2–4 行，speaker 只能是该少女的名字或「旁白」；不伪造其他角色。
- 选择效果只允许 `bond/corruption/gold/reputation` 等轻量数值，不生成技能、装备、魔物 id。
- 委托只生成 `spec` 的本地字段，不绑定实际怪物/敌人模板。

### 5.3 生成规模与结构

- 节点总数 8–16，边数不超过节点数 + 8。
- 恰好 1 个 `start`，1–3 个 `end`。
- 至少 1 个 `scene`，1–2 个 `choice`，1–2 个 `mission`。
- 允许 `event/reward/wait` 点缀，但不允许 `incident/opinion`。
- 每个非 end 节点至少 1 条出边；end 无出边。
- 所有节点必须从 start 可达；所有分支必须最终到达至少一个 end。
- 图必须是 DAG（无环），不允许自环、回边、悬空边。
- 同一节点最多 3 条入边；choice 每个 option 必须有一条出边；mission 必须有 `success` 与 `failure` 两条出边。
- 文案：title ≤ 24 字，premise ≤ 160 字，tone ≤ 24 字；scene narration 80–260 字。

### 5.4 Prompt 约束

Prompt 需要明确写：

1. “输出一张完整蓝图，不要输出四段 beat，不要输出大纲解释。”
2. “只使用允许的节点种类；不要生成 incident / opinion。”
3. “不要输出坐标、颜色、边 id；只输出 nodes 和 edges 的语义字段。”
4. “每个非 end 节点必须有出口；委托必须有 success/failure；选择每个选项都必须有出口。”
5. “不要写不存在的技能、装备、魔物、角色 id；需要战斗时只用 mission spec 的本地字段。”
6. “所有节点必须可达，所有路径必须收束到 end；禁止环。”
7. “台词只允许该少女与旁白；保持当前人格/魔女化人格。”
8. “只返回 JSON 对象，不要 markdown fence。”

### 5.5 修复与失败

采用与战斗札记相同的“一次修复”模式：

1. 第一次 `chatJson`。
2. 解析 → 构建图 → `blueprintIssues`。
3. 若有错误，带上「上一次 JSON」和「必须修正的问题」再请求一次。
4. 第二次仍失败则返回 `{ ok: false, message }`，不写入任何状态。

- 第一次和修复请求都使用 `max_tokens: 5200`。
- 修复 Prompt 要明确“保留合格节点，只修错误；不要删掉整体结构”。
- LLM 日志：`kind: '角色蓝图'`，记录节点数、边数、是否修复、耗时、模型、请求/响应。
- 若返回被截断（`truncated`），直接判失败，不尝试把半张图塞进编辑器。

## 6. 解析、布局与校验

### 6.1 解析

在 `src/storygraph.ts` 增加：

```ts
export interface StoryGraphDraft {
  title: string;
  premise: string;
  tone: string;
  nodes: Array<{ id: string; kind: StoryNodeKind; title: string; data: unknown }>;
  edges: Array<{ from: string; fromPort?: string; to: string }>;
  entry?: string;
}
export function buildGraphFromDraft(draft: StoryGraphDraft): StoryGraph;
```

职责：

- 过滤重复/空 id；非法 id 重新编号为 `n1...`。
- 边 id 本地生成 `e1...`；`fromPort` 默认 `out`。
- 给所有节点填 `x: 0, y: 0` 占位，再调用现有 `sanitizeGraph` 做 data 清洗。
- 如果 start 缺失或多个 start，直接判错（不自动猜）。
- 布局在 `layoutStoryGraph` 中完成。

### 6.2 布局

把 `StoryGraphDialog` 现有的 BFS 分层布局抽成 `src/storygraph.ts` 的纯函数：

```ts
export function layoutStoryGraph(graph: StoryGraph): StoryGraph;
```

- 按从 start 出发的最短层数分列。
- `x = 60 + level * 232 + floor(index / 6) * 214`
- `y = 76 + (index % 6) * 122`
- 保留用户已有坐标时不要调用；仅生成图和“自动布局”按钮使用。
- 这样 LLM 图打开时不会所有节点堆在 (0,0)。

### 6.3 生成专用校验

新增：

```ts
export function blueprintIssues(graph: StoryGraph): { level: 'error' | 'warning'; message: string }[];
```

在 `validateGraph` 之上增加/提升：

- `validateGraph` 的所有 error 保留。
- 将“不可达节点”“委托缺 failure 出口”从 warning 提升为 error。
- 新增环检测：DAG 校验失败即 error。
- 新增 start 入度必须为 0、start 出度必须为 1。
- 新增所有非 end 节点必须能到达某个 end。
- 新增 choice 的每个 option 必须恰好一条出边；mission 必须正好 success/failure 各一条。
- 新增节点数 8–16、end 数 1–3、节点种类白名单。
- 新增 `incident/opinion` 出现即 error（仅用于 LLM 生成验收；手动编辑仍用 `validateGraph`，这两类节点可正常保存和开场）。

## 7. 界面与交互

### 7.1 角色档案的故事卡

无计划时：

```text
故事线
还没有蓝图
[生成故事蓝图]  [手动画蓝图]
```

有计划时：

```text
故事线
《末班车之后》 · 12 个节点 · 3 个结局
[按蓝图开场]  [编辑蓝图]  [重新生成]
```

- `#dossier-story-blueprint`：生成蓝图（新按钮）。
- `#dossier-story-start`：按现有计划开场；蓝图优先。
- `#dossier-story-graph`：打开蓝图编辑器。
- `#dossier-story-regenerate`：已有计划时显示，需二次确认。
- 不再提供「自己写一条」手稿入口，`#dossier-story-edit` 与 `StorylineEditorDialog` 从普通故事流程移除；蓝图编辑器是唯一编辑入口。
- 生成中：按钮禁用并显示“叙事者正在画…”，避免重复请求。
- 生成成功 toast：`蓝图写好了：12 个节点、3 个结局。先检查，再按蓝图开场。`
- 生成失败且无旧计划：本地模板兜底，toast 警告，然后打开编辑器。
- 生成失败且有旧计划：不覆盖旧计划，只提示失败。

### 7.2 蓝图编辑器的元信息

`StoryGraphDialog` 增加：

- 顶部标题旁显示 `蓝图 · N 节点`。
- `#story-graph-meta` 打开「故事信息」抽屉/面板：
  - `#story-graph-title`
  - `#story-graph-premise`
  - `#story-graph-tone`
- `onSave` 从 `(graph)` 改为 `(graph, meta?: { title; premise; tone })`；旧调用可继续只传 graph。
- 保存时写回 `girl.storyPlan`，不清空 graph。
- 未保存关闭仍保持现状；v1 不新增复杂的脏数据确认。

### 7.3 开场

- `CharacterDialog` 的「按蓝图开场」只调用 `startStoryline`，不触发生成。
- `startStoryline` 接受 `plan.graph` 或 `plan.beats`。
- 开场后运行时仍走现有 `startStoryGraph` / `advanceStoryGraph`，不改节点执行器。
- 如果蓝图没有 start/end、有悬空端口等 `validateGraph` error，按钮禁用并提示“先修好蓝图里的错误”；`incident/opinion` 是合法运行节点，不因生成契约的额外限制被禁止开场。

### 7.4 无 Key 与失败兜底

新增本地函数（建议放 `src/storyplan.ts`）：

```ts
export function fallbackStoryPlan(girl: Girl): StoryPlan;
```

- 用 `storyPlanTemplate(girl.name + '的故事', ...)` 生成 4 段本地故事。
- `compileBeatsToGraph` 编译为图，再用 `layoutStoryGraph` 布局。
- 保留 `beats`，同时写入 `graph`；这样旧摘要和旧运行路径都还能读。
- 只在“当前没有可玩计划”时自动保存，绝不覆盖用户已有蓝图。
- UI 在编辑器里显示一条黄色提示：`模型蓝图未通过校验，当前是本地模板，可以直接改。`

## 8. 运行时与状态改造

### `src/game.ts`

- `startStoryline` 的准入条件从 `girl.storyPlan?.beats?.length` 改为 `playableStoryPlan(girl.storyPlan)`；运行前用 `validateGraph` 的 error 做最后一道门，不使用生成契约专用的 `blueprintIssues`。
- `planToStoryline` 不变：已有 `plan.graph ?? ensureGraph(plan)`；确保 graph-only 计划不会走 `ensureGraph([])`。
- `setStoryPlan` 的校验从“beats 非空”改为“beats 非空或 graph 可 sanitize”；允许保存未完成的蓝图草稿，否则用户无法分次编辑。
- LLM 生成成功后的首次保存必须通过 `blueprintIssues`；手动「保存蓝图」只做结构清洗，开场时才要求 `validateGraph` 无 error。
- 不修改 `advanceStoryGraph`、mission 结算、奖励结算。

### `src/App.tsx`

- 新增 `storyBusy: string | null`（按 girlId）。
- 增加 `generateBlueprint(id)`：
  1. 找到 girl；
  2. `setStoryBusy(id)`；
  3. 调 `generateStoryBlueprint`；
  4. 成功 → `setStoryPlan` → 关 busy → `setModal({type:'story-graph', id})`；
  5. 失败且无计划 → `fallbackStoryPlan` → 保存 → 打开编辑器 + 警告；
  6. 失败且已有计划 → 保留旧计划，只提示；
  7. `finally` 清 busy。
- `startStory` 只处理“已有计划开场”；没有计划时不再偷偷调 LLM。
- `StoryGraphDialog` 保存时合并 meta，不清掉原 `beats`。

## 9. 兼容策略

- 旧存档：`storyPlan.beats` 无 graph，继续按原路径 `ensureGraph` 编译。
- 旧 LLM 故事线：`state.storylines` 中的历史条目保持可回放；不迁移成 `storyPlan`。
- 正在运行的故事：编辑蓝图不会热替换；退出/重开后才使用新图。
- 契约卡：`buildGirlCard` 目前用 `{...girl.storyPlan}`，会保留 graph；`parseGirlCard` 走 `sanitizeStoryPlan`，graph-only 也能读。
- 卡片 hash 增加 `storyPlan` 的稳定摘要（title + graph 节点/边数 + 节点 id/标题 hash），避免不同蓝图导出同 hash 的卡。
- 旧 `generateStoryline` 保留为内部兼容/模板函数，但不再是角色故事主按钮的路径。
- 现有浏览器测试「分幕剧情：无 Key 也有四段模板剧情」改为「生成蓝图 → 编辑器 → 开场」；断言的剧情节点仍可保留。

## 10. 测试计划

### 状态测试（`tests/game.test.ts`）

预计新增 5–6 条：

1. `sanitizeStoryPlan` 接受 graph-only（`beats: []`），拒绝 graph/beats 都空的计划。
2. `buildGraphFromDraft` 自动补边 id、去重 id、推导 entry、布局出非零坐标。
3. `blueprintIssues` 拒绝环、不可达节点、缺 failure 出口、choice 缺 option 出口、incident/opinion。
4. `generateStoryBlueprint` mock `fetch`：
   - 请求包含 `故事蓝图`、`nodes`、`edges`，用途为 `storyline`；
   - `max_tokens >= 5200`；
   - 合法 JSON 返回 graph；
   - 第一次非法时只修复一次，修复后合法；
   - 两次都非法时返回 `ok:false`。
5. graph-only `startStoryline` 创建带 graph 的 `Storyline`，并进入 start 节点。
6. `buildGirlCard` / `parseGirlCard` 往返 graph；hash 随 graph 改变。

### 浏览器流程（`tests/browser.mjs`）

预计新增 2 条、改造 1 条：

1. `LLM 蓝图：生成后进入编辑器，手动加节点再开场`
   - 注入无计划的少女；
   - 点 `#dossier-story-blueprint`（无 Key 走本地模板）；
   - 断言编辑器打开、`#story-graph-title` 可见、节点数 > 0；
   - 加一个 scene 节点、连到 end、保存；
   - 断言档案出现「蓝图」与节点数；
   - 点「按蓝图开场」，进入故事并完成一次选择。
2. `蓝图元信息：标题/前提/基调可编辑并持久化`
   - 打开已有蓝图；
   - 改 `#story-graph-title` 等字段，保存；
   - 刷新后标题仍在，卡片导出再导入仍保留 graph。
3. 改造旧「分幕剧情」：不再直接断言四段模板自动开跑，而是先进入蓝图编辑器再开场；四段本地模板仍作为 fallback 被覆盖。

### 验收命令

```powershell
npx tsc -b
npm test
node node_modules/vite/bin/vite.js build --logLevel error
node tests/browser.mjs
```

实际通过：**126 项状态测试、56 组浏览器流程**（原估 127 / 58，按最终验收数同步 README、`tasks/todo.md`）。

## 11. 风险与边界

- **图的复杂度**：8–16 个节点对 5200 token 可能偏紧；若截断率高，降到 8–12 个节点或把 `max_tokens` 提到 6000。首版以“能稳定校验通过”优先。
- **LLM 漏 failure 出口**：这是最常见的结构错误；校验必须把它当 error，而不是 warning。
- **修复放大**：只允许一次修复，避免一次点击烧三次请求。
- **旧测试行为改变**：无 Key 用户从“一键四段”变成“先生成蓝图再开场”；这是有意的产品变化，需要在 README 里写清楚。
- **手稿与蓝图并存**：graph 存在时手稿编辑器隐藏；不提供自动迁移，避免两个事实来源。
- **运行中不热更新**：编辑蓝图只影响下一次开场，避免中途换图导致 cursor/节点失效。
- **手动添加 incident/opinion**：生成器不产出，但编辑器保留；这两类仍需现有内容工坊卡片。
- **不做图撤销/重做**：沿用现有编辑器能力，不在本版扩展。

## 12. 验收标准

- 有 API Key 时，点「生成故事蓝图」只产生一次蓝图请求（失败修复最多一次），不会直接创建 `Storyline`。
- 生成成功后蓝图编辑器打开，节点有布局、边可连线、可保存；保存后档案显示蓝图摘要。
- 用户手动改节点/连线/选择效果后，点「按蓝图开场」，运行的是修改后的图。
- 无 Key 或模型失败时，仍能得到一张可编辑的本地蓝图；已有蓝图不会被覆盖。
- 旧 beats-only 计划仍能开场；旧 LLM 历史故事仍能回放。
- 契约卡导出/导入保留 graph。
- `npx tsc -b`、`npm test`、生产构建、浏览器流程全部通过。

## 13. 实施顺序

1. `storyplan.ts` / `storygraph.ts`：graph-only 计划、`buildGraphFromDraft`、`layoutStoryGraph`、`blueprintIssues`。
2. `llm.ts`：`generateStoryBlueprint`、Prompt、解析、一次修复、日志。
3. `game.ts`：`startStoryline` / `setStoryPlan` / 卡片 hash 兼容。
4. `App.tsx` + `CharacterDialog.tsx`：生成按钮、busy、兜底、开场入口。
5. `StoryGraphDialog.tsx`：元信息编辑、`onSave(graph, meta)`、graph 摘要。
6. 状态测试 → 浏览器流程 → 截图检查 → README / todo / 版本说明。
7. 全量验证后提交并推送。

## 14. 涉及文件

- `src/types.ts`（仅确认 `StoryPlan.graph` / `Storyline.graph`，预计不改结构）
- `src/storyplan.ts`
- `src/storygraph.ts`
- `src/llm.ts`
- `src/game.ts`
- `src/App.tsx`
- `src/components/CharacterDialog.tsx`
- `src/components/StoryGraphDialog.tsx`
- `src/components/StorylineEditorDialog.tsx`（移除；不再有手稿入口）
- `src/cards.ts`（契约卡 storyPlan hash 与 graph 往返）
- `src/styles.css`（蓝图资料栏、兜底提示、生成中状态）
- `tests/game.test.ts`
- `tests/browser.mjs`
- `README.md`
- `tasks/todo.md`
- `tasks/plan-v18.md`
