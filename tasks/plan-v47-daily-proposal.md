# v47 每日提案与蓝图提示词修订方案

> 与 `plan-v46-story-graph.md` 的关系：v46 管蓝图的节点结构与端口；本文件管**两处提示词的写法**（每日提案、蓝图里的阶段委托与角色事件），并顺手改了提案的分支结构与掉落/委托的生成方式。两处改动互不冲突，v46 的端口规则继续有效。
>
> **执行顺序：先做本文件（v47），再做 v46。**
>
> 两处共用的东西：`pickMissionTemplate({ work, difficulty, seed })` 与「按阶级抽成品」的思路——v47 用它给提案抽委托与装备，v46 用它给蓝图阶段委托抽委托、给奖励节点抽装备。先做 v47 可以把这两个工具函数一次做对。

---

## 一、体检

| 需求 | 现在是什么样 | 位置 |
| --- | --- | --- |
| ① 每日提案提示词不完整 | 只给 `NIGHT_SCHEMA_EXAMPLE` 的 JSON 骨架 + 13 条硬规则；`changes` / `outcomes` 有哪些 kind、各字段什么意思，全靠模型猜 | `llm-night.ts:842 buildNightPrompt`、`812 NIGHT_SCHEMA_EXAMPLE` |
| ② 提案要两个分支 | 强制 `accept / defer / reject` 三项，`defer` 还要模型精确写出「羁绊 −1 + 势力 −2」 | `llm-night.ts:587-599`、`472-515` |
| ③ 阶段委托只有调查写法 | `StoryMissionSpec` 让模型写 duration / requirement / target / monsters，全是调查口径 | `storygraph.ts:209-221`、`storyRun.ts:224 storyMissionForBeat`、`llm.ts:1415` |
| ④ 角色事件没写清 cast | 提示词只有一句「cast 是 1–3 个名册里的角色 id」，没说这些人要**在开场白里真的出现**，也没说怎么与台词对应 | `llm.ts:1416` |
| ⑤ 提案里塞了全部装备 | `catalog.items` 把**所有**物品（含自制）的 id/name/slot 全灌进提示词；`loot` 还要模型自造名称、属性与被动 | `llm-night.ts:786-789`、`918 materializeLoot` |

补充：`catalog.monsters` 也把全部可上场魔物列进去了。一旦 ③⑤ 改成「只给难度、由本地抽模板」，这份魔物表就完全不需要了——顺带省掉一大截 token。

---

## 二、① 每日提案提示词：补成「字段说明书」

把 `buildNightPrompt` 重排成五块，规则与字段说明分开：

1. **今晚的机制目录**（精简版，见 ⑤）
2. **值夜名册**（不变）
3. **三方首领 / 势力关系 / 城市态势**（不变）
4. **字段说明书**（新增，本轮重点）
5. **硬性规则 + JSON 形状**（保留，规则合并去重）

### 字段说明书要覆盖的字段

**mission（今晚的主委托）**
| 字段 | 写法 |
| --- | --- |
| `title` | 6–14 字，只写地点 + 异常，不写数值 |
| `description` | 80–160 字，写报案人口吻的现场感官 |
| `difficulty` | `低危 / 中危 / 高危 / 绝望` 之一 |
| `work` | `combat`（正面交战）或 `investigation`（现场调查） |

其余字段（时长、报酬、判定属性、目标值、轮次、推荐等级、敌人组合、辖区）**一律不写**，由程序按 difficulty + work 从真实委托模板里抽（见 ③）。

**opinions（今晚的议题，1–3 条）**
| 字段 | 写法 |
| --- | --- |
| `authorId` | 名册或三方首领的 id；`authorKind` 为 `girl` / `leader`；领袖提案要写 `authorFaction` |
| `topic` | `经费 / 排班 / 设施 / 同伴 / 城市 / 私人心愿` |
| `faction` | 这条议题牵动哪一方 |
| `district` | 与该辖区有关时填，否则 `null` |
| `title` / `text` / `request` | 14 字内标题 / 60–140 字说明 / 一句话诉求 |
| `dialogue` | 3–5 句，`speakerId` 必须来自名册，`expression` 只能取白名单 |
| `options` | **恰好两条**：`accept` 与 `reject`（见 ②） |

**options[].changes 的合法 kind**（写清方向，模型最容易在这里出错）
| kind | 写法 | 方向说明 |
| --- | --- | --- |
| `gold` | `{kind:'gold', amount}` | 负数=支出，正数=收入；单条 ≤1500 |
| `reputation` | `{kind:'reputation', amount}` | 城市安定度，±10 |
| `faction` | `{kind:'faction', faction, amount}` | 势力态度，±15 |
| `girl` | `{kind:'girl', girlId, field, amount}` | field 取 `bond / fatigue / corruption / spirit / hp`；bond ±5、fatigue ≤20 |
| `item` | `{kind:'item', itemId, amount}` | 指向成品物品 id，负数=消耗 |
| `minutes` | `{kind:'minutes', amount}` | 正数=占用时间，≤90 |
| `hostility` | `{kind:'hostility', pair, amount}` | 只有领袖提案可写，±9 |

