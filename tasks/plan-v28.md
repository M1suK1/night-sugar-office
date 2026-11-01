# v28 方案：兼容 agent 模式（结构化读写 → 代理值班）

> 目标一句话：让本作能被一个外部 agent（DSH、脚本、或本地 LLM 代理）稳定地「读状态 → 选动作 → 执行 → 读事件」地驱动，而不靠猜 DOM；同时把同一套动作面留给游戏内的「代理所长」，人类玩家随时可以接管。默认的人类玩家体验不变。

## 1. 先对齐「agent 模式」指什么

这个词有三种常见含义，本方案按 **A（推荐）** 设计，B 作为 A 之上的第二层，C 单列在待确认里：

| | 含义 | 本方案 |
|---|---|---|
| A | **外部 agent 驱动**：脚本 / DSH / 自动化测试读游戏状态、下指令 | ✅ 主目标：结构化快照 + 动作白名单 + 页面内桥 |
| B | **代理所长**：游戏里的 LLM 托管日常运营（自动派遣、决议、雇人），玩家可随时接管 | ✅ 第二层：复用 A 的动作面 + 一个本地策略循环 |
| C | **SillyTavern / 预设的 agent 扩展**（function calling、`<output_method>`、`game_content`） | ⏸ 不在本版；若你指的是这个，方案要换成「预设兼容层」，见 §10 |

## 2. 范围与边界

### 2.1 要做的

| # | 需求 | 落地位置 | 规模 |
|---|---|---|---|
| 1 | 稳定的状态快照（JSON、小、只读） | 新 `src/agent.ts` 的 `agentSnapshot()` | ~120 行纯函数 |
| 2 | 动作白名单（JSON → `GameAction`） | 新 `src/agent.ts` 的 `AGENT_ACTIONS` + `applyAgentAction()` | ~150 行 |
| 3 | 页面内桥 `window.__nightSugar` | 新 `src/agentBridge.ts` + `src/App.tsx` 接线 | ~90 行 |
| 4 | 阻塞弹窗转队列，agent 必须显式处理 | `src/agent.ts` 的 `pendingBlockers()` + App 的 agent 模式分支 | ~60 行 |
| 5 | 事件游标（动作产生的新日志、弹窗、战斗） | `agentSnapshot().events` + `events(since)` | ~50 行 |
| 6 | 代理值班（B 层） | 新 `src/agentRunner.ts`（可选开关，默认关） | ~120 行 |
| 7 | 只在显式开启时挂桥 | `?agent=1` 或 `localStorage['night-sugar:agent']==='on'` | 1 处判断 |

### 2.2 不做的

- 不做服务端多用户、账号、远程对战；本作仍是纯前端 + 本地接口。
- 不让 agent 直接写 `GameState`、直接改 IndexedDB、执行任意脚本；一切走 `act()` 的校验。
- 不把叙事者（LLM 生成内容）交给 agent；agent 只做「决策」，内容生成仍由游戏自己调。
- 不改战斗、经济、议会、卡库的规则数值。
- 不为 agent 单独做一套 UI；人类界面照旧，只多一个「代理值班中」徽标。

## 3. 现状

- 动作全部集中在 `src/game.ts` 的 `act(state, action)`（**60+ 种** `GameAction`），校验、日志、结算都在里面；UI 只是 `perform()` 的包装。
- 状态只存在 IndexedDB 的 `save/current`；页面里是 React state，**没有对外的读写口**（`window.__*` 只有测试脚本注入的 `__readSave/__writeSave`）。
- 终端（`#open-command`）只有 `help/status/advance/end/page/generate/preset/district/mission/girl/clear`，**不能雇人、决议、派单**，也没有机器可读输出。
- 🚧 阻塞：`blockingIncidents(state)` 里的弹窗会挡住推进；UI 用 `IncidentDialog` 强制选择。agent 如果不知道「现在被什么挡住」，会一直 `advance` 失败。
- 🎭 弹窗副作用：`act()` 返回的 `battle`、打烊确认、开局编成、标题页、序章都是 **UI 相位**，不在 state 里；agent 必须能感知「现在停在哪个相位」。
- 浏览器验收已经证明「用选择器点 UI」可行，但那是测试代码，不是接口；DOM 一变就碎。

