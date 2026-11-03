# v82 方案：选项节点必须先把剧情引到门口

> 用户要求（2026-11-03 夜）：角色剧情后面如果有选项节点，必须在玩家确认结束后，
> 在角色剧情界面继续生成一段剧情把剧情引到选项上，然后弹出选项；
> 玩家选完才算这段角色剧情结束，再进入分支。
>
> 本轮已做的两小步（见提交）：蓝图续写契约里加了一条「选项前必须先把她推到门口」，
> 交互剧情里选项上方加了一句「她没有再往下说。轮到你决定。」。**真正的流程改造还没做。**

## 现状

- 蓝图里的 `choice` 节点在 `storyRun.ts:88` 只是把运行器挂住：`run.waiting = { kind: 'choice', ref: node.id }`，什么都不生成。
- 选项按钮目前画在**档案 → 故事线**里（`CharacterDialog.tsx:290`，读 `storyline.run.waiting.kind === 'choice'` 的 `node.data.options`），
  和角色剧情的会话界面（`EventDialog` 的 `session` 模式）是两套地方。
- 会话界面自己的 `options` 来自上一轮 `generateStoryTurn` 的产出（模型给的 3 条「你……」），
  和蓝图的 choice 节点没有接线：选完只是又一轮对话，蓝图那条分支永远等不到。

## 目标流程

```
会话进行中（EventDialog，mode='session'）
  ├─ 玩家发言 → generateStoryTurn → 旁白 + 台词
  ├─ 若该角色的蓝图正卡在 choice 节点（run.waiting.kind === 'choice'）
  │    └─ 玩家点「结束这段」时，先追加一轮 **引路旁白**（leadIn）
  │         产出：narration（把她推到门口）+ lines（在场者的最后一两句）
  │         然后这一轮的 options 换成蓝图节点的真实标签（不用模型自己编）
  ├─ 选项就地显示在会话底部（composer 锁住，只能选）
  └─ 选中 → 应用分支（storyRun 的 choice 解析）→ 结束这段剧情（event.status = 'done'）
            → 蓝图沿选中边的 target 继续
```

## 改动点

| 位置 | 改什么 |
| --- | --- |
| `src/rules/storyRun.ts` | 新增 `pendingChoiceOf(state, girlId)`：返回这女孩蓝图里卡住的 choice 节点（含 options 与 nodeId）。已有 `resolveStoryWait(..., 'choice', nodeId)` 负责推分支，复用 |
| `src/llm.ts` | `generateStoryTurn` 增加 `leadIn?: { nodeTitle: string; options: string[] }`：system 里点明「这一轮不是普通续写，而是把她推到选择门口，不要写出选择结果」；产出复用现有形状（narration/lines），options 由调用方覆盖 |
| `src/App.tsx` | `finishSession(eventId)`：若无 pendingChoice → 直接结束；有 → 先 `generateStoryTurn(..., leadIn)` 追加一轮并把蓝图标签写成该轮 options；再等玩家点选 |
| `src/rules/storyOps.ts` | 新增动作 `chooseStoryOption { eventId, storyId, nodeId, optionId }`：先 `resolveStoryWait` 推进蓝图，再 `finishStoryEvent`；写一条 base 日志 |
| `src/components/EventDialog.tsx` | 选项块区分两种来源：`session`（模型给的自由选项）与 `branch`（蓝图分支）。分支选项下加一句「选完这段剧情就结束」，选中后 composer 与输入都禁用 |
| `src/components/CharacterDialog.tsx` | 档案里的旧选项按钮改成「这段剧情正在进行，去剧情界面选择」的提示（没有会话时仍可点，作为兜底） |

## 验收

- `tests/v82.test.ts`：
  - `pendingChoiceOf` 能认出卡在 choice 的蓝图、认不出别的；
  - `chooseStoryOption` 推进蓝图到对应 target 并把事件标成 done；
  - 没有 choice 时 `finishSession` 不追加轮次。
- 手测：跑一张带 choice 节点的蓝图 → 会话里点「结束这段」→ 多出一段引路旁白 → 只剩三个蓝图选项 → 选完剧情结束、蓝图前进一格。

## 不做

- 不改蓝图编辑器（`StoryGraphDialog`）的节点语义；
- 不让模型自己编蓝图分支的标签——分支文字只能是节点里写好的那几条，否则分支会飘。
