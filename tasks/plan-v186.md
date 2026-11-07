# 方案 v186 · 蓝图开场白回归修复

TASK
  故事线蓝图事件自带 `opening` 时，界面要像 v123 之前一样直接用它开场；
  不能因为等不到玩家的 `playerSeed` 就停在空白会话。同步补一条回归测试。

APPROACH
  把 App 里的自动开场判断收成一个纯函数 `shouldAutoOpenStory`：
  `mode === 'session'`、`status === 'active'`、没有 turns，且
  「玩家已写 seed」或「蓝图自带非空 opening」之一成立。
  App 只负责在弹窗打开时调用它；约谈 / 会议没有 opening，仍走玩家先写。

FILES
  · src/storySession.ts     新增纯函数 shouldAutoOpenStory
  · src/App.tsx             自动开场门槛改为调用该函数
  · tests/v186.test.ts      5 条回归用例
  · package.json            test 脚本追加 tests/v186.test.ts
  · tasks/plan-v186.md      本方案
  · tasks/todo.md           v186 勾选

EDGE IN
  · 蓝图 opening 为空或只有空白：不算已就绪，仍等玩家写
  · 已有 turns / 已结束 / 非 session：不重复开场
  · 玩家 seed 为空串（按引子开始）：照常开场

EDGE OUT
  · 不改 `seedStorySession` 清空 opening 的行为（重写开场仍按 v123 设计）
  · 不改约谈 / 会议的入场流程与提示词
  · 不改 `startStorySession` 的回合结构

ASSUME
  「节点上的开场白作为开头」指 opening 原样成为第一轮 narrator 文本；玩家不需要再点一次开场。