## 4. 设计

### 4.1 快照：`agentSnapshot(state, phase)`

只读、稳定、控制在几 KB（不含立绘/长文本）：

```ts
export interface AgentSnapshot {
  version: number;                 // GameState.version
  phase: 'title' | 'roster' | 'prologue' | 'play';
  day: number; minutes: number; clock: string;
  gold: number; reputation: number;
  shift: { wave: number; minutesLeft: number; closed: boolean };
  girls: { id: string; name: string; level: number; status: string;
           hp: number; guard: number; fatigue: number; bond: number;
           missionId?: string; retired?: boolean }[];
  candidates: { id: string; name: string; level: number; cost: number; cardId?: string }[];
  missions: { id: string; title: string; status: string; work: string;
              district?: string; window?: string; squad: string[] }[];
  opinions: { id: string; title: string; topic: string; status: string;
              authorId: string; options: string[] }[];
  incidents: { id: string; title: string; blocking: boolean;
               options: { id: string; label: string }[] }[];
  market: { level: number; stock: { id: string; name: string; price: number }[] };
  cardbox: { total: number; unused: number };
  blocked: boolean;                // 有 blocking incident 或必须处理的弹窗
  actions: string[];               // 当前可执行的动作类型
  events: AgentEvent[];            // 最近 40 条，带递增 seq
}
```

- **稳定 id**：全部用 `state` 里已有的 id（`mission.id`、`girl.id`、`opinion.id`、`incident.id`），不再另造。
- **不泄漏**：不带立绘、不带 LLM 密钥、不带提示词；`cardbox` 只给数量。
- **事件**：从 `logs` + `state.incidents` + 战斗结果里折叠出 `{ seq, kind, text, at }`；`seq` 用页面内单调计数（刷新归零，agent 以 `snapshot` 为基线重连即可）。

### 4.2 动作面：白名单，不直接改 state

只暴露「代理所长一天会做的事」，其余（导入卡、改池上限、删内容、改档案、换装）不开放，避免 agent 把存档改坏：

| 动作 | 参数 | 说明 |
|---|---|---|
| `advance` | `minutes` 1–180 | 被阻塞时返回 `blocked`，不推进 |
| `dispatch` | `missionId`, `girlIds[]` | 复用现有校验（疲劳/血量/人数/时段） |
| `endNight` | — | 直接结算到次日 20:00，不弹确认框 |
| `hire` | `girlId` | 候选 → 名册，校验星砂与席位 |
| `decideOpinion` | `opinionId`, `accept/defer/reject` | 复用议会代价预检 |
| `resolveIncident` | `incidentId`, `optionId?` | 阻塞弹窗的唯一出口 |
| `care` | `girlId`, `resting` | 休息 |
| `startExpedition` / `recallExpedition` | — | 星象台远行 |
| `buyItem` | `itemId` 或 `stockId` | 势力物资 |
| `refillMarket` | —（桥内部读卡库） | 市场补货，等价于 UI 的自动补 |
| `snapshot` / `capabilities` / `events` | — | 只读 |

实现：

```ts
export function applyAgentAction(state: GameState, action: AgentRequestAction, ctx: AgentContext):
  { ok: boolean; message: string; state: GameState; battle?: BattleState; events: AgentEvent[] };
```

- 内部就是把 JSON 折成 `GameAction`，调 `act()`，再把 `battle`、`blockingIncidents` 折进返回值；
- **幂等**：请求带 `requestId`，同一 id 在 10 秒内重复提交直接返回上次结果（防 agent 重试导致双倍推进）；
- **限速**：同一页面每秒最多 8 次写动作，超出返回 `rate_limited`。

### 4.3 页面内桥：`window.__nightSugar`

只在显式开启时挂载（`?agent=1` 或 `localStorage['night-sugar:agent']==='on'`），默认不存在，不影响普通玩家：

```ts
window.__nightSugar = {
  ready: true,
  capabilities(): { version: number; actions: AgentActionSpec[] },
  snapshot(): AgentSnapshot,
  act(req: { requestId?: string; action: AgentRequestAction }): AgentResult,
  events(since: number): AgentEvent[],
  pause(): void;   // 人类接管：agent 的写动作被拒绝，直到 resume
  resume(): void;
};
```

