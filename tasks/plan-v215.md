# plan-v215 · 角色剧情历史只喂总结

## TASK

角色剧情的提示词里，此前的对话塞的是整轮旁白 + 全部台词（一轮 1500–3000 字，最多 8 轮），
再加上开场全文 1600 字，历史部分会膨胀到两万字以上。要求**每次续写**都额外写一段
**不超过 300 字** 的总结，之后的历史上下文只引用这些总结；开场与收尾不额外写总结。

## APPROACH

1. 在 `StoryTurn` 上加可选字段 `summary?: string`，只给**续写轮**（narrator）用。
   - 开场轮不写：历史里的开场用 `event.opening` 截 400 字代替。
   - 收尾轮不写：整段结束时已有的 `event.summary` 继续负责以后的前情提要。
2. 只改 `arcTurnContract`：
   - JSON 形状加 `"summary":""`。
   - 正文写「summary 不超过 300 字：所长做了什么、她怎么回应、局面推进到哪；
     之后的历史只引用它」。
   - 代码解析时 `slice(0, 400)`：提示词要求 300，实际容忍到 400，不因为多写几十字就砍。
3. 生成层：
   - `generateStoryTurn` 的 `StoryTurnDraft` 带 `summary`。
   - App 组装 narrator turn 时写入 `result.turn.summary`。
   - 重写轮走同一个 `generateStoryTurn`，新 summary 随 `replaceStoryTurn` 覆盖旧的。
4. 上下文构建换成只读总结：
   - 新增 `storyRecapHistory(event, turns, limit = 8)`：
     - 第一行「开场：<event.opening 截 400 字>」；没有 opening 时用第一轮 narrator 原文截 400。
     - 之后每轮 narrator 输出「· <summary>」，没有 summary 的旧轮次用原文截 400 兜底。
     - 玩家原话不再进历史；每轮 summary 必须覆盖「所长这一轮做了什么」。
   - `generateStoryTurn` 与 `generateStoryEnding` 用它替换 `storyHistory`。
   - 续写与收尾的 context 不再单独塞 `event.opening` 的 1600 字全文。
   - `recentEventSummaries` 维持原样。
5. 旧档兼容：`summary` 可选，缺了就用该轮原文截 400，不写迁移。
6. 11 份出厂预设只同步 `arc:turn` 契约快照；`arc:opening` / `arc:ending` 不动。

## FILES

- `src/types.ts`：`StoryTurn.summary?: string`。
- `src/promptSections.ts`：只改 `arcTurnContract`。
- `src/llm.ts`：`generateStoryTurn` 解析并返回 summary（截 400）；
  新增 `storyRecapHistory`，替换续写与收尾里的 `storyHistory` 和开场全文。
- `src/App.tsx`：`submitStoryTurn` 与 `rewriteStoryTurn` 把 summary 写进新轮次。
- `src/content/presets/shipped/*.ts`（11 份）：同步 `arc:turn` 快照。
- `tests/v215.test.ts`、`package.json`：回归测试与登记。

## EDGE IN

- 续写轮 summary 缺失或为空：用该轮原文截 400 兜底。
- 旧档 / 旧副本没有 summary：同样截 400，历史长度仍有上限。
- 开场不写 summary：历史用 `event.opening` 截 400，不再塞 1600 字全文。
- 收尾不写额外 summary：`event.summary`（150–300）继续负责以后的前情提要。
- 重写轮：新 summary 覆盖旧 summary。
- 历史轮数沿用 8 轮上限。

## EDGE OUT

- 不删除 `event.turns` 原文（回看、存档要用）。
- 不要求开场 / 收尾输出 summary，不改这两份契约。
- 不改 `event.summary` 的 150–300 字契约与 800 字落库上限。
- 不回填旧存档已有轮次的 summary。
- 不回改 `storyArchive`、回看界面、`recentEventSummaries`、`girlDossier`。
- 不处理战斗札记、私人事件、每日提案。

## ASSUME

- 「每一段」指交互剧情的每次续写轮，不含开场与收尾。
- 提示词按 300 字要求，代码上限 400 字；300–400 之间不截断。
- 开场在历史里以截断原文出现，而不是模型总结。
- 历史里不放玩家原话；每轮 summary 必须覆盖「所长这一轮做了什么」。

## 验收

1. `arcTurnContract` 带 summary 字段与「不超过 300 字」。
2. `generateStoryTurn` 落库 summary 最长 400，301–400 字不被截。
3. `storyRecapHistory` 不含整段旁白：开场 ≤400，之后每轮 ≤400。
4. 缺 summary 的旧轮次走截断兜底。
5. 开场 / 收尾契约与 `event.summary` 逻辑未变。
6. 11 份出厂预设的 `arc:turn` 与代码默认一致。
7. `npm test`、`npm run check:rules`、`npx tsc -b` 全绿。
