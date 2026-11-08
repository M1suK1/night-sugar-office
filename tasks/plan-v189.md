# 方案 v189 · 把收尾引子写回回合记录

TASK
  v188 让「点结束前留在输入框里的那句」进了收尾提示词，但它没有进回合记录：
  回看这段剧情时看不到自己最后写的那一句。现在把它当作最后一轮玩家发言记下来。

APPROACH
  1. `finishStorySession` 动作增加可选 `lead`；App 两条收尾路径（有模型 / 本地收尾）都带上。
  2. 在 `applyFinishStorySession` 里，找到事件、确认还没结束之后立刻写入这一轮：
     压成一行、截 300 字，id 用 `turn-say-` 前缀，排在结局与岔路旁白之前。
  3. 轮数在写入之前先算好：引子没有真的发出去，只入档，不改羁绊结算，
     日志里的「走了 N 轮」仍按真正来回的回合数。
  4. 因为写在世界观分支判断之前，蓝图岔路口的「导向结局」也会先把这句记下来。

FILES
  · src/types.ts                 finishStorySession 加 lead
  · src/rules/storyOps.ts        写入玩家轮次，轮数改为前置计算
  · src/App.tsx                  两条收尾路径都传 lead
  · tests/v189.test.ts           4 条
  · package.json / tasks/plan-v189.md / tasks/todo.md

EDGE IN
  · 空串 / 纯空白：不写回合，行为与 v133 一致
  · 换行与多余空白压成一行；超长截 300 字（与输入框一致）
  · 重复结束、找不到事件：沿用原守卫，不写回合
  · 本地收尾（无叙事者）同样留档

EDGE OUT
  · 不改回合提交、重写、删除的既有流程
  · 不把引子算进羁绊与轮数
  · 不改摘要生成（v188 的提示词照旧）

ASSUME
  「写回回合记录」= 作为一条 role 为 player 的 StoryTurn 存在，能被回看与后续摘要引用。
