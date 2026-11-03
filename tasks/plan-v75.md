# v75 方案：档案可编辑 / 癖好进提示词 / 非财政提案 / 载入不生成 / 立绘重载 / 势力存在感

> 六件事分六次提交，每件都能单独验证、单独回滚。所有锚点都标了文件与行号，实施时不用再翻。

---

## 1. 契约卡导入后「外貌 / 服装描述」不能改

**现状**
- 档案页只能改性格：`CharacterDialog` 有 `#dossier-personality-input`，动作是 `setPersonality`（`types.ts` 动作表）。
- `appearance` / `outfitDescription` 只在导入时从卡片带上（`cards.ts` 的 `parseGirlCard` 会截断到 240 字），之后没有任何编辑入口；`girlDossier.ts` / `girlBrief()` 直接读这两个字段喂给模型。

**改法**
1. 新增两个动作（`types.ts` + `rules/growthOps.ts` + `rules/act.ts`）：
   ```ts
   | { type: 'setAppearance'; girlId: string; text: string }
   | { type: 'setOutfitDescription'; girlId: string; text: string }
   ```
   两个都走同样的清洗：`trim()`、去换行、限长 240 字、空串允许（表示「没写」），并在 `logs` 里记一条 `base` 日志。
2. `CharacterDialog` 的「外观装备」页（`tab === 'appearance'`，`CharacterDialog.tsx:412`）顶部加两块文本域：
   `#dossier-appearance-input`、`#dossier-outfit-input`，与性格输入同款交互（草稿 + 失焦提交，参考 `personalityDraft` 的写法：`useState` + `onChange` 存草稿、`onBlur` 派发）。
3. 档案页「关系网络」或「外观装备」里补一句小字：这两段会进提示词（`{{heroine}}` 与 `girlBrief`）。
4. 导出卡片时用的是 `buildGirlCard`，它直接读 `girl.appearance/outfitDescription`，改完自动同步，无需额外处理。

**验收 / 测试（`tests/v75-appearance.test.ts`）**
- 改外貌后 `girlDossier` 与 `girlBrief` 输出里出现新文本；超过 240 字被截断；空串不写回垃圾。
- 导入一张带外貌的卡 → 改成新文本 → 导出卡里是新文本。

---

## 2. 角色「癖好」没有进提示词（战后获得的特性）

**现状（已核实）**

- 这里的「癖好」就是**战后获得的特性**：`gainTrait()`（`rules/conditions.ts:62`）在战斗胜利 35%、调查完成 30%、星象台远行 12% 的概率下从特性池里抽一条写进 `girl.traits`（带 `gainedAt` 与 `polarity` 正 / 负 / 中性）。
- `girlDossier.ts:93` 把特性写进了**全量档案**（`{{heroine}}` 走这条），但**简报** `girlBrief()`（llm.ts）只写身份 / 性情 / 外貌 / 语气——对话、私语、角色事件全用简报，所以叙事者根本不知道她战后染上了什么怪癖。
- 简报也是战斗札记「她是谁」与事件开场白的取数口，这条缺失在三个任务里同时存在。

**改法**

1. `girlBrief()` 增加一行：`战后癖好：偏执（多疑，容易把好意当试探）｜好整以暇（打完还笑得出来）`，最多 4 条，按 `gainedAt` 新→旧排；没有就写「暂时没有」。
2. 极性写进文本：负面写「她自己也察觉到了」，正面用中性描述，中性直接给行为。
3. 抽一个 `traitLine(girl)` 同时供 `girlBrief`、`dossierOf().brief` 与 `girlDossier()`，避免三处各写一遍又走散。
4. 战后日志已有「显露出新的特性」，不再额外通知。

**验收 / 测试（`tests/v75-quirk.test.ts`）**

- 没有特性 → 简报含「暂时没有」；
- 给 5 条特性 → 只取最近 4 条，顺序按获得时间倒序；
- 同一份信息在 `dossierOf().brief` 与 `girlDossier()` 里一致。
## 3. 每日提案偏财政：加「契约者之间的纠纷」

