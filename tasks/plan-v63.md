# v63 方案：换日刷新时机 / 弹窗事件能不能发生 / 提示词全量可见

> 目标读者：下一次迭代的实施者（可能是我自己）。每条改动都要求可测，不留"看起来对"的地方。

---

## 0. 结论先行

| # | 你的观察 | 已经查到的机制 | 一句话结论 |
| --- | --- | --- | --- |
| 1 | 每日提案、委托在 0 点就刷新 | 营业夜是 `20:00 → 次日 26:00(=02:00)`，`advanceClock` 用 `nextDay = floor((to − SHIFT_START) / 1440)`，**day 其实在 20:00 才翻**；但第三批委托 `WAVE_AT = [0,120,240]` 正好落在 00:00，且 `endNight` 的 `closedDay` 判定在"午夜后中断"时会退化成原地重开 | 不是"day 在 0 点翻"，而是**0 点有一批委托 + 一段打烊边缘逻辑**，合起来像"0 点刷新"。需要把"每日重置"与"时段投放"两类东西分开定阈值，并补一条"0 点不重置"的回归测试 |
| 2 | 弹窗事件根本不会发生 | `dueIncidents()` 只从内置模板挑，模型写的条目进 `state.incidentPool` 后就**再没人取用**：`takeFromPool()` 全仓库**零调用**（`src/incidents.ts:271` 定义，无调用方）。另外生成提示词里没有 `trigger / kind / 出场角色 / 效果的合法写法`，条目即使被取用也多被判无效 | 两处问题叠加：**取用链路断了** + **提示词没写契约** |
| 3 | 提示词要全部交给人工审核 | 现在 `DEFAULT_PROMPTS`（31 条）+ `SECTION_PROMPTS`（16 条）已进预设，但 **6 个"锁定契约"和若干生成器字面量仍在代码里**（`dailyContract()`、`newsContract()`、`battleContract()`、`arcContract()`、`arcOpening/TurnContract()`、`generateIncidentBatch` 的"只输出一个 JSON…"、`DIALOGUE_FORMAT_HINT`、whisper 的"写她此刻发给所长的消息"、故事蓝图四幕说明等） | 把"契约 + 生成器字面量"全部搬进预设词条，并加一条 **lint 测试**：`src/llm*.ts` 里再出现提示词字面量就测试失败 |

---

## 1. 换日刷新时机

### 1.1 现有坐标系（先对齐概念，再谈改法）

- `SHIFT_START = 1200`（20:00）、`SHIFT_END = 1560`（次日 02:00），`state.minutes` 允许 ≥1440，表示"跨过午夜的同一夜"（`src/shift.ts:9-11`）。
- 绝对分钟 `absoluteMinutes(day, minutes) = day * 1440 + minutes`。
- `advanceClock()` 里 `nextDay = floor((to − SHIFT_START) / 1440)`（`src/rules/time.ts:150`）：数学上 20:00 翻日，00:00 **不翻**。
- 所有"每日"效应都挂在 `days > 0` 分支（`time.ts:154-166`）：养老金、条件 tick、`processDay()`（污染 / 势力库存 / 来使 / 市场 / BOSS / 战线）、暂缓议题回归、`trimOpinions()`。
- 委托按 `WAVE_AT = [0, 120, 240]` 三个时段投放 → 20:00 / 22:00 / **00:00**（`syncShift`，`time.ts:97-117`）。

### 1.2 已确认的三处"像 0 点刷新"的地方

| 位置 | 现在的行为 | 应该的样子 |
| --- | --- | --- |
| `WAVE_AT[2] = 240`（`src/shift.ts:14`） | 第三批委托在 00:00 投放，玩家看到"整块委托换新" | 保留"同夜第三批"的设定，但**不叫刷新**：委托卡片与日志明确写"午夜批"，并让它只补空位、不清板 |
| `endNight()` 的 `closedDay`（`time.ts:367`） | `next.minutes < SHIFT_START \|\| next.minutes >= SHIFT_END ? day + 1 : day`；若中途被弹窗拦住（`advance` 失败），`minutes` 停在 1440–1560 之间 → `closedDay = day` → `advanceClock` 目标时间**早于当前**，`elapsed <= 0` 直接 return，于是"下一夜"仍停在同一天同一夜，看起来像"0 点重开" | `endNight` 先判定"这一夜是否已跨过 24:00"，跨过就 `day + 1`；并把 `advanceClock` 目标改为 `max(当前, absoluteMinutes(closedDay, SHIFT_START))`，杜绝回退 |
| 每日提案（意见） | `state.day > state.councilDay` → `trimOpinions`（`time.ts:165`），day 只在 20:00 翻，逻辑本身没问题 | 保持；但要补测试固定"午夜不 trim、20:00 才 trim"，防止以后有人把 `councilDay` 改成按分钟判 |
| 市场文案 | 代码里没找到"0 点刷新"字样，只有 `refreshMarket` 挂在 `processDay`（`time.ts:245`），即 20:00 翻日时刷新 | 全文搜"0 点 / 零点 / 00:00"，凡指"市场次日刷新"的文案统一改成"下一夜开门（20:00）刷新"；若你看到的那句在别处（截图发我），按同样口径改 |

