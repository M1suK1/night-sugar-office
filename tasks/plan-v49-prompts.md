# v49 提示词分区与宏：把 v46 / v47 的提示词交给玩家改

> 修订 2（2026-11-03）：按反馈改两处——① `{{girl}}` 与 `{{girls}}` 撞脸，改名 `{{heroine}}` 并扩成**全量档案**；② 任务经历 / 故事线经历 / 聊天记录不进档案，单独做成 `{{history.*}}` 宏，按需取用、按任务给默认档、按预算裁剪。
> 落地前不改代码。

---

## 一、体检：现在的提示词在哪、谁能改

| 位置 | 现在长什么样 | 谁能改 |
| --- | --- | --- |
| `llm.ts` `generateStoryBlueprint` 的 `body` | 4 759 字 / 约 2 146 tokens：规模与硬性结构、连线总则（8 条 + 反例端口名）、九种节点的 data 写法、不要、提交前自检 | **没人能改**，它作为 `contract` 永远排在预设词条之后 |
| `llm.ts` 蓝图返修尾巴 | 三条修正策略（补边不改 id、语义化 fromPort 改写、不删节点） | 同上 |
| `llm-night.ts` `buildNightPrompt` | 8 382 字 / 约 3 971 tokens：机制目录 1 277、值夜名册 699、城市与硬性规则 1 109、字段说明书 646、JSON 形状 241 | **没人能改** |
| `llm.ts` 对话 / 私语 / 私人事件 / 完整剧情 | 每处都**手写**一大段「她是谁」：身份、外貌、性格、服装、台词、目标、特性、技能、羁绊、同伴关系、战斗、状态、最近参与（`missionMemory`）、最近对话 | 没人能改，且四处口径各写一遍，改一处漏三处 |
| `presets.ts` `DEFAULT_PROMPTS` | 14 条词条，每个任务一句「口吻」 | 可改，但改不到结构规则，也改不到数据 |

结论：预设现在只能改**怎么说**；**说什么**（结构规则、目录、她的档案、她的过往）全在代码里，且重复了四份。

---

## 二、设计总则：三层拆分

```
┌ 1. 预设词条（可编辑）── 说明、口吻、结构规则、自检、返修策略、要不要带她的过往
├ 2. 宏（只读，代码现算）── 存档数据、目录、枚举、阈值、她的档案与历史
└ 3. 锁定契约（只读，代码追加）── JSON 骨架 + 枚举取值 + id 字符集 + 数值类型
```

1. **说明进词条**：凡是人话都搬进预设，按用途（`storyline` / `daily` / `chat` / `whisper` / `event` / `arc`）归 scope，默认文本先与现在等价。
2. **数据进宏**：词条里不再出现具体名字与数字，写 `{{girls}}`、`{{heroine}}`、`{{factions}}`、`{{history.chat:20}}`。
3. **契约留代码**：只留解析器真正需要的东西，编辑器里只读可预览。
4. **校验器仍是裁判**：玩家把「8–16 个节点」改成「3 个」也照样被 `blueprintIssues` 打回；编辑器并排显示当前校验口径。

总量目标：拆分前后持平或略降——蓝图 ≤ 3 000 tokens、每日提案 ≤ 4 200、对话 ≤ 4 500。编辑器显示每用途合计，超预算黄字。

---

## 三、宏系统（`src/promptMacros.ts` 新）

### 3.1 语法

- 无参：`{{girls}}`、`{{heroine}}`、`{{factions}}`
- 带参：`{{heroine:brief}}`、`{{history.chat:20}}`、`{{items:3}}`、`{{missions:combat}}`
- 键名允许点号（`history.chat`），解析为「组.成员」；未知宏保留原文并记入 `missing`（叙事引擎面板可见）。
- 兼容：`{{user}}`、`{{char}}`、ST 的 `{{setvar:…}}` 清理逻辑不变。

### 3.2 命名：为什么是 `{{heroine}}`

