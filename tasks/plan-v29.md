# v29 方案（第二稿）：模型来信 / 首领代表 / 关系议会 / 接口反代

> 一句话：打完一场仗，她会带着那一战的记忆给你发消息；会客厅与议会里的「三方代表」就是你自己开局指派的首领；关系提案可以直接停战、换辖区，也可能因为一句「驳回」直接开战；接口能挂在任意反向代理后面。

## 0. 本轮决策（已确认）

| # | 决策 | 影响 |
|---|---|---|
| 1 | 主动来信**走模型**，模型要读**战斗记录**，生成成功后才显示未读角标 | 新增 `whisper` 生成任务 + 异步队列；失败不显示角标 |
| 2 | 代表名字按**玩家开局分配的首领**来，不再用 `factionInfo.envoy` 的静态人名 | 会客厅、议会、代表委托统一走 `rosterLeader(state, faction)` |
| 3 | 议会关系提案允许**直接停战 / 换辖区**，代价很高；**驳回可能直接开战** | `OpinionOutcome` 新增 `truce` / `war`，`OpinionChange` 新增 `hostility` |
| 4 | 首领默认 **10 级** | `content/factionLeaders.ts` 三个首领等级 7/7/8 → 10，相关测试与数值展示同步 |

## 1. 范围

| # | 需求 | 主要落点 | 规模 |
|---|---|---|---|
| 1 | 战斗/调查结束后，模型读战报写一条主动消息；成功后加未读角标 | `types.ts`、`game.ts` 结算钩子、新 `whisper` 任务、`App.tsx` 队列 effect、`Roster.tsx`、`AuxViews.tsx`、`Conversation.tsx` | 新任务 scope + 队列字段 + 角标 |
| 2 | 会客厅代表 = 开局指派的首领；卡片先展示委托内容 | `factions.ts` 访问器、`views/AuxViews.tsx`、`game.ts` 的 `factionTask` 预览、`aux-views.css` | 文案 + 预览 + 布局 |
| 3 | 三方首领进入议会，提案可停战/换辖区/开战 | `types.ts`、`opinions.ts`、`llm-night.ts`、`views/AuxViews.tsx`、`components/ProposalDialog.tsx` | 作者模型 + 关系结果 + 提示词 + UI |
| 4 | 接口兼容反向代理 | `llm.ts`、`components/UtilityDialogs.tsx` | URL 构造 + 认证/头 + 设置页 |
| 5 | 首领默认 10 级 | `content/factionLeaders.ts`、相关测试 | 3 个数字 + 断言 |

不做：不改战斗结算公式、不改卡库格式、不引入后端；反向代理仍是浏览器直连，不做 SSE 流式。

## 2. 现状

### 2.1 灯下私语

- `state.messages: Record<string, Message[]>`，`Message` 只有 `role/text`（`types.ts:780`），没有未读、来源、时间。
- 只有玩家开口才写消息：`talk()`（`game.ts:2684`）。
- 委托结算：战斗 `settleCombat`（约 `game.ts:2116`）与调查 `settleInvestigation`（约 `game.ts:2347`）；战报已经以 `BattleState` 存在 `state.battles`（`events` / `units` / `rounds` / `outcome` / `scars`），可以直接喂给模型。
- 头像两处：名册 `#roster-girl-${id}`（`Roster.tsx:33`）与会客厅 `#av-base-talk-${id}`（`AuxViews.tsx:194`），无角标位。

### 2.2 会客厅

- 代表身份是 `factionInfo.envoy` / `.title` 静态字符串（`content/items.ts:8`），与开局指派的首领无关。
- 点「接受委托」才生成任务：`acceptFactionTask` → `factionTask(state, faction)`（`game.ts:554`），卡片上看不到标题、类型、辖区、时长、报酬。
- 列表是三行紧凑布局（`.av-envoy-row`），无头像、无展开。

### 2.3 议会

- `Opinion.authorId` 只允许值夜名册的少女（`llm-night.ts:502`），没有作者类型；势力首领无法提案。
- `OpinionChange` 只有 `gold / reputation / faction / item / girl / minutes`，没有敌意值；`OpinionOutcome` 只有 `territory / mission / join / leave`，没有停战/开战。
- 议会 UI 从 `state.girls` 找作者，代表提案会显示「事务所」。

