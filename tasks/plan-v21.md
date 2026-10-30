# v21 方案：空月设定、开场剧情、契约卡库与开局编成

> 状态：方案稿（已按第二轮意见修正），等确认后开工。四件事，不夹带。

## 0. 总览

| # | 需求 | 一句话定案 |
| --- | --- | --- |
| 1 | 世界书「空月」条目 | 常驻词条，把空月写成一切的终焉与三方共同的债。**这一版它只是背景**：不加封印进度、不加献祭资源，Boss 战玩法原样不动 |
| 2 | 进入游戏后的开场 | **三幕**全屏开场，只交代「三方是谁 / 你是谁 / 今夜做什么」，约 40 秒；带转场、逐段淡入、月亮呼吸与灯焰抖动等动效，`prefers-reduced-motion` 全关。可跳过、可从记录页重看 |
| 3 | 契约卡库 | 一次选中多个 `.json` 卡片读进本地库；库里可搜索、勾选、批量导入候选名册；原始文本留着，下次不用再找文件 |
| 5 | 自定义少女与候选 | 属性按职阶基准 **±10 波动**（总量仍 260）；代表色由 LLM 起草时一并给出（限定调色板） |
| 4 | 开局编成 | 两块：**① 你自己的初始契约少女（4–6 人，可自定义）**；**② 指定三方势力的阵容（首领与随从都可指派）**。三方首领不是你的契约者 |

两条关键规则（第二轮意见带来的改动）：

- **首领也可以指派**：三位首领在编成时分给任意一方，一对一占位；头衔与档案文案跟着现属势力走。编成页另给一个「一键按原属重置」（`#starter-reset-roster`）。
- **属性波动扩散到市场候选**：`rollStats` 用「候选 id 的哈希」当种子，波动但可复现——同一存档读两次结果一样，不会让存档漂移。
- **首领只有在该势力失去全部辖区（覆灭）之后才能被雇佣**，开局时一律不可选。
- **空白档案不编成**，改成一句明确的加卡提示：没有契约者就先去导入契约卡或自己登记一张。

版本：`GameState.version` 14 → **15**。`loadState` 接受 `1, 3..15`，旧存档补齐新字段后照常开局，不清空任何数据。

流程：

```
新游戏 → StartDialog → 开场剧情(三幕 Pologue) → 开局编成(Starter) → 派遣页
                                    ↘ 记录页可重看
空白档案 → StartDialog → 开场剧情 → 加卡提示（不编成）→ 派遣页
市场 → 契约卡库(多选导入) → 候选名册 → 原有契约流程
势力覆灭（辖区归零）→ 该势力首领可被雇佣 → 档案标「已并入事务所」
```

---

## 1. 世界书「空月」

### 1.1 定位：这一版只做背景

空月是世界观的地基，不是这一版的玩法。所以：

- **做**：一条常驻世界书词条 + 把现有文案里自相矛盾的说法对齐。
- **不做**：封印进度条、献祭资源、献祭选择、空月的第二阶段形态、主线与结局。这些等主线和结局定了再单独开一版。

现有代码里已经有一个同名 Boss（`hollow-moon`「空月」，`rank: 王座`）。保持它能打、能被打退，只是把「天灾降临」的说法改成「封印到期」——玩法一行不动，改的是文案。

### 1.2 词条定义

新增内置常驻词条，写在 `src/worldbook.ts` 的 `builtinWorldbook()` 里，排在事务所档案之前：

| 字段 | 值 |
| --- | --- |
| `id` | `moon`（刻意不复用怪物 id `hollow-moon`，免得两套数据在搜索里撞车） |
| `name` | `空月` |
| `keys` | `['空月', '终焉', '封印', '献祭', '月相', '缺口']` |
| `constant` | `true`（它是这个世界的地基，不是某条支线的背景） |
| `priority` | `96`（高于事务所档案的 92，也高于「生命与受伤」的 95） |
| `order` | `0` |
| `builtin` | `true`（玩家可改文案，切「恢复内置」会回来） |

### 1.3 词条正文（定稿文案）

```
【终焉】空月不是天体，是所有魔法少女的祈愿与绝望叠起来的那一轮月亮。它盈满的那一刻，也正是它开始亏的那一刻——缺下去的那一块不是影子，是它张开的嘴：它饥饿地吞掉一切魔法来源，从最弱的那颗星开始。

【对抗史】三方曾经真的一起打过它。星灯协会交出过名录上最好的名字，市役所把整队量产编号填进钟楼的裂缝，月蚀庭烧掉了自己一半的配方。每一次都只把它按回去一会儿，代价一次次叠高，高到没有人敢再算总账。

【现在的办法】三方不再谈胜利，只谈延期。按份额献祭魔法少女——协会出登记者，市役所出编号，月蚀庭出未受洗的孩子——用她们的愿望把它哄睡。封印有期限，到期就会松动，松动到撑不住的时候，钟楼上方的月亮就少一块。

【写法提醒】空月不说话，也不谈判，没有代理人。别把它写成会讲条件的反派；提到它时写月相、饥饿、账本和名字，不要写它的台词。
```

最后一段是给叙事者的护栏：模型很容易把「终焉」写成会说话的魔王，这段直接堵住。

### 1.4 文案对齐（只改字，不改玩法）