| 名字 | 含义 | 说明 |
| --- | --- | --- |
| `{{girls}}` | **在册名单**（谁在事务所） | 简表，一位一行，给「可以点名的人」用 |
| `{{heroine}}` | **本场主角**（这一次写的是谁） | 全量档案；storyline=故事线少女，chat=对话对象，whisper=私语的那位，event/arc=事件角色；daily 不用 |
| `{{char}}` | 只输出名字 | 保留 ST 兼容，不再承担档案 |
| ~~`{{roster}}`~~ | 删掉 | 上一版草稿里的名字，和 `{{girls}}` 重复 |

### 3.3 `{{heroine}}` 的字段清单（不 OOC 的底稿）

按固定顺序输出**结构化的她**（默认上限 800 tokens，超出时按下面的顺序从后往前裁）：

1. **身份**：姓名 / 代号 / 称号 / 是否首领 / 出身（协会·市役所·月蚀庭·无所属）→ 雇主固定写「夜糖事务所」（沿用 v48 口径：出身 ≠ 雇主）
2. **外形**：外貌、当前服装描述与服装名、常用的表情与动作习惯
3. **性情**：性格（普通形态用 `personality`，魔女化形态用 `witchPersonality`）、语气参考（`quote`）、说话方式
4. **能力**：元素 / 职阶 / 等级 / 四维 / 三个技能名与一句效果 / 特性（名称 + 定义）
5. **此刻**：生命、心防、疲劳、侵蚀、状态（出勤中 / 治疗中 / 待命 / 戒断）、身上疤痕逐条、当前临时增益
6. **关系**：对所长羁绊 0–100 与七阶阶段名；与同伴的关系（名字 + 数值 + 阶段）；是否在魔女化
7. **心愿**：`goal` 与 `goalKind`（她要什么、为什么）
8. **契约**：签约日、到期日、续约次数、退休金是否欠缴
9. **随身**：武器与护符（名称 + 一句效果）
10. **边界**（宏自动附在末尾，不是词条文案）：「这里没列出的事她不知道，不要替她编」

`{{heroine:brief}}`：只给 1 + 3 + 6 + 7 的压缩版（约 120 tokens），用于「只提一句」的场合，比如名册速览。

### 3.4 她的过往：`{{history.*}}`（这一节回答「有些情况还要历史怎么办」）

| 宏 | 数据来源 | 默认输出 | 默认预算 | 参数 |
| --- | --- | --- | --- | --- |
| `{{history.missions}}` | `state.missionRuns`（v33 起；旧档从 `battles` 派生，已有 `recentMissionRuns`） | 最近 N 次：`第 12 日「糖街的雨」· 调查 · 中危 · 成功 · 报酬 1200 · 留下 1 道疤` | 300t | `:6` 次数 |
| `{{history.storylines}}` | `state.storylines`（按 slot / day） | 每段：标题 + 前提一句 + 已走完的幕（幕名 + 当时选的选项文案）+ 结局标签 + 当前停在哪一幕；最多三段 | 320t | `:3` 段数 |
| `{{history.chat}}` | `state.messages[girlId]`（每位保留最近 60 条） | `你：…` / `她：…（动作）`，按时间正序取最近 N 条；`system` 消息跳过 | 420t | `:20` 条数 |
| `{{history.battles}}` | `state.battles`（`ally-<id>` 单位） | 最近 N 场：日期 · 委托 · 胜负 · 回合 · 造成/承受/治疗 · 留下几道疤 | 260t | `:4` 场数 |

四条规则：

1. **按需取用，不是默认全塞**：哪个词条写了哪个宏，才注入哪份历史；想省 token 就停用整段词条。
2. **同一请求的回忆合计封顶 1 600 tokens**，超了从最旧的一条开始裁，并在结尾写「（更早的 N 条已省略）」；日志的分段内容里能看到每条宏占多少。
3. **默认档按任务给**：蓝图要「她以前发生过什么」但不该背聊天记录 → `{{history.storylines}}` + `{{history.missions:6}}`，聊天给 `:8` 且可删；对话 / 私语给 `{{history.chat:20}}` + `{{history.battles:4}}`。
4. **不脱敏、不新增存储**：聊天记录受「上下文预算」与记忆清除机制影响（当前 `clear` 只清精神疤痕、不动 `messages`；要动就改一处并在这里补一句）；卡片导出不带历史，宏永远从当前存档现算。