### 2.4 首领

- `content/factionLeaders.ts` 里三位首领分别是 Lv.7 / Lv.7 / Lv.8；编成、档案、雇佣都读这个等级。

### 2.5 接口

- `apiBase()`（`llm.ts:563`）只去掉末尾斜杠与 `/chat/completions`，硬拼 `/chat/completions`；带查询串/子路径/Azure 路径会拼坏。
- 固定 `Authorization: Bearer`；没有 `x-api-key`、`api-key`、查询参数、自定义头。

## 3. 设计

### 3.1 灯下私语：模型读战报，生成成功才点亮角标

#### 3.1.1 触发与队列

结算末尾不再直接写消息，而是把「想说话」的请求放进持久队列：

```ts
whisperQueue?: {
  id: string;              // day:missionId:girlId
  girlId: string;
  missionId: string;
  day: number;
  outcome: 'victory' | 'defeat' | 'success' | 'failure';
  battleId?: string;       // 战斗才有
  createdAt: number;
}[];
```

- `maybeQueueWhisper(state, mission, squad, outcome, battle?, at)` 在 `settleCombat` / `settleInvestigation` 成功/失败后调用；概率规则同上一稿（胜利 30% + 羁绊/5，失败 45% + (100−羁绊)/10，高疲劳/高侵蚀额外 +10~15%，上限 85%），用 `hashText(day:girlId:missionId)` 确定性随机；每人每天最多 1 条，全所每天最多 3 条。
- 没有配置 API Key 时：不排队、不发消息（功能离线不可用，但也不造假消息）；面板记一条「没有密钥，跳过私语」。
- 队列随存档保存：关掉页面再开，仍会尝试生成；`whisperQueue` 里超过 2 天的条目直接丢弃，避免过期战报突然来信。

#### 3.1.2 生成任务

新增生成任务 `whisper`（`PromptScope` / `PROMPT_TASK_SCOPES` / 默认预设 / 设置页标签「灯下私语」）：

- 输入（系统提示）：
  - 角色卡：名字、称号、性格、外貌、语气（`quote`）、当前羁绊/疲劳/侵蚀/伤势；
  - 委托：标题、辖区、类型、结果、奖励；
  - 战报：逐回合摘要（`battle.events` 里的 round / actor / skill / damage / heal / status），最终 HP，倒下/疤痕；
  - 最近 6 条对话（避免重复说同样的话）。
- 输出：**纯文本 2–3 句、≤120 字**，不要 JSON、不要旁白、不要改数值。
- 预算 400–600 tokens，温度 0.9；失败重试 1 次；两次都失败就丢弃队列条目并写日志，**不加未读**。

#### 3.1.3 App 侧消费

`App.tsx` 新增 effect（等 `loaded` 之后）：

```
while (whisperQueue.length) {
  const job = whisperQueue[0];
  const result = await generateWhisper(config, state, job, preset);
  if (ok) perform({ type: 'addWhisper', jobId: job.id, text: result.text });
  else perform({ type: 'dropWhisper', jobId: job.id, reason: result.message });
}
```

- 一次只处理一条，避免并发烧额度；`generating` 时暂停。
- `addWhisper`：`messages[girlId].push({ role:'girl', text, whisper:true, at })`，`whisperUnread[girlId] += 1`，写一条通知（事务所通知里分类「灯下私语」）。
- 角标只在 `addWhisper` 之后出现；生成期间头像不显示「正在输入」角标（可在叙事引擎面板看到进行中）。

#### 3.1.4 未读与 UI

- `whisperUnread: Record<string, number>`；`lastWhisperDay: Record<string, number>`。
- 名册卡头像右上角数字角标；会客厅成员头像同样；`aria-label="有 N 条新消息"`，`pointer-events:none` 不挡拖拽。
- 打开「灯下私语」调用 `markWhispersRead(girlId)` 清零；`talk()` 也清零。
- 通知中心加「灯下私语」条目，点击直接打开对应少女的对话。