| 位置 | 现在 | 改成 |
| --- | --- | --- |
| `src/worldbook.ts` 的 `factions` 条目 | 「月蚀**教团**相信魔法少女是通往另一侧的桥」 | 「月蚀**庭**……」（旧称残留，顺手修），并补一句三方与空月的关系 |
| `src/components/Shell.tsx` Boss 横幅 | 「城市级威胁 / 空月降临」 | 「封印到期 / 空月正在变亏」 |
| `src/App.tsx:591` 安定度脚注 | 「城市级威胁『空月』在场（每3小时 −1 安定）」 | 「空月缺口扩大（每 3 小时 −1 安定）」 |
| `src/views/AuxViews.tsx:758` / `:835` | 「天灾『空月』在场」「下次周期 Boss：第 N 日」 | 「封印到期：第 N 日」「空月周期」 |
| `src/game.ts:2140` / `:431` 日志 | 「空月出现在钟楼上空」「空月自行离开了城市上空」 | 「封印到期，空月重新变亏」「缺口合上了，但它还在那里」 |
| `src/content/monsters.ts` 空月的 `description` / `codex` | 「它不是月亮，只是月亮缺席时留下的洞」 | 保留这句（很好），补一句「三方每隔一段时间把它按回去一次，账记在活人身上」 |

### 1.5 注入效果

- 叙事、对话、委托生成都会读到这条常量（现有 `worldbookBudget` 逻辑不变），模型写「月亮缺了一角」「名字被划掉」这类意象时会对得上设定。
- 落地后跑一次「世界书命中预览」，确认常驻词条总和没超过 1200 预算；超了就把 `council`、`dorm` 这类低频常量降一档优先级。

---

## 2. 开场剧情

### 2.1 数据结构

新建 `src/prologue.ts`：

```ts
export interface PrologueLine { speaker: string; tone: string; text: string }
export interface PrologueBeat {
  id: string;
  title: string;
  /** 场景提示词，只用于视觉分组：table / lamp / night */
  scene: 'table' | 'lamp' | 'night';
  narration: string;
  lines: PrologueLine[];
}
export const PROLOGUE: PrologueBeat[] = [ /* 五幕 */ ];
```

纯静态数据，不进存档、不走 LLM（开场必须每次一样，没 Key 也要能看）。台词与 `factionLeaders` 的 `quote` 保持一致，避免同一个角色两套口吻。

### 2.2 三幕脚本（定稿）

开场不是设定集，是「三十秒让你知道自己在哪」。三幕，每幕一到两段旁白，最多三句台词，全篇约 180 字。

**第一幕 · 三本账**（`scene: table`）

> 旁白：这座城市由三方分着管：星灯协会登记少女、发委托；市役所管夜禁、管辖区；月蚀庭不问出身，只问价钱。
> 白鹭千秋：「名录之外，没有灯。」
> 雨宫澄：「编号不会哭，城市才睡得着。」
> 蚀医·夜鸮：「城市不把女巫当人，我们就自己写人的定义。」

**第二幕 · 这盏灯**（`scene: lamp`）

> 旁白：夜糖事务所关门七年，灯还亮着。房租付到了年底，欠着的是人情——现在这家店归你，名册上一个人也没有。

**第三幕 · 今夜**（`scene: night`）

> 旁白：接委托、派人出勤、把辖区守到天亮。九块地各有各的脏，天上那轮月亮缺着一角，它每晚都在等着什么。

三幕讲完只回答三件事：**谁在管这座城市、你是谁、今夜干什么**。空月只露一句意象，不解释设定——细节留给世界书，玩家想看自己能翻。

### 2.3 触发与状态

| 场景 | 行为 |
| --- | --- |
| 标准开局（新档） | 关掉 `StartDialog` 后立刻播 |
| 空白档案（新档） | 也播（开场讲的是事务所，不是名册），播完进加卡提示 |
| 旧存档 / 读档进入 | 不播。`loadState` 里把缺失的 `prologueSeen` 补成 `true` |
| 设置里重置进度 | 重置出来的新档重新播 |
| 记录页 | 常驻入口 `#replay-prologue`，随时能看，不写状态 |

状态只有一个字段：`GameState.prologueSeen: boolean`。看完或跳过都设 `true`——**跳过也算看过**，否则每次刷新都会再弹。

### 2.4 UI

新建 `src/components/PrologueDialog.tsx`，全屏遮罩，不复用 `Dialog`（开场是舞台，不是表单）。

| 选择器 | 作用 |
| --- | --- |
| `#prologue-dialog` | 根节点，`role="dialog" aria-modal="true" aria-labelledby="prologue-title"` |
| `#prologue-scene` | 背景层，`data-scene="moon"`，纯 CSS 渐变 + 一层噪点，不加载图片 |
| `#prologue-beat` | 「第 1 / 3 幕」 |
| `#prologue-progress` | 三个小圆点，`aria-hidden` |
| `#prologue-title` | 幕标题 |
| `#prologue-narration` | 旁白段，逐段淡入（纯 CSS，不写打字机定时器） |
| `#prologue-lines` | 台词行，按 `speaker` 左右分列 |
| `#prologue-next` | 下一幕；第三幕变「推开门」 |
| `#prologue-skip` | 跳过 |

- 键盘：`Enter` / `Space` / `→` 下一幕，`Esc` 跳过。
- 焦点：打开时聚焦 `#prologue-next`；关闭后回到 `#main-content`。
- 动效细则见 §2.5；`prefers-reduced-motion` 下全部关闭。
- 320 宽度：旁白 15px、行距 1.8，不横向滚动。

### 2.5 与后续流程的衔接

### 2.5 动效

原则：**全部纯 CSS 动画**，不写 `setTimeout` 驱动的打字机——开场要能被 `Esc` 和键盘随时打断，定时器一多就会和跳过逻辑打架。

