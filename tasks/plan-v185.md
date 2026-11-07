# 方案 v185 · 退休金倍率下调 50%

TASK
  契约者的退休金整体下调一半：日划拨、欠缴累计、续签补缴与档案里的「退休金标准」都按新数值走。
  用户已直接指定下调 50%，本条即为确认。

APPROACH
  在 `src/contracts.ts` 引入 `PENSION_SCALE = 0.5`，`pensionFor` 改为
  `round((240 + 等级 × 160) × PENSION_SCALE)`。其余口径不动：
  日划拨仍是 `pensionFor / 10`，欠缴仍是 `pensionMissed × pensionFor`，
  续签补缴复用同一函数，所以改一处全链路生效。

FILES
  · src/contracts.ts        倍率常量 + pensionFor 公式
  · tests/v185.test.ts      新标准与欠缴累计
  · package.json            test 脚本追加 tests/v185.test.ts
  · tasks/plan-v185.md      本方案
  · tasks/todo.md           v185 勾选

EDGE IN
  · 1 / 5 / 10 级的退休金都正好是原值的一半（原公式结果恒为偶数，取整不丢分）
  · 欠缴按期数累计，0 期仍为 0

EDGE OUT
  · 不迁移旧存档：退休金是即时计算的派生值，没有历史金额需要改写
  · 不改续签价、契约价、返聘价与远程联络费
  · 不改离职判定（欠缴期数）、每日划拨比例（仍是 1/10）

ASSUME
  「倍率」作用在 pensionFor 的最终值上：底薪 240 与每级 160 一起减半，而不是只减等级部分。
