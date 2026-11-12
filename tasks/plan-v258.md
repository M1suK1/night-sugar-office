# v258 · 台词写进正文（内联标记），不再靠 after 插入

TASK
现在模型把台词单独放在 `lines` 里，还要自己数「插在第几段旁白之后」（`after`），经常数错，结果几句对白全堆在末尾。
改成：台词直接写在 narration 正文里，用固定标记开头；解析器把它拆回 `StoryLine[]` 并算出 `after`，渲染层与存档结构不变。
有歧义先说明——仍然输出 JSON（narration / options / summary / bond），只是「台词放哪」从独立数组改成正文内联。

APPROACH
1. 新模块 `src/storyInline.ts`（纯函数，不依赖 llm）：
   - `splitInlineStory(narration, cast, limit)` → `{ text, lines, inline }`
   - 标记语法（行首、独立成行）：
     ```
     @爱丽丝[calm]：今晚的委托，我不接。
     @砂糖：那我替她接。
     @所长：先听她说完。
     ```
     - `@` + 名字或 id，`[表情]` 可省（缺省 calm），冒号全角/半角都接受；
     - `@所长` / `@player` 映射到 `speakerId: 'player'`；
     - 表情只认 calm / smile / surprise / sad / angry / shy，非法值按 calm；
     - `after` = 这句之前已经输出的**非空旁白行数**（与现在 `split(/\n+/)` 的分段口径一致，0 = 最前面）；
     - 标记行从正文移除，连续空行折叠；解析完再截到 `NARRATION_LIMIT`。
   - 识别失败的行（名字不认识、没有冒号、不是 cast 里的人）**原样保留为旁白**，一个字都不丢。
2. 合并规则：`storyWithLines(narration, jsonLines, cast)`
   - 正文里认出了至少一条台词 → 用内联结果（忽略 JSON 的 `lines`）；
   - 一条都没认出 → 退回 JSON 的 `lines`（旧模型、旧预设行为不变）；
   - 两者都为空的轮次照旧允许（纯旁白）。
3. 生成侧（`src/llm.ts`）：开场、续写、收尾、魔女化对峙四处统一走 `storyWithLines`；`lines` 允许是空数组。
4. 契约改写（`src/promptSections.ts`）：`arcOpeningContract` / `arcTurnContract` / `arcEndingContract` / `witchConfrontationContract`
   - 删掉 `after` 的说明与「台词必须贴着它回应的那一段」这类要求；
   - 新增写法说明 + 两个例子（单人对白、多人接话）；
   - 增加心声写法：`@名字（心想）：……` / `@名字[表情]（心想）：……`，解析成 `mode: thought`（界面标「· 心声」）。
   - JSON 形状里不再出现 `lines`，提示词也不提这个字段（旧模型仍输出时由解析层兜底）；
   - 明确禁止「旁白里再复述一遍台词」。
   11 份出厂预设里的同名契约条目同步。
5. 存档：`StoryTurn` 增加 `inline?: boolean`（true = 台词由正文解析而来）。
   - 新轮次写入 true；旧轮次没有这个字段 → 继续把 `lines` 当权威，渲染完全不变。
   - 编辑某一轮正文（`applyEditStoryTurn`）：`inline` 为 true 时按新正文重新解析并更新 `lines`；为 false 时维持现状（只改文本）。
6. 渲染层与舞台（`interleaveTurn`、`EventDialog`、`vn/beats.ts`）不改：解析产物仍是带 `after` 的 `StoryLine[]`。

FILES
- `src/storyInline.ts`（新）— 内联标记解析、名字映射、`after` 计算、合并规则。
- `src/llm.ts` — 四处生成改用 `storyWithLines`；`parseStoryLines` 保持给 JSON 兜底用。
- `src/promptSections.ts` — 四个契约改写。
- `src/types.ts` — `StoryTurn.inline?`。
- `src/rules/storyOps.ts` — 编辑轮次时按 `inline` 重新解析。
- `src/content/presets/shipped/*.ts`（11 份）— 四个契约条目同步。
- `tests/v258.test.ts` + `package.json` — 解析、合并、编辑、旧档、预设同步。
- `tasks/todo.md`、`README.md`（提示词写法说明）。

EDGE IN
- 名字不认识 / 缺冒号 / 表情越界：整行退回旁白，不丢字，也不影响其他台词。
- 名字同时是别人的 id：先按 id 精确匹配，再按名字匹配；重名取 cast 里第一个。
- 心声标记写在冒号前（半角/全角括号都认）；认不出表情时仍按 calm，mode 不受影响。
- 台词在正文最前面：`after = 0`；连续多句：`after` 相同、顺序保持。
- 整轮只有台词、没有旁白：`text` 为空字符串，`lines` 非空；渲染与编辑都要能处理空正文。
- 正文里出现 `@` 但不是标记（邮箱、引用）：只有「行首 @ + 可映射的名字 + 冒号」才算台词。
- 正文超长被截断：先截断再解析，避免 `after` 指向已删掉的段落。
- 编辑后标记全被删掉：如果玩家只是改旁白（正文里没有标记），保留原来的台词；只有写了标记才重新解析替换。这样改错别字不会顺手丢掉整轮对白。
- 旧存档 / 旧预设：没有 `inline` 的轮次、没有标记的正文，行为与现在完全一致。
- 模型同时给了内联台词和 `lines`：以内联为准，不两套都渲染。

EDGE OUT
- 不改角色对话与灯下私语（本来就是纯台词，没有旁白）。
- 不改私人事件的 `scenes` 与蓝图 `passages` 的结构（仍用各自的 lines / after），本版只改交互剧情四条链路。
- 不做流式输出。
- 不改战斗、数值、提案与校验逻辑。
- 不新增「表情以外的舞台指令」（动作、镜头、停顿）——以后要加再说。

ASSUME
- 标记是给模型看的写法，不是玩家必须学的语法；玩家只在「编辑这一轮」时可能看到它。
- 模型仍然输出 JSON 外壳；正文里的标记只是把台词挪进 narration。
- 冒号全角/半角等价，表情缺省 calm；名字匹配不区分首尾空格。
- 解析失败一律「降级为旁白」，绝不报错中断这一轮。
