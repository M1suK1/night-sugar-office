# v32 方案：议题上限、每日提案瘦身、内容池扩容与默认退休角色

> 目标一句话：议事桌每天最多摆出设施允许的议题；首夜由叙事者一次写满，之后每天补到上限；日常提案不再产出新魔物；魔物池扩到 50、调查委托 20、战斗委托 120，且地图上没有同名重复委托；新游戏不再默认把栀子放进退休区。

## 1. 范围

| # | 需求 | 主要落点 | 规模 |
|---|---|---|---|
| 1 | 每天议题上限 3，随设施等级提升；不显示超过上限的议题；首夜 LLM 立刻生成 3 条，每天补充；不再显示默认提案 | `game.ts` 的 `generateOpinions` / `openingFill` / `createInitialState`、`llm-night.ts` 的提案 schema、`CouncilView.tsx` | 结构 + 状态 + UI |
| 2 | LLM 每日提案不再生成新魔物 | `llm-night.ts` 的 `NightProposalV2` / prompt / 校验 / `materializeNightProposal`、`App.tsx` 的 `addGeneratedContent` | 契约删减 |
| 3 | 魔物池 50、调查委托 20、战斗委托 120；地图委托不重复 | `poolLimits`、`opening.ts`、新增内容池填充器、`game.ts` 的 `deployMissionTemplate` / dedupe | 生成器 + 迁移 |
| 4 | 新游戏移除退休区的默认栀子 | `createInitialState` 的 `zhi` 退休块 | 一行逻辑 + 测试 |

不做：

- 不改战斗结算、委托奖励、污染与势力规则。
- 不把议事流程改成“必须全部处理完才能换日”。
- 不删除已有的自定义魔物、旧存档里的栀子或旧委托。
- 不重做议事厅视觉；只改能显示/能生成的条数。

## 2. 现状

### 2.1 议题

- `generateOpinions`（`game.ts:743`）在待议达到 6 条时停止；每天换日只补 **1 条**（`game.ts:2495`）。
- `openingFill`（`game.ts:2992`）先用本地 `generateOpinions` 补到 `OPENING_OPINIONS=3`，再让 LLM 补一条；所以首夜会同时出现默认议题和模型议题。
- `createInitialState` 还预置了一条「星象台的窗需要修」的默认议题（`game.ts:1995`）。
- `CouncilView` 的 `pending` 直接取全部 pending（`CouncilView.tsx:61`），没有上限。

### 2.2 每日提案

- `NightProposalV2` 固定包含 `monster`（`llm-night.ts:101`）；`materializeNightProposal` 每次都造一只 `lm_*` 魔物（`llm-night.ts:925`），`addGeneratedContent` 再推进 `customMonsters`。
- 提案只有一个 `opinion`，无法一次写满 3 条议题。

### 2.3 内容池

- `poolLimits` 只有 `missions: 12 / monsters: 8 / candidates: 20`（`game.ts:1987`）。
- 首夜只从内容包摆出少量委托；没有“按战斗/调查分别补到 120/20”的机制。
- 模板标题有重复可能；`addGeneratedContent` 只检查 `mission.id`，不检查标题或描述重复。

### 2.4 栀子

- `createInitialState` 把 `zhi` 强制设成 `retired=true`（`game.ts:1940`），所以新游戏退休区默认有栀子，且她不在 5 人值班名册里。

## 3. 设计

### 3.1 议题上限：由会客厅等级决定

新增：

```ts
export function opinionLimit(state: GameState): number {
  const lounge = state.rooms.find(room => room.type === 'lounge');
  return Math.max(3, Math.min(5, 1 + (lounge?.level ?? 2)));
}
```

- 当前会客厅初始 2 级 → **3 条**；升到 3 级 → 4 条；4 级 → 5 条。
- 只保留最多 `opinionLimit` 条 pending；超过部分在换日整理时标为 `deferred`（不删除，进记录可回看），不参与 UI 和计数。
- `CouncilView` 用 `pending.slice(0, limit)`；侧栏“待决议”显示 `Math.min(pending.length, limit)`。
- 每天只在换日时补到上限，**处理完一条不会当天自动补**；次日再补。