| 元素 | 动效 | 时长 / 曲线 |
| --- | --- | --- |
| `#prologue-scene` 背景层 | 每幕切换时交叉淡入，同时轻微推近（`scale 1.06 → 1`，像镜头落定） | 620ms `cubic-bezier(.22,.61,.36,1)` |
| `#prologue-title` | 淡入 + 字距收敛（`letter-spacing .34em → .08em`） | 480ms，延迟 60ms |
| `#prologue-narration` 每段 | 淡入 + 上移 10px | 420ms，段间延迟 180ms |
| `#prologue-lines` 每行 | 从 `speaker` 一侧滑入（协会/市役所从左、月蚀庭从右），位移 16px | 400ms，延迟 240ms 起、每行 +120ms |
| 月亮层（`scene=moon` 复用 `table` 的远景） | 呼吸式外发光（`box-shadow` 与 `opacity` 6s 交替）；缺口缓慢自转 | 循环，`ease-in-out` |
| 灯盏（`scene=lamp`） | 灯焰亮度抖动，用 `steps(6)` 做不规则感，不匀速 | 4.2s 循环 |
| 手印波纹（幕末） | 一圈径向扩散后消散 | 900ms 一次，不循环 |
| `#prologue-progress` 当前点 | 放大 1.35 + 发光 | 240ms |
| 切幕按钮 | 按下微缩、hover 提亮 | 160ms |
| 关闭 / 跳过 | 整块 220ms 淡出后再卸载，避免闪白 | 220ms |

实现要点：

- 全部走 `@keyframes` + `animation`，`animation-fill-mode: both`，进场元素初始 `opacity: 0` 写在基类，动画负责点亮；无动画时（reduced-motion）直接 `opacity: 1`。
- 幕间过渡用 `key={beat.id}` 强制重挂载，动画自然重播，不用手动重置类名。
- `@media (prefers-reduced-motion: reduce)` 里把 `animation-duration` 全部压到 `0.01ms`、`iteration-count: 1`，保留布局不跳动。
- 动效不加在文字逐字上（打字机会让「跳过」和朗读都变得别扭），要的是镜头感不是演出感。

### 2.6 与后续流程的衔接

```ts
started && !state.prologueSeen                                   → <PrologueDialog onDone={…} />
started && state.prologueSeen && !state.startersPicked && !blank → <StarterDialog … />
started && state.prologueSeen && !state.startersPicked && blank  → <BlankHint … />   // §4.7
```

---

## 3. 契约卡库

### 3.1 存储

**不进存档**，单独一个 localStorage 键：`night-sugar:cardbox:v1`。卡库是「我的文件柜」，重置进度不该把玩家的卡一起丢掉；也不会让存档体积膨胀。

```ts
export interface CardBoxEntry {
  hash: string;          // girlCardHash(card)
  name: string;
  level: number;
  element: string;
  factionTag: GirlFaction;
  fileName: string;
  addedAt: number;
  /** 原始 JSON 文本；重新导入时不用再找文件。 */
  raw: string;
}
```

上限：单卡 `raw` ≤ 256KB，库内最多 60 张。满库拒绝新增并提示「先删几张」，不静默淘汰。

### 3.2 批量解析

`src/cardbox.ts`：

```ts
export function loadCardBox(): CardBoxEntry[]
export function saveCardBox(entries: CardBoxEntry[]): void
export function cardboxAdd(inputs: { name: string; text: string }[]): {
  added: CardBoxEntry[];
  duplicates: string[];
  failed: { name: string; message: string }[];
}
export function cardboxRemove(hashes: string[]): CardBoxEntry[]
export function cardboxFilter(entries: CardBoxEntry[], query: string): CardBoxEntry[]
```

- 每张卡走现成的 `parseGirlCard`；坏的那张只记录 `{ name, message }`，不影响同批其它卡。
- 去重按 `hash`；同 hash 第二次导入只提示「已在库里」，不覆盖玩家可能改过的 `fileName`。
- 读文本用 `File.text()` + `Promise.allSettled`，单个读失败也算「失败」，不是整批失败。

### 3.3 批量导入动作

```ts
{ type: 'importCards'; cards: GirlCard[] }
```

内部逐张走现有 `importCard` 的构造逻辑（`hydrate` + `custom: true` + `candidateUntilDay`），统一返回：

```
已导入 3 张，跳过重复 1 张，2 张读取失败。
```

名册里已有同名同 hash 的卡也计入「跳过重复」。候选位不够时按现有 `slots` 规则排队，不覆盖玩家自定义卡。

### 3.4 UI

新建 `src/components/CardLibraryDialog.tsx`（复用 `Dialog` 的 `wide`）。

| 选择器 | 作用 |
| --- | --- |
| `#cardbox-dialog` | 根 |
| `#cardbox-file` | `<input type="file" multiple accept="application/json,.json">`，隐藏 |
| `#cardbox-drop` | 拖放区，与 `#cardbox-file` 走同一个处理函数 |
| `#cardbox-search` | 搜索名字 / 文件名 / 出身 |
| `#cardbox-count` | 「库里 12 张 · 已选 3 张」 |
| `#cardbox-list` | 列表容器 |
| `#cardbox-row-{hash前8位}` | 单行：勾选、名字、Lv、元素、出身徽章、文件名 |
| `#cardbox-check-{hash前8位}` | 单行勾选 |
| `#cardbox-select-all` | 全选当前筛选结果 |
| `#cardbox-import` | 导入选中，关窗回市场 |
| `#cardbox-delete` | 从库里删掉选中（只删库，不动名册） |
| `#cardbox-errors` | 失败清单：文件名 + 原因 |
| `#cardbox-empty` | 空库引导：拖卡片进来，或点「选择文件」 |

样式落在 `src/views/market-view.css` 与 `src/dialogs.css`；列表行沿用 `.av-candidate-*` 的排版语言，和市场候选卡看起来是一套。

### 3.5 入口

