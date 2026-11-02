# v35 方案：把 `game.ts` 按功能拆开

> 目标不是「重构」，是**搬运**：一行行为都不改，只把它切成看得懂、改得动、冲突少的几块。
> 对外入口保持不变——20 个 UI/模块文件和 11 个测试文件都不需要改 import。

## 1. 现状

| 事实 | 数字 |
| --- | --- |
| `src/game.ts` 行数 | 4596（292 KB，仓库最大单文件） |
| 对外导出 | 84 个（含 8 个 type/interface） |
| `act()` | 1192 行、76 个 `case`（3059–4250） |
| 其它函数 | 90 余个：从 `relationshipStage` 到 `importState`，跨度 43–4595 |
| 依赖它的文件 | 20 个 UI/模块（App、Roster、MarketView、行业面板…）+ 11 个测试 |
| 测试规模 | 15 个文件 / 383 条（逐文件跑） |

具体痛点：

1. **改动落在 2500 行外**。加一次委托结算要同时改 `makeCommission`（1110）、`settleInvestigation`（2565）、`processDay`（2681）三处，中间隔着 1400 行无关代码。
2. **`act` 是一个 1200 行的 switch**。想看「读档后事件怎么继续」要在 76 个 case 里跳转，没有一处能一眼看完一条功能闭环。
3. **review 噪音**。任何提交的 diff 都从 `game.ts:1` 开始，和别人的改动天天撞车。
4. **隐式共享**。`findGirl`、`archive`、`pushNotice` 这类小工具被所有流程共用，却和几十个专业逻辑混在一起，看不出谁依赖谁。
5. **新人定位成本**。找 `clinicQuote` 需要先知道它在 2470 行。

已有先例可参考：`combat.ts`、`storygraph.ts`、`incidents.ts`、`progression.ts`、`factions.ts`、`fronts.ts` 等 30 余个模块已经从 `game.ts` 里分出去过，这次是把**剩下的 reducer + 结算 + 存档**按同样风格切完。

## 2. 目标与硬约束

**目标**

- `src/game.ts` 变成只做 re-export 的 barrel，≤ 130 行。
- 功能代码迁入 `src/rules/`，单文件 ≤ 400 行（`act.ts` 允许 ≤ 300）。
- `act()` 的每个 case 变成一行委托调用。
- 依赖单向：`rules/* → rules/core → types`，禁止成环。

**硬约束（不满足就不算完成）**

- 行为零变化：只移动 / 补 `import`/`export` / 拆函数，不改 `GameState` 结构、不改数值、不改提示词、不改随机顺序。
- 公开契约不变：`src/game.ts` 仍然导出当前全部 84 个名字，且类型不变。
- 导入路径不变：UI 与测试里的 `from './game'` / `from '../src/game.ts'` 一行都不改。
- 每步可独立验证：`tsc --noEmit` 0 错 + 15 个测试文件 383 条全过 + 导入图脚本通过。

**为什么用 `src/rules/` 而不是 `src/game/`**：`src/game.ts` 与 `src/game/` 同时存在时，TS 会优先解析文件、Vite 行为一致，但读代码的人每次都要猜「这个 game 到底是文件还是目录」。换个名字（`rules/`）零歧义，也省得以后改 import 后缀。

## 3. 目标结构

