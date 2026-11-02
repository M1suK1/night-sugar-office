# v33 方案：洞察命中 / 敏捷闪避与速度、完成与升级提示、手动加点

> 目标一句话：让四项数值各自承担明确职责，不再让敏捷同时垄断命中、闪避和先手；完成任务与升级要看得见；升级后的成长点交给玩家分配。

## 1. 范围

| # | 问题 | 主要落点 | 规模 |
|---|---|---|---|
| 1 | 敏捷同时影响命中与闪避，洞察只影响先手，数值价值失衡 | `src/combat.ts` 的命中公式、`initiativeOf`、`BattleReport.tsx` 的结算说明 | 战斗公式 + UI 文案 |
| 2 | 完成任务、角色升级没有明确提示 | `src/game.ts` 结算与 `grantExp`、`src/App.tsx`、通知组件 | 事件队列 + toast/通知 |
| 3 | 升级自动加三维，玩家无法决定成长方向 | `src/progression.ts`、`Girl`/`GameState`、`CharacterDialog.tsx`、`Roster.tsx` | 状态 + 加点 UI + 迁移 |

不做：

- 不改伤害公式、技能倍率、护持/心防与战斗回合数。
- 不重新设计四项属性的命名或角色卡的四维范围。
- 不强制旧存档把已经获得的自动成长退洗；迁移只影响以后升级。
- 不把战斗札记和战斗结算重写。

## 2. 现状

### 2.1 命中与先手

`battle()` 里当前是：

```ts
chance = clamp(10, 95, baseAccuracy + agility - targetAgility + bonus)
```

`initiativeOf()` 当前是：

```ts
statOf(unit, 'insight') + roll + bonus
```

同时：

```ts
const hit = skill.side !== 'enemy' || roll <= chance;
```

也就是**玩家技能必中**，命中率实际只约束敌方攻击。结果是：

- 敏捷：提高敌人命中所需对抗、降低自己被命中，还影响敌方先手（因为敌方也用敏捷算命中）。
- 洞察：只影响先手顺序，且对玩家自己的攻击完全不产生命中收益。
- 玩家堆洞察的收益远低于堆敏捷，数值价值失衡。

### 2.2 升级

`grantExp`（`progression.ts:31`）升级时固定：

- 主属性 +2
- 副属性 +1
- 最大生命 +4
- 心防按共情重算

玩家没有选择权，职阶决定一切。

### 2.3 提示

委托完成只在日志里写一条；升级只改数值，没有独立提示。`perform()` 的 `notify` 是单条 toast，时间推进一次可能同时完成多个委托/多人升级，单条 toast 会互相覆盖。

## 3. 数值设计

### 3.1 职责表

| 属性 | 新职责 | 不再负责 |
|---|---|---|
| 魔力 | 伤害倍率 | — |
| 洞察 | **命中率**：攻击方洞察高于目标敏捷时更容易命中 | 先手 |
| 敏捷 | **闪避率 + 速度值**：提高先手，降低自己被命中 | 攻击方命中 |
| 共情 | 心防、护持、共情技 | — |

### 3.2 命中公式

新增可读函数，避免公式散在循环里：

```ts
export function hitChanceOf(attacker: BattleUnit, target: BattleUnit, skill: Skill): {
  base: number; insight: number; targetAgility: number; bonus: number; chance: number;
}
```

建议公式：

```ts
base = skillAccuracy(skill);                 // 单体 50，群体按目标数递减
insightEdge = (statOf(attacker, 'insight') - statOf(target, 'agility')) * 0.5;
chance = clamp(30, 95, base + insightEdge + hitBonus(attacker));
```

- **不加任何基础补偿**：同属性 50 对 50 时单体命中就是 50%。
- 洞察 90 对敏捷 50：`50 + 20 = 70`。
- 洞察 40 对敏捷 80：`50 - 20 = 30`。
- 群体技的基础仍然低，命中修正照常生效；最低 **15%**，避免完全无法命中。
- `hitBonus`（疤痕、命中 buff/debuff）继续叠加，不再混入敏捷。
- 因为难度上升，升级点数同步提高（见 5.2），用成长来补偿命中劣势。

**攻击双方都掷骰**（治疗与增益不掷）：

```ts
const offensive = skill.side === 'enemy';
const roll = offensive ? rng() * 100 : 0;
const hit = !offensive || roll <= chance;
```

