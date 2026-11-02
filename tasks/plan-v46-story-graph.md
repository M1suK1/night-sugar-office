# v46 故事蓝图改造方案（修订 3）

> 修订 3 的改动：
> 1. 奖励节点的提示词补全可用字段与幅度，**删掉技能**；**装备改为指定阶级、由程序随机发放对应阶级的成品**
> 2. 场景节点的去向由「角色事件」改为**强制弹窗**
> 3. 初始提示词补上**强制弹窗**与**议会提案**的写法，同时解除对这两种节点的禁令
> 4. 把「连线/端口」的纠错规则**写进初始提示词**，不再靠生成后的返修
>
> **执行顺序**：先做 `plan-v47-daily-proposal.md`，再做本文件。

---

## 一、体检：问题到底出在哪

| 现象 | 代码位置 | 原因 |
| --- | --- | --- |
| 奖励只给了 `{"effect":{"bond":2,"gold":0}}` 一行 | `llm.ts:1417` | 没告诉模型还有 reputation / corruption / growth / trait / buff，也没给幅度上限 |
| 模型偶尔写技能、装备 | 同上 + `StoryGraphDialog` 的奖励面板 | 提示词没禁止；编辑器里还摆着「装备」「技能」两个下拉 |
| 永远不生成强制弹窗 / 议会提案 | `llm.ts:1407` 的 kind 白名单 + `1420` 的「不要生成 incident 或 opinion」+ `storygraph.ts:494-498` 的硬性拒绝 | 三处一起把这两类节点挡在门外，而且提示词里**没有任何 data 示例** |
| 返修清单里全是端口错 | `storygraph.ts:527-538` 的校验；`buildGraphFromDraft` 原样保留 fromPort | 模型用语义化端口名（`trust_calc` / `defy_fate` / `accept_logic` / `point_overlo`）代替选项 id，提示词只说了「fromPort 等于该选项 id」一句，没有反例、没有自检清单 |

---

## 二、① 场景节点的去向：改为强制弹窗

上一版打算转成**角色事件**，本次改为**强制弹窗**：旁白本来就是「看一眼」的信息，弹窗的 `body` 正好接住，玩家点一下继续，不必每次都被拖进一段交互剧情。

**类型与常量**
- `StoryNodeKind` 删除 `'scene'`；`StoryNodeData` 删除场景分支。
- `NODE_LABELS` / `NODE_ACCENT` 同步删除（`Record<StoryNodeKind, …>` 会强制改干净）。

**运行时**
- 删除 `advanceStoryGraph` 的 scene 分支。
- `graphBeats()` 的过滤由 `scene || event` 改为 `event`；幕列表里的 `scene` 字段留空，`hook` 取事件 hook。

**蓝图编译（手稿 → 图）**
- `ensureGraph()` 原来为每一幕生成「场景 + 委托/选择」，改为生成**弹窗**节点：
  - `spec.kind` 取 `'girl'`
  - `title` = 幕标题
  - `body` = `beat.scene || beat.summary`（截 400 字）
  - `options` = 空数组（纯通报卡，玩家点「知道了」继续）
- 支线结构不变：弹窗 → 委托/选择 → 下一个弹窗。

**校验**
- 删掉「蓝图至少需要一个场景节点」。
- 改为「**至少需要一个角色事件或强制弹窗**」。
- 新增数量约束：`event` 1–2 个、`incident` 1–2 个、`opinion` 0–1 个。
- **删掉**「生成蓝图不能包含强制弹窗/议会提案」这条硬性拒绝（`storygraph.ts:494-498`）——这一条正是模型永远不生成它们的原因。

**旧存档 / 旧卡片迁移**
- `sanitizeGraph()` 遇到 `kind: 'scene'` 就地转换：
  - `kind` → `'incident'`，**id、坐标、连线一律不动**（弹窗在无选项时也用 `out` 出口，天然兼容）
  - `spec` = `{ kind: 'girl', title: 原 title, body: narration（截 400 字）, options: [] }`
  - 原 `lines` 台词并入 `body` 末尾（截断后仍超长则丢弃）
- 幂等：转换后再读一次不会有变化。迁移必须发生在读档时，否则正在跑的图模式故事线 `run.cursor` 会指向不存在的节点而被判「中断」。

