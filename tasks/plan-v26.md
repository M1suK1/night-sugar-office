# v26 方案：开局流程重做（三选项 → 卡库读卡 → 势力分配 → 序章 → 首夜空缺补齐）

> 目标一句话：把「点一下标准开局就直接掉进第 14 日晚上」改成一条有前后因果的开场线——先在标题页选怎么开始，再用卡库里的少女（没卡才用默认六人）编成事务所名册，然后把三方首领与随从分好，看一段改过的过场戏，最后让叙事者把这一夜空缺的议案、弹窗事件与委托补上。
>
> 本版按 User said m21944 的五条要求设计：①标题页三个选项（开始新游戏 / 读取存档 / 设置）；②优先从卡库里读卡，没卡再填默认角色；③玩家分配角色势力；④进入改过文案的过场剧情；⑤同时由 LLM 生成第一天空缺的议案、弹窗事件等。

## 1. 范围与边界

### 1.1 要做的

| # | 需求 | 落地位置 | 规模 |
|---|---|---|---|
| 1 | 标题页三选项 | 新 `src/components/TitleDialog.tsx`，替换 `StartDialog` | 1 个新组件 + `src/App.tsx` 相位状态机 |
| 2 | 卡库优先读卡 | `src/App.tsx` 的 `startNewGame()` + `importCards` + `StarterDialog` 的 `initialPicked` | 1 个新动作组合 + 1 个新 prop |
| 3 | 分配角色势力 | 复用 `StarterDialog`（已有三方首领/随从分配），改为开场必经、不可关闭 | 组件小改 |
| 4 | 过场剧情改文案 | `src/prologue.ts` 由常量改 `prologueFor(state)`，`PrologueDialog` 收 `beats` | 2 个文件 |
| 5 | 首夜空缺补齐 | 新 `src/opening.ts` + `GameAction.openingFill` + App 侧一次性 effect | 1 个新模块 + 1 个新动作 |

### 1.2 不做的

- 不改战斗、经济、势力、污染、内容池数值。
- 不新增后端、不新增依赖。
- 不改存档结构以外的东西：`GameState` 只加一个 `openingFilledAt` 字段。
- 不把标题页做成"四个选项"——继续上次进度收进「读取存档」的第一项（见 §3.3）。
- 空白档案语义保留（无契约者、6,000 星砂），但也能读卡库（见 §4.3）。

## 2. 现状（改之前）

```
bootState() ──► !booted: #boot-splash
              └► booted: !started ? <StartDialog>（#start-standard / #start-blank）
                          started && !prologueSeen ? <PrologueDialog>  ← 序章在编成之前
                          starts 之后直接落进主界面
```

- `started` 是 `sessionStorage['night-sugar-office:started'] === '1'`（`src/App.tsx:128-130`），有存档时 `boot.hadSave` 直接置 true（`:167`）。
- `StartDialog`（28 行）只有两个按钮：`#start-standard` → `markStarted()`；`#start-blank` → `reset(blank)` + `markStarted()`。
- `StarterDialog`（327 行）早就写完了，但**只能从设置页 `#settings-starter` 手动打开**，开场根本不经过它；`state.startersPicked` 只用于存档位显示。
- `PROLOGUE`（`src/prologue.ts`，56 行）是三幕静态数据，`PrologueDialog` 自己 `import { PROLOGUE }`，App 不能替换内容。
- `createInitialState()` 起于**第 14 日 20:00**（不是第 1 天），7 条 seed 委托、1 条 seed 议案、0 条待用弹窗池。
- 每日自动生成只在 `state.day > lastGeneratedDay.current` 时触发，而 `lastGeneratedDay` 初始化为 `state.day`——**第 14 日这一夜永远不会自动补稿**（`src/App.tsx:218-224`）。
- 弹窗池补稿同理（`:226-236`），只在跨日时跑。

## 3. 新流程

### 3.1 相位状态机

`src/App.tsx` 里用 `phase` 取代 `started` 布尔：

```ts
type BootPhase = 'title' | 'roster' | 'prologue' | 'play';
const [phase, setPhase] = useState<BootPhase>(() =>
  sessionStorage.getItem(STARTED_KEY) === '1' ? 'play' : 'title');
```

| 相位 | 渲染 | 进入条件 | 离开 |
|---|---|---|---|
| `title` | `<TitleDialog>` | 启动（无会话标记） | 见 §3.2 |
| `roster` | `<StarterDialog forced>` | 点了开始新游戏 | 确认编成 → `prologue` |
| `prologue` | `<PrologueDialog beats={prologueFor(state)}>` | 编成确认 | 翻完 → `play` |
| `play` | 现有全部界面 | 读档 / 序章结束 | — |