不再保留“玩家技能必中”。这会改变战斗节奏，必须通过固定种子回归测试重新校准；校准只允许调整最低命中阈值与升级成长，不再把洞察移出命中公式，也不加回基础补偿。

### 3.3 先手/速度

```ts
export function speedOf(unit: BattleUnit): number {
  return statOf(unit, 'agility') + effectBonus(unit, 'initiative') + (unit.initiativeBonus ?? 0);
}
export function initiativeOf(unit: BattleUnit, roll: number): number {
  return speedOf(unit) + roll;
}
```

- 敏捷同时决定“速度值”和先手，符合“敏捷提供闪避率和速度值”。
- 洞察不再进入先手；高洞察角色靠命中而不是抢跑。
- `insightRoll` 字段保留名字以兼容旧战报，内部改称速度掷骰；新增 `speed` 展示时从 `speedOf` 计算。
- `effect.stat` 仍支持 `initiative`（先手 buff/debuff）与 `hit`（命中修正）；不新增复杂的效果类型。

### 3.4 展示

- `BattleReport.calcText` 改为：
  `命中 72% ＝ 基础 50 + 补偿 20 + 洞察 78 − 敌敏 62（修正 +2）；d100 41 → 命中`
- 兼容旧战报：`calc.hit` 没有 `insight` 字段时继续用旧的“敏捷/敌敏”文案，不报错。
- 档案/技能详情增加一句：“洞察提高命中；敏捷提高闪避与先手。”
- 数值说明、世界书、帮助页同步。
- 战斗札记摘要改回「带技能名与用途」的版本：支援/护持/回复不再被写成向队友出手；正文允许引用技能名，只禁止伤害与回合数值。

## 4. 完成与升级提示

### 4.1 通知数据

```ts
export interface GameNotice {
  id: string;
  kind: 'mission' | 'level';
  day: number;
  minutes: number;
  title: string;
  text: string;
  girlId?: string;
  missionId?: string;
}
```

`GameState` 增加：

```ts
notices?: GameNotice[]; // 最近 20 条，新的在前
```

### 4.2 写入时机

- 战斗/调查完成（`mission.status = 'done'`）：
  `mission` 通知，标题为委托名，正文写报酬、 scarring/伤势摘要与参战者。
- 角色升级：`grantExp` 返回 `LevelUpResult`：
  ```ts
  { leveled: boolean; levels: number; from: number; to: number; points: number }
  ```
  调用方写 `level` 通知：`月见桃升到 Lv.7，获得 3 点可分配属性。`
- 一次推进完成多个委托/多人升级：按发生顺序 push，不覆盖。

### 4.3 展示

- `App` 维护 toast 队列，不再用单一 `toast` 覆盖：
  - 通知到达时入队，逐条显示 4.5 秒；
  - 最多同时显示 3 条，其余排队；
  - 点击通知打开对应角色/战斗记录。
- 顶栏铃铛显示未读点；`NotificationsDialog` 的列表顶部加入 `notices`（委托完成 / 升级），日志继续保留。
- 完成任务通知不阻塞操作；不要求玩家点确认。

## 5. 手动加点

### 5.1 状态

`Girl` 增加：

```ts
unspentPoints?: number;   // 可分配属性点
```

`GameState` 增加：

```ts
levelUpMode?: 'auto' | 'manual'; // 新档默认 manual；旧档迁移为 auto
```

### 5.2 升级行为

- `mutual`：
  - 升级时 `unspentPoints += 10`，不自动加主/副属性；
  - 最大生命每级 **+10**，心防按共情重算（生命成长不属于四维点）；
  - 玩家在角色档案 →「契约成长」分配。
- `auto`：
  - 主属性 +6 / 副属性 +4（合计 10 点，与手动同值，不因模式吃亏）；
  - 最大生命每级 +10；
  - `unspentPoints` 不变。
- 旧档：
  - `levelUpMode ??= 'auto'`，`unspentPoints ??= 0`；不追溯退点。
  - 设置页提供「升级加点：自动 / 手动」开关；切换只影响之后升级。
- 新档：`levelUpMode: 'manual'`，初始 `unspentPoints: 0`。

### 5.3 加点规则

