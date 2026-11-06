# 方案 v160 · 与势力首领见面（修复召见 + 主动约见）

## TASK

1. 修好打烊后的随机召见：用当前编成的首领，而不是静态「席位空缺」占位。
2. 增加主动约见：势力档案里的「约见首领」按钮，直接进入交互剧情。

## APPROACH

- `buildSummonEvent` 改用 `rosterLeader(state, faction)`；空席返回 undefined，`maybeSummon` 跳过，不写冷却。
- 新增 action `meetLeader`：
  - 解析当前首领，空席拒绝；
  - 事件 id `meet-<day>-<faction>`，一天一方只建一次；
  - 写入 `session` 事件与一条日志。
- 势力档案头部加「约见首领」按钮；App 在成功后直接用同一个 id 打开事件弹窗。
- EventDialog 支持 `castPool`：把 `customFactionLeaders` / `customFactionGirls` 一起交给剧情，首领才能立绘上台。
- LLM `storyCast` 认势力名册，首领/随从给一段基于称号、备注、引子的 brief，提示词里不再是「席位空缺」。

## FILES

| 文件 | 改动 |
| --- | --- |
| `src/rules/summon.ts` | 召见取编成首领；新增约见事件与 action |
| `src/types.ts` / `src/rules/act.ts` | `meetLeader` action |
| `src/components/FactionDialog.tsx` | 约见按钮 |
| `src/App.tsx` | 按钮回调、事件弹窗的 castPool 与 subject |
| `src/components/EventDialog.tsx` | `castPool` |
| `src/llm.ts` | 剧情 cast 认势力首领/随从 |
| `src/dialogs.css` | 按钮间距 |
| `tests/v160.test.ts` / `tests/v79.test.ts` | 新用例；空席不再造召见 |

## EDGE

- 空席：召见不触发、约见被拒绝。
- 同一天重复约见：返回已有事件，不重复建。
- 首领换成卡库里的自定义角色：召见与约见都跟当前编成。
