# 方案 v209 · 阶段委托强制携带后续剧情角色

> 状态：已实现（v209，分支 main）。

TASK
  蓝图里「阶段委托」后面接角色剧情事件时，这支小队必须包含该事件 cast 中的角色；
  没带齐不让派遣，UI 明说还缺谁。

APPROACH
  · Mission 加可选 storyCastIds?: string[]（本次强制同行的人）。
  · storyMissionForBeat 创建委托时预读：
    从任务节点的 success 边（没有就 out）出发，穿过 reward / 0 时长 wait，
    遇到第一个 event 节点，取其 data.cast；
    cast 为空则视为 [故事主角]，和运行时 event 的回退一致。
  · dispatch 增加校验：storyCastIds 全员必须在小队里，缺一个就拒绝并报名字。
  · MissionDialog 在故事委托区列出「剧情同行」，squadReady 也要求选齐；
    与既有 requiredGirlId（指定同行者）并行检查。
  · 编队上限：故事委托存在 storyCastIds 时，squadLimit 至少为该列表长度（最多 3），
    避免调查类委托上限 2 与 3 人剧情冲突。
  · 只认 success/out 分支；failure 分支的事件不强制（任务成败未知，先按叙事主线走）。
  · 旧档任务没有该字段 → 不追加要求；不写迁移。

FILES
  改   src/types.ts                 Mission.storyCastIds?
  改   src/rules/storyChoice.ts     剧情 cast 预读（穿过 reward / 0 时长 wait）
  改   src/rules/storyRun.ts        创建阶段委托时写入 storyCastIds
  改   src/rules/dailyOps.ts        dispatch 校验
  改   src/rules/roster.ts          storyCastIds 的编队上限
  改   src/components/MissionDialog.tsx  显示同行与禁用确认
  新建 tests/v209.test.ts           五条
  改   package.json                 test 登记 v209
  新建 tasks/plan-v209.md           本方案
  改   tasks/todo.md                勾选

EDGE IN
  · 任务后没有 event → 不限制。
  · event cast 为空 → 要求主角。
  · 任务后隔着 reward / 0 时长 wait → 继续找 event。
  · cast 与 requiredGirlId 同时存在 → 两个都检查，去重显示。
  · cast 3 人、调查任务原上限 2 → 该委托放宽到 3。
  · 角色死亡 / 退役 / 出勤中 → 照常被派遣状态校验拦下。

EDGE OUT
  · 不强制 failure 分支的事件 cast。
  · 不强制 choice 各分支的不同 cast（选完才知道走哪条）。
  · 不改蓝图提示词与结构校验；工坊可以继续画任意 cast。
  · 不改事件本身选人逻辑，只改「去阶段委托时必须带谁」。

ASSUME
  · 「后有角色剧情」指 success/out 分支上的第一个 event，中间可隔 reward / 0 时长 wait。
  · 「必须派出」指 cast 里的每一个可编队角色都要在小队里，不是只带主角。
  · storyCastIds 最多 3，与事件 cast 上限一致。

TESTS（tests/v209.test.ts，五条）
  1. mission → event：生成的 storyCastIds 等于 event.cast。
  2. mission → reward → event：能穿过 reward 取到 cast。
  3. cast 为空：storyCastIds 回退主角。
  4. dispatch 缺人拒绝；全员到齐通过。
  5. 调查任务 cast 3 人时 squadLimit 放宽到 3。