**编辑器**
- 节点按钮条去掉「场景」，删除场景编辑面板。
- 强制弹窗面板已有（标题/正文/选项），补一个「留空选项 = 纯通报卡」的说明。

---

## 三、② 奖励节点：补全提示词，砍掉技能，装备改按阶级发放

**提示词改写**（替换 `llm.ts:1417` 那一行）
```
- reward（一次结算：数值 + 可能的特性 + 可能的一件装备）:
  {"kind":"reward","effect":{"bond":2,"gold":0},"equipmentTier":3}
  · effect 可用字段与幅度：bond −12…12、gold −800…800、reputation −10…10、corruption −10…10、
    growth{magic|insight|agility|empathy 各 −3…3}、trait{name≤16字, description≤60字}、
    buff{name, stat: magic|insight|agility|empathy, amount ≤6, days 1…5}
  · 同一张图里的奖励要克制：gold 合计不超过 800，bond 合计不超过 12。
  · equipmentTier 可选，1–5 的整数：写 3 就是「一件三阶装备」，具体是哪一件由程序从三阶里随机发放。
    不想要装备就不写这个字段；一张图最多一个 reward 带装备。
  · 不要写 skill、装备名字、装备属性——蓝图不发放技能，也不指定具体装备。
```

**代码侧同步**
- `StoryNodeData` 的 reward：`equipmentId` 换成 `equipmentTier?: number`（1–5）；`sanitizeData` 的 reward 分支按阶级收（`clampInt(tier, 1, 5, 0)`，0 表示不给），并**剥掉 `effect.skill`**。
- 新增 `pickEquipmentOfTier(state, tier, seed)`：从物品表里按 `tierOf(item)` 过滤，同阶内按 `hashText(`${story.id}:${node.id}`)` 确定性随机取一件（**只取 weapon / charm，不取消耗品**），保证同一张蓝图每次跑到这里拿到的是同一件。
- `advanceStoryGraph` 的 reward 分支：`equipmentTier` 存在时调上面这个函数，把成品 id 放进 `state.inventory`，并写一条日志「她从这段故事里带走了一件东西：<名称>（<阶级>）」。
- `StoryGraphDialog` 奖励面板：删掉「装备」下拉与「技能」下拉，换成「装备阶级 1–5（0 = 不给）」的数字输入。
- `applyStoryEffect` **不动**：角色事件与剧情选择仍在用 `skill`，只是蓝图奖励不再产出它。

---

## 四、③ 提示词补上强制弹窗与议会提案

`blueprintKinds`（`llm.ts:1356`）改为：
```ts
const blueprintKinds: StoryNodeKind[] = ['start', 'choice', 'mission', 'event', 'incident', 'opinion', 'reward', 'wait', 'end'];
```

并在提示词里补两段 data 说明（完整文本见第五节）：

- **incident（强制弹窗）**：`spec.kind` 三选一（`faction` / `environment` / `girl`）、`title` ≤14 字、`body` 60–160 字、`options` 0–3 个，`effect` 用 `IncidentEffect` 的字段（gold / reputation / faction / girl / district / hostility），幅度克制。
- **opinion（议会提案）**：`topic` 六选一、`title`、`text` 60–140 字、`request` 一句话，**只写 `accept`（批准）与 `reject`（驳回）两个选项**，每个带一句 `effect`。这两个选项就是节点上的两条出线，决定剧情往哪边走；`defer`（暂缓）由程序固定补，**不推进剧情**，只是把议题推到下个议事日。

**运行时接线（提案节点 = 两条分支）**
1. `portsOf(opinion)` 返回 `['accept', 'reject']`，画布上直接显示两个出口，从哪个口拉线就代表那个分支。
2. `resolveStoryWait` 增加 `port` 参数（默认 `'out'`）；处理提案时传**玩家实际选的那个决定**（`accept` / `reject`）。
3. `factionOps` 处理议题时把 decision 带过去；`decision === 'defer'` 时**不调用** `resolveStoryWait`（现状已如此），剧情停在原节点，议题下个议事日重新提出。
4. `advanceStoryGraph` 生成议题时，`spec.options` 只有 accept / reject，程序按 v47 同一套规则补一条固定 defer，**服务厅界面仍是三个按钮**，只是暂缓不接剧情线。
5. 校验：accept 与 reject 各恰好一条边；出现 `defer` 或其它 `fromPort` 一律报错。

