# v27 方案：卡库成为唯一的人事来源（开局 20 张选人池 / 市场从卡库补货 / 卡库瀑布流）

> 目标一句话：把「谁可以成为契约者」彻底交给玩家的契约卡库——开局先摆出最多 20 张卡当编成选人池（默认角色只在卡不够 20 张时补位），没被选中的卡直接进市场池；市场池不再由本地随机或叙事者生成，缺人时从卡库余额补货，卡用完了就明确提示去加卡；卡库本身从「一行一条」改成瀑布流。

## 1. 范围与边界

### 1.1 要做的

| # | 需求 | 落地位置 | 规模 |
|---|---|---|---|
| 1 | 开局从卡库导入上限 20 张 | `src/opening.ts`、`src/game.ts`、`src/App.tsx` 的 `startNewGame` | 1 个常量 + 初始值 + 迁移 |
| 2 | 卡够 20 张时不显示默认少女与首领，不够才补位 | `src/roster.ts`、`src/components/StarterDialog.tsx` | 1 个模式参数 + 1 个 prop |
| 3 | 市场池改由卡库补货 | 新 `src/cardMarket.ts`、`GameAction.refillMarket`、`src/App.tsx` | 1 个新模块 + 1 个动作 + 1 个 effect |
| 4 | 卡库用完时提示加卡 | `src/App.tsx` 通知、`src/views/MarketView.tsx` 空态、`src/components/CardLibraryDialog.tsx` | 文案 + 入口 |
| 5 | LLM 不再生成候选者 | `src/llm-night.ts`、`src/components/ProposalDialog.tsx`、提示词 | 删一段 schema/物化/预览 |
| 6 | 卡库改瀑布流 | `src/components/CardLibraryDialog.tsx`、`src/dialogs.css` | 标记 + 26 行 CSS |

### 1.2 不做的

- 不改卡库的存储格式（还是 IndexedDB 里的 `night-sugar:cardbox:v1`）、不改卡 JSON 的 schema。
- 不改战斗、经济、委托、势力、污染数值；卡牌候选仍按现有规则算契约费（见 §10 待确认 4）。
- 不把卡库做成可上传/云同步；「加卡」仍是本地文件、扫描目录或拖拽。
- 不重做市场页布局，只在候选为空/卡库用完时补一块提示。
- 不删叙事者的其余生成物（魔物、委托、议案、代表委托、装备照旧）。

## 2. 现状（改之前）

```
startNewGame()
  └─ importCards(最多 poolLimits.candidates - candidates.length = 6 - 1 = 5 张)
       └─ 只进 candidates；StarterDialog 从 girls + custom candidates 里挑 4–6 人

refreshMarket()   ← 每次跨日（state.marketDay < state.day）
  └─ 本地随机造 2–5 位原生候选（makeCandidate），7 天/3 天过期

generateDaily() → materializeNightProposal()
  └─ 每晚物化 1 位 LLM 候选者，写进 candidates

卡库列表
  └─ <li class="cardbox-row"> 一行一张（flex 纵向），带勾选框、名字、等级、元素、出身
```

- `poolLimits.candidates` 默认 **6**（`src/game.ts:1935`），设置页可调 1–40。
- `refreshMarket`（`src/game.ts:385`）只补**非自定义**候选，且槽位是 `min(marketSize(marketLevel), 6 - customCount)`；`marketSize` 随市场等级 2–5。
- `makeCandidate` 造的原生候选带 `candidateUntilDay`（1–3 天后过期）；契约卡导入的候选是 `custom: true`，永不过期；契约费按 `1800 + 等级 × 220` 算（Lv.1 = 2,020 星砂）。
- `StarterDialog` 的可选池 = `state.girls`（4 位在编 + 退役栀子）+ `state.candidates` 里的自定义卡；三方编成的池 = `rosterPool()`，顺序是**内置 3 首领 → 9 随从 → 自定义名册 → 卡库 → 自定义少女**（`src/roster.ts:60`）。
- `materializeNightProposal`（`src/llm-night.ts:858`）把 `proposal.candidate` 物化成一位候选；`validateNightProposal` 把 `candidate` 当必填。
- 卡库列表样式在 `src/dialogs.css:554-571`：`.cardbox-list{display:flex;flex-direction:column}`，一行一条，最多 40vh 高。