**现状**
- 提案主题枚举 `NIGHT_TOPICS` 里已有 `同伴`（`nightSpec.ts`），但提示词没要求「非财政提案」的最低配额，模型自然偏向「批钱 / 立项」这类最好写的。
- `defaultOpinionDialogLines`（`opinions.ts`）只按主题给模板，`同伴` 的模板也很薄。

**改法**
1. 提示词（`promptSections.ts` 的 `dy-*` 分区 + `dailyContract()` 之外的软要求）：
   - 「每晚至少一条提案**不涉及星砂支出**：可以是两个人的矛盾要你裁决、某人对排班/辖区归属的不满、或她在意的人被谁伤了。」
   - 「涉及两个人的提案，`dialogue` 里两人都要说话，且第二个人必须反驳或加码，不要只有提出者自言自语。」
2. 新增一小组「纠纷种子」到 `opinions.ts` 的默认模板（`defaultOpinion*`）：争吵、越权、抢委托、护着外人、旧伤被提起。这些只在模型没写 `dialogue` 时兜底，不覆盖模型输出。
3. 弹窗侧补一类「两人纠纷」模板（`content/incidents.ts`）：`kind: 'girl'`、两个 `speakerId`、`trigger: { kind: 'wave', wave: 1 }`；效果以 `bond` / `fatigue` 为主，避免又变成扣钱。
4. 校验（`llm-night.ts` 的 `parseOpinion`）：若三条提案全部含 `gold < 0`，记 `warn`（不 fail），并在修复轮的 `problems` 里带一句「至少留一条不花钱的提案」。

**验收 / 测试（`tests/v75-quarrel.test.ts`）**
- 造一份「三条都扣钱」的提案 → 校验给出 warn；
- 造一条 `同伴` 提案带两人对白 → 渲染时两句都在，且第二句的 `speakerId` 与提出者不同；
- 新弹窗模板能被 `dueIncidents` 在 wave 1 投出来（用 `dayStart`/`wave` 两条断言）。

---

## 4. 载入存档就生成一次提案

**现状（`App.tsx:289-296`）**
```ts
useEffect(() => {
  if (!autoGenerate) { lastGeneratedDay.current = state.day; return; }
  if (!loaded) return;
  if (state.day <= lastGeneratedDay.current) { lastGeneratedDay.current = state.day; return; }
  lastGeneratedDay.current = state.day;
  ...
}, [state.day, autoGenerate, loaded]);
```
`lastGeneratedDay` 是 `useRef(0)`，**页面一刷就是 0**，于是任何 `state.day > 0` 的存档在首次 effect 里都会走「day 变大」分支，立刻请求一次。

**改法**
1. `lastGeneratedDay` 初始化改为跟随载入的存档：在 boot/`afterLoad`/`loadFromSlot`/`importSave` 之后把 ref 设成 `state.day`（一处 helper：`syncGeneratedDay(day)`）。
2. 更稳的做法是把它写进状态：`state.generatedDay?: number`（持久化），effect 判 `state.day > (state.generatedDay ?? state.day)`；生成成功后 `setState(prev => ({...prev, generatedDay: prev.day}))`。这样**刷新、换设备、读档**都不会重放。
3. 「首夜补齐」继续走 `fillOpening()`（`openingFilledAt` 逻辑，`App.tsx:872` 附近），与自动生成分开：前者只在 `openingFilledAt === 0` 时跑一次。

**验收 / 测试（`tests/v75-autogen.test.ts`）**
- 构造 `day: 20, generatedDay: 20` 的存档 → 载入后 effect 不触发（用纯函数 `shouldAutoGenerate(state, autoGenerate)` 断言，App 里改为调它）；
- `generatedDay: 19` + `day: 20` → 触发一次，生成后 `generatedDay` 变 20，再跑不触发；
- 首夜 `openingFilledAt: 0` 仍然只补一次。

