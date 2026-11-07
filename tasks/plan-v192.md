# 方案 v192 · 宽松模式漏修单数 opinion

TASK
  设置里明明选的是「宽松」，提案仍被严格口径打回：
  「opinion.options[1]：驳回只能改动提出者的羁绊……」。
  这条限制本来就只在严格模式生效，宽松模式应该就地修好、不整份作废。

APPROACH
  1. 定位：`validateNightProposal` 在宽松模式下会先跑 `repairRejectOptions`，
     但那个函数只处理 `proposal.opinions` 数组；而校验器同时接受旧的单数写法 `proposal.opinion`。
     模型一旦退回单数，修复函数直接 return，等于没修，严格口径的报错照旧弹出。
  2. 修：把「修一条议题」拆成 `repairOpinion`，数组与单数两种写法都过一遍；重复修是幂等的。
  3. 行为不变：宽松仍然只保留提出者的 bond（没有就补 −2），catch 结构问题；
     严格模式照样整份作废。
  4. 既有三条用例（驳回必须带代价、硬错误要返修、girlId 改写）本来就是严格口径，
     之前靠「单数没被修」侥幸通过；现在显式把审查模式钉成 strict，
     宽松一側由新的 v192 用例覆盖。

FILES
  · src/proposalCheck.ts    repairOpinion + 两种写法都修
  · tests/v192.test.ts      5 条（含 strict 与 lenient 对照）
  · tests/game.test.ts      三条严格口径用例显式进入 strict
  · package.json / tasks/plan-v192.md / tasks/todo.md

EDGE IN
  · 单数 `opinion`、数组 `opinions`、两者同时出现
  · 驳回里没有提出者羁绊时补 −2；accept 不动
  · strict 模式仍然报错（用例固定验证）

EDGE OUT
  · 不改严格模式的规则与文案
  · 不改错误路径的写法（所有议题都显示为 `opinion.options[n]`，属于旧口径，另开一版再统一）

ASSUME
  「宽松」的语义仍是：驳回可以写多，程序就地裁成「只掉提出者羁绊」；结构问题照样拦。
