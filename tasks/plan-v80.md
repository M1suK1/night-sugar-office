# v80 方案：原创角色的语料、所长的立绘、装备的数值

> 三件事分三个提交批次做，每批自带测试与验证。计划见下，**未开工**。
> 记于 2026-11-03 夜。

---

## 0. 现状（为什么是这三个改法）

| 现象 | 代码现状 |
| --- | --- |
| 原创角色「有脸没声音」 | `Girl` 有 `appearance`（外貌）/`personality`（性格）/`outfitDescription`/`quote`（一句台词），但**没有「她怎么说话」这一层**：口癖、句子长短、称呼、回避什么，全都要靠 `personality` 一句话硬猜。对话、私语、事件弹窗、演出都只拿到那一句。 |
| 自定义建人已有 LLM 起草，但只起草「设定」 | `CustomGirlDialog` 的 `onGenerate` → `App.draftGirlProfile` → `generateGirlProfile(config, portrait, hint, preset, research)`；产出填的是名字、外貌、性格、属性、特性、技能。**语料不在产出里**，预设 `profile` 段也没有要求它。 |
| 所长只有名字 | 交互剧情（`EventDialog` 的 `session` 模式）右侧固定写「所长」，坐实了玩家是个**没有脸的人**：`speakerId === 'player'`，没有立绘、没有差分、没有档案页。少女那边一整套 `EXPRESSIONS`（平静/微笑/惊讶/低落/生气/害羞）差分与 `expressionVariantKey` 机制，所长一样都没有。 |
| 商店只写一句话 | `views/MarketView.tsx` 的货架卡片只渲染 `item.passive ?? item.description`。而 `Equipment` 上明明有 `stats`（四维）、`maxHpBonus`、`spiritBonusPct`、`damageBonus`、`initiativeBonus`、`effect` + `amount`（drug/heal/purify/contractDiscount/taxRefund）、`skillId`、`corruptionPerBattle`——**买之前看不到它会给你加多少东西**，只能靠价格猜。 |

---

## 1. 原创角色的语料（voice）

### 1.1 数据：加一层「语料」，不加四层

```ts
/** 她怎么说话：进提示词，不进战斗结算。 */
export interface GirlVoice {
  /** 一句话概括她的说话方式（30 字内）。 */
  tone: string;
  /** 口头习惯，最多 3 条：自称、语气词、句子长短、回避什么。 */
  habits: string[];
  /** 三句例话：必须是她说得出口的句子，不是对她的描述。 */
  samples: string[];
}
```

- 挂到 `Girl`：`voice?: GirlVoice`（可选，老存档没有就按空处理）。
- 同时进 `GirlDraft`，自定义建人时可手填、可让叙事者起草、可空着。
- **不做**自由文本大段「语料库」：句库会让提示词膨胀，而且模型会照抄句子。要的是**风格约束 + 三句样张**。

### 1.2 进提示词（唯一出口 `voiceLine`）

- 新增 `src/voice.ts`：
  - `voiceLine(girl)` → `说话方式：<tone>；习惯：<habits.join('、')>；例话：「…」「…」「…」`，整段 ≤ 180 字，空语料返回 `''`。
  - `sanitizeVoice(raw)` → 收口 LLM 产出：`tone` ≤ 30 字，`habits` 去重、≤ 3 条、每条 ≤ 18 字，`samples` ≤ 3 句、每句 ≤ 40 字、必须带引号外的句子内容。
- 接到三处（都是现有 `girlBrief()` 的调用方，一处改全处生效）：
  - `girlBrief()`（对话、私语、事件、演出都走它）
  - `dossierOf().brief`（档案里给自己看的那份）
  - `girlDossier()`（全量档案）
- 回执：语料为空时**不要**输出「说话方式：」空行，避免模型自己编一段语气词。

### 1.3 LLM 起草（自定义建人里的接口）

- 产出类型 `GeneratedGirlProfile` 增 `voice: { tone, habits[], samples[] }`；`generateGirlProfile` 的解析用 `sanitizeVoice` 收口，缺就当空。
- `CustomGirlDialog`：
  - 「让叙事者起草」按钮旁加「**只重写语料**」次级按钮（`#custom-voice-draft`），只替换三个语料字段，不动名字/属性/技能——已经调好的角色不想被整份覆盖。
  - 语料区三个可编辑控件：`#custom-voice-tone`（单行）、`#custom-voice-habits`（多行，按换行拆）、`#custom-voice-samples`（多行，按换行拆）。样式沿用 `.av-input` 与 `.field`，与外貌/服装那两块一致。