## 3. 设计

### 3.1 开局：20 张选人池，没选中的进市场

- 新常量 `OPENING_CARDS = 20`（`src/opening.ts`，和 `OPENING_OPINIONS` 放一起）。
- `poolLimits.candidates` 默认 **6 → 20**：它既是市场池容量，也正好装下「20 张选人池减去被编进名册的最多 6 人」。
- `startNewGame()`（`src/App.tsx`）：
  1. `reset` 之后，如果卡库里有可用卡，先把内置候选 `lu` 从 `candidates` 里清掉——她是「默认市场面孔」，卡库开局不该占掉一个位置；
  2. 再按 `addedAt` 从新到旧把 `min(OPENING_CARDS, 卡库里还没用过的卡数)` 张卡导入 `candidates`（`custom: true`、`cardId: <hash>`，契约费沿用导入规则），重复卡（`cardId` 已在 `girls` / `candidates` / `customFactionGirls`）跳过；
  3. 这 20 张就是编成界面的选人池；`setStarters` 确认后，**被选中的 4–6 人进名册，没被选中的继续留在 `candidates` 里——也就是市场池**。
- 没有卡（或卡库为空）时不删 `lu`，走原来的默认开局；编成池靠内置角色补位（§3.2）。
- 顺序上仍然是「先导进候选、再编成」：候选池在编成期间是同一份数据，确认编成只做「移出被选中的人」，所以不需要再造一个临时人池。

### 3.2 默认角色什么时候出现

判定基准：**卡库里能用的卡 ≥ 20 张时，编成界面完全不显示内置角色**；不足 20 张时，内置角色按「补到 20」的顺序补在卡后面。

| 位置 | 卡 ≥ 20 | 卡 < 20 |
|---|---|---|
| 编成「自己的名册」网格 | 只显示卡（+ 玩家自定义登记的人） | 卡在前，内置 4 位在编少女补在后面 |
| 三方首领 / 随从池 | 只有卡（+ 自定义） | 卡在前，内置 3 首领 + 9 随从补在后面 |
| 名册初始勾选 | 卡库前 6 张（`已选 6 / 6`） | 卡库全部 + 内置补到 4 人（现在的行为） |
| 市场候选 | 全是卡 | 全是卡（内置候选不再生成，见 §3.3） |

- `rosterPool(state, library, { cardsOnly })`：`cardsOnly` 为真时跳过 `factionLeaders` / `factionGirls` / 非自定义 `state.girls`；为假时保持现有顺序，但把卡库放到内置之前，并且总数截到 `OPENING_CARDS`。
- 同一张卡只能出现一次：卡库条目（id `card-<hash>`）如果已经作为候选/名册导入（`girl.cardId === hash`），池子里就跳过它，避免「同一个人既是候选又是卡」占两格。这条去重现在 `rosterPool` 里没有，v27 必须补。
- `StarterDialog` 新增 `cardsOnly?: boolean`，由 App 按「卡库里可用卡数 ≥ 20」传入；`poolPicks` 同步过滤掉 `!custom` 的在编少女。
- 内置角色只是「补位」：一旦卡够了，退役的栀子、默认四方和三位内置首领都不再出现在编成里（她们仍留在存档和世界设定里，不影响已开的档）。

### 3.3 市场池从卡库补货

新模块 `src/cardMarket.ts`（约 70 行，纯函数）：