- 市场页候选区标题栏：`#av-market-cardbox`「契约卡库」，与「导入卡片」「自定义登记」并排。原有单张导入保留。
- 设置页「游戏设置」加一行入口。
- 空白档案的加卡提示里直接开这个窗（§4.7）。

### 3.6 边界

| 情况 | 表现 |
| --- | --- |
| 一次选 30 张 | 正常处理，进度「已读 12 / 30」 |
| 旧版本卡片 | `parseGirlCard` 的版本检查生效，失败进清单 |
| 不是 JSON | 记「不是有效的 JSON」，不中断其它文件 |
| 重复导入 | 提示「已在库里」，勾选状态保持 |
| 库满 60 张 | 拒绝新增并提示先删 |
| 清空浏览器数据 | 卡库一起消失——README 里写清楚 |

---

## 4. 开局编成

### 4.1 编成分两块

| 区块 | 内容 | 是否可改 |
| --- | --- | --- |
| **① 你的初始契约少女** | 4–6 人，来源见 §4.2 | 完全可改：增减、换人、现场自定义 |
| **② 三方势力阵容** | 每方 1 位首领 + 1–4 位随从 | 首领固定；随从可分配 |

关键点：② 里的首领与随从**都是势力的人，不是你的契约者**。编成界面只是把他们的归属定下来，之后照旧在势力档案、辖区拦截战里出场。

### 4.2 你的初始契约少女

可选来源（同一个列表里混排，按来源打标签）：

| 来源 | 说明 |
| --- | --- |
| 事务所原有六人 | 月见桃 / 砂糖 / 零青 / 雾眠 / 栀子 / 鹿铃，默认全在这里面挑 |
| 契约卡 | 卡库里已有的卡（§3）与本次刚导入的卡，选中的按卡里的数据进名册 |
| 现场自定义 | 打开现有的 `CustomGirlDialog` 现做一张，做完直接进候选，不必先去市场 |

- 人数：至少 4 人、最多 6 人。默认预选事务所四人（月见桃 / 砂糖 / 零青 / 雾眠）。
- 卡片来的少女保留 `custom: true` 与卡里的出身，不重新随机。
- 未被选中的事务所六人 **不回市场**：他们是事务所原有编制，直接移出（保留在 `candidates` 里会让市场莫名其妙多出几个人）。这条在 `setStarters` 里处理。

### 4.3 三方阵容：首领与随从都可指派

- 每方恰好 1 位首领、1–4 位随从。**候选人不再限定系统给定的 12 人**：三方原属首领（3）、`factionGirls`（9）、以及玩家自己的少女——在编的、市场候选里的、契约卡库里的卡、现场登记的自定义，全都可以当首领或随从。
- 候选统一成 `RosterSubject { id; name; level; title; faction; origin: 'leader'|'faction'|'custom'|'roster'; color; portrait; portraitSpec?; stats; skillIds; archetype }`，由 `rosterPool(state)` 现算，不落库；编成只存 id。
- 默认阵容沿用原属：星灯协会 → 白鹭千秋 + 篠宫灯里 / 藤枝小夜 / 朝仓凛，市役所 → 雨宫澄 + 三只编号体，月蚀庭 → 蚀医·夜鸮 + 黑川眠 / 苏我夜 / 鹿岛棘。
- 同一个人只能占一个位置：不能既是首领又是随从，也不能同时挂在两方；已经在名册里被你选中的少女不再出现在三方候选里。
- 自定义少女没有三套头衔，`titles` 缺省时用她自己的 `title`（登记时写的职阶名）兜底。
- 分配结果落进存档：`state.factionRoster: Record<FactionId, { leaderId: string; memberIds: string[] }>`。
- 拦截战、势力档案「首领」与「成员」页、敌意值文案都改成读 `factionRoster`，再经 `rosterSubject(state, id)` 解析成具体的人，不再读静态的 `factionGirls` 分组，也不再读 `factionLeader()` 的固定映射。
- **头衔按现属势力显示**：`FactionLeader` 增加 `origin: FactionId`（原属，只用于档案里的小字「原属 星灯协会」）与 `titles: Record<FactionId, string>`（三套头衔）。指派到她方后，档案与拦截战文案用现属那一套。

| 首领 | 原属 | 现属 = 星灯协会 | 现属 = 市役所 | 现属 = 月蚀庭 |
| --- | --- | --- | --- | --- |
| 白鹭千秋 | 星灯协会 | 协会会长 · 监察官 | 监察顾问 · 借调 | 名录执笔 · 客卿 |
| 雨宫澄 | 市役所 | 频段顾问 · 借调 | 夜间特别勤务课长 | 编号簿客卿 |
| 蚀医·夜鸮 | 月蚀庭 | 净血讲师 · 客卿 | 配方顾问 | 净血派领袖 |

- 台词（`quote`）跟人走，不跟势力走——那是她的性格，不是职位。现有三条台词一条都不用改。

### 4.4 首领数据补全

`FactionLeader` 现在只有文案字段，缺等级、属性、技能——但拦截战和后期雇佣都要用。补：

```ts
export interface FactionLeader {
  /* …现有字段… */
  level: number;
  stats: Record<StatKey, number>;
  skillIds: string[];
  archetype: Archetype;
  /** 原属势力，只做档案里的小字标注。 */
  origin: FactionId;
  /** 三套头衔，按现属势力取用，见 §4.3。 */
  titles: Record<FactionId, string>;
  /** 覆灭被雇佣后每次出勤的势力影响，见 §4.6。 */
  duty: { faction: FactionId; note: string };
}
```

建议数值（实施时用 `skillPool` 校验技能 id 真实存在）：