---

## 5. 立绘缺失 → 重新载入

**现状**
- 立绘已经走资产（`portraitAsset`），`GirlPortrait` 拿不到图时退回程序化剪影，于是「角色还在，但图没了」。
- 卡库里通常还留着这张卡的原文（`cardbox` 按 `hash` 存 JSON），`girl.cardId` 就指向它；这是最好的恢复源。

**改法**
1. `CharacterDialog` 外观页加一个按钮 `#dossier-portrait-reload`：
   - 先按 `girl.cardId` 去卡库取卡（`cardboxCards([hash])` / `loadCardBox` 查表），把卡里的 `portrait` 转成资产（`assetPut`）写回 `portraitAsset`；
   - 卡库里没有就退到「从卡片重导」或「手动选择文件」（复用 `WitchFormDialog` 的选图交互）；
   - 全部失败时提示「这张卡不在卡库了，可以重新导入契约卡或手动指定立绘」。
2. 新增动作 `reloadPortrait`（`girlId`、可选 `dataUrl`），在 `rules/growthOps.ts` 里统一走 `assetPut` + `portraitAsset` 赋值 + 清空 `portrait: ''`，并清掉 `imageSlim` 留下的空引用。
3. 顺手加一个「批量体检」：载入存档后扫一遍 `girls/candidates/memorial`，凡是 `portraitAsset` 存在但 `assetGet` 取不到的人，在档案页标一个「立绘缺失」角标（只提示，不自动改）。

**验收 / 测试（`tests/v75-portrait.test.ts`）**
- 假 girl：`portraitAsset: 'asset:missing'` → `assetGet` 为空 → 判定为「缺图」；
- 给定卡库卡片，`reloadPortrait` 后 `portraitAsset` 换新、`portrait` 清空；
- 失败路径不改状态、给出可读原因。

---

## 6. 势力存在感太低

**现状**
- 议会提案里势力提案要靠模型自己想起（`authorKind: 'leader'`，提示词只有一句「代表提案写 leader」）。
- 弹窗事件里 `kind: 'faction'` 的模板有，但和 `girl`/`environment` 权重相同，且**没有「首领召见」**这类直接把玩家拉进一场对话的事件。
- `CharacterEvent` 已经支持 `cast`（`storyCast` 从 `state.girls` + `candidates` 取人），但首领不在这个池子里 —— 这是「召见」做不出来的真正卡点。

**改法**
0. **频率（已确认：概率 + 冷却，且可在数值规则里改）**
   - `balance.ts` 增两个字段（进 `BALANCE_FIELDS`，分组「势力」）：
     `leaderSummonChance`（首领召见概率，0–100%，默认 40）与 `leaderSummonCooldownDays`（召见冷却，1–14 天，默认 3）。
   - 冷却复用 `incidentCooldowns` + `templateId`；概率用 day 派生的确定性哈希，便于复现与测试。
   - 世界书「数值规则」条目由 `BALANCE_FIELDS` 驱动，会自动带上这两项，不用另写文案。
1. **召见机制（核心）**
   - `StoryCast`/`storyCast`（`llm.ts`）与 `EventDialog` 的 `cast` 解析改为同时认「三方代表」：`factionRepresentativeOf(state, faction)`（`factions.ts`）返回的 `{id, name, portrait, color}` 也能进 cast；渲染侧复用现有 `PortraitSubject`（它只要 id/name/color/portrait）。
   - 新增弹窗模板组「召见」（`content/incidents.ts`）：`kind: 'faction'`、`trigger: {kind: 'dayStart'}`、选项 `应召 / 推脱 / 派人代替`；`应召` 的 outcome 是「开一场角色事件，cast = 首领 + 在场少女」，结算里调用现有的 `addEvent(state, girl, title, hook, 'story', storylineId?)`（`rules/storyCore.ts`）并把 `event.cast` 设成 `[representative.id, ...]`。
   - 事件开场/续写的 `focusGirlOf` 对首领事件要能退回「在场的少女」；`{{heroine}}` 仍取少女，首领信息走新的 `{{leader}}` 宏（`promptMacros` 新增，取当前 event 里的代表）。