为什么不做「一个宏塞全部」：那样每次请求都会把三段历史全带上——蓝图会为 20 条寒暄多花 400 tokens，而提案根本不需要。**词条即开关**比隐藏参数更可控。

### 3.5 其余数据宏

| 宏 | 内容 | 默认预算 |
| --- | --- | --- |
| `{{night}}` | 第 N 日 · HH:MM · 时段 · 星砂 · 安定度 · 平均污染 · 待议 N · 待处理弹窗 N | 60t |
| `{{girls}}` `{{girls:n}}` | 在册（未退役未死亡）每位一行：名字（id）· 代号 · 称号 · 元素/职阶 · Lv · 羁绊 · 疲劳 · 侵蚀 · 状态 · 出身 | 900t |
| `{{factions}}` | 三方：态度与档位 · 现任首领 · 辖区数 · 立场一句 | 300t |
| `{{leaders}}` | 三方首领 id 白名单（`authorId` 用） | 120t |
| `{{districts}}` | 九区：污染 · 档位 · 当主 · 环境修正 | 600t |
| `{{hostility}}` | 三对势力敌意值与档位 | 80t |
| `{{office}}` | 事务所名 / 代表 / 床位 / 会客厅等级（=议题上限） | 80t |
| `{{council}}` | 待议议题 ≤8 条：标题 · 提出者 · 主题 | 200t |
| `{{incidents}}` | 待处理弹窗 ≤6 条 | 160t |
| `{{storylines}}` | 全局进行中的故事线（谁 · 第几段 · 哪一幕） | 160t |
| `{{items}}` `{{items:3}}` | 阶级统计 + 每阶 ≤3 示例名（沿用 v47 瘦身） | 200t |
| `{{missions}}` `{{missions:combat}}` | 委托模板 ≤24 条：id · 标题 · 难度 · 工作 · 时长 · 辖区 | 500t |
| `{{traits}}` | 特性词表名 ≤40 | 120t |
| 枚举 | `{{kinds}}`（九种节点）、`{{limits}}`（节点 8–16 等阈值）、`{{works}}`、`{{difficulties}}`、`{{topics}}`、`{{expressions}}`、`{{factionIds}}`、`{{slots}}`、`{{tiers}}` | ≤40t |
| 既有 | `{{world}}` `{{player}}` `{{char}}` `{{scenario}}` `{{personality}}` `{{worldbook}}` `{{context}}` `{{history}}` `{{direction}}` | — |

`{{limits}}` 与校验器共用 `STORY_LIMITS` 常量；枚举宏直接读 `NODE_LABELS` / `NIGHT_TOPICS` / `NIGHT_EXPRESSIONS`，以后加一种节点类型只改一处。

---

## 四、v46 蓝图提示词的分区（scope `storyline`）