- 保留 `STARTED_KEY` 语义（进入 `play` 时写 `'1'`），刷新同标签页直接回 `play`，不会每次重看序章。
- `markStarted()` 拆成 `enterPlay()`：`setPhase('play')` + 写 sessionStorage。
- 修复 `boot.hadSave` 分支：不再自动 `setStarted(true)`；改为**标题页可读**——启动后停在 `title`，只有会话标记才跳 `play`（`sessionStorage` 在刷新时保留，所以"刷新不打断游戏"仍然成立；新标签页才会看到标题页）。

### 3.2 标题页（`src/components/TitleDialog.tsx`）

外层沿用 `.start-overlay / .start-card`（`src/styles.css:832-842` 已有样式，无需新 CSS），`aria-label="夜糖事务所 · 开始"`。

| 选择器 | 文案 | 行为 |
|---|---|---|
| `#start-new` | 开始新游戏 / 「用卡库里的少女开局；没有卡就用默认六人」 | `startNewGame()` → `roster` |
| `#start-load` | 读取存档 / 「三个档位、项目目录里的文件，或继续上次进度」 | 打开 `<SaveSlotsDialog>`（`setModal({ type: 'slots' })`） |
| `#start-settings` | 设置 / 「故事引擎、玩家档案、减少动效」 | 打开 `<SettingsDialog boot>`（见 §6） |
| `#start-blank` | 空白档案（小字次级链接） | `reset(blank)` → 无卡库卡时直接 `prologue`，有卡则仍进 `roster` |
| `#start-hint` | 一句状态提示：卡库 N 张 / 默认六人 / 当前进度停在第 X 日 | 只读 |

- 三选项用 `.start-option` 卡片纵向排布（窄屏单列，宽屏 `#start-new` 跨两列）。
- 保留 `.start-option.blank` 的既有配色给 `#start-blank`。
- `#start-standard` **不再存在**（浏览器流程要改，见 §9）。

### 3.3 「读取存档」与继续进度

`SaveSlotsDialog` 顶部新增"当前进度"区（**只在 boot 模式渲染**，正常游戏内不显示，避免和自动存档打架）：

| 选择器 | 行为 |
|---|---|
| `#slot-current` | 显示 `第 X 日 · N 位契约者 · 已编成/未编成`，点「继续」→ `kvGet(SAVE_CURRENT_KEY)` → `setState` → `enterPlay()` |
| `#slot-current-load` | 同上按钮本体 |

- 没有当前进度时整块显示「还没有进行中的一夜」。
- 读到 `startersPicked === false` 的老存档 → 进 `play` 后由 §4.2 的守卫自动补进 `roster`。
- 允许在标题页读档：`onLoad`/`onLoadFile` 成功后调 `enterPlay()`；`onSave`/`onDelete`/`onRestart` 在 boot 模式下隐藏（没有进度可存）。

### 3.4 开始新游戏：卡库优先

`startNewGame()`（`src/App.tsx`）：

```ts
const startNewGame = async () => {
  let next = act(state, { type: 'reset' }).state;           // 标准开局
  const box = await loadCardBox();                          // 契约卡库（IndexedDB）
  if (box.length === 0) { setState(next); setPhase('roster'); return; }
  // 最近添加的优先，最多 6 张（= poolLimits.candidates）
  const picks = [...box].sort((a, b) => b.addedAt - a.addedAt).slice(0, Math.max(0, next.poolLimits.candidates - next.candidates.length));
  const cards = cardboxCards(box, picks.map(entry => entry.hash));
  const imported = act(next, { type: 'importCards', cards });
  if (imported.ok) next = imported.state;
  setState(next);
  setPhase('roster');
};
```

- 为什么"最近添加优先"：卡库上限 60 张，玩家的最新作品最可能是这次要用的。
- 候选位只有 6（`poolLimits.candidates`），初始状态已占 1（`lu`），所以实际最多导入 5 张。导入失败/超限都静默跳过，不打断开局。
- 卡库为空 → 什么都不做，`StarterDialog` 的默认四人（`STARTER_DEFAULT = ['yue','tang','ling','wu']`）就是"默认角色"。

### 3.5 分配势力（`StarterDialog` 改动）

