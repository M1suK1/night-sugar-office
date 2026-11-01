# v31 方案：灯下私语的动作分层、表情、连发与委托记忆

> 目标一句话：她一次可以发来几条短消息；每条台词下面的动作是灰色斜体；左侧立绘跟着当前这句话换表情；模型在回话前真的读过她最近参与过的委托。

## 1. 范围

| # | 问题 | 主要落点 | 规模 |
|---|---|---|---|
| 1 | 动作和台词混在同一段 | `Message`、`llm.ts` 的输出契约、`Conversation.tsx`、`dialogs.css` | 新字段 + 结构化输出 + 气泡排版 |
| 2 | 左侧立绘始终一个表情 | `Message.expression`、`Conversation.tsx` 的立绘、`GirlPortrait` 的换图动画 | 每条消息一个表情 + 悬停预览 |
| 3 | 一次只回一段 | `talk` / `addWhisper` reducer、`generateDialogue`、`generateWhisper`、消息分组 | 1–3 条连发，同一轮分组 |
| 4 | 模型不知道她最近去过哪些委托 | `MissionRun` 历史、`generateDialogue` / `generateWhisper` 的上下文 | 新历史表 + 提示词段落 |

不做：

- 不改战斗结算、羁绊数值、疲劳、侵蚀和委托奖励。
- 不把灯下私语改成实时聊天室；仍然是一次请求返回一组消息。
- 不改变「模型失败回退本地剧情」的总体策略。
- 不重写整个 `Conversation` 的视觉，只做必要的布局与气泡层级。

## 2. 现状与根因

### 2.1 动作与台词混在一起

`Message` 目前只有 `text`（`src/types.ts:792`）。`talkResponse`（`src/game.ts:2708`）和模型输出都把「她做了什么」写进同一段：

```
「……知道了。」她把档案合上，没有再看你。
```

`Conversation.tsx` 只渲染一个 `<p>{m.text}</p>`，所以没有地方放独立的动作行。

### 2.2 立绘没有表情来源

`GirlPortrait` 本身支持 `expression`（`src/components/GirlPortrait.tsx:49`），`Expression` 有 `calm | smile | surprise | sad | angry | shy`（`src/types.ts:22`），但 `Conversation.tsx` 直接传 `girl`，从来不按消息覆盖表情。灯下私语因此永远是角色卡上的那个表情。

### 2.3 一次只有一段

`generateDialogue`（`src/llm.ts:236`）只返回 `{ text }`；`generateWhisper`（`src/llm.ts:308`）也只返回 `{ text }`。reducer 里 `talk` 固定 push 一条 girl 消息，`addWhisper` 固定 push 一条 `whisper: true` 消息（`src/game.ts:2751`、`2844`）。所以 UI 一次只能出现一个气泡。

### 2.4 最近委托记录没有留人

结算时：

- 战斗胜利会把 `mission.status = 'done'` 并清空 `mission.squad`（`src/game.ts:2121`、`2136`）。
- 调查完成也会清空 `mission.squad`（`src/game.ts:2408`）。
- 失败/击退时同样清空。

之后 `state.missions` 里已经不知道谁去过；`state.completed` 只有委托 id；`state.logs` 没有角色 id。`generateWhisper` 只读了**这一次**的 mission/battle 和最近 6 条聊天，没有「她最近参与过什么」的稳定来源。

## 3. 数据模型

### 3.1 `Message` 扩字段

`src/types.ts`：

```ts
export interface Message {
  role: 'girl' | 'player' | 'system';
  text: string;
  at?: string;
  whisper?: boolean;
  /** 与台词分开的动作/神态；显示在气泡内、台词下方，灰色斜体。 */
  action?: string;
  /** 这条消息对应的立绘表情；旧消息没有，回落到角色卡表情。 */
  expression?: Expression;
  /** 同一轮生成的多条消息共享；用于气泡分组与“连发”间距。 */
  burstId?: string;
}
```

兼容：旧存档没有 `action` / `expression` / `burstId`，按原来的单气泡渲染。

### 3.2 模型返回的行

`src/llm.ts` 新增并在两处复用：

```ts
export interface DialogueLine {
  text: string;
  action?: string;
  expression: Expression;
}

export interface DialogueReply {
  lines: DialogueLine[];
}
```

约束：

- `lines` 长度 1–3。
- 每条 `text` 20–120 个汉字；总长不超过 420 字（灯下私语不超过 300 字）。
- `action` 可选，8–50 字，只写动作/神态/环境反应，不重复台词。
- `expression` 必须是六种之一；缺失或非法回落到 `calm`。
- 至少一条有 `text`；允许一条「只有动作」的短停顿，但最多一条。
- 不使用 markdown、列表、括号包裹整段动作。

### 3.3 委托历史 `MissionRun`

`src/types.ts`：