- App 里用一个 `stateRef` 保存最新 state，桥的每次调用都基于它；写动作走现有的 `perform()` 路径（含弹窗副作用），但 agent 模式下**不弹模态**，把结果折进返回值。
- 桥挂在 `window` 上，进程外 agent 用 Playwright/CDP 的 `page.evaluate` 就能读写，不需要额外的服务端。

### 4.4 阻塞与相位

- `phase` 不是 `play` 时，桥只允许 `snapshot/capabilities`，写动作返回 `{ ok:false, reason:'not_in_play', hint:'先完成编成/序章' }`。
- 有 `blockingIncidents` 时，`advance`/`endNight`/`dispatch` 一律返回 `{ ok:false, reason:'blocked', blockers:[…] }`，agent 必须先 `resolveIncident`。
- 行动产生的战斗：agent 模式下不打开 `BattleReport`，把 `result.battle` 摘要放进返回值，并在 `events` 里追加一条；人类模式下仍照旧打开。
- 打烊：agent 的 `endNight` 直接结算，不需要 `#end-night-confirm`。

### 4.5 代理值班（B 层，可选）

`src/agentRunner.ts`：一个「节拍器 + 策略」循环，默认关闭，由设置页或 `?agent=1&run=1` 开启：

```ts
while (running) {
  const snap = snapshot();
  if (snap.blocked) await resolveBlockers(snap);
  else if (snap.shift.closed) await act({ type: 'endNight' });
  else await policy(snap);        // 派单 → 雇人 → 决议 → 推进
}
```

- 策略可以是最小规则（先派最紧急委托、有闲钱就雇 Lv 最高的卡），也可以外接模型；
- 循环每步之间 `await` 一次 `requestAnimationFrame`，避免把主线程占满；
- 人类一碰界面（键盘/鼠标）就 `pause()`，顶栏出现 `#agent-badge`「代理值班中 · 按 Esc 接管」。

### 4.6 UI

| 位置 | 改动 |
|---|---|
| 顶栏 | agent 模式下显示 `#agent-badge`（「代理值班中」/「已暂停」），点击暂停/继续 |
| 设置 → 一般 | 「agent 模式」开关（写 `localStorage`，刷新生效） |
| 弹窗 | agent 模式下 `IncidentDialog` 等仍渲染，但不阻塞桥；人类看不看都不影响 agent 的返回值 |
| 日志 | agent 动作写 `kind: 'story'`，文本前缀「代理：」，人类能在记录页回看 |

## 5. 状态与存储

| 项 | 改动 |
|---|---|
| `GameState.version` | **不变**（20）；agent 不改存档结构 |
| 新增存储键 | `localStorage['night-sugar:agent']='on'|'off'`、`night-sugar:agent-paused`（不进存档） |
| `window.__nightSugar` | 仅运行时，不落盘 |
| 日志 | 复用现有 `Log`，`kind` 仍用 `'story'`，不新增枚举 |
| 幂等记录 | 内存 Map（requestId → 结果），最多 200 条，刷新即失效 |

- 不做版本迁移：老档直接能开 agent 模式；关掉 agent 模式后一切照旧。

## 6. 安全

- 桥只在 `?agent=1` 或显式开关时挂载；普通玩家打开页面时 `window.__nightSugar === undefined`。
- 只在本机（`127.0.0.1` / 本地文件）提供；不开 CORS、不开远程监听。
- 快照不含密钥、提示词、立绘与本地路径；动作白名单不含删除/导入/改设置。
- 限速 + requestId 幂等；`pause()` 后所有写动作拒绝，人类优先。
- 浏览器直接暴露写接口有风险：文档与设置页明确写「只在自己机器上用，别把带 agent 模式的页面暴露到公网」。

## 7. 测试计划

### 7.1 状态测试（新增 `tests/agent.test.ts`，约 14 条）