#### 3.1.5 模型上下文示例（节选）

```
【这一战】旧城区 · 深夜清扫 · 胜利
- 回合 1：白洲梓 施放「碎光枪」，对生锈电台造成 24 伤害
- 回合 2：生锈电台 释放「磁带杂音」，白洲梓 心防 −6
- 回合 3：白洲梓 施放「星落」，造成 31 伤害，战斗结束
- 战后：HP 74/109，疲劳 38，无疤痕
【她的语气】安静、话少，但会把担心说成提醒。
```

### 3.2 会客厅：代表就是你的首领

#### 3.2.1 身份统一

新增访问器（`factions.ts`）：

```ts
export function representativeOf(state, faction): {
  id; name; title; color; portrait; portraitSpec; kind: 'leader' | 'envoy';
}
```

- 先读 `state.factionRoster[faction].leaderId`，从 `customFactionLeaders` 或 `factionLeaders` 解析；解析不到才退回 `factionInfo.envoy`（旧档兜底）。
- 会客厅、议会作者、代表委托描述、编年史统一用它；`factionInfo.envoy/envoyTitle` 只作 fallback，不再直接显示。
- 代表称呼用「首领」或首领自己的头衔（`leaderTitle`），不再写「夜祷使/监察官」这类固定身份，除非该首领模板自带。

#### 3.2.2 委托预览

- 导出 `previewFactionTask(state, faction): Mission`（把现有 `factionTask` 改成不写状态，`acceptFactionTask` 复用同一结果，保证预览 = 实际）。
- 卡片显示：委托标题、类型（战斗/调查）、辖区、时长、推荐等级、目标属性与目标值、报酬、完成后的声望/安定变化、敌人数量。
- 「查看详情」打开只读弹窗（`#envoy-preview-${fid}` → `#envoy-preview-close`），不写存档；「接受委托」保留 `#av-envoy-accept-${fid}`，先弹 `#envoy-accept-confirm`。
- 已领态显示「今日已领」+ 任务入口。

#### 3.2.3 文案

- 每个首领一句立场（按声望段：冷淡 / 中立 / 亲近），加上与另外两方的敌意值一句（例：「与星灯协会 92 · 临战」）。
- 代表委托描述改成首领口吻，例如「{首领名}把任务书推过桌面」。
- 截图与代码的人名差异不再重要：一律显示玩家开局指派的首领名。

### 3.3 议会：首领提案，停战/换辖区/开战

#### 3.3.1 作者

```ts
Opinion.authorKind?: 'girl' | 'leader';   // 旧档缺省 girl
Opinion.authorFaction?: FactionId;        // leader 提案必填
```

- `authorId` 为 `rosterLeader(state, faction).id`（可能是自定义首领 id）。
- 解析：`authorKind === 'leader'` → 用 `representativeOf`；否则从 `girls` 找。
- 议会卡、决议记录、编年史统一用 `opinionAuthor(state, opinion)`，显示「月蚀庭首领 · 蚀医·夜鸮」。

#### 3.3.2 关系结果

`OpinionChange` 增加：

```ts
| { kind: 'hostility'; pair: FactionPair; amount: number } // ±20
```

`OpinionOutcome` 增加：

```ts
| { kind: 'truce'; pair: FactionPair; days: number }       // 停战：清掉该对战线，进入冷却
| { kind: 'war'; pair: FactionPair }                       // 立即开战：生成一条战线
```