```ts
/** 市场还缺几个位置：`poolLimits.candidates - candidates.length`。 */
export function marketCardGap(state: GameState): number;
/** 从卡库里挑还没用过的卡：按 addedAt 从新到旧，跳过已编入名册/候选/势力的 cardId。 */
export function unusedCards(box: CardBoxEntry[], state: GameState, limit: number): CardBoxEntry[];
/** 卡库是否已经完全用光（没有可补的卡）。 */
export function cardBoxExhausted(box: CardBoxEntry[], state: GameState): boolean;
/** 该不该催玩家加卡：没有可补的卡，且市场真的快没人了（候选 ≤ 2）。 */
export function marketNeedsCards(state: GameState, box: CardBoxEntry[]): boolean;
```

- 新动作 `{ type: 'refillMarket'; cards: GirlCard[] }`（`src/types.ts` + `src/game.ts`）：
  - 逐个走现成的 `importCard` 逻辑（解析、`cardId` 去重、候选上限）；
  - 全部失败时返回 `ok: false`，消息沿用「没有新的契约卡进名册」；
  - 成功时写一条 `kind: 'market'` 日志：「市场补进了 N 位新面孔：A、B、C。」
- `refreshMarket`（跨日）**删除** `pushCandidate` 调用与 `factionBag`：不再生成原生候选，只做过期清理（原生候选以后不会再产生，这段等于空转，保留函数以防旧档里还有）。顺带把 `refreshMarket` 里写死的 `6 - customCount` 换成 `state.poolLimits.candidates - customCount`，免得 20 的口径和这里对不上。
- App 侧补货 effect（`src/App.tsx`）：

  ```ts
  useEffect(() => {
    if (phase !== 'play' || !booted) return;
    if (marketCardGap(state) <= 0) return;
    if (refilling.current) return;
    refilling.current = true;
    void refillMarketFromCards();   // 读卡库 → unusedCards → perform({ type: 'refillMarket', cards })
  }, [phase, booted, state.day, state.candidates.length]);
  ```

  触发点因此覆盖：开局进正片、跨日、雇走一位候选、手动删候选。从卡库导入新卡不会改变 `candidates.length`，所以 `CardLibraryDialog` 的 `onImport` 回调里要再手动调一次补货。`refilling` 用 ref 防重入，函数式 `setState` 落地，避免和玩家的其它操作互相覆盖。
- 补货口径：只要还有没用过的卡、且候选没到上限，就一次补满；没有可补的卡就什么都不做（不硬造人）。
- 「卡库用完」的提示只在**真的没人可雇**时出现：`unused === 0` 且 `candidates.length <= 2`。
  - 记一次 `marketEmpty.current = state.day`，同一天只提示一次；
  - `notify('卡库里的卡都用完了。去契约卡库加几张新的，市场会自己补货。', false)`；
  - 市场页在候选为 0 时显示 `#market-card-hint`：「卡库里的卡都用完了」+ 按钮 `#market-open-cardbox`（打开卡库）。
  - 这样 20 张开局、卡库只剩这 20 张时，市场还有 14 位候选，不会立刻催玩家去加卡。
- 卡库本身不因「被市场用过」而删除条目：卡是玩家的文件柜，去重靠 `cardId`，不靠删卡。

### 3.4 LLM 不再生成候选者

- `src/llm-night.ts`：
  - `NightProposalV2.candidate` 从必填改为**可选**，`validateNightProposal` 不再因缺 candidate 报错；
  - 结构化提示词删掉 candidate 段与 `candidate` 的目录要求，`pool.candidates` 从提示里去掉（不再问模型「市场还缺几个人」）；
  - `materializeNightProposal` 不再物化候选者，返回值里的 `candidates` 恒为空数组（保留字段，调用方不用改签名）。
- `src/components/ProposalDialog.tsx` 删掉「02 新的候选者」整块；预览只剩魔物 / 委托 / 议案 / 代表委托 / 装备。
- 设置页「生成今晚的提案」的说明文案同步：候选者改由卡库补充，叙事者只写事件与委托。
- 旧提案日志/旧档不受影响：已经落库的候选照常存在。

### 3.5 卡库瀑布流

`src/components/CardLibraryDialog.tsx` 的列表从「一行一条」改成瀑布流卡片：