| 文件 | 职责 | 主要迁出内容 | 预估行 | 允许依赖 |
| --- | --- | --- | --- | --- |
| `rules/core.ts` | 到处在用的小工具 | `findGirl` `findRosterGirl` `archive` `book` `sampleFor` `dateLabel` `pushNotice` `grantExpWithNotice` | 90 | types |
| `rules/labels.ts` | 展示用常量与映射 | `statLabels` `statusLabels` `workLabels` `workDescriptions` `stageLabels` `stageHints` `relationshipStage` `clock` `WARDROBE_LIMIT` | 40 | types |
| `rules/persistence.ts` | 存档读写与迁移 | `SAVE_KEY` `loadState` `migrate` `importState` `migrateGuardFields` `migrateTierFields` `validGirl` `validGeneratedItem` `validBattleNote` `canAcceptGeneratedContent` `safeId` | 350 | core, state |
| `rules/state.ts` | 开局与实体净化 | `createInitialState` `createBlankState` `createInitialFromPack` `hydrate` `makeCandidate` `sanitizeCustomGirl/Leader` `sanitizeFactionRoster` `sanitizeSubjectStats` `clampStat` `sampleDays` `hashText` `genderOf` `LEADER_HIRE_COST` | 340 | core, labels, outfits, pools, roster, market |
| `rules/outfits.ts` | 立绘与衣柜 | `defaultSkills` `defaultWardrobe` `sanitizeOutfit` `customOutfitFor` `witchOutfitFor` `pruneOrphanVariants` | 90 | types, expressions |
| `rules/pools.ts` | 委托/魔物池 | `missionKey` `missionKeyTaken` `ensureMissionPools` `trimMissionPools` `ensureMonsterPool` `missionVisibleOnMap` | 150 | core, content |
| `rules/missions.ts` | 委托生成与模板 | `missionSeed` `commissionPool` `missionTemplates` `MissionTemplateOption` `makeCommission` `pickDifficulty` `factionTask` `previewFactionTask` `makeBossMission` `annotateMission` `missionSnapshot` `missionDeadlineLabel` `districtOrderFor` `districtPin` `deployMissionTemplate` | 400 | pools, roster, economy, districts |
| `rules/encounters.ts` | 敌群与精英 | `spawnableMonsters` `eliteChance` `SpawnedEnemies` `rollEnemies` `deployIncidentCard` | 130 | content, missions |
| `rules/roster.ts` | 名册/席位/门诊/派遣名额 | `capacity` `seatedGirls` `seatsTaken` `buildCost` `chance` `squadLimit` `squadChance` `drugDaysLeft` `inWithdrawal` `clinicQuote` `treatmentFor` `ClinicQuote` | 160 | core, economy |
| `rules/market.ts` | 市场窗口与货架 | `marketPool` `marketWindowSize` `MarketSlot` `marketSlots` `marketWindow` `normalizeMarketWindow` `unshiftMarketWindow` `refreshMarket` `marketUpgrade` `itemPrice` `factionStanding` `StockOptions` `stockWeights` `stockPicks` `topTierStreakBroken` `makeFactionStock` `makeMarketStock` | 260 | core, economy, factions |
| `rules/conditions.ts` | 侵蚀/药瘾/特性/年金 | `addCorruption` `drugTick` `addCondition` `gainTrait` `tickConditions` `accruePension` | 140 | core, progression |
| `rules/opinion.ts` | 议题与决议 | `makeOpinion` `opinionLimit` `trimOpinions` `applyOpinionChanges` | 160 | core, opinions |
| `rules/battle.ts` | 战斗结算（**不是** `combat.ts`） | `applyScar` `recordBattle` `settleCombat` `settleInterception` `interceptionFor` `applyWitchBounty` `maybeQueueWhisper` `killGirl` `districtOfMission` `applySettleEnvironment` `applyPollutionRelief` `grantTemplateRewards` `settleInvestigation` | 450 | combat, roster, conditions, core |
| `rules/incidentOps.ts` | 弹窗事件的运行时 | `incidentId` `makeRuleIncident` `pickPoolIncidentCard` `rollPoolIncident` `girlInFront` `applyIncidentEffect` | 200 | incidents, hostility, core |
| `rules/storyGraph.ts` | 蓝图推进 | `storyChoices` `storyGraphNode` `storyGraphEdge` `startStoryGraph` `advanceStoryGraph` `resolveStoryWait` | 230 | storygraph, missions, incidentOps |
| `rules/storyMission.ts` | 故事委托 | `planToStoryline` `storyMissionForBeat` `ensureStoryCompanion` `spawnStoryBeat` `completeStoryMission` `failStoryMission` | 220 | storyGraph, missions |
| `rules/storyEvent.ts` | 角色事件与剧情会话 | `addEvent` `buildTemplateArc` `buildTemplateStoryline` `finishStoryEvent` `applyStoryEffect` `fireStoryTrigger` `STORY_SESSION_TURNS` + 会话 4 个 case 的处理器 | 330 | core, storyGraph |
| `rules/time.ts` | 时钟、换日、打烊 | `syncShift` `closeShift` `advanceClock` `settleTreatments` `processDay` `careRecovery` `advance` `endNight` `settleExpiredIncidents` `settleExpedition` | 380 | 大部分 L2/L3（见依赖规则） |
| `rules/dailyOps.ts` | 派遣、陪伴、私语 | `dispatch` `care` `talk` `talkResponse` `normalizeDialogueLines` + 私语 3 个 case 处理器 | 200 | core, battle, roster |
| `rules/rosterOps.ts` | 契约/人事/门诊/房间 | `hire` `renewContract` `rehire` `setAssistant` `build` `retire` `clinic` `startExpedition` `recallExpedition` `hireLeader` `setOfficeProfile` `setStarters` `openingFill` `seenPrologue` 处理器 | 300 | roster, market, contracts |
| `rules/growthOps.ts` | 成长与外观 | `allocateStat` `setLevelUpMode` `changeOutfit` `setExpression` `setPersonality` `importWardrobe` `removeOutfit` `renameOutfit` 处理器 | 160 | progression, outfits |
| `rules/itemOps.ts` | 背包与装备 | `buyItem` `equipItem` `unequipItem` `useItem` 处理器 | 120 | economy, content/items |
| `rules/cardOps.ts` | 卡片导入与候选者 | `advancedRecruit` `importCard` `importCards` `refillMarket` `upgradeMarket` `acceptFactionTask` `createGirl` 处理器 | 320 | cards, cardbox, market |
| `rules/factionOps.ts` | 势力/前线/内容池管理 | `joinFront` `decideOpinion` `mergeIncidentPool` `addIncident` `resolveIncident` `setPoolLimit` `deleteMission` `deleteCandidate` `deleteMonster` `addGeneratedContent` `saveBattleNote` `deleteBattleNote` 处理器 | 260 | factions, fronts, incidents |
| `rules/act.ts` | 调度器 | `act()`：76 个 case，每个一行委托 | ≤ 260 | 上面全部 |
| `src/game.ts` | **barrel** | 显式 named re-export（84 个名字），附 `@internal` 注释说明哪些不该被 UI 用 | ≤ 130 | rules/* |

合计 25 个文件，最大 450 行（`battle.ts`），`game.ts` 从 4596 → ~130。

## 4. 依赖规则

```
types.ts
  ↑
content/*  economy  districts  combat  progression  contracts  factions  fronts
  ↑
rules/core.ts  labels.ts  outfits.ts  pools.ts  conditions.ts
  ↑
rules/missions.ts  encounters.ts  roster.ts  market.ts  opinion.ts  incidentOps.ts
  ↑
rules/battle.ts  storyGraph.ts  storyMission.ts  storyEvent.ts  rosterOps.ts  growthOps.ts  itemOps.ts  cardOps.ts  factionOps.ts  dailyOps.ts
  ↑
rules/time.ts        （换日要写几乎所有系统，允许在这一层横切）
  ↑
rules/state.ts       （开局要初始化上面全部，同样允许横切）
  ↑
rules/act.ts
  ↑
src/game.ts (barrel)
```

三条硬规矩：

1. **只许向上不向下**：下层模块禁止 `import` 上层。`core.ts` 只能依赖 types。
2. **`time.ts` 与 `state.ts` 是横切层**，允许依赖 L2/L3；它们自身**不得被** L2/L3 反向依赖。若真需要（例如 `missions.ts` 想用 `advanceClock`），说明这段逻辑放错层了，要下沉成一个纯函数。
3. **出现环时只允许一种解法**：把共享的那几行纯函数下沉到 `core.ts`。禁止用动态 `import()`、禁止靠 ESM 顺序碰运气、禁止把两个模块合成一个 800 行的大文件。

用 `tools/check-imports.mjs`（新增，约 60 行、零依赖）守这两条：解析 `src/rules/*.ts` 的 import，建图后 DFS 找环，并检查行数上限。

## 5. 实施步骤（每步一条 commit）

| # | 步骤 | 内容 | 验证 |
| --- | --- | --- | --- |
| 0 | 护栏先行 | 加 `tests/game-api.test.ts`（`import * as game` 后比对 84 个导出名的排序快照）+ `tools/check-imports.mjs` + `npm run check:rules` | 新测试单独跑通 |
| 1 | 地基 | `core.ts` `labels.ts` `outfits.ts` 迁出，`game.ts` 改成 `export *` 过渡 | tsc + 全测试 |
| 2 | 存档 | `persistence.ts` | 同上 + `store/v26/v27` 重点看 |
| 3 | 开局 | `state.ts`（`createInitialState` 一族） | + `game` 的 254 条 |
| 4 | 池与市场 | `pools.ts` `market.ts` `encounters.ts` | + `market-window/v24/v32` |
| 5 | 委托 | `missions.ts` `roster.ts` | + `game/budget/v29` |
| 6 | 战斗 | `battle.ts` `conditions.ts` | + `game/v33` |
| 7 | 事件与议题 | `incidentOps.ts` `opinion.ts` | + `v31/v32` |
| 8 | 剧情 | `storyGraph.ts` `storyMission.ts` `storyEvent.ts` | + `v34` |
| 9 | 时间 | `time.ts` | + `game/budget` |
| 10 | 日常 | `dailyOps.ts` `rosterOps.ts` `growthOps.ts` `itemOps.ts` | + 全量 |
| 11 | 卡片与势力 | `cardOps.ts` `factionOps.ts` | + `cards-api/v24/v27` |
| 12 | 调度器 | `act.ts`：76 个 case 变一行委托，`game.ts` 已无业务代码 | + 全量 |
| 13 | 收口 | barrel 改显式 named re-export；更新 README/todo 行数与文件表 | + 全量 + `check:rules` + `npm run build`（本地） |

每步固定动作：

```powershell
node .\node_modules\typescript\bin\tsc --noEmit
foreach ($f in 'game','budget','vertex','v24','v26','store','cards-api','v27','research','market-window','v29','v31','v32','v33','v34') {
  node --experimental-strip-types --test-isolation=none --test "tests/$f.test.ts"
}
node tools/check-imports.mjs
```

（测试必须逐文件跑：多文件同进程会串内容库状态，v24/budget 会假失败。）

## 6. `act` 的拆分细则

处理器签名统一成：

```ts
type Act<K extends GameAction['type']> = Extract<GameAction, { type: K }>;
export function applyHire(state: GameState, action: Act<'hire'>): ActionResult { … }
```

`act()` 里每个 case 收敛成 `case 'hire': return applyHire(state, action);`（case 已经窄化类型，不需要断言）。分组与去向：

| 组 | 去向 | case |
| --- | --- | --- |
| 时钟 | `time.ts` | `reset` `advance` `endNight` |
| 日常 | `dailyOps.ts` | `dispatch` `care` `talk` `markWhispersRead` `addWhisper` `dropWhisper` |
| 契约人事 | `rosterOps.ts` | `renewContract` `rehire` `setAssistant` `hire` `retire` `clinic` `startExpedition` `recallExpedition` `hireLeader` `setOfficeProfile` `setStarters` `openingFill` `seenPrologue` |
| 成长外观 | `growthOps.ts` | `build` `changeOutfit` `setExpression` `setPersonality` `allocateStat` `setLevelUpMode` `importWardrobe` `removeOutfit` `renameOutfit` |
| 物品 | `itemOps.ts` | `buyItem` `equipItem` `unequipItem` `useItem` |
| 卡片市场 | `cardOps.ts` | `advancedRecruit` `importCard` `importCards` `refillMarket` `upgradeMarket` `acceptFactionTask` `createGirl` |
| 势力内容 | `factionOps.ts` | `joinFront` `decideOpinion` `mergeIncidentPool` `addIncident` `resolveIncident` `setPoolLimit` `deleteMission` `deleteCandidate` `deleteMonster` `addGeneratedContent` `saveBattleNote` `deleteBattleNote` |
| 剧情 | `storyEvent.ts` / `storyGraph.ts` | `startStoryline` `setStoryPlan` `addStoryline` `decideStoryChoice` `advanceStoryline` `addCharacterEvent` `startCharacterEvent` `advanceEvent` `beginStoryEvent` `startStorySession` `appendStoryTurn` `replaceStoryTurn` `finishStorySession` `chooseStoryPort` `chooseStoryPassage` `resolveEvent` |
| 其它变体 | `growthOps.ts` | `setVariant` `setVariants` `deleteVariant` `setOutfitDescription` `setWitchForm` `clearWitchForm` |

目标：`act()` 从 1192 行降到 ≤ 260 行，逻辑体全部在功能文件里。

## 7. 公共 API 稳定性怎么保证

1. `tests/game-api.test.ts` 冻结导出名快照（84 个）。任何移动导致漏导出/重命名，测试立刻红。
2. barrel 用**显式** named re-export，不用 `export *`：
   - 一屏能看清对外契约；
   - 重名会直接在编译期报错，而不是静默以某一个为准；
   - 以后要收窄内部 API（例如 `storyGraphNode`、`missionSnapshot` 不该被 UI 用）时，只需从 barrel 删一行。
3. 内部函数保留原导出形态 + `@internal` 注释，**本轮不动它们**，避免一次改动太大。

## 8. 风险与对策

| 风险 | 表现 | 对策 |
| --- | --- | --- |
| 循环依赖 | Vite 运行时报 `Cannot access before initialization`，测试却全绿 | `check-imports.mjs` 进 CI 脚本；发现环就下沉纯函数 |
| 行为悄悄变化 | 移动时顺手「整理」了逻辑 | 每步只做移动；禁止在拆分 commit 里改任何 `if`/数值/顺序；结束时跑 `git diff -w --stat` 抽查 |
| 测试隔离假象 | 多文件同进程导致 v24/budget 假失败 | 固定逐文件命令，写进 README 与 todo |
| `noUnusedLocals` 报错 | 拆走后残留 import | 每步 `tsc` 立刻暴露，顺手删 |
| barrel 掩盖依赖 | `import { … } from './game'` 看不出真实来源 | 本轮先保路径，下一轮（v36）再考虑把 UI 改成直接从 `rules/*` 导入；barrel 里按层分组注释 |
| diff 与其他分支冲突 | 大文件搬迁必然撞车 | 每步独立 commit、可单独 revert；建议在功能冻结窗口做 |
| 构建不可用 | 沙箱里 `npm run build` 被拦（vite 配置阶段 spawn 被拒） | 拆分只影响 TS 结构，`tsc --noEmit` + 测试即可验证；最终 `dist` 由你本地 `npm run build` 重建 |

## 9. 验收清单

- [ ] `src/game.ts` ≤ 130 行，且只含 re-export 与注释。
- [ ] `src/rules/*.ts` 单文件 ≤ 450 行（超了说明那一块还得再分）。
- [ ] `act()` ≤ 260 行，76 个 case 全部一行委托。
- [ ] 84 个导出名、类型完全不变（快照测试通过）。
- [ ] `tsc --noEmit` 0 错。
- [ ] 15 个测试文件、383 条逐文件全过。
- [ ] `check-imports.mjs`：无环、每文件行数达标、无 L2/L3 反向依赖 `time.ts`/`state.ts`。
- [ ] 手动冒烟：新档 → 派遣 → 战斗结算 → 打烊换日 → 读档 → 进入交互剧情（v34 会话）→ 结束事件 → 蓝图继续。
- [ ] README 的目录/测试说明、`tasks/todo.md` 增加 v35 小节。

## 10. 明确不做

- 不改任何数值、提示词、随机顺序、存档结构（`GameState` 一个字段都不动）。
- 不改 UI 的 import 路径（留到 v36）。
- 不引入 `madge` 等新依赖；不启用 ESLint 规则大扫除。
- 不做命名风格统一（`settleX` / `applyX` / `makeX` 混用保持原样），避免把功能改动埋进搬迁 diff。
- 不动 `llm.ts`（2090 行）——它是下一次拆分的目标，单独出方案。

## 11. 工作量与顺序建议

| 阶段 | 步骤 | 预估改动 | 风险 |
| --- | --- | --- | --- |
| A 地基 | 0–3 | 约 700 行搬迁 + 2 个新文件 | 低：依赖少，测试面窄 |
| B 领域 | 4–8 | 约 1900 行搬迁 | 中：循环依赖最可能出现 |
| C 流程 | 9–11 | 约 800 行搬迁 | 中：换日/派遣链路长，靠 `game` 254 条兜底 |
| D 收口 | 12–13 | `act` 拆壳 + barrel | 高：case 多，但每步都有测试 |

建议 A→D 顺序推进，中间每步都能独立提交与回滚；若时间紧，做完 A+B 就已经能拿到「找代码不再靠滚轮」的主要收益。
