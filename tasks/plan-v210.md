# 方案 v210 · 完整故事线前提与更长的行动选项

> 状态：已实现（v210，分支 main）。

TASK
  1. 【她的过往】不再把故事线 premise 截到 60 字；两条完整前提都要能进提示词。
  2. 每轮给玩家的行动选项不再截到 24 字；允许更长的完整选项。

APPROACH
  · storylineHistoryText：去掉 premise.slice(0, 60)，预算从固定 320t 改为按段数给
    （每段约 520t，最低 320t，最高 1400t）；超出时仍整段丢最旧的故事线并注明。
  · llm.ts：开场与续写的 options 解析上限从 24 字改为 60 字。
  · promptSections.ts：arc 开场 / 续写契约的选项长度要求同步改为 60 字。
  · 不改选项数量上限（仍是 3 条），不改 UI 结构。

FILES
  改   src/girlDossier.ts            premise 完整保留 + 动态预算
  改   src/llm.ts                    两个 options 解析上限 60
  改   src/promptSections.ts         两份选项契约 24 → 60
  新建 tests/v210.test.ts            四条
  改   package.json                  test 登记 v210
  新建 tasks/plan-v210.md            本方案
  改   tasks/todo.md                 勾选

EDGE IN
  · 两段故事线各有 150 字左右前提 + 已走过 / 当前幕：都保留。
  · 三段故事线超过 1400t：丢最旧一段，保留省略说明。
  · 选项 24–60 字：完整保留；超过 60 字才截断。
  · 选项仍只取前 3 条。

EDGE OUT
  · 不改历史总预算 1600t 的全局规则；故事线自身最多 1400t。
  · 不改蓝图 choice 节点的 2–4 个选项，也不改其 24 字编辑上限。
  · 不新增存档字段。

ASSUME
  · 「完整 premise」指 storyline.premise 原样，不再按 60 字切。
  · 选项上限 60 字足够覆盖模型常见输出；仍保留上限防止异常长文本。

TESTS（tests/v210.test.ts，四条）
  1. 两段长 premise 都原样出现，不再断在 60 字。
  2. 三段超预算时只丢最旧一段，并出现省略说明。
  3. 开场解析保留 40 字选项。
  4. 续写解析保留 40 字选项。