---

## 五、④ 端口纠错规则写进初始提示词

### 新版提示词正文（可直接替换 `llm.ts` 的 `body`）

```
请直接写一张「故事蓝图」（StoryGraph），不是四幕手稿。只输出一个 JSON 对象，不要 Markdown 代码块：
{"title":"","premise":"","tone":"","nodes":[{"id":"n1","kind":"start","title":"开始","data":{"kind":"start"}}],"edges":[{"from":"n1","fromPort":"out","to":"n2"}]}

节点 kind 只能用这九种：start、choice、mission、event、incident、opinion、reward、wait、end。
没有 scene 节点。需要一段旁白时，用 incident 写一张「看一眼」的弹窗；需要她开口说话时，用 event。

【规模与硬性结构】
6–16 个节点；恰好 1 个 start；2–3 个 end，且每个 end 的 ending 两两不同（例如「留下」「离开」「带着钥匙走」）；
choice 1–2 个；mission 1–2 个；event 1–2 个；incident 1–2 个；opinion 0–1 个；reward 与 wait 合计不超过 2 个。

【连线总则——这一节写错，整张蓝图会被校验打回】
1. 必须是有向无环图：从 start 能到达每个节点；每条路径最终都到 end；不允许回环、自环、悬空连线。
2. 除 end 外每个节点都必须有出口；end 不能有任何出口；start 只有一条 fromPort="out"。
3. fromPort 只有四种合法来源，别的一律非法：
   a) "out"：start、event、reward、wait，以及没有选项的 incident；
   b) "success" 与 "failure"：只有 mission 用，且必须各恰好一条；
   c) choice 的选项 id；
   d) incident 有选项时的 o1 / o2 / o3。
4. choice 的选项 id 只能是小写单字母：a、b、c、d，按顺序给。
   禁止语义化命名。下面这些名字一出现就说明写错了：trust_calc、point_overlo、defy_fate、accept_logic、option1、OPTION_A、选项A。
5. choice 有几个选项，就必须恰好有同样条数的出边，fromPort 分别等于这些 id —— 不多一条，也不少一条。
   例：options 是 a、b，则 edges 里必须同时存在 {from:"该节点",fromPort:"a",to:…} 与 {from:"该节点",fromPort:"b",to:…}。
6. 全图不允许出现「起点节点里没有声明过的 fromPort」。写边之前先回头看那个节点的出口清单。
7. incident 的选项 id 固定写 o1、o2、o3；每个选项对应一条 fromPort 相同的边。incident 不写选项时，用一条 fromPort="out"。
8. opinion 固定两个分支：**accept 与 reject 各一条出边**，`fromPort` 分别写 accept / reject。这两条线就是「批准」和「驳回」之后各自的剧情。不要写 defer，暂缓由系统处理、不走剧情线。

【各节点 data 的写法】
- start: {"kind":"start"}
- choice: {"kind":"choice","prompt":"她在等你怎么回应","options":[{"id":"a","label":"选项文案","intent":"这个选择意味着什么","effect":{"bond":2}},{"id":"b","label":"另一个选项","intent":"","effect":{"bond":-1,"corruption":1}}]}
  · 2–4 个选项；id 只能是 a/b/c/d。effect 可用 bond −12…12、gold −800…800、reputation −10…10、corruption −10…10。
- mission: {"kind":"mission","spec":{"title":"","goal":"她要在这场委托里做到什么，写具体","category":"故事委托","difficulty":"简单|常规|棘手|危险","duration":90,"requirement":"magic|insight|agility|empathy"}}
- event: {"kind":"event","title":"","hook":"一句引子","cast":["名册里的角色 id"],"opening":"250–350 字开场白：写清地点、在场的人、她正在做什么，用「你」称呼所长，结尾留一个能让玩家接话的空档"}
  · cast 1–3 人，必须包含这条故事线的主角。
- incident（强制弹窗：必须现在拿主意，或必须先看一眼的事）:
  {"kind":"incident","spec":{"kind":"faction","title":"不超过 14 字","body":"60–160 字，写清谁在施压、要什么、不答应会怎样","faction":"association|government|witch","district":"candy|station|plaza|greenhouse|cathedral|crossroad|oldtown|clocktower|docks","options":[{"label":"答应","hint":"一句代价","effect":{"gold":-200,"reputation":2}},{"label":"拒绝","hint":"一句代价","effect":{"reputation":-3,"faction":{"id":"government","standing":-2}}}]}}
  · spec.kind 只能是 faction / environment / girl。
  · options 0–3 个；effect 可用：gold −800…800、reputation −4…4、faction{id, standing −4…4}、girl{fatigue, spirit, corruption, bond}、district{id, targetPct, rewardPct, untilDay}、hostility{pair, delta −3…3}。
  · 不给选项就是一张纯通报卡，玩家点「知道了」继续。
- opinion（议会提案：摆到会客厅让玩家批准 / 驳回；两个分支各自接一条剧情线）:
  {"kind":"opinion","spec":{"topic":"私人心愿","title":"不超过 14 字","text":"60–140 字，写清她要什么、为什么现在提","request":"一句话说明她要你答应什么","options":[{"id":"accept","label":"批准","effect":"批准之后会发生什么，一句话"},{"id":"reject","label":"驳回","effect":"驳回之后会发生什么，一句话"}]}}
  · options 只能有 accept 与 reject 两项；节点上对应两条出边，fromPort 分别是 accept 与 reject。
  · 暂缓（defer）由程序固定补，不占端口、不推进剧情——不要写。
  · topic 只能是 经费 / 排班 / 设施 / 同伴 / 城市 / 私人心愿。
- reward（一次结算：数值 + 可能的特性 + 可能的一件装备）: {"kind":"reward","effect":{"bond":2,"gold":0},"equipmentTier":3}
  · effect 可用：bond −12…12、gold −800…800、reputation −10…10、corruption −10…10、growth{四维各 −3…3}、trait{name≤16字, description≤60字}、buff{name, stat, amount≤6, days 1…5}。
  · equipmentTier 可选，1–5 的整数：写 3 就是「一件三阶装备」，具体哪一件由程序随机发放；不写即不给装备。
  · 全图 gold 合计不超过 800，bond 合计不超过 12。不要写 skill、装备名字或装备属性。
- wait: {"kind":"wait","days":0,"minutes":60}（days 0–14，minutes 0–1440）
- end: {"kind":"end","summary":"这条结局收在哪里","ending":"两三个字的结局名，同一张图里不能重复"}

【不要】
不要给 x、y、边 id、颜色、note 或任何额外字段；不要输出 scene 节点；不要输出注释、解释或 Markdown 代码块。

【提交前自检——逐条对照，全部通过再输出】
1. 所有 kind 都在九种之内，且没有 scene。
2. 每个 choice 的选项 id 都是 a/b/c/d；每个选项在 edges 里都有且只有一条 fromPort 完全相同的边。
3. edges 里每条的 fromPort，都能在 from 指向的节点里找到同名出口；出现 trust_calc、defy_fate 这类名字就说明写错了。
4. 每个 mission 恰好一条 success、一条 failure。
5. 每个 incident：有选项就每个 o1/o2/o3 各一条同名边，没选项就一条 out。
6. 每个 opinion 恰好 accept 与 reject 两条边——批准走一条，驳回走另一条。
7. start 只有一条 out；end 没有任何出边；其余非 end 节点至少一条出边。
8. 从 start 出发能走到每一个节点，且每条路径都能到某个 end；没有环。
```