### 3.2 首夜与每日议题生成

- `createInitialState` 删除默认 `seedOpinion`；新游戏议事桌为空，等待叙事者。
- `openingFill` 不再调用本地 `generateOpinions` 补议题：
  - 没有 API Key：只补待用事件，议事桌保持空，并显示“配置叙事者后生成议题”，不显示默认提案。
  - 有 Key：立即调用一次每日提案，要求生成 `opinionLimit` 条议题。
- `generateContent('auto')` 每天只跑一次；生成前算 `need = limit - pending.length`，把 `need` 传给 prompt。
- `generateDaily` 返回 `opinions: NightOpinionSpec[]`（1–3 条），不再返回单条 `opinion`；旧字段兼容一版，解析时归一化。
- 采纳后按顺序 push，超过上限的丢弃并写日志；不生成默认文案作为兜底。

### 3.3 每日提案不再生成魔物

- `NightProposalV2` 删除 `monster` 字段；prompt、示例 JSON、校验目录同步删除。
- `NightMissionSpec.enemyRefs` 只能引用现有魔物目录（内置 + 已登记的 `customMonsters`），不再允许 `"generated"`。
- `materializeNightProposal` 不再创建 `MonsterTemplate`，返回 `{ mission, opinions, envoyMission, items }`。
- `addGeneratedContent` 不再接收 `monster`，也不 push `customMonsters`；每日自动补充的提示改为“新的委托与议题”。
- 工坊手动创建魔物仍保留，池容量 50。

### 3.4 内容池与去重

#### 3.4.1 容量

`poolLimits` 扩展为：

```ts
poolLimits: {
  missions: number;          // 总数，默认 140，兼容旧逻辑
  combatMissions: number;    // 120
  investigationMissions: number; // 20
  monsters: number;          // 50
  candidates: number;        // 20
}
```

旧档迁移：

- `combatMissions ??= 120`
- `investigationMissions ??= 20`
- `missions ??= combatMissions + investigationMissions`
- `monsters ??= 50`

#### 3.4.2 新游戏填充

新增 `src/content/pool-fill.ts`（或 `src/missionPool.ts`）：

```ts
export function ensureMissionPools(state: GameState): number;
export function ensureMonsterPool(state: GameState): number;
```

- 先统计当前 `open | active` 的战斗/调查数量；只补缺口，不替换已有委托。
- 模板来源：内置 `missionTemplates()`、`extraMissions`、工坊模板；先放模板本身，再按辖区/目标/难度生成变体，直到 120/20。
- 唯一键：`missionKey = normalize(title) + '|' + normalize(description)`；生成前查 `state.missions` 与本次已生成集合，撞了就换辖区/目标/后缀（`· 其二`），保证标题与描述不重复。
- 坐标按辖区确定性抖动，避免 140 个图钉重叠在同一点。
- 新游戏在 `createInitialState` 末尾调用一次；换日只补被完成/过期清掉的缺口。

#### 3.4.3 魔物池

- 容量 50；新游戏用内置 6 只 + 44 只本地变体补满，变体只改名字/称号/描述与数值档位，复用现有 `spec/rules`，不引入新技能。
- `ensureMonsterPool` 用确定性 `hashText` 生成，读档不抖；已存在的 `customMonsters` 不重排。
- LLM 不再增加魔物，只有工坊可手动新增。

#### 3.4.4 LLM 委托去重

- `addGeneratedContent` 在写入前检查 `missionKey` 是否已在 `state.missions`；重复则拒绝并返回“已有同名委托，请重新生成”。
- 若自动补充遇到重复，记一条 warning 并跳过，不硬塞；下一晚再试。
- 首夜/每日填充器与 LLM 共用同一个 `missionKey` 函数，避免两套标准。

### 3.5 移除默认退休栀子

`createInitialState` 删除：

```ts
const zhiIndex = ...
zhi.retired = true ...
```

保留栀子作为 **5 名初始在册成员之一**（`yue / tang / ling / wu / zhi`），`lu` 仍在候选池。这样退休区默认为空，诊所文案不需要改。

旧存档不动：已经退休的栀子继续留在退休区，只有新游戏生效。