**options[].outcomes 的合法 kind**
| kind | 含义 |
| --- | --- |
| `leave` | 她因此离开事务所 |
| `truce` | 两方停战（只能写在 accept） |
| `war` | 两方开战（只能写在 reject） |
| `territory` | 辖区易主 `{kind:'territory', district, faction}` |
| `mission` | 追加一份委托模板（本轮不再使用，见 ⑤） |

**envoy（三方使者委托）**：与 mission 同口径，只写 `title / description / difficulty / faction / district`，其余本地抽。
**loot**：改为只写阶级（见 ⑤）。

---

## 三、② 提案只产生两个分支：批准 / 驳回

**模型侧**
- `options` 从「恰好 3 项」改为「**恰好 2 项**，id 只能是 `accept` 与 `reject`」。
- 提示词删掉 `defer` 的规则，改为一句：「暂缓由系统固定处理（提出者羁绊 −1、所属势力态度 −2、下个议事日重新提出），你不要写。」

**程序侧**
- `validateOpinion`：`ids === 'accept,reject'`；删掉 `validateOption` 里的 defer 分支。
- `materializeNightProposal`：给每条议题**自动补一条 defer**（固定 changes：提出者 `bond −1`、`faction −2`），保证会客厅仍是三个按钮、暂缓的「次日回归」逻辑不用改。
- 兼容：老提案里若模型多写了 `defer`，解析时直接丢掉（由程序那条覆盖）。

**界面**：`CouncilView` / 决策对话框继续按 `option.id` 找按钮，不用改。

---

## 四、③ 阶段委派支持战斗委托（只给难度）

**数据**
`StoryMissionSpec` 收敛为语义四件套，其余字段可选保留（旧蓝图兼容）：
```ts
{ title: string; goal: string; work: 'combat' | 'investigation'; difficulty: '简单'|'常规'|'棘手'|'危险';
  // 以下保留给旧蓝图，新生成不再写
  duration?: number; district?: DistrictId; requirement?: StatKey; target?: number; rounds?: number; monsters?: MonsterTemplate[] }
```

**运行时（`storyMissionForBeat`）**
1. 按 `work` 取池：`combat` → 80 条战斗模板，`investigation` → 16 条调查模板（都在 `baseCommissionPool`）。
2. 用 `hashText(story.id + beat.id)` 做**确定性随机**挑一条（同一幕每次重开都是同一条，不会读档变样）。
3. 难度按 `storyRank` 映射到模板的 difficulty 档，模板数值原样采用（时长、报酬、判定、轮次、推荐等级）。
4. 战斗模板的 `enemyIds` **原样使用**（这就是「使用其魔物组合」）；调查模板用它的 `requirement / target`。
5. `description` 用模型给的 `goal` 覆盖；`title` 用模型给的 `title`。
6. 旧蓝图里写了 `duration / monsters / district` 的，仍优先采用，不让老图失效。

**提示词（蓝图）**
```
- mission: {"kind":"mission","spec":{"title":"","goal":"她要在这场委托里做到什么，写具体","work":"combat|investigation","difficulty":"简单|常规|棘手|危险"}}
  · 只写这四个字段。时长、报酬、判定属性、目标值、轮次、敌人、辖区由系统按 difficulty 从真实委托模板里抽，
    战斗委托会复用模板的魔物组合，所以不要自己编敌人或数值。
  · work 决定这是战斗还是调查：正面冲突、要打，写 combat；走访、取样、问话，写 investigation。
```

**校验**：`work` 必填且二选一；`difficulty` 必填且四选一；`goal` 非空。

---

## 五、④ 角色事件的参演者写进提示词

提示词里把 cast 讲透（现在只有一句）：

```
- event: {"kind":"event","title":"","hook":"一句引子","cast":["名册里的角色 id"],"opening":"250–350 字开场白"}
  · cast 写 1–3 个名册里的角色 id，第一个必须是这条故事线的主角。
  · 这几个人必须在 opening 里真的出场：每个人至少有一句台词或一个明确动作，
    不能只在 cast 里挂个名字。
  · opening 用「你」称呼所长，写清地点、在场的人、她正在做什么，结尾留一个能让玩家接话的空档。
  · 如果涉及三方首领，id 也要从名册/首领名单里取，不要新造名字。
```

**运行时兜底**：`advanceStoryGraph` 的 event 分支在 `cast` 为空时补 `[girl.id]`；生成期在 `generateStoryBlueprint` 校验「cast 非空、≤3 人、含主角」，不合格只记 warning（不整张作废），运行时再补。

---

## 六、⑤ 提案不再列全部装备；委托只给难度