### 返修提示词也补一句

`llm.ts:1453` 的修复尾巴现在只有「只输出修正后的完整 JSON」。改为：

```
按上面的规则逐条修正下列问题后再输出完整 JSON：
- 如果某个选项「必须且只能连一条线」，就补一条 {from:"该选择节点 id",fromPort:"该选项 id",to:…}，不要新增选项、不要改选项 id。
- 如果出现「无法识别的出口」，说明 fromPort 写成了语义化名字：把它改成该节点真实存在的选项 id（a/b/c/d 或 o1/o2/o3），不要新建端口。
- 不要删节点；保持原有的 2–3 个 end 与 6–16 个节点规模。
```

---

## 六、校验器（`validateGraph`）同步改动

| 位置 | 现在 | 改成 |
| --- | --- | --- |
| `storygraph.ts:481/493` | 统计 scenes、要求 ≥1 个 scene | 删除；改为「至少一个 event 或 incident」 |
| `storygraph.ts:494-498` | 生成蓝图禁止 incident / opinion | 删除；改为数量上限（event 1–2、incident 1–2、opinion ≤1） |
| 新增 | — | incident 端口：每个选项恰好一条同名边；无选项时必须恰好一条 `out`；其它端口报错 |
| 新增 | — | opinion 端口：`accept` / `reject` **各恰好一条**；多写 defer 或其它端口报错 |
| 新增 | — | 通用白名单：start / event / reward / wait 只允许 `out`，多出即报错 |
| `storygraph.ts:536-538` | 「无法识别的出口」文案 | 补一句提示：「fromPort 必须是该节点真实存在的出口（选项 id 或 out）」，与提示词措辞一致 |

