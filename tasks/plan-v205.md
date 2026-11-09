# 方案 v205 · 收尾时由叙事者代玩家选定蓝图分支

> 状态：已实现（v205，分支 `superpowers/memory-reshape-merge`）。

TASK
  角色剧情（蓝图 event 节点）收尾时，叙事者在写结局的同时，从紧随其后的 choice 节点里
  选出玩家实际走向的那个选项；事件结束后直接沿该选项推进，不再让玩家去档案页二次选择。
  模型只决定「走哪条边」，数值仍由本地按 option.effect 确定性结算。

APPROACH
  1. 预读下一站（纯函数，不结算）
     nextChoiceAfterEvent(story, event)：从 event.storyNodeId 的 out 边出发，
     跳过 reward 与 0 时长 wait，遇到第一个阻塞节点：
       · 是带选项的 choice → 返回 { nodeId, title, options }
       · 其他（mission / incident / opinion / 另一个 event / wait>0 / end）→ undefined
     只读图，不建事件、不发奖、不改 cursor。

  2. 收尾生成多一个字段
     generateStoryEnding(..., upcomingChoice?)：
       · 有 upcomingChoice 时，请求里写清「这一段之后必须走一条分支」，
         并列出 option 的 id / label / intent；
       · arcEndingContract 追加 choice 字段，要求模型根据整段 turns 里玩家的实际言行
         选最贴近的一条，且结局正文要写出这条分支的直接后果；
       · 只传 id / label / intent，**不传 effect 数值**；
       · 返回值增加 choice?: string。

  3. 局部校验 + 一次返修
       · choice 必须命中 upcomingChoice.options 的 id。
       · 未命中：带「上一次输出 + 允许的 id」返修一次；仍不合法 → 不自动选，
         回退旧路径（事件关闭、choice 留在档案页，即手选兜底），并记日志。
       · 没有 upcomingChoice 时忽略模型给的 choice。
       · 沿用项目现有规则：模型提案必须过本地校验，硬错误返修一次后中止。

  4. 原子落盘
     finishStorySession 增加可选 port：
       a. 先用预读结果校验 port（不合法直接失败，事件保持打开、不扣任何东西）；
       b. 照旧写结局轮、结算羁绊、archive、标 done；
       c. finishStoryEvent 推进到 choice，确认 run.waiting 正是这个 choice；
       d. 调用从 chooseStoryPort 抽出的 takeStoryPort：结算 option.effect、
          清 waiting、cursor 移到 edge.to、advanceStoryGraph；
       e. 记一条「你选了：X」日志。
     旧的调用不带 port → 完全走现在的行为。

  5. UI 接线
     App 的 endStorySession 在 generateStoryEnding 前预读 upcomingChoice，
     成功后把 result.choice 作为 port 一起 perform；
     无 key / 生成失败 / 无分支时按旧逻辑收尾。
     事件弹窗仍停在只读结局；分支在状态层推进，下一个 event 照常生成，mission 照常上桌。

  流程：
    event 结束
      → 预读接下来的 choice
      → LLM 写结局 + 选一个 option id
      → 本地校验（必要时返修一次）
      → 关闭事件 → 推进到 choice → 按 id 走边 → 继续蓝图

FILES
  改   src/rules/storyChoice.ts     新增 nextChoiceAfterEvent 纯预读
  改   src/promptSections.ts        arcEndingContract(choice?) 追加 choice 字段与判定规则
  改   src/llm.ts                   generateStoryEnding 接收/返回 choice，校验与一次返修
  改   src/types.ts                 finishStorySession 增加 port?
  改   src/rules/storyOps.ts        原子收尾；从 chooseStoryPort 抽出 takeStoryPort
  改   src/App.tsx                  预读、传参、把 choice 一起提交
  新建 tests/v205.test.ts           七条
  改   package.json                 test 脚本登记 v205
  改   tasks/todo.md                勾选
  新建 tasks/plan-v205.md           本方案

EDGE IN
  · event → choice：自动选。
  · event → reward → choice：预读跳过 reward；实际推进时由 advanceStoryGraph 正常发奖后再选。
  · event → 0 时长 wait → choice：同上跳过。
  · event → mission / incident / opinion / wait>0 / 另一个 event / end：
    预读返回空，本次不自动跨节点预判；轮到 choice 时仍用档案页选择。
  · 无 API Key、没有分支、choice 非法且返修失败：回退「结束事件 → 档案页手选」。
  · 模型整段生成失败（连旁白都没有）仍保持事件打开、可重试（沿用 v117）。
  · 老档：已有 waiting choice 的故事线原样保留；新字段可选，不需要迁移。
  · 效果只应用一次：事件羁绊、option.effect、reward 节点发奖各自独立。

EDGE OUT
  · 不让模型写 effect 数值、改选项文案或新增选项。
  · 不自动替玩家做 mission / incident / opinion 的选择。
  · 不删除 pendingChoice / chooseStoryOption / 档案页选择，它们保留为离线与失败兜底。
  · 不做跨多个阻塞节点的连跳（例如 event → mission → choice 不在一次收尾里预判）。
  · 不改结局正文字数、摘要规则与模型调用预算。

ASSUME
  · 「玩家选了哪个」指从 session 的 turns 里能看出倾向；模型只需在给定 id 里挑最贴近的，
    判断理由不展示。
  · 蓝图允许 event 直接接 choice，也允许中间隔 reward / 0 时长 wait。
  · 事件收尾后仍保持只读结局界面，不强制关闭；分支推进是状态层的事。
  · 生成失败、choice 非法、无 API Key 一律回退手选（已确认），不替玩家兜底选第一个。
  · 版本号用 v205（v202 仍待实现，v203 / v204 已在同一分支）。

TESTS（tests/v205.test.ts，七条）
  1. event → choice 预读拿到节点与选项；event → event 返回 undefined。
  2. event → reward → choice 能穿过 reward；event → wait 60 → choice 停下返回 undefined。
  3. 带选项的收尾契约包含 choice 字段与允许的 id；不带选项的旧契约不出现 choice。
  4. mock fetch：模型返回合法 choice，generateStoryEnding 原样带出。
  5. mock fetch：choice 非法 → 发起一次返修；返修后仍非法 → ok:false。
  6. finishStorySession 带 port：事件 done、效果只结算一次、cursor 落到分支后方；
     不带 port 保持 waiting choice；port 非法时事件仍 active、资源不变。

RISK
  · 模型可能挑一个与玩家实际发言不符的选项，提示词只能降低概率，无法根除；
    单测只能保证 id 合法，保证不了判断质量。
  · 自动选择绕过了档案页按钮，玩家没有二次确认；这是需求本身，不做撤销入口。
  · 预读跨过 reward 但不结算，若 reward 里有会影响叙事的内容，模型写结局时看不到；
    此处只用于「选哪条边」，不把 reward 数值交给模型。