| 首领 | Lv | 魔/洞/敏/共 | 职阶 | 技能方向 |
| --- | --- | --- | --- | --- |
| 白鹭千秋 | 7 | 74 / 86 / 58 / 72 | 控制 | 星辉类三件：单体高伤 + 群体减益 + 护盾 |
| 雨宫澄 | 7 | 68 / 80 / 64 / 60 | 侦查 | 频段类三件：命中削弱 + 沉默 + 自身加速 |
| 蚀医·夜鸮 | 8 | 88 / 70 / 66 / 50 | 输出 | 月影类三件：吸血 + 群体真伤 + 自伤换爆发 |

三人 `portrait: ''`，继续走 `GirlPortrait` 程序化立绘，不需要新图。

### 4.5 首领的雇佣门槛：势力覆灭之后

- 判定：`canHireLeader(state, faction)` = 该势力（**她现属的那方，不是原属**）当前 `territories` 数量为 **0**，且首领未在名册、未死亡。
- 势力覆灭的直接来源是现有的战线结算与议会易主（v20 §4）：辖区被另外两方吃光，这个势力就没了。
- 覆灭后：
  - 势力档案顶部加一条「名下已无辖区」，`#faction-hire-leader` 按钮出现在档案页（不是编成页）；首领位旁边显示「现任首领：某某（原属 星灯协会）」。
  - 雇佣代价：一次性 `12,000` 星砂 + 该势力残留态度清零；首领以契约者身份入名册（`leader: true`、`starter: false`），等级与属性按 §4.4。
  - 雇佣后她不再参与辖区拦截，也不再出现在势力档案的「首领」位置，改为「已并入夜糖事务所」。
  - 另外两方态度各 `+3`（他们乐见其成），已覆灭势力的残留声望不再变化。
- 未覆灭时：档案页不显示雇佣按钮；即使伪造动作进 `hireLeader`，后端也要拒绝并返回「她还有辖区要守」。

### 4.6 首领出勤的代价（雇佣后）

每夜第一次派首领出勤时：原势力残留态度 `−1`，另外两方 `+1`。同一夜不重复计。这条只在**已被雇佣**的首领身上生效。

### 4.7 空白档案：不编成，给加卡提示

空白档案没有契约者，编成没有意义。开场之后显示一张提示卡：

| 选择器 | 作用 |
| --- | --- |
| `#blank-hint` | 提示卡根节点，`role="status"` |
| `#blank-hint-cards` | 「打开契约卡库」→ 打开 `CardLibraryDialog` |
| `#blank-hint-custom` | 「登记一位」→ 打开 `CustomGirlDialog` |
| `#blank-hint-skip` | 「先看看城里」→ 关掉提示，进派遣页 |

文案：「空白档案里没有契约者。先把她们的名字写下来——从契约卡库导入一批，或者登记一位新的。」提示只在空白档案首次进入时出现，`startersPicked` 置 `true` 后不再重复。

### 4.8 动作

```ts
{ type: 'setStarters'; girlIds: string[]; roster: Record<FactionId, { leaderId: string; memberIds: string[] }> }
{ type: 'hireLeader'; leaderId: string }
```

`setStarters`：

- 校验：4–6 人、id 都在池子里（事务所在编 / 卡库卡 / 刚登记的自定义）、不重复；`roster` 每方恰好 1 位首领、随从每方 1–4 人；`leaderId` 与 `memberIds` 都必须能经 `rosterSubject` 解析到真人，全员不重复、不跨位；已在名册里的人不得再占三方位置。随从**不再要求凑满 9 人**。
- 效果：名册换成选中的这批；`state.factionRoster = roster`；`startersPicked = true`。
- 失败返回消息，不改状态。

`hireLeader`：

- 校验：§4.5 的三条（辖区为 0、不在名册、未死亡）+ 星砂够。
- 效果：扣星砂、清残留态度、加人、`leader: true`、写一条编年史与日志。

### 4.9 UI

新建 `src/components/StarterDialog.tsx`：居中浮层（`.starter-dialog` 是遮罩 + `.starter-sheet` 是面板，宽 `min(1180px, 100%)`、`max-height: calc(100vh - 68px)` 内部滚动、页脚 sticky），四个页签——「你的少女」+ 三方，全部是头像网格，点卡片选人、点星标指派首领。

| 选择器 | 作用 |
| --- | --- |
| `#starter-dialog` | 根 |
| `#starter-tab-own` | ①「你的少女」页签（默认） |
| `#starter-tab-association` / `-government` / `-witch` | ② 三方阵容页签 |
| `#starter-pick-{id}` | 你的少女卡片，选中态 `aria-pressed="true"` |
| `#starter-card-{id}` | 卡片：立绘、名字、Lv、来源标签（在编 / 卡片 / 自定义）、出身徽章 |
| `#starter-add-card` | 「从契约卡库添加」，打开卡库后回来刷新列表 |
| `#starter-add-custom` | 「现场登记一位」 |
| `#starter-count` | 「已选 4 / 6 · 至少 4 人」 |
| `#starter-default` | 恢复默认四人 + 默认阵容（首领回原属、随从 3/3/3） |
| `#starter-reset-roster` | **只**把首领与随从按原属重置，不动你已选的少女 |
| `#starter-leader-slot-{faction}` | 某方首领位：头像 + 名字 + 现属头衔，未指派时显示「待指派」 |
| `#starter-leader-name-{faction}` | 该方现任首领的名字 |
| `#starter-leader-reset-{faction}` | 「换回原属首领」 |
| `#starter-roster-count-{faction}` | 「随从 3 / 4 · 至少 1 人」 |
| `#starter-members-{faction}` | 已选随从的头像 chip 区 |
| `#starter-member-chip-{id}` | 点掉一位随从 |
| `#starter-pool-{faction}` | 该方候选人头像网格（首领 + `factionGirls` + 自定义少女） |
| `#starter-subject-{id}` | 点一下加入/移除随从 |
| `#starter-set-leader-{id}` | 星标：把这个人指为该方首领 |
| `#starter-source-all` / `-native` / `-custom` | 候选来源筛选：全部 / 原属 / 自定义 |
| `#starter-search` | 按名字找人 |
| `#starter-confirm` | 确认编成；人数或分配不合法时禁用 |