- 档案页（`CharacterDialog` → 外观装备页）：语料与外貌/服装并列，同一套草稿 + 失焦提交，动作沿用 v75 的 `setProfileText` 思路，新增 `field: 'voiceTone' | 'voiceHabits' | 'voiceSamples'`。

### 1.4 预设提示词同步增加

- `profile`（角色起草）契约新增三条：
  1. 语料写给**她本人**：`tone` 说她怎么说话，`samples` 是她说得出口的句子，不要写成旁白描述。
  2. 例话必须能听出她的出身与教养：协会的用词、政府的公文腔、无所属的短句与沉默，各不相同。
  3. 不要用「温柔但坚定」这类两头堵的形容词；用具体习惯替代（自称「我」还是「人家」、句尾带不带「啦」、会不会先反问）。
- 对话/私语契约各加一句：语料是**约束**不是台词本——照她的说话方式写，但不要重复例话原句。
- `tests/prompt-lint.test.ts` 的字面量上限跟着核实（新增文案必须落在预设/契约文件里，不许写回 `llm*.ts`）。

---

## 2. 所长的立绘与表情差分

### 2.1 数据

```ts
/** 玩家（所长）的形象：只有一套衣服，不做衣柜与魔女化。 */
export interface DirectorProfile {
  name: string;                    // 默认「所长」
  portrait: string;                // data URL，空＝缺图
  portraitCrop?: { zoom: number; x: number; y: number };
  /** 与少女同一套六种表情，各自一张；缺的就回落到 portrait。 */
  expressions: Partial<Record<Expression, string>>;
}
```

- 挂 `state.director?: DirectorProfile`，读档缺失时按 `{ name: '所长', portrait: '', expressions: {} }` 补。
- 拆行李：`state.director` 的图直接进瘦身流程（`slimStateImages` 里跟 `girl.portrait` 同一档阈值），存档变大要一起量（`saveSize.ts` 已在用）。

### 2.2 界面

- 档案 → 新增「所长」一页（`#dossier-director`），沿用少女档案的版式：
  - 立绘卡 + 「重新载入立绘」按钮（复用 v78 的 `#dossier-portrait-reload` 交互与 `setPortrait` 校验规则，动作换成 `setDirectorPortrait`）。
  - 六格表情差分：每格一个上传位，标注「平静 / 微笑 / 惊讶 / 低落 / 生气 / 害羞」，与 `EXPRESSIONS` 顺序一致；缺的那格显示虚线框，不显示「缺失」字样。
  - 裁剪：沿用 `portraitCrop` 的三个数值（缩放 + X + Y），与少女立绘同一套手感。
- 交互剧情（`EventDialog` 的 `session` 模式）：
  - 右侧「所长」那一栏改成**带头像的发言块**：有图就显示当前表情（按 `line.expression`，缺则 `calm`），没图就是一个描边剪影 + 「所长」二字。
  - 玩家回合的 `player-turn` 气泡头像同步。
- 战斗札记与私语：`speakerId === 'player'` 的地方都用同一个组件（`DirectorPortrait`），避免再写第二份。

### 2.3 动作

| 动作 | 说明 |
| --- | --- |
| `setDirectorPortrait` | `{ portrait: string; crop?: {zoom,x,y} }`，只收 data URL，空串＝清空 |
| `setDirectorExpression` | `{ expression: Expression; portrait: string }`，空串＝删掉这一格 |
| `setDirectorName` | `{ name: string }`，≤ 8 字，默认「所长」 |

三个动作都写 `base` 日志（「所长的立绘换了一张」/「生气那张差分被清空」）。

### 2.4 不进提示词的部分

所长形象**不写进世界书**：模型只需要知道他叫「所长」，长什么样是给玩家自己看的。唯一例外是交互剧情里如果模型问到「你今天穿了什么」，`player` 的描述留空即可——不做这一层，避免提示词里多出一段永远用不上的自我描述。

---

## 3. 市场装备的用处与数值

### 3.1 一个渲染器，三处复用

新增 `src/itemStats.ts`：