| 词条 id | 名称 | 内容要点 | 默认 tokens |
| --- | --- | --- | --- |
| `sl-structure` | 蓝图·规模与结构 | 节点 8–16（`{{limits}}`）、1 个 start、2–3 个 end 且 ending 两两不同、choice 1–2、mission 1–2、event 1–2、incident 1–2、opinion ≤1、reward + wait ≤2 | 260 |
| `sl-ports` | 蓝图·连线总则 | 有向无环、非 end 必须有出口、`fromPort` 只有四类合法来源、choice 只能 a/b/c/d、每个选项恰好一条同名边、弹窗 o1–o3、提案 accept + reject、反例端口名清单 | 520 |
| `sl-nodes` | 蓝图·节点写法 | 九种节点 data 示例（mission 只写 title·goal·work·difficulty；event 的 cast 与 opening 250–350 字；incident 的 `spec.kind` 与 `IncidentEffect` 幅度；opinion 六 topic + accept/reject；reward 的 `equipmentTier` 与「不写 skill 与装备名」） | 780 |
| `sl-heroine` | 蓝图·她是谁 | `{{heroine}}` + `{{history.storylines}}` + `{{history.missions:6}}` + 在场的人 `{{girls}}`；末尾附**不 OOC 边界 8 条**（见下） | 900 |
| `sl-guard` | 蓝图·不要与自检 | 【不要】x/y/边 id/颜色/note；【提交前自检】8 条；「若请求里出现【必须修正的问题】逐条修，不新增端口、不改选项 id、不删节点」 | 420 |
| **锁定契约** | — | JSON 骨架 + `kind` 取值 `{{kinds}}` + 节点 id 字符集 + from/to 必须存在 | ~140 |

`sl-heroine` 里的**不 OOC 边界**（默认文案，玩家可改）：

1. 只用这里写到的信息；没写的事她不知道，不要替她编经历、亲友或秘密。
2. 用她的语气参考与说话方式，不写成通用温柔女主腔。
3. 能力只按档案里的三技能与特性，不临时加新技能或新形态。
4. 状态要影响她：疲劳高就迟钝，侵蚀高就偏执，疤痕多则心防低、更容易被戳痛。
5. 距离感按羁绊阶段（疏离 → 戒备 → 平常 → 亲近 → 依恋 → 爱意），别一上来就交底。
6. 魔女化形态用魔女化人格，普通形态用原人格，不要混。
7. 引用过往时可以回指（「上次那条巷子」），但不要逐条复述历史。
8. 不替所长说话、不做决定，用「你」称呼所长。

---

## 五、v47 每日提案的分区（scope `daily`）

| 词条 id | 名称 | 内容要点 | 默认 tokens |
| --- | --- | --- | --- |
| `dy-catalog` | 提案·今晚的目录 | `{{night}}` + `{{missions}}` + `{{items}}` + 值夜名册 `{{girls}}` + 三方首领 `{{leaders}}` + `{{hostility}}` + `{{factions}}` `{{districts}}` `{{office}}` | 1 700 |
| `dy-rules` | 提案·硬性规则 | 现行 1–13 条（含 options 恰好两项、不写 defer、reject 必修项、只写 work 与 difficulty、数值上限、loot 只写阶级与槽位、本次需要 N 条议题） | 900 |
| `dy-fields` | 提案·字段说明书 | mission / envoy / opinions / changes 六种 kind / outcomes 五种 kind / loot / 不要写的字段 | 700 |
| `dy-repair` | 提案·返修策略 | 「出现【必须修正的问题】时：只补不删、id 仍取目录、不新增字段」 | 120 |
| **锁定契约** | — | `NIGHT_SCHEMA_EXAMPLE` + 「只输出一个 JSON 对象」 + 「数值必须是整数」 | ~260 |

提案不需要 `{{heroine}}`：它是「整晚事务所」的视角，单个少女的全量档案只会挤掉目录。

---

## 六、档案与历史的落点：四处手写 body 的去重

（修订 2 新增：OOC 保障要跨任务生效，就必须把这四处合流。）

| 任务 | 现在 body 里的内容 | 迁移后 |
| --- | --- | --- |
| 角色对话 `chat` | 身份 / 外貌 / 性格 / 服装 / 台词 / 目标 / 特性 / 技能 / 羁绊 / 同伴 / 战斗 / 状态 / 最近参与 | 交给 `{{heroine}}` + `{{history.missions:4}}` + `{{history.battles:3}}`；代码只留「这次在哪见面 / 是否远程通话」这类场景句 |
| 灯下私语 `whisper` | 同上 + 战报事件 + 最近对话 | `{{heroine}}` + `{{history.missions:4}}` + `{{history.chat:12}}`；代码只留「这一次的结果与战报摘要」 |
| 私人事件 `event` | `{{char}}` + 前提 | 该 scope 新增 `ev-heroine`：`{{heroine}}` + `{{history.storylines}}` |
| 完整剧情 `arc` | `{{char}}` + 前情 | 该 scope 新增 `arc-heroine`：`{{heroine}}` + `{{history.storylines}}` + `{{history.chat:10}}` |