- **停战**（accept）：新增 `settleTruce(state, pair, days)`：结束该对未完成的战线（`fronts` 标 `resolved`、写战史与日志）、`hostility` 压到 0–20、`truceUntil[pair] = day + days`；`planFronts` 先读 `truceUntil`，冷却期内不再开这条线。代价必须很高：金币 ≥ 3000、声望 −8、作者势力 −10，或割一个辖区（`territory` outcome）。
- **换辖区**（accept）：复用现有 `territory` outcome，把某辖区划给对手方/己方；必须附带金币/声望成本；只能在停战或敌意 < 60 时提出。
- **开战**（reject 可能触发）：新增 `startWarForPair(state, pair, at)`，把 `planFronts` 里「选进攻方 / 防守方 / 辖区 / 建战线」那段抽成公用函数；`war` outcome 直接调用它（不等每日开门），或只给 `hostility +40`，让敌意冲破 100 后由现有每日逻辑开战。议会选项卡明确写「拒绝可能直接开战」，确认弹窗列出后果。
- 校验规则：
  - 关系提案的 `pair` 必须包含 `authorFaction`；`truce` / `war` 只能出现在对应选项（accept / reject）。
  - accept 的成本总和 ≥ 金币 3000 或割让一个辖区；reject 必须带 `hostility` 或 `war`。
  - 已在战线的 pair 不允许再提「开战」；`truce` 的 days 限 5–20。
- 应用后写日志与编年史：「星灯 ↔ 月蚀：敌意 92 → 12，停战 10 天」「驳回提案，协会与月蚀庭开战」。

#### 3.3.3 提示词

- 目录新增 `representatives`：三个首领的 id/name/title/faction/standing/hostility 对。
- 规则：`authorKind` 可为 `girl` 或 `leader`；`leader` 提案必须带 `authorFaction` 与至少一条关系变化/结果；`truce`/`war` 只能按上文出现；数值范围另列（hostility ±20、truce 5–20 天、金币成本 ≥3000）。
- `dialogue.speakerId` 允许首领 id；解析时把首领当可说话角色。

#### 3.3.4 UI

- 提案头部：势力印章 + 首领名/头衔 +「三方首领提案」标签；涉及关系时显示两条势力关系条。
- 选项下方预览：「关系 92 → 72」「星灯 ↔ 月蚀 停战 10 天」「割让旧城区」；点下先确认，不可逆项标红。
- 已决议记录显示关系变化与停战到期日。

### 3.4 接口：反向代理

同上一稿，补齐要点：

- `apiBase` 改为 `buildChatUrl(config)`：`new URL()` 解析，保留子路径与查询串；已含 `/chat/completions` 不重复拼；支持 Azure `/openai/deployments/{model}/chat/completions?api-version=` 与自定义 `customPath`（`{model}` 占位）。
- 认证：`bearer` / `x-api-key` / `api-key` / `query` / `none`，外加 `extraHeaders: Record<string,string>`；`Content-Type` 不允许被覆盖。
- 设置页：接口形态预设（OpenAI / Azure / OneAPI / 自定义反代）、高级折叠（Header 表、查询参数、自定义路径）；端点预览只显示 host+path；日志不记密钥与 header 值。
- 浏览器仍受 CORS 限制；同源反向代理最稳，方案不内置后端。

### 3.5 首领默认 10 级

- `content/factionLeaders.ts`：三位首领 `level: 7/7/8 → 10`。
- 影响：编成首领卡 Lv.10、雇佣首领 `hireLeader` 的基础血量（`96 + empathy*0.3 + level*4`）与档案显示、势力战力展示；相关断言改成 10。
- 自定义首领若来自契约卡，保留卡片等级；只有内置三方首领默认 10 级。

## 4. 状态与迁移

- `GameState.version` 20 → **21**：
  - `whisperQueue = []`、`whisperUnread = {}`、`lastWhisperDay = {}`、`truceUntil = {}`；
  - 旧 `Opinion` 补 `authorKind: 'girl'`；
  - 旧 `Message` 无需改动（新字段可选）。
- `Message` 增加 `at?: string`、`whisper?: boolean`。
- 预设新增 `whisper` scope：`PROMPT_TASK_SCOPES` 从 9 → 10，默认预设、设置页标签、旧档迁移；相应测试数量与 README「九个任务/十种用途」改成「十个任务 / 十一种用途」。
- localStorage 的接口配置新增字段全部可选，旧配置按默认值补。

## 5. 文件清单