```ts
export interface ItemStatLine { label: string; value: string; tone?: 'good' | 'bad' }
export function itemStatLines(item: Equipment): ItemStatLine[]
export function itemEffectSummary(item: Equipment): string   // 一行短语，给卡片标题右边用
```

覆盖顺序固定（先看会直接改数字的，再看被动）：

1. `stats` 四维：`魔力 +6`、`洞察 +4`……（`statLabel` 已有）
2. `maxHpBonus` → `心防上限 +12`
3. `spiritBonusPct` → `心防上限 +8%`（旧字段 `spiritBonus` 已在读入时折算，渲染器不再处理）
4. `damageBonus` → `伤害 +10%`
5. `initiativeBonus` → `先手 +2`
6. `effect` + `amount`：`drug` 成瘾 / `heal` 治疗 / `purify` 净化 / `contractDiscount` 契约金折扣 / `taxRefund` 退税，各带数值
7. `skillId` → 技能名（`skillById`），查不到就写 id
8. `corruptionPerBattle` → `每战堕化 +1`（负数写 `-`，tone `good`）
9. 最后才是 `passive` 那句话（原样保留，不截断）

### 3.2 摆到哪

- `views/MarketView.tsx` 货架卡：标题行右侧加 `itemEffectSummary`（如「魔力 +6 · 伤害 +10%」），卡片正文在 `passive/description` 之上插入**数值行**（`<ul class="av-supply-stats">`，每行 label + value）。
- 装备与背包列表（`views/` 里现有的装备栏与 `inventory` 展示）用同一个 `itemStatLines`，不再各写一套。
- 对比：已装备同槽位时，数值行右侧给出差值（`+6 → +9`），没有装备就不显示箭头。
- 不新增弹窗、不做悬浮说明：现有卡片就能容纳八行，先做"看得见"。

### 3.3 不改数据

`Equipment` 字段一个都不加——问题从来不是数据缺，是**渲染缺**。凡是商店里出现的东西，数据上必须能解释清楚，这也顺带逼出对 `generatedItems`（LLM 造装备）的一次自检：数值全空的装备会在卡片上只剩被动，`validGeneratedItem` 里补一条「至少一项数值或被动」的约束。

---

## 4. 分批与验收

| 批次 | 内容 | 测试 |
| --- | --- | --- |
| **v80-1** | 语料：`GirlVoice` + `voice.ts`（`voiceLine`/`sanitizeVoice`）+ `girlBrief`/`dossierOf`/`girlDossier` 接上 + 预设 `profile` 三条契约 + `CustomGirlDialog` 三控件与「只重写语料」+ 档案页语料区 | `tests/v80-voice.test.ts`：收口规则、`voiceLine` 空语料为空串、简报里出现语料、起草产出被收口 |
| **v80-2** | 所长档案：`DirectorProfile` + 三个动作 + 「所长」页（立绘 / 六格差分 / 裁剪）+ `DirectorPortrait` 组件接进交互剧情与私语 + 瘦身与存档体积 | `tests/v80-director.test.ts`：动作校验（拒非法 data URL、清空、缺图回落）、差分按表情取图、读档缺字段补默认 |
| **v80-3** | 装备数值：`itemStats.ts` + 市场卡片与装备列表接入 + 对比差值 + `validGeneratedItem` 补约束 | `tests/v80-item-stats.test.ts`：四维/上限/百分比/效果/技能/堕化的顺序与文案，空装备只剩被动，对比差值 |

每批一个提交，`tsc --noEmit` 0 错、`check:rules` 通过、全部测试文件逐条跑绿后再推送。

---

## 5. 已定 / 待定

已定（本轮直接按这个做）：

- **语料是结构化的三层（tone / habits / samples）**，不做自由文本句库，避免模型照抄。
- **所长的差分沿用少女那六个表情**，不新增表情枚举；缺图回落 `calm`。
- **装备只改渲染不改数据**，并补一条「LLM 造装备至少带一项数值或被动」的校验。

待你点头（不影响先做 v80-1）：

- 所长的默认形象：全空（剪影 + 「所长」）还是给一张内置的兜底立绘？我倾向全空，玩家自己传。
- 装备差值是否也要在**装备时**弹一行「魔力 +6 → +9」的回执？现在是只显示在卡片上。
- 语料是否也要进**私语的署名**（例如句尾习惯会影响私语的开头）？我倾向先只做提示词约束，别动署名。
