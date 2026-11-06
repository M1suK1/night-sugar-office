# 方案 v159 · 势力首领 / 随从按等级取数值

## TASK

势力首领与随从的等级被统一成首领 10、随从 8–9，但四维还是卡面上的原始值。要让数值跟等级一起长。

## 根因

`src/rules/candidate.ts` 的读档清洗和 `src/factions.ts` 的编成固化：

- `factionLeaderLevel()` 固定返回 10，`factionMemberLevel()` 返回 8 或 9；
- `level` 被改写了，`stats` 直接沿用 `subject.stats` / `src.stats`，没有任何成长换算。

结果：界面与拦截战里显示 Lv.10，四维仍是 1 级卡面值。

## APPROACH

1. `progression.ts` 新增纯函数 `statsAtLevel(stats, fromLevel, toLevel, archetype)`：
   - 先用 `baseStatsAt` 把当前数值回推到 1 级基准；
   - 再按自动升级（主 +6 / 副 +4 每级，上限 120）加到目标等级。
2. 固化时换算：
   - `customLeaderOf`：按 10 级算；
   - `customGirlOf`：按 8/9 级算；
   - `RosterSubject` 增加 `statsLevel`（这份数值对应几级），来自卡面/玩家角色本人等级。
3. 读档兼容：
   - `FactionLeader` / `FactionGirl` 增加 `statsLevel?: number`；
   - `sanitizeCustomLeader/Girl` 若没有 `statsLevel`，按「现有数值＝1 级基准」补一次成长，并写入 `statsLevel`；
   - 有 `statsLevel` 时按它回推再换算，重复读档不会二次膨胀。
4. 不改战斗公式；拦截战、派遣、档案面板读到的 `stats` 自动变成等级后的数值。

## FILES

| 文件 | 改动 |
| --- | --- |
| `src/progression.ts` | 新增 `statsAtLevel` |
| `src/types.ts` | 两个势力类型加 `statsLevel` |
| `src/factions.ts` | `RosterSubject.statsLevel`；两个固化函数换算数值 |
| `src/rules/candidate.ts` | 两个 sanitize 补老档换算 |
| `tests/v159.test.ts` | 换算、固化、老档幂等 |
| `package.json` | 加测试 |

## EDGE IN

- 首领 10 级、随从 8/9 级；原等级 1–10 的卡分配进来都能换算。
- 旧存档（没有 `statsLevel`）：第一次读档补成长；第二次读档数值不变。
- 同一个人从随从调成首领：按 10 级重新换算，不会叠加两次。
- 数值到 120 上限时不再增长。

## EDGE OUT

- 不改内置静态首领/随从（目前是空占位）。
- 不改技能数值与战斗系数。
- 不回溯玩家名册里的角色（他们本来就走 `grantExp`）。

## ASSUME

- 老存档里的势力数值目前就是「1 级基准」，所以按 1 级补成长。若你希望老档从「当前显示等级」开始算（不补），告诉我。
- 成长职阶统一按「输出」（魔力 +6 / 敏捷 +4），与 `customLeaderOf` 现有的 `archetype: '输出'` 一致。

## 测试

- `statsAtLevel`：1→10 主 +54 / 副 +36；10→1 回到基准；上限 120。
- `customLeaderOf`：Lv.10 且数值等于 1→10 自动成长后的值。
- `customGirlOf`：Lv.8 / Lv.9。
- `sanitizeCustomGirl`：无 `statsLevel` 的老数据补一次；再跑一次数值不变。
- `npm test` / `check:rules` / `build` 全绿。
