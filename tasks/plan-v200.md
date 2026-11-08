# 方案 v200 · 侵蚀显示修正 + 魔女出勤代价 + 70 不可逆

> 状态：已实现（v200，分支 `superpowers/witch-corruption-rules`）。

TASK
  1. 修掉档案里两处显示错位（魔女阈值口径、共情修正错位一档）。
  2. 魔女化队员出勤时，其他队员对她的同伴关系下降。
  3. 侵蚀 70 起不可逆：抑制剂只能续命，唯一解除路径是记忆清除。

APPROACH
  1. `economy.ts` 导出 `WITCH_STAGE_AT = 70`，新增 `corruptionEmpathyPenalty(value)`
     （由 `corruptionMultipliers` 折成百分比）。`CharacterDialog` 的 `corruption-facts`
     改成三项：魔女化礼装（`loadBalance().corruptionThreshold`）、魔女阶段（70）、共情修正。
  2. `balance.ts` 增加 `witchSquadRelation`（默认 −4，范围 −10…0）。
     新模块 `src/rules/witchSquad.ts`：`applyWitchSquadRelation(state, squad)`，
     每个非魔女队员对每个魔女各扣一次，夹 0–100，写一条汇总日志；
     战斗与调查结算各调一次。
  3. 不可逆：
     · `applySuppressWitch`：`corruption >= WITCH_STAGE_AT` 直接拒绝（只能续命）。
     · `drugTick` 不变：10 天一支续命，断药按 8/14/22/40 掉血，第 10 天死亡。
     · 记忆清除（`clinic` / `clear`）成为唯一出口：魔女态不要求精神疤痕，价格仍是 1,200
       （诊所等级折价照旧）。清完：`witch = false`、`drugUntilDay = undefined`、
       `withdrawalDays = 0`、**侵蚀归零**、**等级回 1 + 经验归零 + 属性回 baseStats +
       baseMaxHp 回退**、条件清空、**删除 `state.events` 里她已完成的「回忆」**，
       立绘留在第五格。
     · 本地档案 `storyArchive` 不动（记录页仍可回看）。
     · 记忆重塑（`wipe`，4,000）保持原样，本次不改。
  4. 档案文案：≥70 时抑制剂那一栏显示「续命」，并写明唯一解除方式是记忆清除。

FILES
  src/economy.ts                      WITCH_STAGE_AT + corruptionEmpathyPenalty
  src/components/CharacterDialog.tsx  两处显示 + 文案
  src/balance.ts                      witchSquadRelation
  src/rules/witchSquad.ts             新增
  src/rules/battle.ts                 结算调用
  src/rules/investigation.ts          结算调用
  src/rules/growthOps.ts              suppressWitch 的 70 门槛
  src/rules/rosterOps.ts              记忆清除：魔女分支（等级重置、成长清空、回忆删除）
  tests/v200.test.ts                  新建
  package.json                        挂 v200

EDGE IN
  · 40–69：仍可自愿进入、随时用抑制剂压回（暂时魔女化，照旧）。
  · ≥70：抑制剂只能续命；断药 10 天死亡；记忆清除后回到 0、形态解除、药效计时清零。
  · ≥70 且没有精神疤痕时也能做记忆清除（疤痕不再是指令前提）。
  · 「回忆」只删 `state.events` 里她已完成/已收束的会话，进行中的不动。
  · 多魔女出勤：关系惩罚按「每个非魔女 × 每个魔女」叠加，下限 0。

EDGE OUT
  · 不改 `girl.bond`（与所长的羁绊），只动 `girl.relationships`。
  · 不改断药伤害曲线与死亡判定；不改记忆重塑。
  · 不新增存档字段；不碰 `storyArchive`。
  · 普通（非魔女）记忆清除的行为完全不变。

ASSUME
  · 侵蚀归零：魔女态清除后 `corruption = 0`，不是 69。
  · 价格沿用 1,200，诊所折价照旧。