去重后 chat / whisper 的 body 从约 900 字降到 200 字以内，档案与历史由同一套宏供给——「改一处，四处一致」。

---

## 七、接线改动（文件级）

| 文件 | 改动 |
| --- | --- |
| `src/girlDossier.ts`（新，~300 行） | 纯函数：`dossierOf(girl, state)`、`missionHistory`、`storylineHistory`、`chatHistory`、`battleHistory`、`clipToBudget`（带「省略 N 条」尾巴）；`recentMissionRuns` 的拼装逻辑从 `llm.ts` 搬来 |
| `src/promptMacros.ts`（新，~320 行） | 宏目录（key/label/hint/budget/参数）、`resolveMacros(text, ctx)`（支持 `{{k:arg}}` 与点号键）、`gameVars(state, focus?)`、`macroGroups()` |
| `src/promptSections.ts`（新，~300 行） | 分区定义与默认文本、`SECTION_PROMPTS`、`STORY_LIMITS` 与 `limitsText()` |
| `src/presets.ts` | `DEFAULT_PROMPTS` 追加分区词条（storyline 5 + daily 4 + chat 1 + whisper 1 + event 1 + arc 1）；`PRESET_SCHEMA = 5` 迁移；`expandPresetMacros` 支持参数与点号；导出 `composeWithContract` |
| `src/llm.ts` | 蓝图 body → 一句锁定契约 + `gameVars(state, girl)`；对话 / 私语 body 瘦身（删掉手写档案与历史，保留场景句与战报）；`event` / `arc` 的 extra 里补 `heroine` |
| `src/llm-night.ts` | `buildNightPrompt` 拆成 `buildDailyContract()` + 默认分区；`buildNightCatalog` 保留并成为宏数据源 |
| `src/components/PresetDialog.tsx` | 宏面板分组（档案 / 过往 / 城市 / 目录 / 枚举）+ 带参插入到光标；契约只读预览；分区恢复默认；token 超预算黄字；「预览最终系统提示」 |
| `src/components/UtilityDialogs.tsx` | 用途入口补「灯下私语」；新增「提示词总览」 |
| `tests/v49.test.ts`（新） | 见第九节 |

---

## 八、兼容与迁移

| 旧数据 | 处理 |
| --- | --- |
| 内置三套预设 | `defaultPromptCopies()` 自带所有分区 |
| 玩家自建预设（schema ≤ 4） | `ensurePromptScopes` 补 schema 5：只补缺失 id，已有同 id 保留；新 id 同步写进 `promptOrder`（`activePrompts` 只注入 order 里的词条） |
| 玩家删过的分区 | schema 已 5，不再补；「恢复本任务」找回 |
| ST 导入预设 | `sanitizePreset` 后过同一迁移，导入报告多一行「已补齐 N 条结构词条」 |
| 上一版草稿里的 `{{girl}}` / `{{roster}}` | 迁移时替换成 `{{heroine}}` / `{{girls}}`（只做一次，写在 `expandPresetMacros` 的兼容表里，日志提示） |
| 旧档 `missionRuns` 缺失 | 沿用现有「从 `battles` 派生」逻辑；派生不出就输出「暂无出勤记录」 |

风险与对策：

1. **玩家改坏提示词** → 校验器仍拦，错误带位置；编辑器常驻「当前校验口径」。
2. **宏太长撑爆预算** → 每条宏有上限与省略尾巴；回忆合计 1 600 tokens 封顶；日志可见。
3. **档案与历史重复注入**（玩家自己在别的词条里又手写一遍）→ 同一 scope 里同一宏出现两次时编辑器黄字提示。
4. **`{{}}` 与 JSON 冲突** → JSON 用单花括号，宏用双花括号；补测试盯住。
5. **OOC 兜底** → 边界 8 条默认开启；`{{heroine}}` 末尾自动附「这里没列出的事她不知道」，不依赖玩家是否保留那段文案。