立绘用 `GirlPortrait`；「你的少女」网格 1440 三列 / 768 两列 / 320 一列，三方候选网格 1440 四列、768 两列、320 一列。已占位的人加 `.starter-tile.leader` / `.member` 高亮，挂在别方的显示「已任某方首领 / 随从」并压暗。

### 4.11 实施记录

- 已落地：`FactionLeader` 补 `level/stats/skillIds/archetype/origin/titles/duty`（§4.4 数值原样采用，技能 id 均在 `skillPool` 内）；
  `GameState.factionRoster` / `startersPicked`（version 16）；`setStarters` / `hireLeader` 两个动作按 §4.8 校验；
  拦截战、`canIntercept`、势力档案的首领与成员、现属头衔全部改为读 `factionRoster`。
- 首领雇佣：辖区为 0 + 星砂 12,000，扣款后残留声望清零、另两方各 +3，写编年史与日志（§4.5/§4.6）。
- 属性波动：`settleStats` / `rollStats` / `mulberry32` 落在 `src/content/archetypes.ts`，`statsForArchetype` 输出不变；
  市场候选按 `mulberry32(hashText(seed))` 做 ±10 抖动，同一 id 每次一致。
- 代表色：`GeneratedGirlProfile` 新增 `color?`，prompt 的 JSON 模板里带上 `color`，对话框收到就填进代表色。
- 界面：`src/components/StarterDialog.tsx`（改版：水位块 + 三方分栏）与设置页 `#settings-starter` 入口；空白档案顶部 `#blank-hint`。
  自动弹出没有做——现有 77 条浏览器流程都从主界面开始，自动弹会把它们全部打断，编成入口留在设置页。

### 4.10 自定义少女：属性波动与代表色

#### 4.10.1 属性按 ±10 波动

现在的属性完全由职阶决定（`statsForArchetype`，固定四组数字，总点恒 260、每项 40–90），同一职阶做出来的少女一模一样，缺多样性。

- 以职阶基准为底，每项 `±10` 均匀波动 → 夹到 `40–90` → **再平回总数 260**。只改分布，不改预算，做不出「六边形战士」。
- 实现集中在 `src/content/archetypes.ts`：把现有的「夹取 + 平摊」抽成 `settleStats(stats)`，新增 `rollStats(archetype, rand, spread = STAT_JITTER)`；`statsForArchetype` 输出**一个字节不变**。
- **扩散到市场候选**：`makeCandidate` / `refreshMarket` 也走 `rollStats`，`rand` 用 `mulberry32(hashText(girlId))` 这样的种子随机器，保证**同一候选每次生成的属性一致**。存档里存的是生成结果，读档不会再抖。
- 自定义登记面板加「随机分配」（`#custom-randomize`）：点一次换一组，切职阶仍先给基准值。「平均分配」（`#custom-autofill`）保持 65/65/65/65。
- 幅度用 `STAT_JITTER = 10` 单点配置。

#### 4.10.2 代表色：LLM 起草时一并给出

`GeneratedGirlProfile` 现在没有 `color` 字段，LLM 起草完卡片只能吃对话框默认的第一个色（`#F49ABD`），十张卡有八张是同一个粉。

- 新增共享调色板 `src/content/palette.ts`：

```ts
export const GIRL_COLORS = ['#F49ABD', '#B98AD9', '#9CC9D2', '#F2C879', '#A8D8A0', '#E58C8C', '#7FA9E8', '#D98BA6'] as const;
export function sanitizeGirlColor(value: unknown, seed: string): string; // 非法/缺失 → 按 seed 哈希确定性取一枚
```

  对话框里写死的 `colors` 常量改成引用它，世界书、卡库、名册、立绘都读同一份。

- `GeneratedGirlProfile` 与 LLM schema 增加 `color`：

```
"color":"#F49ABD|#B98AD9|#9CC9D2|#F2C879|#A8D8A0|#E58C8C|#7FA9E8|#D98BA6"
```

  提示词补一句：`color 必须是清单里的一个颜色，要和立绘的主色、糖霜/月影气质一致，不要每次都选第一个。`

- 回填：`sanitizeGirlColor(data.color, data.name)` → 对话框 `setColor(...)`，立绘、卡片、名册三处自动跟着变。
- 卡片导入导出已经带 `color`（`src/cards.ts:31` / `:141`），只需在导出前过一遍 `sanitizeGirlColor`，防止手工改过的卡写出非法值。
- 手动换色：保留现有 6 色圆点（改成读 `GIRL_COLORS`，变 8 个），点一下就覆盖 LLM 的选择。


---

## 5. 迁移与兼容

`GameState.version` 14 → 15，`loadState` 接受 `1, 3..15`：

| 新字段 | 旧存档默认值 | 说明 |
| --- | --- | --- |
| `prologueSeen` | `true` | 老玩家不该被开场打断 |
| `startersPicked` | `true` | 老名册不动 |
| `factionRoster` | 首领回原属 + 随从 3/3/3 | 旧档直接沿用现在的首领与随从分组 |
| `Girl.starter` | `false` | 开局编成来的人为 `true` |
| `Girl.leader` | `false` | 覆灭后雇佣的首领为 `true` |