```
<ul id="cardbox-list" class="cardbox-list">   ← CSS columns，列宽 ~170px
  <li id="cardbox-row-<hash8>" class="cardbox-card">  ← break-inside: avoid
    <input id="cardbox-check-<hash8>">
    <span class="cardbox-card-mark">安</span>   ← 首字色块（用 entry.factionTag 的颜色）
    <span class="cardbox-name">名字<small>文件名</small></span>
    <div class="cardbox-card-meta">Lv.4 · 星光系 · 月蚀庭</div>
  </li>
</ul>
```

- 保留现有 id 规则：`#cardbox-row-<hash8>`、`#cardbox-check-<hash8>`、`#cardbox-list`，浏览器流程不用改选择器。
- 不解析立绘：卡库里有 10MB+ 的卡，打开对话框就解析 20 张会让首屏卡住；首字色块 + 名字足够挑人。以后要立绘再按需懒解析。
- CSS（`src/dialogs.css`）：

  ```css
  .cardbox-list{columns:3;column-gap:10px;max-height:min(46vh,360px);overflow:auto}
  .cardbox-card{break-inside:avoid;margin:0 0 10px;padding:10px;…}
  @media(max-width:900px){.cardbox-list{columns:2}}
  @media(max-width:560px){.cardbox-list{columns:1}}
  ```

- 选中态沿用 `.on`（边框 + 背景），勾选框仍可键盘操作；整张卡可点。

## 4. 状态与动作

| 项 | 改动 |
|---|---|
| `GameState.version` | 19 → **20**；`loadState` / `importState` 白名单加 20 |
| `poolLimits.candidates` | 新档默认 6 → **20**；老档 `Math.max(现值, 20)` |
| 新动作 | `{ type: 'refillMarket'; cards: GirlCard[] }` |
| 去重键 | `cardId`（= 卡库条目的 `hash`）：`girls`（含退役/离世）、`candidates`、`customFactionGirls` 都算已用 |
| 不变 | 候选/名册/势力编成的数据结构；卡库存储；`startersPicked` |

- `poolLimits.candidates` 的上限校验保持 1–40，设置页「市场池」一栏的说明改成「卡库往这里补货，补满就停；开局最多摆 20 张供编成挑选」。
- `openingGaps().candidates` 自动跟着 20 走，首夜空缺提示的文案不用改。

## 5. UI 与文案

| 位置 | 文案 / 改动 |
|---|---|
| 标题页 `#start-hint` | 已覆盖「卡库 N 张」；新增一句「开局会先把最近导入的 20 张排进名册」 |
| 编成页头 | 卡 ≥20 时：「今夜只从你的卡库挑人」；卡不够时：「卡库不够 20 张，先用默认阵容补满」 |
| 编成网格空态 | 卡库 0 张且没有内置补位（空白档案）→ 「先去契约卡库加几张卡」+ `#starter-add-card`（已有） |
| 市场页 | 候选为空且卡库空 → `#market-card-hint`：「卡库里的卡都用完了。加几张新卡，市场会自己补货。」+ `#market-open-cardbox` |
| 通知 | 「市场补进了 N 位新面孔」；「卡库里的卡都用完了……」每天最多一次 |
| 卡库 | 瀑布流；顶部「全选当前 N 张」「上限 60 张」不变 |
| 叙事者设置 | 「候选者改由卡库补充；叙事者只写魔物、委托与议案」 |

## 6. 迁移与兼容

| 项 | 处理 |
|---|---|
| `version` 19 老档 | 升到 20；`poolLimits.candidates = Math.max(值, 20)` |
| 老档里的原生候选 | 保留（会按 `candidateUntilDay` 自然过期）；不再新增 |
| 老档里已导入的卡候选 | 不动；`cardId` 继续用于去重 |
| 老档的 LLM 候选 | 保留；以后不再生成 |
| 设置页自定义上限 | 迁移只抬高到 20，玩家之后仍可手动调回 1–40 |
| 空白档案 | 同样 20；卡库有卡也会进编成（v26 已有规则），市场从卡库补 |