### 3.6 议事 UI

- `CouncilView` 只渲染 `pending.slice(0, opinionLimit(state))`。
- 侧栏显示 `待决议 {shown}/{limit}`；超过时在底部提示“还有 X 条已转入暂缓，明日再议”。
- 空桌文案：
  - 未配置 Key：“叙事者尚未接入，今晚没有新议题。”
  - 已配置但生成失败：“叙事者没有写成议题，可手动重试。”
- 不恢复任何默认议题。

## 4. 数据与兼容

- `NightProposalV2` 删除 `monster`：旧日志/旧测试里的 proposal JSON 仍可能带 `monster`，解析时忽略未知字段，不报错。
- `opinions` 数组与旧 `opinion` 单条并存：解析时优先 `opinions`，缺失则 `[opinion]`。
- `poolLimits` 新字段全部可选，迁移时补默认值；`poolLimits.missions` 继续保持“总容量”，避免现有设置页和测试断裂。
- `missionKey` 只用于去重，不写进存档；旧委托不回溯删除。
- 已完成委托仍按 v31 的 `completedDay` 规则，只在地图显示当天完成的。

## 5. 测试

### 5.1 单元

- `opinionLimit`：会客厅 2/3/4 级 → 3/4/5；`trimOpinions` 把超出部分转 deferred。
- 首夜：无 Key 不产生默认议题；有 Key 的 mock 返回 3 条 → 状态里 3 条且都来自模型。
- 每日自动补充：pending=1、limit=3 → prompt 要求 2 条；pending=3 不再请求。
- 提案：JSON 含 `opinions` 3 条；旧 `opinion` 单条仍能解析；不含 `monster` 时校验通过；`addGeneratedContent` 不增加 `customMonsters`。
- 池：新档战斗 120 / 调查 20 / 魔物 50；所有 `missionKey` 唯一；重复 LLM 委托被拒绝。
- 迁移：旧档 `poolLimits` 补 120/20/50；旧档退休栀子不被强制复职。
- 新档 `zhi.retired === false`，退休区为空。

### 5.2 浏览器

- 议事桌首夜显示 3 条，升级会客厅后显示 4 条，不显示第 4/5 条。
- 无 Key 首夜不出现默认「星象台的窗需要修」。
- 自动补充后待议数量不超过上限；已处理一条不会当天补回。
- 市场/记录页不因 140 条委托卡死；地图列表能打开前 10 条且无同名。
- 新游戏退休区没有栀子；5 人值班名册里有栀子。

## 6. 风险

| 风险 | 处理 |
|---|---|
| 140 个图钉渲染卡顿 | 地图默认按辖区聚合计数，列表虚拟滚动或分页；先测 140 条 |
| 本地生成 140 条委托文案重复/生硬 | 唯一键硬校验 + 多段模板组合；重复直接补后缀并写测试 |
| 50 只魔物变体同质化 | 只复用现有 spec/rules，名字/称号/描述按辖区与元素组合；工坊仍可替换 |
| 首夜无 Key 议事桌为空 | 明确空态与“配置叙事者”提示；不恢复默认提案 |
| 旧档 pending 超过新上限 | 换日整理时转 deferred，不删除，记录可回看 |
| LLM 不再产魔物后战斗委托缺敌人 | `enemyRefs` 只允许现有魔物；填充器确保 50 只池子可用 |

## 7. 实施顺序

1. `types.ts`：`poolLimits` 新字段、`NightProposalV2.opinions`、兼容字段。
2. `content/pool-fill.ts`：`missionKey`、`ensureMissionPools`、`ensureMonsterPool`、确定性变体。
3. `game.ts`：`opinionLimit`、`generateOpinions`/`openingFill` 改造、`createInitialState` 去栀子退休与默认议题、池迁移。
4. `llm-night.ts`：提案删魔物、opinions 数组、校验与 materialize。
5. `App.tsx`：`addGeneratedContent` 去掉 monster、首夜/每日 need 传递、自动补充提示。
6. `CouncilView.tsx`：上限切片、空态、计数。
7. 测试、构建、浏览器验收、README/todo 记录。