2. **配额**：`dailyContract()` 补一句「三条提案里至少一条来自三方首领（`authorKind: leader`）」，并在校验里对「零势力提案」记 warn。
3. **弹窗权重**：`dueIncidents` 目前按哈希轮换、战争预兆优先。给「召见」这类模板加 `priority: 5`（低于战争预兆 10），并让 `faction` 类模板在一晚里最多投一条，避免连着三条都是势力。
4. **议会显现**：`CouncilView` 的提出者卡在 `authorKind === 'leader'` 时显示「势力 · 首领」，并把首领的名字、势力色用在卡片与立绘上（现在已有 `authorFigure`，只需补 `kind` 文案与色板）。

**验收 / 测试（`tests/v75-faction.test.ts`）**
- 召见弹窗「应召」→ `state.events` 里出现 cast 含首领 id 的事件；
- `{{leader}}` 宏在有召见事件时渲染出首领名与势力，无事件时为空；
- 三条提案全无 leader → 校验 warn；有一条 leader → 无 warn；
- `dueIncidents` 一晚最多投一条 faction 类。

---

## 决策点（已定 2026-11-03）

1. **癖好的语义**：⑮ 我按「治疗时的深度照料」记成 `kinkFamiliarity` 0–5 并写进档案（默认）｜B 你指的是别的东西（比如某个「癖好」文本字段），告诉我字段名我改接法。
2. **纠纷的强度**：提案里的两人纠纷只影响 `bond` / `fatigue`（默认，安全）｜还是允许它升级成「一人离队风险 / 辖区归属争议」这类重后果。
3. **召见的频率**：一晚最多一条（默认）｜两天一条｜只在态度低于 40 或敌意高时出现。

---

## 实施顺序（提交切分）

| 提交 | 内容 | 依赖 |
| --- | --- | --- |
| v75-1 | 外貌 / 服装描述可编辑（动作 + 档案输入框 + 测试） | 无 |
| v75-2 | 癖好事实与提示词接入 | 决策点 1 |
| v75-3 | 非财政提案配额 + 纠纷模板 + 校验 warn | 决策点 2 |
| v75-4 | 自动生成只在换日触发（`generatedDay` 持久化） | 无 |
| v75-5 | 立绘重载 + 缺失角标 | 无 |
| v75-6 | 势力召见（cast 支持首领 + 模板 + 配额 + 议会文案） | 决策点 3 |

---

## 附录：本方案引用的锚点

- `src/components/CharacterDialog.tsx:214`（性格输入）、`:412`（外观装备页）
- `src/cards.ts`（`parseGirlCard` 对 appearance/outfitDescription 的截断）、`src/girlDossier.ts`、`src/llm.ts` 的 `girlBrief`
- `src/types.ts:1129`（`clinic` 动作）、`src/rules/time.ts:193-201`（治疗结算与癖好日志）、`src/roster.ts:66-70`（癖好收费）
- `src/nightSpec.ts`（`NIGHT_TOPICS`）、`src/opinions.ts`（默认对白/选项）、`src/llm-night.ts`（`parseOpinion` 校验）
- `src/App.tsx:289-296`（自动生成 effect）、`:872` 附近（首夜补齐）
- `src/saves.ts` / `src/store.ts`（`assetPut` / `assetGet`）、`src/imageSlim.ts`、`src/components/GirlPortrait.tsx`
- `src/factions.ts`（`factionRepresentativeOf`）、`src/rules/storyCore.ts`（`addEvent`）、`src/llm.ts` 的 `storyCast`、`src/promptMacros.ts`（新增 `{{leader}}`）