- 新增 prop `initialPicked?: string[]`：`picked` 初值优先级 = `initialPicked`（合法性过滤）→ `STARTER_DEFAULT` 现有逻辑。App 传入 `next.girls.filter(g => g.cardId).map(g => g.id)`，即"卡库带进来的那几位"。
- 新增 prop `forced?: boolean`：为 true 时隐藏 `#starter-close`（开场必经），页头文案换成开场语境「今夜从这几个人开始」，保留「从契约卡库添加」`#starter-add-card` 与「现场登记一位」`#starter-add-custom`。
- 卡库导入的少女在网格里已经带来源标记：`poolPicks` 里 `source: girl.custom ? '契约卡' : '在编'`（`src/components/StarterDialog.tsx:45-52`），卡库导入的卡就是 `custom: true`，会显示「契约卡」，无需新增视觉。
- 确认编成成功后：`setPhase('prologue')`。
- 自定义少女（`#starter-add-custom` → `CustomGirlDialog`）当前会 `setModal({ type: 'custom' })`，把 StarterDialog 顶掉；保持现状即可（关掉后 StarterDialog 重建，`picked` 由 `state.girls/candidates` 重新推导）。

## 4. 状态与动作

### 4.1 `GameState`

```ts
/** 首夜空缺已由本地兜底或叙事者补齐；= 第几日做的，0 表示还没做。 */
openingFilledAt: number;
```

- `GameState.version` 18 → **19**；`loadState` / `importState` 版本白名单加 19。
- 迁移：`state.openingFilledAt ??= 0`（老存档视为未补，下次进入 `play` 会补一次——这正是想要的，老档也没补过）。
- `createInitialState()` / `createBlankState()` 都写 `openingFilledAt: 0`。

### 4.2 新动作 `openingFill`

```ts
{ type: 'openingFill' }                    // 只做本地兜底，并把 openingFilledAt 记为当日
```

`src/opening.ts`（新文件，约 90 行）：

```ts
export interface OpeningGaps {
  opinions: number;   // pending 议案还差几条（目标 3）
  incidents: number;  // 待用弹窗池还差几条（incidentPoolNeed）
  missions: number;   // 委托还差几条（目标 : poolLimits.missions - 2）
  candidates: number;
  monsters: number;
}
export function openingGaps(state: GameState): OpeningGaps;
export function openingNeed(state: GameState): boolean;   // 任一项 > 0
export function fillOpeningLocal(state: GameState): { opinions: number; incidents: number };
```

- `fillOpeningLocal`：`generateOpinions` 循环到 pending ≥ 3（`generateOpinions` 每次只加一条，且自己有 ≥6 就停的保护）；`topUpFromFallback(state, at, 3)` 补弹窗池。
- stellar：本地兜底**不造**委托/候选/魔物——那些要叙事者写，没 key 就不硬造（初始已有 7 条委托，够开始）。
- 动作处理器：跑 `fillOpeningLocal`，写 `openingFilledAt = state.day`，日志「今夜的空缺已经补齐：N 条议题、M 个待用事件。」（`kind: 'council'`，带 count 差分，计数为 0 时不写日志）。
- 幂等：`openingFilledAt === state.day` 时直接返回 `{ ok: true, message: '今夜已经补过了。' }`。

### 4.3 App 侧一次性补稿

`src/App.tsx` 新增 effect：

```ts
useEffect(() => {
  if (phase !== 'play') return;
  if (state.openingFilledAt === state.day) return;
  if (openingRef.current) return;
  openingRef.current = true;
  void fillOpening();                       // 见下
}, [phase, state.day, state.openingFilledAt]);
```

`fillOpening()`：

1. **本地兜底先跑**（保证没 key 也有内容）：`perform({ type: 'openingFill' })`。
2. 有 key 且 `canAcceptGeneratedContent(state).ok` 时，串行：
   - `generateDaily(config, state, worldBrief(state), preset('daily'))` → `materializeNightProposal` → `act({ type: 'addGeneratedContent', ... })`（补委托/候选/魔物/议案/代表委托/装备）。
   - `generateIncidentBatch(config, state, preset('incident'))` → `act({ type: 'mergeIncidentPool', entries })`。
3. 两步都失败不阻断开局，只 `notify` 一条"叙事者这次没接上：<原因>。今夜先用本地内容开着。"