节点规模保持 8–16（与提示词一致，不做额外收紧）。

---

## 七、兼容与迁移

| 旧数据 | 处理 |
| --- | --- |
| 存档里含 `scene` 的蓝图 | 读档时转成 `incident`（保留 id/坐标/连线，`options: []`） |
| 契约卡里的 `storyPlan.graph` 含场景 | 同上（`parseGirlCard` 已走 `sanitizeStoryPlan`） |
| 正在跑的图模式故事线，cursor 指向场景 | 转换保留 id，cursor 天然仍有效 |
| 奖励节点带 `equipmentId` / `effect.skill` 的旧图 | `sanitizeData` 把 `equipmentId` 按该物品的阶级折算成 `equipmentTier`（认不出就丢掉），`effect.skill` 直接剥掉，不报错、不中断 |
| 已发出的弹窗卡（无选项） | 运行时走 `out` 端口，与「知道了」按钮对应 |

---

## 八、测试计划

| 用例 | 断言 |
| --- | --- |
| 迁移 | 含 scene 的旧图读档后节点数不变、scene 全变 incident、`run.cursor` 仍指向存在的节点 |
| 奖励清洗 | 带 `equipmentId` 的奖励节点读入后折算成同阶 `equipmentTier`；`effect.skill` 被剥掉，其余字段保留 |
| 奖励发放 | `equipmentTier: 3` 的奖励节点跑完后背包多一件三阶非消耗品；同一张图重复跑到这里得到同一件 |
| 校验·结构 | 只有 start/end 的图报「至少一个角色事件或强制弹窗」；3 个 incident 报超量 |
| 校验·端口 | 选项 `a` 少一条边 → 报「必须且只能连一条线」；出现 `fromPort="trust_calc"` → 报「无法识别的出口」 |
| 校验·弹窗 | 有选项 `o1`/`o2` 的 incident 缺一条边 → 报错；无选项的 incident 缺 `out` → 报错 |
| 校验·提案 | opinion 缺 `accept` 或 `reject` 边 → 报错；多出 `defer` 端口 → 报错 |
| 运行·提案分支 | 批准走 `accept` 那条线、驳回走 `reject` 那条线；选「暂缓」时剧情原地不动，议题回到下个议事日 |
| 生成 | 模型给出 scene 节点时按 incident 静默转换，不让整份作废 |
| 回归 | 21 个测试文件 426 项全绿 + 新增用例 |

---

## 九、实施顺序

1. 类型与常量删 scene；`sanitizeGraph` 迁移；`validateGraph` 改结构检查。
2. 提示词整段替换（第五节的正文）＋ `blueprintKinds` 加 incident/opinion。
3. 奖励节点：提示词段落 + 编辑器删两个下拉 + `sanitizeData` 剥字段 + 运行时不入包。
4. `validateGraph` 补端口校验（incident / opinion / 通用白名单），文案与提示词对齐。
5. 返修提示词补修正策略。
6. 全量回归、更新 README 与 todo、提交推送。