### 1.3 改法

1. **单一阈值函数**：新增 `src/refreshGate.ts`
   ```ts
   export type RefreshKind = 'proposal' | 'commission' | 'market' | 'factionStock' | 'cityNews' | 'incidentPool';
   /** 返回该种类下一次允许刷新的绝对分钟：目前一律是「下一个营业夜开门」。 */
   export function nextRefreshAt(day: number): number;
   export function canRefresh(kind: RefreshKind, state: GameState): boolean;
   ```
   把所有每日重置点改成问这个函数，而不是各自写 `state.xxxDay < state.day`。这样"什么算隔天"只有一处定义。
2. **`endNight` 修边缘**：见上表第 2 行；顺带补 `advanceClock` 的 `elapsed <= 0` 分支日志（`console.info`），避免以后又静默失败。
3. **午夜批显性化**：`syncShift` 里 wave=2 的消息/日志改成"午夜批：又贴上来 ${n} 张"；委托列表分组标题也标"午夜批"。
4. **文案审计**：全局搜 `0 点|零点|00:00|次日` 逐条确认；只改"声称每天刷新"的句子。

### 1.4 测试（新增 `tests/v63-refresh.test.ts`）

- 从第 14 日 20:00 推进到 22:00、00:00、01:59：`state.day` 恒为 14，`trimOpinions` 未触发，`refreshMarket` 未触发。
- 从 24:00 推到 26:00 再 `endNight`：`state.day` 变 15，`minutes = 1200`，市场与提案各刷新一次。
- 构造"午夜后被弹窗拦住再 endNight"的状态：`day` 必须变 15（当前实现在这里会原地不动）。
- wave=2 投放后：`state.missions` 里原有未过期委托仍在（只补空位）。

---

## 2. 弹窗事件：为什么不会发生

### 2.1 两条断链（都有硬证据）

1. **取用链路断了**：`src/incidents.ts:271 takeFromPool()` 在全仓库**没有任何调用方**（`src/**`、`tests/*` 均已搜）。`dueIncidents()` 的候选池写死 `[...builtinIncidents]`（`incidents.ts:203`），`state.incidentPool` 只在第 211 行被用来**排除**，从不被抽取。结果：模型写进池子的条目永远躺在 `state.incidentPool` 里。
2. **提示词没写契约**：`generateIncidentBatch` 的 body 只给了 `{category,title,body,options[{label,hint,effect}]}`，而真实 `Incident` 需要 `kind: 'faction'|'environment'|'girl'`、`trigger: {kind:'dayStart'|'wave'|'missionDone'|'condition'}`、`options[].id`、可选 `scene`、`ttlMinutes`（`types.ts:476-526`）。`sanitizeGeneratedIncident`（`incidents.ts:294`）又不校验 `trigger`，于是"缺字段 → 默认一直拦住时间"（`blockingIncidents` 对无 trigger 的条目一律返回 true），既不该发生也发生不了。

### 2.2 改法

1. **接上取用**：在三个真实触发点调用 `takeFromPool`，优先级排在内置模板之后：
   - `endNight()` 的 `dayStart` 分支（`time.ts:372`）；
   - `syncShift()` 每个 wave（`time.ts:110` 附近）；
   - 委托结算的 `missionDone`（`time.ts:307`）。
   规则：本轮内置模板已投出一条就不再取池子；池子条目按 `trigger` 精确匹配（`dayStart` 只匹配 dayStart 等），无 trigger 的老条目按 `dayStart` 兜底并在日志里注明。