- 进度反馈：顶栏 `#opening-fill` 小徽标（`生成中` / 完成即消失），复用 `.shift-badge` 的样式类，不新造动画。
- `openingRef` 是 `useRef(false)`，跨 state 更新保持；刷新后由 `openingFilledAt` 兜住（已补过就不再跑）。
- 顺序要点：先本地再 LLM，避免"等模型"这段时间里议案面板空着。

### 4.4 `roster` 守卫

```ts
useEffect(() => {
  if (phase !== 'play') return;
  if (state.startersPicked) return;
  if (state.blank) return;                  // 空白档案不强迫编成
  setPhase('roster');
}, [phase, state.startersPicked, state.blank]);
```

- 覆盖两条路径：标题页直接读老档（`startersPicked=false`）、序章结束后状态被重置。

## 5. 序章改文案

`src/prologue.ts`：

- 导出从 `export const PROLOGUE: PrologueBeat[]` 改为 `export function prologueFor(state: GameState): PrologueBeat[]`，内部仍是三幕，但把动态信息插进去；`PROLOGUE` 保留为 `prologueFor` 在空状态下的默认输出（`ArchiveDialogs` / 浏览器流程重播时不会因缺 state 崩）。
- `PrologueDialog` 新增 `beats?: PrologueBeat[]` prop，缺省 `PROLOGUE`；App 传 `prologueFor(state)`。
- 重播入口 `#replay-prologue`（`src/views/AuxViews.tsx:738`）改为传 `beats={prologueFor(state)}`。

三幕新文案（要点，实现时照抄基调，句子可微调）：

**第一幕「三本账」（`ledger`，scene: table）** —— 保留三方立场，但把话说给"你"：
- 旁白：樱雾市的夜分三本账。名录、编号、血的账，各记各的。
- 旁白：三方都在这张桌上留了位置，谁也没打算先走。
- 白鹭千秋：「名录之外，没有灯。」（保留）
- 雨宫澄：「编号不会哭，城市才睡得着。」（保留）
- 蚀医·夜鸮：「城市不把女巫当人，我们就自己写人的定义。」（保留）

**第二幕「名册」（`roster`，scene: lamp）** —— 承接玩家的编成结果：
- 旁白：事务所的灯关了七年，今晚又亮起来。灯下摊开的名册上，名字是你自己写的。
- 旁白：`${state.girls.length} 位少女签了字` + （卡库来源时）`其中 ${n} 位是你从卡库里带回来的` + `。` 
- 旁白：三方各自坐定了人——`协会会长白鹭千秋 / 夜间特别勤务课长雨宫澄 / 净血派领袖蚀医·夜鸮`（按 `rosterLeader(state, faction)` 取真实名字，换了自定义首领就换名字）。
- 台词（若有代表）：`${代表.name}：「名册定了，就别再改主意。」`——用 `representativeOf(state)`；没有代表时这一句换成「名册还空着一行，等你写。」

**第三幕「今夜」（`tonight`，scene: night）** —— 交代这一夜要做什么：
- 旁白：`第 ${state.day} 日的值班从 ${SHIFT_START} 开始。七条委托已经压在桌角，议会的议题今晚会有人提上来。`
- 旁白：街上会冒出什么事，谁也说不准——`叙事者会替你补上这一夜的空缺`（没有 key 时这句换成「今夜先按本地写好的内容开着」）。
- 台词：`你：「灯留着。人派出去了，就等他们回来。」`

- `scene` 取值保持 `'table' | 'lamp' | 'night'`（`PrologueDialog` 靠 `data-scene` 分组，不动）。
- 浏览器流程里断言的四处旧文案（`三方分着管` / `关门七年` / `接委托、派人出勤` / `推开门`）要同步改（第一、二处仍在，第三处换成"人派出去了"；本轮 §9 列清楚）。

## 6. 标题页的设置入口

`SettingsDialog` 新增可选 prop `boot?: boolean`：

- `boot` 为 true 时：
  - 只显示 `一般`（减少动效 + 玩家档案）与 `故事引擎`（LLM 配置）两个 tab，隐藏 `内容池`（`#settings-tab-pools` 不渲染）。
  - 隐藏 `#settings-export-save` / `#settings-import-save` / `#settings-starter` / `#settings-save-slots` / `#settings-reset-save`（没有进度可操作）。
  - 保留 `#settings-cardbox`（在标题页也能整理卡库，和"卡库优先"呼应）。
  - 页头小字改成「这些偏好与凭证只存在本机，不进存档。」
- 关闭设置后回到 `title`（`setModal(null)` 即可，相位不变）。

## 7. UI 与文案