```ts
export interface MissionRun {
  id: string;
  missionId: string;
  title: string;
  work: WorkKind;
  category: string;
  district?: DistrictId;
  day: number;
  minutes: number;
  girlIds: string[];
  outcome: 'victory' | 'defeat' | 'repelled' | 'draw' | 'success' | 'failure';
  reward: number;
  battleId?: string;
}
```

`GameState` 增加：

```ts
/** 每次委托结算留下的一条参与记录；旧存档在迁移时从 battles 补。 */
missionRuns?: MissionRun[];
```

写入点：

- `settleCombat` 末尾：记录本场 `squad`（未被 `mission.squad = []` 清掉之前）与 `battle.outcome`。
- `settleInvestigation` 末尾：记录 `success/failure`。
- 拦截战暂不单独记一条「委托完成」，但若走 `settleCombat` 仍保留战斗记录，避免丢失。

读取：

```ts
export function recentMissionRuns(state: GameState, girlId: string, limit = 4): MissionRun[]
```

按 `day * 1440 + minutes` 倒序，过滤 `girlIds.includes(girlId)`。

旧存档迁移：

- `missionRuns` 不存在时，遍历 `state.battles`，把有 `ally-${girlId}` 的战斗补成 run；调查类旧记录无法补，保持空。
- 只在迁移时补一次，避免每次加载重复。

## 4. 生成契约

### 4.1 对话输出

`generateDialogue` 从 `{ ok, text }` 改为 `{ ok, reply: DialogueReply }`。

提示词末尾要求：

```json
{"lines":[
  {"text":"……","action":"她把杯子推到你面前。","expression":"shy"},
  {"text":"……","expression":"smile"}
]}
```

规则写进 system/user：

- 先写她真正说出口的台词，动作另放 `action`，不要写成「她说：……」。
- 一次 1–3 条，像连续发消息，不要为了凑条数拆句。
- 每条最多一个动作；没有动作就省略字段。
- 用 `expression` 标出这一句对应的表情。
- 只输出 JSON。

解析与容错：

- 优先 `extractJsonObject`。
- JSON 不可用时，把纯文本按换行/空行拆成最多 3 条，`expression: 'calm'`，不臆造动作。
- 单条超过上限则截断；总长超限则保留前两条并合并剩余。
- 解析失败仍按旧逻辑回退本地剧情；日志里记录「结构化解析失败」。

`generateWhisper` 使用同一套 `DialogueLine`，但字数更短（每条 15–90 字，总长 ≤300），并允许「动作」描述她那边发生的事（水声、椅子、手机电流）。

### 4.2 提示词里的委托记忆

在 `generateDialogue` 和 `generateWhisper` 的 body 都增加：

```
【最近参与】
第 12 日 02:10「锈井盲音」：战斗 · 旧城区 · 胜利；同行 Es、美悠。
第 10 日 23:40「失约的送奶人」：调查 · 住宅区 · 失败；她一个人回来。
...
（只作为记忆，不要逐条复述；当前这次委托已在【这一次】里，不要重复。）
```

- 取最近 4 条，优先包含当前 mission；当前 mission 在【这一次】已出现时，从「最近参与」里跳过，避免重复。
- 每条只写「日期/标题/类型/辖区/结果/同行」，不写伤害、回合和技能名；这些留给战斗札记。
- 总长度限制约 600 字；超出时从最旧的开始丢。
- 没有记录时写「最近没有出勤记录」。

### 4.3 输出预算

- `DEFAULT_TASK_BUDGETS.whisper` 从 600 提到 1200，避免 3 条 + JSON 被截断。
- 对话仍受 420 字总长限制，不需要提高总预算；但 `chat` 请求的 `maxTokens` 要给 JSON 结构留余量。
- 失败时日志要能区分「模型没返回 JSON」与「返回了但校验不过」。

## 5. reducer 与 App

### 5.1 `talk`

`GameAction`：

```ts
| { type: 'talk'; girlId: string; text: string; remote?: boolean; reply?: DialogueReply }
```

`talk()`：

- push 玩家消息；
- 为这一轮生成 `burstId = talk-${Date.now()}-${girl.id}`；
- 按 `reply.lines` push 多条 `{ role:'girl', text, action, expression, burstId }`；
- 本地回退时也生成 1–2 条结构化消息（见 5.3）；
- 远程电话仍然在第一条前加「（电话那头有很轻的电流声）」，但不要重复加到每一条。

### 5.2 `addWhisper`

```ts
| { type: 'addWhisper'; jobId: string; lines: DialogueLine[] }
```

- 同一 job 的所有消息共享 `burstId = job.id`，`whisper: true`；
- `whisperUnread[girlId]` 仍只 +1：一次生成算一条未读会话，不是按气泡数 +3；
- 空数组视为失败，不写消息、不涨未读，返回错误。

