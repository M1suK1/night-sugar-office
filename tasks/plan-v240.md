# v240 · 魔女化对峙弹窗（并把上轮未完成的剧情回忆并入）

TASK
1. 补上上轮未完成的活：角色对话 / 灯下私语的提示词里加入「角色故事的回忆」与故事线【她的过往】；
   结局要写结局描述，不写「已走过」的节点，且不被截断。
2. 魔女化发生时立刻弹窗：标题点明魔女化；内容是魔女化的她把所长堵在某个地方、按她的经历逐条数落所长；
   弹窗正文直接作为一段角色剧情的开场白，接着进入可交互的剧情。

APPROACH
Part 1 · 历史口径（先做，Part 2 依赖它）
- `storylineHistoryText`：删掉「已走过」行；`结局：` 后面接 `endingSummary`（缺省退回结局名），不做 slice。
- 该函数的预算改成「只裁更早的段」：最近一段连同它的结局描述永不裁；单段超预算也整段保留。
- 新增 `eventMemoryText(state, girl, limit)`：已完成私人事件的 `summary`，即「角色故事的回忆」。
- `promptMacros` 增加 `{{history.events}}`；`chat-heroine` / `whisper-heroine` 的【她的过往】里插入它。
- 11 份出厂预设同步这两条分区。

Part 2 · 魔女化对峙弹窗
- 触发：只在 `addCorruption` 跨到「魔女」阶段时调用 `spawnWitchConfrontation(state, girl)`
  （新模块 `src/rules/witchEvent.ts`）。**手动切换魔女形态不弹**（v240 定稿）。
- 事件：`CharacterEvent` 增加 `witch?: boolean`；`title = 魔女化 · <名字>`、`mode: 'session'`、
  `cast: [girlId]`、`opening` 留空、`badge: true`。同一角色只保留一个未开场的魔女事件。
- 生成：`generateWitchConfrontation`（scope `arc`，新契约 `arc:witch`）。输入：
  魔女化人格 + 魔女形态描述 + 侵蚀/疤痕/誓约 + 故事线过往（含结局描述）+ 私人事件回忆 + 最近对话。
  要求写清「她把你堵在哪」、按经历逐条对质、不写数值；输出 `{narration, lines[], options[], backdrop}`。
- 落地：App 监听「未开场的魔女事件」→ 立刻 `setModal({type:'event'})` → 成功后用
  `startStorySession` 把 narration/lines/options/backdrop 写进去；失败用 `witchFallbackOpening` 兜底，
  保证弹窗一定出现。之后玩家继续说话，照旧走 `arc` 续写与收尾。
- 界面：事件弹窗标题本来就读 `event.title`，只需在 eyebrow 加「魔女化」；立绘沿用 `GirlPortrait`
  （`girl.witch` 为真时自动用第五格魔女化形象）。

FILES
- `src/types.ts` — `CharacterEvent.witch?: boolean`。
- `src/rules/witchEvent.ts`（新）— 生成事件、去重、模板兜底开场。
- `src/rules/conditions.ts` — 侵蚀跨到魔女阶段时触发。
- `src/girlDossier.ts` — `storylineHistoryText` 改造；新增 `eventMemoryText`。
- `src/promptSections.ts` — `witchConfrontationContract()`；chat / whisper 的【她的过往】加 `{{history.events}}`。
- `src/promptContracts.ts` — 登记 `arc:witch`。
- `src/promptMacros.ts` — `{{history.events}}`。
- `src/llm.ts` — `generateWitchConfrontation` + 上下文拼装（复用 `recentEventSummaries`）。
- `src/App.tsx` — 监听、立刻弹出、写入开场、失败兜底。
- `src/components/EventDialog.tsx` — eyebrow 标记魔女化（标题已现成）。
- `src/content/presets/shipped/*.ts`（11 份）— 同步分区。
- `tests/v240.test.ts` + `package.json`；`tasks/todo.md`。

EDGE IN
- 侵蚀恰好跨过阈值、同一场战斗里多人同时魔女化：按先后排队，当前弹窗关掉后再弹下一段。
- 没有 API Key / 生成失败：用 `witchFallbackOpening` 模板照常弹出。
- 旧档：`witch` 字段缺省按 false；事件缺字段照常读。
- 用月光抑制剂压回去之后再次魔女化：再触发一次（新的一段对峙）。
- 同一角色已有未进入的魔女事件：不重复生成。

EDGE OUT
- 不改魔女化的阈值、断药与死亡逻辑，也不让魔女化改战斗数值。
- 不改私语概率、结算流程与既有事件类型。
- 不在本版改「完整剧情」的续写与收尾口径。

ASSUME
- 「角色故事的回忆」= 已完成私人事件的摘要（`event.summary`），不是聊天原文。
- 弹窗就是这段剧情的开场，不另开一个只读弹窗再起一段。
- 「立刻」以打断当前界面为准：若正开着别的弹窗会被替换；正在进行的会议/剧情本身不受影响。