1. `agentSnapshot` 的字段齐全、id 与 state 一致、不带立绘与密钥。
2. 快照大小：初始状态序列化 < 24KB。
3. `capabilities()` 列出 10 个写动作，且不含 `importCard`/`deleteMission`/`setPoolLimit`。
4. `applyAgentAction` 未知动作返回 `ok:false`，state 不变。
5. `advance` 正常推进；被阻塞时返回 `blocked` 且不推进。
6. `dispatch` 复用校验：疲劳/血量不足时失败。
7. `resolveIncident` 选完选项后 `blockingIncidents` 清空。
8. 同一 `requestId` 第二次提交返回缓存结果，不重复推进。
9. 每秒超过 8 次写动作返回 `rate_limited`（用注入的时钟）。
10. `phase !== 'play'` 时写动作被拒。
11. `endNight` 直接到次日 20:00。
12. `hire` 消耗星砂并把候选移进名册。
13. `events(since)` 只返回新事件，`seq` 单调。
14. `pause()` 后写动作被拒，`resume()` 恢复。

### 7.2 浏览器流程（100 → 102）

1. **agent 桥可用**：打开 `?agent=1` → `page.evaluate(() => window.__nightSugar.ready)` 为 true；`capabilities()` 至少 10 个动作；`snapshot()` 带 day/gold/girls。
2. **用桥玩一夜**：`act({type:'advance',minutes:30})` → 快照分钟 +30；`dispatch` 一条委托 → `missions` 里 squad 出现；`endNight` → day +1；全程无控制台错误。
   - 对照组：不带 `?agent=1` 打开，`window.__nightSugar` 为 `undefined`。

## 8. 实施顺序

1. `src/agent.ts`：快照、动作白名单、`applyAgentAction`、幂等/限速、事件折叠（纯函数，先写状态测试）。
2. `src/agentBridge.ts` + `src/App.tsx`：挂桥、`stateRef`、agent 模式下的弹窗/战斗分支、暂停/恢复。
3. `src/agentRunner.ts`（B 层，可选开关）：节拍器、最小策略、人类接管暂停。
4. UI：`#agent-badge`、设置页开关、日志前缀。
5. `tests/agent.test.ts`、`tests/browser.mjs` 两条、README / `tasks/todo.md` / 本文件的实际规模。

## 9. 风险与取舍

- **页面内桥 ≠ 进程外 API**：没有服务端，进程外 agent 必须借 Playwright/CDP 或浏览器扩展来调 `window.__nightSugar`。如果目标是「任意进程直接 HTTP 调用」，要再加一层 WebSocket 中继（见 §10-2），成本会翻倍。
- **快照与真实 UI 的相位**：`phase` 由 App 传进快照；如果 agent 在编成/序章阶段乱写，统一拒绝，不做自动跳过。
- **代理值班会「玩得太快」**：节拍器 + 限速 + 人类接管暂停；默认关闭，避免玩家一进来就看到游戏自己动。
- **日志噪音**：agent 每次动作都写日志，记录页会很吵；用「代理：」前缀 + 记录页按来源过滤（已有筛选）。
- **安全边界**：写接口只在本机、需显式开启；文档里明确不要把带 `?agent=1` 的页面放到公网。

## 10. 待确认

1. **「agent 模式」你指的是哪一层？**
   - A 外部 agent 通过结构化接口驱动（本方案主目标）；
   - B 游戏内「代理所长」自动运营（本方案第二层）；
   - C SillyTavern / 预设的 agent 扩展（function calling / `game_content`）——如果是这个，方案要改成「预设兼容层」：识别 SPreset 的 agent 词条、给出警告或映射成游戏内的动作，不通用。
2. **进程外 agent 需要 HTTP 吗？** 如果 DSH/脚本能开浏览器，页面内桥就够了；如果要 `curl` 直接调用，需要加一个本地 WebSocket 中继（浏览器连服务端，服务端转发 JSON），规模 +1 天。
3. **代理值班的最小策略**用本地规则（不回模型），还是第一版就接模型？我按本地规则设计，模型版留到 v29。
4. **授权粒度**：agent 是否可以花星砂（雇人、升级市场、买物资）？我按「可以，但单次动作受现有校验约束」设计；如果要更保守，可以加一个「只读快照」模式先跑观察。