| 位置 | 改动 |
|---|---|
| `src/components/TitleDialog.tsx` | 新建；三选项 + 空白档案次级链接 + 状态提示 |
| `src/components/StartDialog.tsx` | 删除（被 TitleDialog 取代） |
| `src/components/PrologueDialog.tsx` | 加 `beats` prop |
| `src/components/StarterDialog.tsx` | 加 `initialPicked` / `forced` |
| `src/components/SaveSlotsDialog.tsx` | 加 `boot` 模式：`#slot-current` 区、隐藏保存/删除/重开 |
| `src/components/UtilityDialogs.tsx` | `SettingsDialog` 加 `boot` |
| `src/styles.css` | 标题页三卡片布局（宽屏 `#start-new` 跨列、窄屏单列，320px 不溢出） |
| `src/App.tsx` | 相位状态机、`startNewGame`、`fillOpening`、`#opening-fill` 徽标、`#start-*` 接线 |

- 中文 UI；标题页不出现英文与占位符。
- 320px 下三张卡片纵向排，`#start-new` 的说明文字最多两行（`-webkit-line-clamp` 不用，直接缩短文案）。

## 8. 迁移与兼容

| 项 | 处理 |
|---|---|
| `GameState.version` | 18 → 19；白名单 `loadState` / `importState` 加 19 |
| `openingFilledAt` | `??= 0`；老档进 `play` 后补一次（正是想要的） |
| `startersPicked` | 不动；老档 false → §4.4 守卫进 `roster` |
| `STARTED_KEY` | 语义从"已开始"变成"已进入 play"；值仍 `'1'`，不需要迁移 |
| 存档位摘要 | 不变（已显示 `已编成/未编成`） |
| 浏览器旧选择器 | `#start-standard` 消失 → 测试改 `#start-new`（§9） |

## 9. 测试计划

### 9.1 状态测试（`tests/v26.test.ts`，新增 12 条）

1. `createInitialState()` 带 `openingFilledAt: 0`，`version` 为 19。
2. `openingGaps`：初始状态 `opinions > 0`、`incidents > 0`、`missions <= 0`（7 条委托已够）。
3. `openingFill` 把 pending 议案补到 3 条，且 `#` 不重复（同一作者同一话题不重复出现）。
4. `openingFill` 把待用弹窗池补到至少 3 条。
5. `openingFill` 幂等：同一天第二次返回 ok 且计数不变。
6. `openingFill` 写 `openingFilledAt === state.day`。
7. 老档（v18 无 `openingFilledAt`）读入 → 0，可再补。
8. `importCards` 后 `state.candidates` 里有 `cardId` 的少女，`starterKeepInPool` 为真（不被 `setStarters` 清掉）。
9. `setStarters` 用卡库少女编成成功后 `startersPicked` 为 true、`#` 事务所名册就是这几位。
10. `prologueFor(state)` 三幕 id 依次 `ledger`/`roster`/`tonight`，第二幕旁白包含名册人数。
11. `prologueFor(state)` 换了自定义势力首领后，第二幕出现新首领名字。
12. `reset(blank)` 之后 `openingFilledAt` 为 0、`startersPicked` 为 false。

### 9.2 浏览器流程（`tests/browser.mjs`，92 → 97）

改写既有（属于"已记录的流程变更"）：

| 原 | 新 |
|---|---|
| `#start-standard` 点击（`:176`、`:2557`、`:2585`） | `#start-new` → `#starter-confirm`（默认四人已预选，直接确认） |
| 序章文案断言 `接委托、派人出勤` / `推开门`（`:185-186`） | 改断言「人派出去了」/「灯留着」 |
| `:180` `三方分着管` | 保留（第一幕没改这句） |
| `:183` `关门七年` | 保留（第二幕保留这句开头） |
| `sessionStorage['night-sugar-office:started']='1'`（`:2099`） | 保留（语义未变） |
| `#settings-starter` 打开的编成 | 保留（`forced` 只影响能否关闭） |
| `#start-blank` 生成的空白档案 | 保留 |

新增 5 条：