| 文件 | 改动 |
|---|---|
| `src/types.ts` | 队列/未读/停战状态、`Message` 元数据、`Opinion.authorKind/authorFaction`、`hostility`/`truce`/`war` |
| `src/game.ts` | `maybeQueueWhisper`、`addWhisper`、`markWhispersRead`、`previewFactionTask`、`settleTruce`、`startWarForPair`、`applyOpinionChanges` 支持新结果、迁移 |
| `src/factions.ts` | `representativeOf` |
| `src/content/factionLeaders.ts` | 首领等级 10 |
| `src/content/items.ts` | envoy 文案降级为 fallback |
| `src/presets.ts` | 新 `whisper` scope 与默认预设 |
| `src/llm.ts` | `generateWhisper`、URL/认证/头构造 |
| `src/llm-night.ts` | `representatives`、首领提案校验、hostility/truce/war 规则 |
| `src/App.tsx` | 私语队列消费 effect |
| `src/components/Roster.tsx` / `Conversation.tsx` | 角标 / 清零 |
| `src/views/AuxViews.tsx` / `aux-views.css` | 代表卡、议会关系预览 |
| `src/components/UtilityDialogs.tsx` | 接口形态/认证/自定义头 |
| `tests/*`、README、todo | 回归与文档 |

## 6. 测试计划

- **私语**：结算入队（战斗/调查、胜/负）、每人每天 1 条上限、无 Key 不排队、生成成功才加未读、失败丢弃不加未读、队列随存档往返、提示词含战报回合与性格。
- **代表**：`representativeOf` 跟随开局指派（含自定义首领）；会客厅卡片显示首领名与委托预览；预览数值 = 接受后任务。
- **议会**：首领提案通过校验；`hostility` 落地与夹取；`truce` 清战线 + 冷却；`war` 立即生成战线；拒绝高风险提案的确认；无对手方的代表提案被拒。
- **首领等级**：新档/编成/档案显示 Lv.10；雇佣首领血量按 10 级算。
- **接口**：URL 子路径/查询/Azure、五种认证、自定义头、日志脱敏。
- 预计：状态测试 +16～20 条，浏览器 +5～7 组。

## 7. 验收清单

- [ ] 打完一场战斗，稍后收到该参战少女的主动消息；消息内容引用了这一战的回合/伤害/结果；角标在消息生成后才出现。
- [ ] 会客厅三位代表就是开局指派的首领；卡片能看到委托标题/类型/辖区/时长/报酬，查看详情不落库。
- [ ] 议会能出现「月蚀庭首领」的提案；批准停战会结束战线并进入冷却，换辖区会改归属；驳回可能直接开战。
- [ ] 首领在编成、档案、雇佣里都是 Lv.10。
- [ ] 设置里能选 Azure/自定义反代，子路径、查询、认证头、自定义头都能用；日志不泄露密钥。
- [ ] 旧档可读；`npm test` 与浏览器验收全绿。

## 8. 风险与取舍

| 风险 | 处理 |
|---|---|
| 模型来信延迟/失败 | 角标只在成功后出现；失败重试一次后丢弃，不伪装成本地消息 |
| 模型写崩角色 | 提示词限定 2–3 句、≤120 字、不得改数值；日志可查看原始请求 |
| 首领提案太强 | 停战/换辖区成本门槛高；开战只在驳回或敌意破 100 时发生；确认弹窗明示不可逆 |
| 换辖区影响既有势力/辖区逻辑 | 复用现有 `territory` outcome；先在测试里覆盖归属、污染、拦截战 |
| 反代配置复杂 | 预设 + 折叠高级项；默认 OpenAI 保持现状 |

## 9. 实施顺序

1. 首领等级 10（最小改动，先把数值定下来）。
2. 代表身份统一（`representativeOf` + 会客厅预览 + 议会作者解析）。
3. 议会关系结果（hostility/truce/war + 校验 + UI）。
4. 私语（新 `whisper` 任务 + 队列 + 角标 + 对话清零）。
5. 接口反代（URL/认证/设置页）。
6. 最后统一跑测试、更新 README 与 todo。

## 10. 待确认（仅一项）

- 停战/换辖区的「很多资源」具体门槛：方案暂定 **停战 ≥3000 星砂 + 声望 −8 + 势力 −10**，换辖区 **≥6000 星砂 + 声望 −12**；开战不额外收费。如果觉得太高/太低，我再调。