卡库不进存档（§3.1），没有迁移问题；`night-sugar:cardbox:v1` 读不出来时按空库处理。

---

## 6. 测试

现状：218 项状态测试 / 75 组浏览器流程。本版预计 **+40 项状态测试 → 约 258**，**+7 组浏览器流程 → 82**。

### 6.1 状态测试（`tests/game.test.ts`）

空月与世界书：

1. `builtinWorldbook()` 含 `moon` 条目，`constant: true`、`priority` 最高、`order: 0`。
2. 正文包含「祈愿」「绝望」「献祭」「封印」四个关键词。
3. 内置词条里不再出现「月蚀教团」。
4. 常量词条总字数未超过 `WORLDBOOK_BUDGET`。
5. 现有 Boss 战未被改动：`state.boss` 生成与结算路径与 v20 一致（回归，防止文案改动误伤机制）。

开场：

6. `createInitialState()` / `createBlankState()` 的 `prologueSeen` 为 `false`。
7. 旧档（`version: 14` 无该字段）载入后 `prologueSeen === true`、`startersPicked === true`、`factionRoster` 为内置 3/3/3。
8. 动作 `seenPrologue` 置 `true` 且幂等。

卡库：

9. 两张合法卡 → `added.length === 2`。
10. 同 hash 再导入 → `duplicates.length === 1`、`added.length === 0`。
11. 一坏一好 → `failed.length === 1`、`added.length === 1`。
12. 超 256KB 的卡被拒并给出「过大」。
13. 库满 60 张拒绝新增，条目数不变。
14. `cardboxRemove` 只删库。
15. `cardboxFilter` 命中名字 / 文件名 / 出身。

导入与编成：

16. `importCards` 三张 → 候选多 3 人、`custom: true`、出身按卡来。
17. `importCards` 混重复 → 消息含「跳过重复 1 张」。
18. `setStarters` 少于 4 / 多于 6 / 含池外人 → 失败且状态不变。
19. `setStarters` 成功 → 名册只剩选中的人、`startersPicked === true`、未选中的事务所六人不在 `candidates` 里。
20. `setStarters` 的 `roster` 少于 1 人 / 重复 / 合计不为 9 → 失败。
21. `starterOptions()` 不含任何首领（首领不可在编成页选）。
22. 默认 `factionRoster` 是 3/3/3，改分配后 `factionGirlsOf` 与档案「成员」页跟着变。
23. 首领未覆灭时 `hireLeader` 失败，消息含「她还有辖区要守」。
24. 把某方辖区清零后 `canHireLeader` 为真；星砂不足时仍失败。
25. 雇佣成功后：星砂扣除、`leader: true`、该势力 `standing === 0`、另两方各 `+3`、`canIntercept` 不再以她为拦截者。

首领指派与属性波动：

26. `setStarters` 把白鹭千秋指派给月蚀庭后：档案「首领」显示她、头衔取现属那套（`名录执笔 · 客卿`）、小字标「原属 星灯协会」。
27. 两位首领指到同一方 → 失败、状态不变。
28. 某方首领位为空 / 用了不存在的首领 id → 失败。
29. 默认 `factionRoster` 是「首领回原属 + 随从 3/3/3」。
30. `rollStats` 跑 100 次：总点恒为 260、四项都在 40–90、且与 `statsForArchetype` 至少一项不同。
31. `rollStats` 注入固定 rand 可复现；两个不同 seed 结果不同。
32. `statsForArchetype` 输出与 v20 完全一致（回归，确认抽取 `settleStats` 没改行为）。
33. 雇佣门槛跟**现属**走：白鹭千秋指派给月蚀庭后，只清空月蚀庭辖区 → `canHireLeader` 为真；只清空星灯协会辖区 → 为假。
34. 动作 `resetFactionRoster` 后：首领回原属、随从 3/3/3、**已选少女不变**。
35. 市场候选也带波动：`makeCandidate` 两项以上不同职阶基准，总点仍 260。
36. 市场候选可复现：同一 `id` 连续生成两次属性完全相同（种子来自 id 哈希）。
37. `sanitizeGirlColor('#9cc9d2', 'x')` 归一为小写合法色；`'red'` / `''` / `undefined` → 按 seed 确定性回退，两次调用一致。
38. 卡片导出→导入后 `color` 不变；导出前被篡改成非法的值会被 `sanitizeGirlColor` 修好。
39. `generateGirlProfile` 的 schema 字符串包含 `"color"`，且出现的每个色值都在 `GIRL_COLORS` 里（提示词回归，不联网）。
40. `GIRL_COLORS` 无重复、全部是 7 位 hex。

### 6.2 浏览器流程（`tests/browser.mjs`）

1. **开场三幕**：新档 → 开场可见 → 三次「下一幕」→ 进编成；`#prologue-beat` 文案含「1 / 3」。
2. **重看开场**：记录页 `#replay-prologue` 能重开；`Esc` 关闭后不重复弹。
3. **卡库批量导入**：`#cardbox-file` 一次喂 2 个文件 → 列表 2 行 → 全选导入 → 市场候选多出对应人。
4. **编成与阵容**：默认 4 人 + 3/3/3 → 加一人变 5 → 把一个随从调到别方 → 确认 → 名册与档案「成员」页一致；少于 4 人时 `#starter-confirm` 禁用。
5. **空白档案加卡提示**：空白开局 → 开场跳过 → `#blank-hint` 可见 → 点 `#blank-hint-cards` 打开卡库 → 关掉后进派遣页。
6. **指派与随机属性**：编成里把一位首领从协会位拖到月蚀庭位 → 档案「首领」头衔变「名录执笔 · 客卿」；自定义登记点两次 `#custom-randomize` → 两次数值不同、剩余点数仍为 0。
7. **代表色**：自定义登记选一个 `#custom-color-*` → 立绘主色随 `--girl-color` 变；再点 `#custom-randomize` 只换属性、不夺走手选颜色。

