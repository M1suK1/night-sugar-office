# 方案 v203 · 记忆重塑与记忆清除合并为一个动作

> 状态：已实现（v203，分支 `superpowers/memory-reshape-merge`）。

TASK
  把「记忆重塑」与「记忆清除」合并成同一个动作：月光诊所只保留「记忆重塑」一个入口，
  4,000 星砂（诊所等级折扣照旧）。一次重置等级、经验、属性、血上限与全部疤痕；
  若她是魔女，同时解除魔女化（侵蚀归零、断药计时清零、条件清空）。
  她已完成的回忆一并抹掉；本地档案里已保存的回忆不动。
  删除 1,200 的「记忆清除」，普通契约者不再有单条清疤路径。

APPROACH
  · 规则层只留 clinic/wipe：把 clear 分支里的魔女处理与删回忆并入 wipe，删除 'clear'
    分支与 MEMORY_CLEAR_COST、clearScarId。
  · 回忆不保留、人格保留：重塑会删掉 state.events 里她已完成/已收束的会话（进行中的、
    别人的不动）；storyArchive 里已保存的回忆不动。该逻辑从 clear 分支搬进 wipe，
    普通态与魔女态一致生效。
  · 界面统一：删掉所有「记忆清除」按钮与入口，重塑按钮文案写明「等级、属性、疤痕归零；
    魔女态同时解除魔女化；已完成的回忆一并抹去」。
  · 类型收窄：GameAction 的 clinic mode 从 'treat' | 'wipe' | 'clone' | 'clear'
    收成 'treat' | 'wipe' | 'clone'，删 clearScarId。
  · 测试迁移：v25 / v141 / v200 / v201 里按 clear 写的用例改写成 wipe 或删除；
    新增 tests/v203.test.ts 钉住合并后的唯一语义。
  · 旧档：clinic 的 mode 不进存档，不需要迁移；但老档里的 witch / corruption /
    drugUntilDay 原样保留，读档后第一次重塑即收敛。补一条「老档魔女」用例。

FILES
  改   src/rules/rosterOps.ts          clear 的魔女处理与删回忆并入 wipe；删除 clear 分支
  改   src/rules/roster.ts             删除 MEMORY_CLEAR_COST
  改   src/game.ts                     移除 MEMORY_CLEAR_COST 导出
  改   src/types.ts                    clinic mode / clearScarId 收窄
  改   src/components/CharacterDialog.tsx  删清除按钮；魔女提示与重塑副标题改文案
  改   src/components/ClinicPanel.tsx  删 onClear 与「记忆清除」按钮
  改   src/components/RoomDialog.tsx   删 onClear 传参，mode 类型收窄
  改   src/views/AuxViews.tsx          删 onClear，诊所提示与按钮文案
  改   src/rules/growthOps.ts          「唯一解除方式」提示改成记忆重塑
  改   src/rules/conditions.ts         删掉遗留的「记忆清除」注释
  改   tests/game.test.ts              v25 两条清除用例改写/删除，去掉导入
  改   tests/game-api.test.ts          导出清单去掉 MEMORY_CLEAR_COST
  改   tests/v141.test.ts              折扣用例改成对重塑收费打折
  改   tests/v200.test.ts              魔女解除改走 wipe；删普通清疤用例
  改   tests/v201.test.ts              合并后的语义（重塑同时解除魔女化、删回忆）
  新建 tests/v203.test.ts              五条
  改   package.json                    test 脚本登记 v203
  改   tasks/todo.md                   勾选
  新建 tasks/plan-v203.md              本方案

EDGE IN
  · 魔女态重塑：witch = false、corruption = 0、drugUntilDay = undefined、
    withdrawalDays = 0、conditions = []；等级/经验/属性/baseMaxHp/疤痕与普通重塑一致。
  · 重塑删回忆：不论是否魔女，都删掉 state.events 里她已完成/已收束的会话；
    进行中的、别人的不动。storyArchive 不动，人格与羁绊保留。
  · 出勤中（mission / expedition）仍拒绝；普通态没有疤痕也可以重塑（全量重置本来就不要求疤痕）。
  · 诊所等级折扣照旧：4,000 × (1 − 折扣)，折扣上限 60%。
  · 复制契约、治疗、癖好护理完全不动。

EDGE OUT
  · 不改 4,000 定价与诊所折扣；按钮显示原价、结算按折价的旧口径这次不动（另开一版）。
  · 不改断药曲线、70 不可逆门槛、抑制剂逻辑，只改提示里「唯一解除方式」的名字。
  · 不改存档结构与 migrate；不删 storyArchive。
  · 不合并「治疗 / 癖好护理」。

ASSUME
  · 合并后沿用「记忆重塑」这个名字和 4,000 定价（已确认）。
  · 回忆按 state.events 里「已完成/已收束」的会话算；storyArchive 属于「已保存的回忆」，
    不动。人格与羁绊不随重塑清空。
  · 普通契约者不再有 1,200 的单条清疤路径（已确认）。
  · 旧方案文档 plan-v25 / v200 / v201 保留原样作为历史，不回改。
  · 版本号用 v203：v202 已被终局方案（tasks/plan-v202.md）占用且尚未实现。
