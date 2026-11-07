# 方案 v190 · 回看时立绘表情跟着读到的那一轮

TASK
  「观看保存的剧情」用原文视图回看时，立绘表情不跟着剧情走：一打开就是整段最后一句的脸，
  往下读也不变。舞台视图本身是逐拍取表情的，没问题。

APPROACH
  1. 抽纯函数 `expressionAtTurn(turns, turnId?)`（src/storySession.ts）：
     从「读到的那一轮」往回找最后一句非玩家台词，取它的 speakerId 与 expression；
     没有阅读位置就退回最后一句，保持原有行为。
  2. `StorySession` 记录阅读位置：容器顶端往下 110px 作为阅读线，
     滚动时用 rAF 节流算「线上最后一轮」，写进 `readingId`。
  3. `latest` 由「整段最后一句」改为 `expressionAtTurn(turns, readingId)`；
     悬停某句仍优先（preview 不变）。
  4. 打开回看、新的一轮落地时各重算一次，第一屏就是这一轮该有的表情，不用等玩家滚动。

FILES
  · src/storySession.ts            新增 expressionAtTurn
  · src/components/EventDialog.tsx 阅读线 + rAF 节流 + latest 改口径
  · tests/v190.test.ts             4 条
  · package.json / tasks/plan-v190.md / tasks/todo.md

EDGE IN
  · 读到玩家轮：沿用她上一句的表情；没有台词的轮次往回跳
  · 没有阅读位置（首帧、找不到节点）：退回最后一句
  · 空段落 / 没有 turns：返回 null，交给默认表情
  · 滚动节流与卸载时取消 rAF

EDGE OUT
  · 不改舞台（视觉小说）视图：它本来就按节拍取表情
  · 不改归档结构与导出文本
  · 不改立绘差分的取图逻辑

ASSUME
  「观看」默认可能落在原文视图；舞台视图不需要这项修改。