2. **提示词补全**（写进 `SECTION_PROMPTS` 的 `inc-*` 词条，见第 3 节）：
   - `trigger` 必填三选一，并给"什么题材配哪种 trigger"的例子；
   - `kind` 必填（faction / environment / girl），并说明 `girlId` / `district` / `faction` 三者与 kind 的搭配；
   - **出场角色白名单**：`speakerId` 只能取名册 / 三方代表的 id，列出可用清单（宏 `{{girls}}`、`{{leaders}}` 已存在，直接用）；
   - **效果合法写法表**：`gold | reputation | faction{id,standing} | girl{bond,fatigue,spirit,corruption} | district{id,targetPct,rewardPct,untilDay} | territory{id,faction} | hostility{pair,delta}`，附幅度上限（gold ≤ 800、reputation ±4、standing ±4、bond ±6）；
   - `ttlMinutes`（默认 240）与"是否拦时间"（report 不拦、decision/scene 拦）。
3. **校验加固**：`sanitizeGeneratedIncident` 现在不校验 `trigger`；
   - 缺 `trigger` → 直接判无效（或按 category 推导：report → dayStart，decision → wave，scene → missionDone），并把推导结果写进日志；
   - `kind` 与 `girlId`/`district`/`faction` 不一致 → 判无效；
   - 记录丢弃原因到 `llm` 日志，方便你在叙事引擎面板看到"为什么没用上"。

### 2.3 测试（新增 `tests/v63-incident.test.ts`）

- 造 3 条池子条目（三种 trigger），分别跑 dayStart / wave / missionDone：各自**只**在自己那个触发点被取出并进 `state.incidents`。
- 池子条目缺 `trigger` 时的兜底行为（按 category 推导）。
- `kind` 与 `girlId` 不一致的条目被判无效，且 `mergeIncidentPool` 不接收。
- 端到端：`endNight` 之后 `state.incidents` 里能看到模型写的标题。

---

## 3. 提示词全量进预设（可人工审核）

### 3.1 现状盘点

- 已进预设：`DEFAULT_PROMPTS` 31 条、`SECTION_PROMPTS` 16 条（`src/promptSections.ts`）、任务分区 11 个 scope。
- 仍在代码里的提示词（要搬）：
  | 位置 | 内容 |
  | --- | --- |
  | `promptSections.ts` | `storylineContract()`、`newsContract()`、`battleContract()`、`arcContract(targets)`、`arcOpeningContract()`、`arcTurnContract()`（现在虽在 `promptSections.ts`，但**不在** `SECTION_PROMPTS` 词条表里，界面上看不到、改不了） |
  | `src/llm.ts` | `generateIncidentBatch` 的 `只输出一个 JSON 对象…` + `要求：2 到 3 条…`、`DIALOGUE_FORMAT_HINT`、whisper 的 `写她此刻发给所长的消息，1–3 条…`、`generateDialogue` 的 `请接着写…` 之类 |
  | `src/llm-night.ts` / `src/nightSpec.ts` | 每日提案的字段说明与示例 JSON |
  | `src/llm.ts`（story 蓝图） | 四幕结构与 `difficulty` 四档说明 |
  | `src/promptMacros.ts` | 宏说明文本（已有 `macroPreview`，但"有哪些宏、怎么用"的说明不在词条里） |

### 3.2 目标

1. **一条不留**：`src/llm*.ts`、`src/nightSpec.ts` 里不再出现提示词字面量，全部变成 `SECTION_PROMPTS` 词条（可带 `{{macro}}`）。
2. **契约也在预设里**：6 个契约词条带 `locked: true` 标记，界面显示"结构性契约 · 可改但要自己负责"，仍由 `composeTaskSystem` **最后追加**（顺序不变），并给"恢复默认"按钮。
3. **审核视图**：设置 → 提示词 → 新增"全量视图"页签：
   - 按 11 个 scope 分组，列出**所有**词条（含契约与生成器字面量）；
   - 每条显示：名字 / 角色（system·user·契约）/ 是否被改过（与代码默认值 diff）/ 字数 / 命中宏；
   - 单条"恢复默认"、整份"导出 JSON / 导入 JSON"；
   - 顶部一个"我已逐条看过"的勾选（只存本地，用来提醒自己改过哪些）。

### 3.3 落地步骤

