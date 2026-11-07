# 方案 v193 · 故事线走到结局时弹窗

TASK
  蓝图剧情走到 end 节点时，只在日志与编年史里留一行，玩家不知道「这段故事已经结束、而且是以哪个结局收的」。
  要一个弹窗，在结局达成的那一刻当面说清楚。

APPROACH
  1. 不新增存档字段：用「上一帧状态」比对。`storylineEnding.ts` 抽两个纯函数——
     `storylineStatuses()` 记快照、`newlyFinishedStories()` 找「上一帧 active、这一帧 done 且有结局名」。
     读档时本来就结束的故事（第一次见到的 id）不会补弹；走到死路被迫收束（没有 ending）也不弹。
  2. App 里只放一个 `endingSeen` ref 与 `endingQueue`：state.storylines 一变就比对，
     新结束的排队，一次弹一个，关掉自动接下一个。
  3. 弹窗 `EndingDialog` 用现成的 `Dialog` 基座：结局名做主标题，下面是「谁 · 哪条故事线」、这段故事的前提，
     以及一句「这条故事线已经走完，之后不会再有新的节点」。
  4. 只做「告知」，不改故事线状态、不加领奖动作：奖励早已在 reward 节点结过。

FILES
  · src/storylineEnding.ts            新增：状态快照与「刚结束」判定
  · src/components/EndingDialog.tsx   新增：结局弹窗
  · src/App.tsx                       比对 effect + 队列 + 渲染
  · src/dialogs.css                   弹窗排版
  · tests/v193.test.ts                4 条
  · package.json / tasks/plan-v193.md / tasks/todo.md

EDGE IN
  · 同时结束多条：排队依次弹
  · 读档 / 首次挂载：已有结局不补弹
  · 死路收束（没有结局名）：不弹
  · 结局名只有空白：当作没有

EDGE OUT
  · 不做结局图鉴 / 结局收集进度
  · 不改编年史与日志的既有记录
  · 不在弹窗里放奖励领取（奖励在 reward 节点已经结算）

ASSUME
  「达成结局」= end 节点写下的 ending 标签；没有标签的死路不算达成。