---

## 九、测试计划（`tests/v49.test.ts`）

| 用例 | 断言 |
| --- | --- |
| 默认词条 | 12 条新分区都在 `DEFAULT_PROMPTS`，scope 正确，且全部通过 `promptHasMechanicBan`（不误报） |
| 迁移 | schema 4 预设补齐、`promptOrder` 同步、同 id 不覆盖；跑两次不重复；`{{girl}}` → `{{heroine}}` 只迁一次 |
| `{{heroine}}` 全量 | 含身份/外形/性情/能力/此刻/关系/心愿/契约/随身九节；魔女化时用 `witchPersonality`；无存档时返回「（未开局）」 |
| `{{heroine:brief}}` | 只含四节且 ≤150 tokens |
| `{{girls}}` vs `{{heroine}}` | 同时出现时内容不重复，`{{girls}}` 里不含完整性格与外貌 |
| `{{history.missions}}` | 最近 N 次、含结果与疤痕数；`missionRuns` 缺失时从 `battles` 派生；空存档输出「暂无出勤记录」 |
| `{{history.storylines}}` | 三段按 slot 排序、含已选选项文案与结局标签、进行中的那段标出当前幕 |
| `{{history.chat}}` | 最近 N 条、`system` 消息被跳过、带「（更早的 N 条已省略）」 |
| 回忆预算 | 四条历史同时开启时合计 ≤1 600 tokens，超出从最旧裁 |
| 枚举不漂移 | `{{kinds}}`/`{{limits}}`/`{{topics}}` 与代码常量同源 |
| 拼装顺序 | 分区在前、锁定契约在最后；删掉 `sl-ports` 后「连线总则」消失但契约仍在 |
| 可覆盖 | 把 `sl-structure` 改成「只写 3 个节点」，抓到的请求里出现该句 |
| 去重 | 对话请求里不再出现代码手写的「身份：…外貌：…」大段，只剩场景句 + 宏渲染结果 |

回归：24 个测试文件 445 项 + 新增约 13 项；`tsc --noEmit` 0 错；`check:rules` 通过。

---

## 十、实施顺序

1. `src/girlDossier.ts`（纯函数 + 预算裁剪），先把 `recentMissionRuns` / `missionMemory` 的拼装搬过来，配 3 条单测。
2. `src/promptMacros.ts` + `STORY_LIMITS`；`{{heroine}}`、`{{girls}}`、`{{history.*}}`、枚举宏先跑通。
3. `src/promptSections.ts`：12 条分区默认文本 + `DEFAULT_PROMPTS` 合并 + schema 5 迁移。
4. 接线蓝图与提案（v46 / v47 两段 body 变契约），跑 `v46` / `v47` 测试确认校验行为不变。
5. 接线对话 / 私语 / 私人事件 / 完整剧情，删掉手写档案与历史，比对 token 净减。
6. 编辑器 UI（宏面板、契约预览、最终提示预览、灯下私语入口）+ `tests/v49.test.ts` + 全量回归 + README / todo / 提交推送。

---

## 十一、明确不做的事

- 不让预设改写 **JSON 字段名、枚举取值、id 字符集**（解析器会失配）。
- 不新增 `storyline-repair` / `daily-repair` 这类绑定项（返修策略塞进同用途词条，靠「出现【必须修正的问题】时」触发）。
- 不做「一个宏自动带全部历史」的聚合宏：默认按任务给档，玩家用词条开关控制。
- 不新增历史存储：历史一律从 `missionRuns` / `storylines` / `messages` / `battles` 现算，卡片导出不带。
- 不动 v46 的端口规则语义与 v47 的瘦身策略，只搬位置、换数据来源。