1. 新增 `src/promptContracts.ts`：把 6 个契约函数改成返回"词条 id + 文本"，文本里的动态部分（如 `arcContract(targets)` 的 targets、`STORY_LIMITS`）改成宏 `{{arcTargets}}`、`{{limits}}`，由 `promptMacros` 解析（`limits` 宏已存在）。
2. `composeTaskSystem` 改为从预设里取"契约词条"，缺失时回落到代码默认（保证旧预设能跑）；`ensurePromptScopes` 迁移时把新词条补进 `promptOrder`（沿用 v54 的迁移写法，`PRESET_SCHEMA` 提到 7）。
3. 把 `llm.ts` / `llm-night.ts` / `nightSpec.ts` 里的字面量逐条搬进 `SECTION_PROMPTS`，每搬一条跑一次 `tests/v49.test.ts`（它校验词条数量）并更新计数断言。
4. 新增 lint 测试 `tests/prompt-lint.test.ts`：
   ```ts
   // 扫描 src/llm*.ts、src/nightSpec.ts
   // 命中 /只输出|不要 Markdown|要求：\d? ?到? ?\d|请写|逐条/ 且不在 promptSections/promptContracts/promptMacros 内 → 失败
   ```
   这条是本次的"防复发"闸门：以后谁再往代码里写提示词，测试红。
5. `PRESET_SCHEMA = 7`：迁移只为已有预设补词条，不覆盖用户已改内容（沿用 v54 的去重逻辑）。

### 3.4 测试与验收

- `DEFAULT_PROMPTS.length`、`SECTION_PROMPTS.length`、`PROMPT_TASK_SCOPES.length` 全部更新断言；
- 每个 scope 至少有一条契约词条，且 `composeTaskSystem` 输出的末尾就是它（快照测试）；
- lint 测试通过（0 命中）；
- 导出预设 JSON 里能看到全部词条（含 locked 契约）。

---

## 4. 验收清单（逐条可点）

1. 第 14 日 23:59 推进到 00:01：`state.day` 仍是 14，提案、市场、势力库存、城市新闻都不变；委托只多"午夜批"两三条，原有委托还在。
2. 20:00 开门：提案、市场、库存、新闻各刷新一次；日志写"第 15 日开门"。
3. 午夜后被弹窗拦住再打烊：`state.day` 变 15，不会退回 14。
4. 让叙事者写 3 条弹窗事件 → 三处触发点各投一条，叙事引擎面板日志能看到"取了哪条、为什么被丢"。
5. 设置 → 提示词 → 全量视图：能看到每一个任务的 system 段、结构契约、JSON 示例；改一条立刻生效；`prompt-lint` 为绿。

---

## 5. 这次不做

- 不改营业时段（仍是 20:00–02:00）；不改三批投放的数量。
- 不重写 `IncidentEffect` 的数值语义，只补校验与文档。
- 不引入多语言 / 多提示词版本管理。

---

## 6. 实施顺序（建议的提交切分）

1. `v63-1`：`refreshGate` + `endNight` 边缘 + 午夜批文案 + 测试（改动小、可单独验）。
2. `v63-2`：接上 `takeFromPool` 三处 + 生成校验加固 + 测试。
3. `v63-3`：契约与字面量搬进预设 + `PRESET_SCHEMA 7` 迁移 + 计数断言更新。
4. `v63-4`：提示词全量视图 UI + 导入导出 + `prompt-lint` 测试。

---

## 附录：本方案引用的证据位置

- `src/shift.ts:9-16`（`SHIFT_START/SHIFT_END/WAVE_AT/WAVE_SIZES`）
- `src/rules/time.ts:97-117`（`syncShift` 三批投放与事件触发）、`:144-177`（`advanceClock` 翻日）、`:205-258`（`processDay` 每日重置）、`:347-384`（`endNight` 与 `closedDay`）
- `src/incidents.ts:195-221`（`dueIncidents` 只取内置模板）、`:271-281`（`takeFromPool` 无调用方）、`:294-`（`sanitizeGeneratedIncident` 不校验 trigger）、`:364-378`（`mergeIncidentPool`）
- `src/rules/incidentOps.ts:98-106`（`rollPoolIncident` 只管工坊卡池）
- `src/types.ts:476-526`（`IncidentTrigger` / `Incident` / `IncidentTemplate` 字段）
- `src/promptSections.ts`（`SECTION_PROMPTS` 与 6 个契约函数）
- `src/llm.ts` 内的生成器字面量：`generateIncidentBatch`、`DIALOGUE_FORMAT_HINT`（`:307`）、`generateDialogue`/`generateWhisper` 的 user 句