1. **标题页三选项**：`#start-new` / `#start-load` / `#start-settings` 都在，`#start-standard` 不存在；`#start-hint` 文案含"默认"或"卡库"。
2. **卡库优先**：先往卡库塞 1 张卡（复用现有卡 JSON）→ 刷新 → `#start-new` → `#starter-dialog` 里 `#starter-card-g_card_<hash>` 存在且 `aria-pressed="true"`，`#starter-count` 显示「已选 5 / 6」。
3. **势力分配→序章**：`#starter-confirm` → `#prologue-beat` 可见，第二幕含「名册」且含 `老板名`/首领名 → 翻完后进主界面，`sessionStorage['night-sugar-office:started']==='1'`。
4. **读取存档继续**：造一份当前进度（推进到 day 15）→ 刷新到标题页 → `#start-load` → `#slot-current` 含「第 15 日」→ `#slot-current-load` → 主界面顶栏 `第 015 日`。
5. **首夜空缺**：清空 storage → `#start-new` → 编成 → 序章 → 进主界面后 `#opening-fill` 最终消失；`state.openingFilledAt !== 0`；进 `#nav-council` 后 `.council-side` 里的「待决议」数字 ≥ 2（`src/components/CouncilView.tsx:138` 现有的 `<b>{pending.length}</b>`，不新增选择器）。

- 无 key 的 CI 环境：流程 5 只断本地兜底（不等待 LLM）。
- 目标规模：**状态 302 → 314**，**浏览器 92 → 97**。

## 10. 实施顺序

1. `src/types.ts`：`GameState.openingFilledAt`、版本 19、动作 `openingFill`。
2. `src/game.ts`：两个初始状态写字段、`openingFill` 处理器、迁移 `??= 0`、版本白名单 19。
3. `src/opening.ts`：`openingGaps` / `openingNeed` / `fillOpeningLocal`。
4. `src/prologue.ts`：`prologueFor(state)`（静态兜底 `PROLOGUE`）+ `PrologueDialog` 的 `beats` prop。
5. `src/components/TitleDialog.tsx` 新建；`StartDialog.tsx` 删除。
6. `src/App.tsx`：相位状态机、`startNewGame`、`fillOpening` effect、`#opening-fill` 徽标、`roster` 守卫、`#start-*` 接线、`replay-prologue` 传 `beats`。
7. `src/components/StarterDialog.tsx`：`initialPicked` / `forced`。
8. `src/components/SaveSlotsDialog.tsx`：`boot` 模式与 `#slot-current`；`UtilityDialogs.tsx` 的 `boot`。
9. `src/styles.css`：标题页三卡片。
10. `tests/v26.test.ts` 12 条；`tests/browser.mjs` 改旧 6 处 + 新增 5 条。
11. `README.md`（回归规模与开局流程说明）、`tasks/todo.md`、本文件末尾追加实际规模。

## 11. 风险与取舍

- **刷新即跳过标题页**：`STARTED_KEY` 用 sessionStorage，所以同标签页刷新直接进游戏；只有新标签页/新会话才看标题页。这是"不打断游戏"优先于"每次都问"的取舍。若要每次都问，改成不写 sessionStorage 即可，但会让每次刷新都掉回标题页。
- **卡库优先可能盖掉"默认四人"的叙事意图**：卡库里的卡等级/属性可能远高于默认六人，开局强度会飘。本次不限制等级（卡库本来就是玩家的资产），但导入上限 5 张（受候选池 6 位限制）；如果实测过强，下一步再按 `level` 分档限额。
- **候选池上限是硬约束**：`importCards` 会在候选满时全部失败，`startNewGame` 静默跳过并落到默认六人。不会出现"没有少女可编"的僵局。
- **首夜补稿可能让第一夜信息过载**：本地兜底 3 条议案 + 3 个待用事件 + LLM 一批委托，开局就有很多可点。取舍是"首夜要热闹"，`canAcceptGeneratedContent` 仍会挡住超限的情况。
- **`prologueFor` 依赖 state**：序章不再"每次一样"，重播时会看到当前名册。这是想要的（第二幕讲的就是你的名册），但浏览器流程不能再断静态长句，只能断关键词（§9.2 已按关键词改）。
- **`#start-standard` 消失是破坏性改动**：所有外部脚本/书签里写死这个 id 的都会失效。只在项目内部测试有三处引用，已列进 §9.2。

## 12. 待确认

1. 标题页要不要显示"当前进度停在第 X 日"这一行提示（`#start-hint`）？我按"要"设计。
2. 卡库导入上限按"最近添加优先 5 张"还是"按等级从高到低"？我按最近添加。
3. 「设置」在标题页是否需要允许改玩家档案（名字/外貌等）？我按"允许"设计（和游戏内同一份 `PlayerProfile`）。
4. 空白档案如果卡库里有卡，要不要也走 `roster`（我按"要"设计：有卡就进编成，没卡直接进序章）。
