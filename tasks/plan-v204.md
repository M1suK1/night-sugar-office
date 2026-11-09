# 方案 v204 · 诊所按钮显示价与折后扣款对齐

> 状态：已实现（v204，分支 `superpowers/memory-reshape-merge`）。

TASK
  诊所「记忆重塑 / 复制契约」按钮显示 4,000 / 18,000，实际扣款却按诊所等级打折；
  余额不足的判断也用原价。要统一成：按钮文案、提示文案、禁用门槛都按折后价。

APPROACH
  · 规则层新增两个纯函数：clinicLevel(state)（没有诊所按 1 级）与
    clinicCost(state, base) = clinicPrice(base, clinicLevel(state))。
  · rosterOps 改用共享的 clinicLevel，删掉文件内的私有副本。
  · 三个界面在渲染时取一次折后价，用它同时决定按钮文案、禁用条件与提示段落。
  · 折扣规则、基础价、诊所等级上限全部不动。

FILES
  改   src/rules/roster.ts           导出 clinicLevel / clinicCost
  改   src/rules/rosterOps.ts        改用共享 clinicLevel，删私有实现
  改   src/game.ts                   导出两个新函数
  改   src/components/CharacterDialog.tsx  重塑/复制按钮：价格文案 + disabled 门槛
  改   src/components/RoomDialog.tsx       手术页提示 + 两个按钮的 disabled 门槛
  改   src/views/AuxViews.tsx              手术页提示 + 按钮文案 + disabled 门槛
  新建 tests/v204.test.ts            四条
  改   package.json                  test 脚本登记 v204
  改   tasks/todo.md                 勾选
  新建 tasks/plan-v204.md            本方案

EDGE IN
  · 没有诊所 / 1 级诊所：显示与扣除都是 4,000 / 18,000。
  · 4 级诊所（默认每级 5%）：显示与扣除都是 3,400 / 15,300。
  · 余额正好等于折后价时可以点击；少于折后价才禁用。
  · 折扣上限 60% 照旧，display 与结算共用同一个 clinicCost，不再各算一套。

EDGE OUT
  · 不改诊所折扣规则、基础价与等级上限。
  · 不改「治疗 / 癖好护理」报价（ClinicPanel 已按 clinicQuote 实时算）。
  · 不动 v203 的重塑语义与回忆删除。
  · 不做四舍五入以外的价格展示策略（不写「4,000 起」）。

ASSUME
  · 玩家看到的价格就是这次要扣的价格，折扣直接体现在数字上。
  · 诊所等级只从 state.rooms 里 type === 'clinic' 的房间读，和结算逻辑同源。
  · 版本号用 v204：v202 仍被终局方案占用，v203 已实现。