- 每点 +1 四维之一；每次操作 1 点。
- 四维上限 120（与战斗 `statOf` 的 220 上限分开）；不能超过。
- 共情加点后立即重算 `maxSpirit` 与当前心防（不超过新上限）。
- 生命/心防不因加点直接增加，避免“全点共情 = 无限心防”的二次收益；心防只按共情公式重算。
- 新增 `GameAction`：
  ```ts
  | { type: 'allocateStat'; girlId: string; stat: StatKey; amount?: number }
  ```
  reducer 校验 `unspentPoints`、上限、角色状态；返回清晰错误。

### 5.4 UI

- 角色档案 →「契约成长」：
  - 顶部显示 `可分配点数 N`；
  - 四维各一行，右侧 `+1` 按钮；点满/无点数时禁用；
  - 显示「推荐分配」（按职阶给主/副属性各 2/1）作为一键建议，不自动执行。
- 名册头像/等级旁显示小角标 `+N`，提示有未分配点。
- 设置页加入「升级自动加点」开关，默认关闭（手动）。
- 角色卡导出/导入带上 `unspentPoints` 与 `levelUpMode`？`levelUpMode` 是存档级，不随卡；`unspentPoints` 随角色卡保留。

## 6. 兼容与迁移

- 旧战报的 `calc.hit` 没有 `insight` 字段：展示层回退旧文案；重新战斗才使用新公式。
- 旧存档 `levelUpMode` 缺失 → `auto`，不改变已有角色属性。
- `grantExp` 返回值从 `boolean` 改为对象：更新 3 处调用（战斗、调查、日常经验），旧测试同步。
- `unspentPoints` 缺失按 0；导入旧卡不报错。
- 新公式会让现有战斗结果变化；固定种子测试需要重新校准期望值，不能只改文案。

## 7. 测试

### 7.1 数值

- 同洞察/敏捷 50：单体命中约 70%；洞察 90 对敏捷 50 命中约 90%；洞察 40 对敏捷 80 命中约 50%；群体技不低于 30%。
- 双方都掷骰：固定种子下玩家可以落空、敌人也可以落空。
- `initiativeOf` 只读敏捷：洞察变化不改变先手；敏捷 +10 先手提高 10。
- 旧 `calc.hit` 数据仍能生成战报文案。
- 固定队伍打固定委托的胜率/回合数在可接受区间；必要时只调补偿值。

### 7.2 通知

- 完成一场战斗/调查 → `notices` 多一条 mission，标题/报酬正确。
- 连续完成两场 + 两人升级 → 4 条通知都保留，不被覆盖。
- 通知点击打开对应角色/战斗记录。
- 刷新后未读点仍在，打开通知后清零。

### 7.3 加点

- 新档 `levelUpMode='manual'`；升级后 `unspentPoints=3`，属性不变，HP +4。
- `allocateStat` 扣点、加属性、上限 120、无点数拒绝；共情加点重算心防。
- 自动模式仍按主 +2 / 副 +1。
- 旧档迁移为自动模式且不补发点数。
- 角色卡导出/导入保留 `unspentPoints`。

### 7.4 浏览器

- 档案成长页加点按钮可用，点数从 3 → 0，四维显示更新。
- 名册 `+N` 角标出现/消失。
- 完成任务后 toast 与通知列表出现；多人升级时逐条显示。
- 设置切换自动/手动后，下一次升级行为正确。

## 8. 风险

| 风险 | 处理 |
|---|---|
| 玩家攻击从必中变成掷骰，难度上升 | 基础补偿 +20，最低 30%；固定种子回归，必要时调补偿不调洞察职责 |
| 洞察/敏捷旧角色价值突变 | 旧档不追溯属性；新公式统一作用于之后战斗 |
| 手动加点导致角色长期不成长 | 名册角标 + 通知 + 推荐分配；设置可切回自动 |
| 全点共情导致心防膨胀 | 加点只重算公式，不额外加心防；上限 120 |
| 提示太多淹没界面 | toast 队列最多 3 条、4.5 秒；通知中心保留最近记录 |

## 9. 实施顺序

1. `combat.ts`：`hitChanceOf`、双方掷骰、`speedOf`/`initiativeOf`、`BattleReport` 文案。
2. `types.ts` + `progression.ts`：`GameNotice`、`unspentPoints`、`levelUpMode`、`grantExp` 返回结构。
3. `game.ts`：完成/升级写通知、`allocateStat`、迁移。
4. `App.tsx` + 通知组件：toast 队列、铃铛未读、通知列表。
5. `CharacterDialog` / `Roster` / 设置：加点面板与自动/手动开关。
6. 测试、构建、浏览器验收、README/todo 记录。