既有 75 条保持：行为变化只有「新档先播开场 + 进编成」，相关流程统一加一步「跳过开场 + 用默认编成」。

---

## 7. 实施顺序

1. 世界书：`moon` 条目 + `factions` 修旧称 + Boss 文案对齐（纯文案，先落地）。
2. 类型与版本：`prologueSeen` / `startersPicked` / `factionRoster` / `Girl.starter` / `Girl.leader` / `FactionLeader` 扩字段，版本升 15，旧档补默认。
3. 开场：`src/prologue.ts` + `PrologueDialog` + 记录页重看 + 样式。
4. 卡库：`src/cardbox.ts` + `importCards` + `CardLibraryDialog` + 市场入口 + 样式。
5. 阵容：`factionRoster` 接入 `factionGirlsOf` / 档案成员页 / 拦截战判定。
6. 编成：`starterGirls.ts` + `setStarters`（含首领指派与 `resetFactionRoster`）+ `StarterDialog` + 空白档案加卡提示。
7. 属性与配色：`archetypes.ts` 抽 `settleStats` 加 `rollStats`（含市场候选接入）、`content/palette.ts` + `sanitizeGirlColor`、`GeneratedGirlProfile.color` 与提示词、自定义登记面板「随机分配」与调色板。
8. 首领雇佣：`canHireLeader` + `hireLeader` + 档案页按钮 + 出勤代价。
9. 测试与文档：状态测试 25 条、浏览器流程 5 条，README / `tasks/todo.md` / 本方案回填。

每步先 `npx tsc -b` + 相关单测；UI 落地后重建 `dist` 再跑浏览器流程。

---

## 8. 风险与取舍

| 风险 | 处理 |
| --- | --- |
| 随从分配可改后，`factionGirls` 的静态分组与存档分组并存，容易读错源 | 所有读取点统一走 `factionGirlsOf(state, faction)`，静态数组只保留原始数据 |
| 首领雇佣门槛是「辖区归零」，但势力可能靠议会易主反复复活 | 只在确认覆灭（`territories.length === 0` 且当夜结算后）才允许；复活后按钮自动消失，已雇佣的不退回 |
| 编成把「标准开局六人」变成「自选 4–6 人」，老玩家习惯被打断 | 默认预选还是原来那四位核心，直接确认即可；编成可跳过=用默认 |
| 事务所六人未选中就被移出，可能被理解为「丢人」 | 界面上写明「未选中的会留在事务所以外自谋出路」，并在确认前二次提示 |
| 卡库吃 localStorage 配额（约 5MB） | 单卡 256KB + 总数 60 双上限，满库拒绝而非静默淘汰 |
| 开场每次新档都播，重置类测试变慢 | 浏览器流程统一走「跳过」；开场本身只测一次 |
| 首领可指派后，`factionLeaders` 里静态的 `faction` 字段与「现属」并存 | 静态字段只作 `origin`；所有展示与判定读 `factionRoster`，`factionLeader(state)` 改为按编成结果取 |
| 随机波动可能做出极端偏科少女 | 夹在 40–90 并回平到 260，只改分布不改预算 |
| 市场候选一旦随机就可能破坏「同档同值」的旧断言 | 种子取自候选 id 哈希，属于确定性随机；旧断言改成「总点 260 + 范围 40–90」，不再钉死具体数值 |
| LLM 容易总选第一个色，八个色实际只用到一个 | 提示词点名「不要每次都选第一个」，并在 schema 里列全部八色；产不出合法值时按名字哈希兜底 |
| 空月被写成「会说话的终焉」 | 词条末尾「写法提醒」写死护栏；叙事提示词补一句「不要替空月写台词」 |

---

## 9. 待确认

1. **调色板要不要放开手写 hex？** 现在是 8 枚固定色，选色只能点圆点。若想支持任意 hex（含取色器），这里加一个输入框，非法值仍走 `sanitizeGirlColor` 兜底。
2. **首领雇佣价格**：定为 12,000 星砂 + 残留态度清零。如果你想要「免费但掉另两方态度」或「只能用某条战线胜利换」，改这一处。
3. **未选中的事务所六人**：现在是「移出，不回市场」。若想让他们出现在市场当候选（可再签回来），改 `setStarters` 一行。
4. **卡库要不要随存档导出？** 现在只存本地。
5. **波动幅度**：现在是 ±10（总点 260 不变）。若觉得差异还不够明显，调到 ±14 仍能夹在 40–90 内。
6. **空月的机制**（献祭 / 封印进度）留到主线与结局定稿后再开一版，本版不碰。

### 4.12 存档位与重新开始（补充）

- `src/saves.ts`：`SAVE_SLOT_IDS = [1,2,3]`，键 `night-sugar-office:slot:{n}`，内容 `{ schema: 1, savedAt, state }`；
  `loadState` 负责校验与迁移，裸 state JSON 也能读，损坏槽位返回空而不是崩溃。
- 自动存档仍写 `SAVE_KEY`（当前进度）；三个槽位只在玩家按下保存时才变。
- 单槽上限 `SLOT_BYTES_LIMIT = 1_600_000` 字符，超了直接提示体积与清理办法，避免静默失败。
- `src/components/SaveSlotsDialog.tsx`：三张卡片 + 底部「重新开始」（二次确认）；设置页入口 `#settings-save-slots`。
- 「重新开始」走既有的 `reset` 动作：回到第 14 日 20:00、重放开场三幕、不动三个档位与契约卡库。
