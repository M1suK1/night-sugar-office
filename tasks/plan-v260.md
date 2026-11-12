# v260 · 精炼 / 炼制装备实例读档后消失

TASK
精炼过词条的装备读档后不见了。
根因：读档 `normalizeState` 用 `validGeneratedItem` 过滤 `state.generatedItems`，该函数要求 id 以 `lm_item_` 开头（为 LLM 产出设的闸），而精炼实例 id 是 `refine-…`，整条被当非法数据丢弃 → 没有 `registerItem` → 少女槽位与仓库里的 id 变成悬空引用，界面上什么都查不到。
炼制兜底出的 `craft-…` 同一根因，而且炼制压根没写过 `generatedItems`，所以炼出来的东西读档也消失。

APPROACH
1. 校验分层：`validGeneratedItem` 保留为「LLM 产出的装备」校验（只认 `lm_item_`，逻辑不动）；新增 `validStoredItem`（`src/rules/validate.ts`）给读档用，前缀放行 `lm_item_ / refine- / craft- / relic-`，`lm_item_` 仍走原函数，其余只校验「能不能渲染、能不能装备」。
2. 单一上限：`GENERATED_ITEM_LIMIT = 200` 放 `src/content/items.ts`，精炼、炼制、读档共用——此前写 120、读档只留 40，超出的会被静默丢掉。
3. 裁剪保引用：`pruneGeneratedItems` 优先留住被仓库或少女槽位引用的实例，再按「新的在前」补满上限。
4. 炼制产物也写进 `state.generatedItems`；精炼改用同一个 `rememberGeneratedItem`。

FILES
- `src/content/items.ts`：新增 `GENERATED_ITEM_LIMIT` / `referencedItemIds` / `pruneGeneratedItems` / `rememberGeneratedItem`。
- `src/rules/validate.ts`：新增 `validStoredItem`。
- `src/rules/persistence.ts`：读档改用 `validStoredItem` + 按引用裁剪。
- `src/refine.ts`：入库改走 `rememberGeneratedItem`。
- `src/crafting.ts`：`craft-…` 实例写入 `generatedItems`。
- `tests/v260.test.ts` 与 `package.json`：回归测试。

EDGE IN
- 仓库里的精炼件、穿在身上的精炼件（含同一件连精多次）。
- 兜底炼制出的 `craft-…` 实例。
- 条目数超上限时，被引用的一律保留。
- 旧档里已有 `lm_item_…` 的 LLM 装备行为不变。

EDGE OUT
- 历史版本已经被丢弃的实例不尝试恢复：存档里那份数据早没了，没有可重建的依据。
- 不清理仓库里已经悬空的 id（界面本来就跳过，不影响游玩）。

ASSUME
- 本地实例的数值由代码写死，读档只校验形状，不夹数值上限。