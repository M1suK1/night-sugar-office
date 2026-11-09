# 方案 v206 · 离城结局与首页终局进度

> 状态：已实现（v206，分支 `superpowers/memory-reshape-merge`）。

TASK
  先只做「离城」这一条终局：
  · 星砂达到 100,000 后，首页新闻卡旁边出现可点击的终局入口；
  · 点击后二次确认，选择完成结局；
  · 完成后落一张落幕页，并把结局记进存档，随时可回看；
  · 不锁档，落幕页给「继续这一局」。

APPROACH
  - 新增 src/ending.ts：终局元数据、EndingRecord 类型、离城进度计算。
    进度只看 state.gold 与 balance.endingLeaveGold，不碰模型、不掷骰。
  - balance.ts 增加 endingLeaveGold（默认 100000，世界书「终局」组可调）。
  - GameState 加可选 endings?: EndingRecord[]；旧档缺省空数组，不做结构迁移。
    读档时收敛一次：只认 leave、丢掉坏数据、按 id 去重。
  - 新动作 finishEnding（endingId: 'leave'）：
    · 未达标 → 拒绝并提示还差多少；
    · 已记录 → 拒绝，避免重复；
    · 达标 → 写入 EndingRecord（day / at / gold / reputation / girls 快照）、
      记一条编年史与事务所日志，不扣星砂、不锁档。
  - 首页：在 heading-side 的新闻卡右侧加一张「终局 · 离城」进度卡。
    · 未满：进度条 + 当前/门槛，不可点；
    · 已满：整张卡可点，提示「可以走了 · 点击完成结局」；
    · 已完成：显示「已离城 · 第 N 日」，点击可重看落幕页。
  - 点击后先弹确认框（再留一阵 / 离开樱雾市）；确认成功再切到落幕页。
  - 落幕页显示：离城日、星砂、安定度、在册契约人数；文案本地固定，不依赖 API Key。

  流程：
    首页进度卡（star ≥ 100,000）
      → 点击 → 确认框
      → finishEnding → 写入 endings + 编年史/日志
      → 落幕页 → 继续这一局 / 关闭

FILES
  新建 src/ending.ts                        终局元数据、EndingRecord、离城进度
  新建 src/rules/endingOps.ts               applyFinishEnding
  改   src/types.ts                         EndingRecord / GameState.endings / finishEnding
  改   src/rules/act.ts                     分发 finishEnding
  改   src/rules/persistence.ts             读档收敛 endings
  改   src/balance.ts                       endingLeaveGold + 「终局」字段
  新建 src/components/EndingProgress.tsx    新闻卡旁的进度卡
  新建 src/components/CampaignEndingDialog.tsx  确认框 + 落幕页
  改   src/App.tsx                          挂进度卡、确认/落幕流程
  改   src/styles.css                       进度卡与落幕页样式
  新建 tests/v206.test.ts                   六条
  改   package.json                         test 脚本登记 v206
  改   tasks/todo.md                        勾选
  新建 tasks/plan-v206.md                   本方案

EDGE IN
  · 星砂正好 100,000：可以完成；99,999 拒绝，事件/资源不动。
  · 进度实时读 state.gold：花掉星砂会掉回未满，门槛按 balance 当前值。
  · 重复完成：按 id 拒绝，不重复写 endings / 编年史。
  · 旧档没有 endings：读成空数组；坏记录丢弃，不影响其他字段。
  · 已完成后再点进度卡：只打开落幕页，不再触发写入。
  · 结局记录是快照：完成后再赚钱/花钱，落幕页统计不变。
  · 不锁档、不退场、不删档，继续玩沿用现有存档。

EDGE OUT
  · 本次不做「投靠」「一统」，也不做九格辖区落幕图。
  · 不做独立结局图鉴页；已完成记录只在进度卡与落幕页可见。
  · 不改星砂产出、委托奖励或经济曲线；100,000 只作为门槛。
  · 结局文案不走叙事者，不新增 LLM 调用。
  · 不在完成时清空事务所、契约者或日志。

ASSUME
  · 「完成结局」是收束本局叙事，不是删档；沿用 v202 的「不锁档」约定。
  · 「新闻界面旁边」指派遣页标题区 heading-side 里的夜间访谈卡右侧；
    如果你指的是新闻弹窗内部，需要改成弹窗里的并列区。
  · 点击后保留一次确认，避免误触；确认文案用「离开樱雾市」。
  · 版本号 v206：v202 的终局方案仍只做离城这一条，其余留到以后。

DESIGN（沿用现有夜城语言）
  · 颜色只取现有 token：黑/雾白/蔷薇粉；达成时用蔷薇粉描边，危险色不参与。
  · 结构：眉标「终局 · 离城」+ 大号当前星砂 + 细进度条 + 一行提示。
  · Signature：进度条最后一小格——满格时点亮，成为「可以走了」的唯一信号。
  · 尺寸：桌面约 220px，与新闻卡并排；窄屏跟随 heading-side 纵向堆叠。
  · ASCII：
      ┌ 终局 · 离城 ───────────┐
      │ 87,400 / 100,000 星砂   │
      │ ████████████░░░  87%    │
      │ 攒够就离开樱雾市         │
      └────────────────────────┘

TESTS（tests/v206.test.ts，六条）
  1. 进度：99,999 未达成、100,000 达成；已完成时 done 为真。
  2. finishEnding 未达标拒绝，gold / endings / 日志都不动。
  3. finishEnding 达标写入快照、编年史与日志，不扣星砂。
  4. 重复 finishEnding 被拒绝，记录不重复。
  5. 旧档没有 endings 时读成空数组；坏记录被丢弃。
  6. balance 默认 100,000，世界书字段可改。