### 5.3 本地回退

把 `talkResponse` 从返回字符串改为返回 `DialogueLine[]`：

- 现有 8 个分支改写成「台词 + 可选动作」；
- 表情用简单规则：提到星星/月亮 → `smile` 或 `shy`，道歉 → `sad`，累 → `calm`，高羁绊 → `smile`；
- 通常 1 条，高羁绊或长回复可 2 条；
- 不伪造模型才有的细节。

这样没有配置 API 时，UI 仍能演示动作分层、表情和多条消息，不会只有模型模式才有效。

## 6. UI 与样式

### 6.1 消息分组

`Conversation.tsx` 把 `messages` 按连续 `burstId` 分组：

```
[玩家消息]
[她的第 1 条]
  └ 动作（灰斜体）
[她的第 2 条]
  └ 动作
```

- 同一 `burstId` 只显示一次名字（`<small>{girl.name}</small>`），气泡间距 6–8px；
- 不同轮之间保持原来的 18px 间距；
- 旧消息没有 `burstId`，每条单独一组，行为不变。

### 6.2 动作行

```tsx
<div className="chat-message girl">
  <small>{girl.name}</small>
  <p className="chat-text">{line.text}</p>
  {line.action && <p className="chat-action">{line.action}</p>}
</div>
```

CSS：

```css
.chat-action {
  margin: 6px 0 0;
  padding: 0 2px;
  color: #8e7f99;
  font-size: 9px;
  font-style: italic;
  line-height: 1.8;
}
```

- 动作不放进台词气泡的 `p`，保证复制/排版时台词是台词、动作是动作。
- 如果一条只有动作、没有台词，则只显示动作行，不加空气泡。

### 6.3 立绘表情

`Conversation` 计算：

```ts
const latestGirl = [...messages].reverse().find(m => m.role === 'girl');
const latestExpression = latestGirl?.expression ?? girl.expression ?? 'calm';
const [preview, setPreview] = useState<Expression | null>(null);
const shownExpression = preview ?? latestExpression;
```

渲染：

```tsx
<GirlPortrait
  key={shownExpression}
  girl={{ ...girl, expression: shownExpression }}
  variant="full"
/>
```

- 鼠标悬停某条她的消息时，`preview = line.expression`；移出恢复最新表情。
- 多条连发时，最新一条的表情就是左侧立绘的表情；如果后续做逐条高亮，高亮到哪条就切到哪条。
- 给立绘加 `.conversation-character .girl-portrait { animation: portrait-in .35s ease-out; }`，让换表情不是硬切。
- 不改 `GirlPortrait` 的绘制逻辑；只传 `expression`。

### 6.4 连发节奏

- 新到的一组消息用 CSS `animation-delay: calc(var(--line-index) * 120ms)` 逐条淡入。
- 不做「先隐藏再逐条显示」的持久化假状态；刷新后整组直接显示，避免消息丢失。
- 输入框在整组生成完成前保持 `sending`，生成完成后一次性写入。

## 7. 兼容与迁移

- `Message` 新字段全部可选，旧消息不需要迁移。
- `missionRuns` 缺失时补空数组；能从 battles 补多少补多少。
- 旧 `Message.text` 里的动作不拆分，按旧样式整段显示；不尝试正则猜动作，避免把台词拆坏。
- 存档导入/导出：`missionRuns` 跟着 `GameState` 走；卡库导出不涉及。
- 现有 `tests/v29.test.ts` / v30 用例中直接构造 `Message` 的地方不需要改；新增字段可选。

## 8. 测试

### 8.1 单元测试

新增 `tests/v31.test.ts`：

- `validateDialogueReply`：3 条合法；超过 3 条截断；缺 `text` 且无 `action` 拒绝；非法表情回落 `calm`；总长截断。
- `talk` reducer：一次写入 3 条 girl 消息，`burstId` 相同，玩家消息仍在前面。
- `addWhisper`：一次写 3 条、未读只 +1、`burstId = job.id`、空数组不写。
- `recentMissionRuns`：按时间倒序、只取该角色、最多 4 条；没有记录返回空。
- `missionRuns` 迁移：旧存档从 `battles` 补出战斗记录，不重复补。
- 提示词：`generateWhisper` 的 body 含最近委托标题/结果；当前 mission 不重复。
- 本地回退：返回结构化 1–2 条，动作与台词分离。

### 8.2 浏览器验收

在 `tests/browser.mjs` 增加：

- 灯下私语发送后出现 2–3 个 girl 气泡，名字只出现一次。
- 至少一个气泡有 `.chat-action`，且样式为斜体灰色（取 computed style）。
- 立绘 `data-expression` 随消息变化；悬停不同消息时切换。
- 一次生成 3 条时，未读角标仍为 1。
- 老存档消息仍正常显示，不出现空白动作行。