**目录瘦身**
- `catalog.items`：从「全部物品」改为**阶级清单**：
  `items: { tiers: [{ tier: 1, count: 12, examples: ['蚀月抑制剂','星织长杖'] }, …] }`（每阶最多 3 个示例名，只做文风参考）。
- `catalog.monsters`：**整段删除**（委托不再写敌人）。
- 估算：这两块原本各占几百到上千 token，删完提示词能省一半。

**掉落改为阶级**
- 提案的 `loot` 改为 `[{ tier: 1–5, faction, slot: 'weapon'|'charm'|'consumable' }]`，最多 2 件；**不再写 name / stats / passive**。
- 新增共用的 `pickEquipmentOfTier(state, tier, slot, seed)`：从物品表按 `tierOf(item)` 过滤，同阶同槽内按种子确定性随机取一件成品；`materializeNightProposal` 用它把 loot 换成真实物品 id（作为 `rewardItemRef` 或直接进背包）。
- v46 的奖励节点 `equipmentTier` 复用**同一个函数**，只是 seed 换成 `story.id + node.id`。
- 好处：不会出现自造装备、属性越界，也不用把整张物品表塞进提示词。
- 兼容：旧提案里带 `name/stats` 的自造 loot 仍按原路登记（`materializeLoot` 保留为 fallback）。

**委托只给难度**
- 与原 ③ 用同一个抽取函数 `pickMissionTemplate({ work, difficulty, seed })`，每日提案的 mission / envoy 与蓝图阶段委托共用。
- 提案 mission 形状：`{ title, description, difficulty, work }`；envoy 额外保留 `faction` 与 `district`。

---

## 七、类型与函数改动清单

| 文件 | 改动 |
| --- | --- |
| `llm-night.ts` | `buildNightPrompt` 重排 + 字段说明书；`buildNightCatalog` 删 monsters、items 改阶级清单；`NIGHT_SCHEMA_EXAMPLE` 改成新形状；`validateOpinion` 只收 accept/reject；`materializeNightProposal` 自动补 defer、按阶级抽装备 |
| `llm-night.ts`（新增） | `pickMissionTemplate({ work, difficulty, seed })`：从 `baseCommissionPool` 确定性抽模板并返回填充好的委托字段 |
| `storygraph.ts` | `StoryMissionSpec` 增 `work`；`sanitizeData` 的 mission 分支按新形状收（保留旧字段） |
| `storyRun.ts` | `storyMissionForBeat` 改为「按 work+difficulty 抽模板 + 用模型的 title/goal 覆盖」 |
| `llm.ts` | 蓝图提示词的 mission / event 段落重写（第四、五节） |
| `types.ts` | `StoryMissionSpec.work`；`NightLoot` 改为 tier 形状（旧字段可选） |

---

## 八、兼容与迁移

| 旧数据 | 处理 |
| --- | --- |
| 老提案（3 个选项、带 defer） | 解析时丢掉 defer，materialize 补回固定那条 |
| 老提案里自造的 loot（带 name/stats） | 仍按原路登记，不走阶级抽取 |
| 老蓝图 mission 写了 duration/monsters/district | 优先采用，不抽模板 |
| 老蓝图 event 的 cast 为空 | 运行时补 `[girl.id]` |
| 老蓝图里 reward 带技能/装备 | v46 已定：`sanitizeData` 剥掉 |

---

## 九、测试计划

| 用例 | 断言 |
| --- | --- |
| 提案选项 | 只给 accept/reject 两项也能通过；materialize 后变回三项且 defer 的 changes 是固定值 |
| 提案难度抽取 | 同一 day+状态抽两次得到同一条模板；work=combat 时 enemyIds 来自战斗模板 |
| 蓝图阶段委托 | `work:'combat'` 的 mission 节点能抽到战斗模板、`enemyIds` 非空、description 用模型写的 goal |
| 蓝图阶段委托（旧图） | 写了 `monsters` 的旧节点仍按原样生成，不被抽模板覆盖 |
| 角色事件 cast | cast 为空时报 warning 且运行时补主角；cast 含主角时正常 |
| 掉落阶级 | 提 `tier:3` 两件 → 材质化后得到两件三阶成品，槽位与请求一致 |
| 目录瘦身 | 提示词里不再出现完整物品表与魔物表；仍能看到阶级统计 |
| 回归 | 21 个测试文件 426 项全绿 + 新增 |

---

## 十、实施顺序

1. **提示词**：重排 `buildNightPrompt` + 字段说明书；蓝图 mission / event 段落重写。
2. **目录瘦身**：删 monsters，items 改阶级清单；`NIGHT_SCHEMA_EXAMPLE` 同步。
3. **提案两分支**：校验 + materialize 补 defer。
4. **难度抽模板**：新增 `pickMissionTemplate`，接到每日提案与蓝图阶段委托。
5. **掉落改阶级**：`materializeNightProposal` 按 tier 抽成品；旧自造 loot 走 fallback。
6. 全量回归、更新 README 与 todo、提交推送。