## 7. 测试计划

### 7.1 状态测试（新增 `tests/v27.test.ts`，10 条）

1. 新档 `version === 20` 且 `poolLimits.candidates === 20`。
2. v19 老档（上限 6）读入后是 20；原来填 8 的保持 8 以上（`max`）。
3. 清掉内置候选后，`importCards` 能一次收 20 张卡进候选，第 21 张被上限拒绝。
4. `refillMarket` 只补没用的卡，补满到上限就停。
5. `refillMarket` 跳过已经在 `girls` / `candidates` / `customFactionGirls` 里的 `cardId`。
6. `refillMarket` 在卡库空时返回 `ok: false`，状态不变。
7. `refreshMarket` 跨日不再生成原生候选（空卡库跨日后候选数不变）。
8. `materializeNightProposal` 不再产出候选（返回的 `candidates` 为空）。
9. `rosterPool(cardsOnly: true)` 不含内置首领/随从/原生少女；`cardsOnly: false` 时内置补位且总数 ≤ 20。
10. 开局勾选规则抽成纯函数 `starterPicks()`：卡库 ≥20 时取前 6 张，<20 时「卡 + 默认补到 4」；`marketNeedsCards()`：候选 3 位以上不提示，≤2 且卡库无可用卡才提示。

### 7.2 浏览器流程（97 → 100）

1. **卡库瀑布流**：塞 6 张小卡打开卡库，`.cardbox-list` 的计算样式 `column-count ≥ 2`，`.cardbox-card` 数量为 6，`#cardbox-row-<hash8>` 仍可点选。
2. **开局 20 张**：塞 20 张小卡 → `#start-new` → `#starter-count` 是「已选 6 / 6」，网格里不含「月见桃」等内置名字；进市场前候选池恰好 20 张且都是卡（内置候选 `lu` 已被清掉；确认编成后剩 8 张）。
3. **市场用完提示**：塞 1 张卡开局 → 编成里取消勾选这张卡（保住 4 位默认）→ 确认后这张卡留在市场 → 按契约费雇走 → 候选为 0，市场出现 `#market-card-hint` 且含「用完」，点 `#market-open-cardbox` 打开 `#cardbox-dialog`。

- 现有流程要改的：v26 的「卡库优先 → 5/6」在只有 1 张卡时仍然成立（默认四人补位）；但 v26 状态测试里按 `poolLimits.candidates = 6` 写死的断言（「卡库导入按候选上限收」那条）要改成按当前上限算，否则改成 20 之后取不到足够的卡。

## 8. 实施顺序

1. `src/types.ts` / `src/game.ts`：版本 20、`poolLimits` 20、迁移、`refillMarket` 动作。
2. `src/opening.ts`：`OPENING_CARDS = 20`。
3. `src/cardMarket.ts`：`marketCardGap` / `unusedCards` / `cardBoxExhausted`。
4. `src/game.ts`：`refreshMarket` 去掉原生候选生成。
5. `src/llm-night.ts` + `ProposalDialog.tsx`：候选者转可选、停止物化、删预览块、改提示词。
6. `src/roster.ts` + `StarterDialog.tsx`：`cardsOnly` 与 20 张补位规则。
7. `src/App.tsx`：`startNewGame` 导 20 张（先清 `lu`）、补货 effect 与 `CardLibraryDialog.onImport` 的手动触发、用完提示、市场打开卡库的接线。
8. `src/views/MarketView.tsx` + `src/components/CardLibraryDialog.tsx` + `src/dialogs.css`：提示块与瀑布流。
9. `tests/v27.test.ts`、`tests/browser.mjs`、README / `tasks/todo.md` / 本文件末尾的实际规模。

## 9. 风险与取舍

