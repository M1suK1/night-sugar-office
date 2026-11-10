# v237 · 魔法少女对战：编队最多比对面多一人（3v3 封顶）

TASK
只在「对手是魔法少女」的战斗里限制编队：辖区当主的拦截战、势力的破坏行动。
编队上限 = 对面出场人数 +1（1→2、2→3、3→3），可以少派；魔物委托与 Boss 战按你的决定不动。

APPROACH
新增 `src/rules/duel.ts` 作为唯一口径：
- `duelOpponents(state, mission)` 返回对面人数（不是魔法少女对战则返回 undefined）。
  - 已有 `mission.interception`（破坏行动在建单时写入）直接取 `girlIds.length`；
  - 普通委托能被拦截时，沿用手感公式 `1 + floor(recommendedLevel / 4)`，夹在 1–3，
    再按该势力名册人数取小（结算时 `interceptionFor` 也只能从名册里挑人）；
  - 旧档破坏行动没有 `interception` 时，用 `envoyRaidSquadIds` 按同一业务日重算（与结算同源）。
- `squadLimitFor(state, mission)` = 对面人数 +1，封顶 3；没有对面就回落到现有 `squadLimit(mission)`。
  `squadLimit` 本身不改，避免影响别的调用方与旧测试。

UI 与派遣校验都改读 `squadLimitFor`；拦截提示里写明「对面会派 N 人」，
破坏行动的「对面的人」一节补上人数与上限。不做「必须满员」校验（你选的是「可以少派」）。

FILES
- 新增 `src/rules/duel.ts` — 对面人数与编队上限的唯一实现。
- `src/rules/dailyOps.ts` — dispatch 的编队校验改用 `squadLimitFor`，超限提示写明对面人数。
- `src/components/MissionDialog.tsx` — 上限取 `squadLimitFor`；拦截/破坏行动显示对面人数；指派文案改「最多 N 位」。
- `src/game.ts` — 转出 `duelOpponents` / `squadLimitFor`。
- `tests/v237.test.ts` + `package.json` — 新增用例并登记。

EDGE IN
- 推荐等级 1–3 → 1 人，4–7 → 2 人，8+ → 3 人；名册只剩 1 人时按 1 人。
- 破坏行动：以 `interception.girlIds` 为准；旧档缺字段时按 `envoyRaidSquadIds` 重算。
- 调查委托被拦截：上限也按对面人数 +1（1 人→2 人，2 人→3 人）。
- 已写下 `interception` 的委托按已写人数算。
- 旧存档不迁移，读取时现算。

EDGE OUT
- 魔物委托（含 4–6 只的高难单）与 Boss 战：按你的决定不改。
- 战线（fronts）是积分对抗、不是逐单位战斗，不套用。
- 不改拦截概率、判定条件与结算流程。

ASSUME
- 对面人数以结算时同一套公式为准；途中名册变化时，UI 与结算都以当时状态现算（与现有拦截提示一致）。