### 8.3 回归

- `npm test`（现有 357 项 + 新增）。
- `node tests/browser.mjs`（现有 105 项 + 新增）。
- `npm run build`。
- 手动检查 1182×816 与 1680×1000 两个尺寸，确认三条消息不把输入框顶出视口。

## 9. 风险

| 风险 | 处理 |
|---|---|
| 模型返回 3 段但每段都很长，撑爆面板 | 单条 120 字、总长 420 字硬限制；超出合并/截断 |
| 动作被模型写成第二段台词 | 校验 `action` 长度，提示词明确「动作不重复台词」；UI 仍分开放 |
| 表情变化过于频繁 | 只在最新消息与悬停时切换；同一条不重复动画 |
| 旧存档没有 `missionRuns` | 迁移补 battles；调查旧记录缺失在提示词中写「最近没有记录」 |
| 多消息让未读角标变成 3 | reducer 明确按 job +1，测试钉死 |
| JSON 输出失败导致没有回复 | 纯文本拆分回退；再失败才走本地剧情 |

## 10. 实施顺序

1. `types.ts`：`Message.action/expression/burstId`、`DialogueLine`、`MissionRun`、`GameState.missionRuns`。
2. `llm.ts`：`DialogueLine` 校验与解析、`generateDialogue` / `generateWhisper` 改造、委托记忆段落。
3. `game.ts`：`talk` / `addWhisper` 多消息、`talkResponse` 结构化、`missionRuns` 写入与迁移。
4. `Conversation.tsx` + `dialogs.css`：分组、动作行、立绘表情、连发动画。
5. `App.tsx`：传递 `reply.lines` / `lines`，日志与提示文案。
6. 测试、构建、浏览器验收、README/todo 记录。

## 11. 追加：市场每日刷新，售罄保留空位

### 11.1 现状

- `marketWindow` 每天只摆 `marketSize(level)` 位，设计上确实是「一天一窗口」。
- 但 `App.tsx:669` 的补货 effect 依赖 `state.candidates.length`：买走一位后候选数下降，effect 立即从卡库补一位，`unshiftMarketWindow` 把新面孔塞回窗口，于是看起来「买完立刻刷新」。
- `hire`（`game.ts:3161`）还会 `normalizeMarketWindow(next)`，把买走的人从窗口里删掉，UI 只剩下没买的那一位，无法显示「这个窗口已售出」。

### 11.2 规则

1. 市场窗口在每天第一次进入/换日时确定，当天不再因为购买、候选减少而补位。
2. 买走的人从候选池移除，但窗口保留一个 `sold` 占位；UI 显示「已签约 / 明日 00:00 重新挂牌」。
3. 次日 `refreshMarket` 清空窗口与售罄标记，按新的候选池重新开窗；卡库补货每天最多执行一次。
4. 手动从卡库导入的卡仍可进入候选池；是否立刻替换当日窗口另定，默认不替换已售罄占位。

### 11.3 数据与函数

- `GameState.marketSold?: string[]`：今天已售出的窗口 id。
- `marketSlots(state): { id: string; girl?: Girl; sold: boolean }[]`：按窗口 id 返回完整槽位；售出但仍在窗口里的 id 返回 `sold: true`。
- `marketWindow(state)` 继续返回未售出的 `Girl[]`，供旧调用与计数。
- `normalizeMarketWindow` 保留 `sold` id，不再把已售出的人从窗口裁掉。
- `refreshMarket` 换日时清空 `marketSold`。

### 11.4 组件

- `MarketView` 用 `marketSlots` 渲染；售罄槽位用 `SoldCandidateCard`：
  - 与候选卡同高，灰化、虚线边框；
  - 文案「今日已签约」+「明日 00:00 重新挂牌」；
  - 不可点击签约。
- 顶部统计改为「今日挂牌 N 位 · 已签约 M 位 · 池中 K 位」。
- 全部售罄时仍显示售罄卡，不再显示「卡库用完了」的空状态（除非当天窗口本来就是 0）。

### 11.5 App 补货

- 新增 `marketRefillDay` ref；effect 只在 `state.day` 变化时执行一次。
- 移除对 `state.candidates.length` 与 `marketTick` 的即时依赖；买人不再触发补货。
- 卡库导入仍可手动补池，但不改变已售罄的当日窗口。

### 11.6 测试

- reducer：连续 `hire` 两位后 `marketWindow` 仍保留两个 id，`marketSold` 含两人，`marketSlots` 两个 `sold: true`。
- 换日：`refreshMarket` 后 `marketSold` 为空、窗口换成新候选。
- App 逻辑：同一天买人不再触发 `refillMarket`；换日只触发一次。
- 浏览器：买完两位后页面仍有两张售罄卡；不可再次签约；换日后恢复新候选。