- **市场一次性铺 20 张**：市场页会很长，契约费沿用现有规则（Lv.1 是 2,020 星砂），开局 12,840 星砂只够雇 6 位左右，20 张不会一次被买空。
- **新档没卡**：严格按需求，市场会空着并提示加卡；内置四人只在编成里补位。对第一次打开游戏的人是负体验，但符合「卡库是唯一人事来源」。
- **LLM 提案少了一块**：每日提案从「5 件套」变成「4 件套」，旧提示词副本里还留着 candidate 要求也不会报错（schema 转可选）。
- **卡库瀑布流不显示立绘**：首字色块换来打开速度；卡库 20 张 × 10MB 的立绘解析会卡首屏。
- **老档的上限被抬高**：迁移会改 `poolLimits.candidates`，属于对玩家设置的覆盖；只在低于 20 时抬，之后可手调。

## 10. 已确认的设计决定

| # | 问题 | 决定 |
|---|---|---|
| 1 | 默认角色何时隐藏 | **卡库里可用卡 ≥ 20 张就全部隐藏**：内置四人、三位首领、九位随从都不进编成池；不足 20 张时按「补到 20」补在后面 |
| 2 | 20 张是什么 | **编成界面的选人池**：开局把这 20 张摆出来挑 4–6 人，没选中的留在候选池（市场）等雇佣 |
| 3 | 卡库空了怎么办 | **允许市场长期没人**：不再造原生候选，只在候选 ≤2 且没有可补的卡时提示去加卡 |
| 4 | 卡牌候选的契约费 | 沿用现有导入规则 **1800 + 等级 × 220**（Lv.1 = 2,020 星砂），不改成免费。你的 20 张卡全是 Lv.1，导入后等级照卡面走 |
| 5 | 其余 | 按方案里的建议执行（卡库瀑布流不解析立绘、同一张卡按 `cardId` 去重、`lu` 在卡库开局时清掉） |

> 关于第 4 点：契约卡 JSON 里的等级由卡面决定（`girl.level`，`parseGirlCard` 原样保留）。核对了 `data/cards` 里的 20 张，全部是 Lv.1，所以「开局卡默认 1 级」在你的卡库上成立；以后导入高等级卡时，等级也会照原样进来。

## 11. 实施记录

按 §8 全部落地，规模 **332 项状态测试 / 100 组浏览器流程**。

### 11.1 与方案的偏差

| 方案 | 实际 | 原因 |
|---|---|---|
| 默认三方各坐满 4 位随从 | 只坐 **1 位**（3 首领 + 3 随从） | 20 张卡若被 6 名册 + 14 三方吃掉，市场就是空的，和「没选中的进市场」冲突；最低配阵容既合法又给市场留 8 张 |
| 编成默认沿用 `defaultFactionRoster()` | 卡够 20 时用 `cardFactionRoster()` 预填 | 内置阵容的 id 不在 cardsOnly 池子里，`legal` 会一直不通过，确认按钮点不了 |
| 去重靠 `girl.cardId` | 给 `FactionLeader` / `FactionGirl` 补 `cardId` 并在 `sanitizeCustomLeader/Girl` 保留 | 编进三方的卡会离开候选池，不记 cardId 的话市场补货会把同一张卡再拉进来 |
| 市场提示「候选 ≤2 且无卡」 | 同方案 | 20 张开局时市场还有 8 位，不会立刻催加卡 |
| 契约费 0 | 沿用 `1800 + 等级 × 220`（Lv.1 = 2,020） | 契约卡导入本来就是收费的，不改经济；用户的卡全是 Lv.1 |

### 11.2 20 张的去向

以卡库正好 20 张为例：6 张被编进名册、3 张当三方首领、3 张当随从，剩下 **8 张留在市场**等雇佣；卡库还有更多卡时，进正片后会立刻补回市场容量上限。

### 11.3 构建备注

`tools/vite.mjs` 加了 `--configLoader runner` 之后，`npm run build` 从项目目录直接跑通，不再需要 subst 盘符；之前 `subst X:` 只是绕开 esbuild 打包配置文件时的向上解析。
