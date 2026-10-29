# v20 方案：技能池扩容与命中率、弹窗事件体系、任务面板、势力冲突、主动离职、多结局故事线

> 状态：方案稿，等确认后开工。范围只写本版要做的六件事，不夹带。

## 0. 总览

| # | 需求 | 一句话定案 |
| --- | --- | --- |
| 1 | 技能池到 50 个 | 50 条一个池子，少女和魔物共用；每个技能自带基础命中率，替代写死的 50，目标越多命中越低；Boss 另有独立技能组（`tier: boss`，不进池子）；自定义少女按流派 + 阶级筛选 |
| 2 | 弹窗事件 | 内置 10 个可过期事件；池子不足 10 个时每天开门让叙事者补；支持定时、委托完成、条件三种触发；三种形态：通报 / 抉择 / 直接进角色剧情 |
| 3 | 首页左上任务面板 | 一个常驻小卡，汇总势力任务、故事线当前段、到点委托与待决事项，点条目直达 |
| 4 | 势力之间开战 | 三方两两之间有一组**敌意值**：弹窗事件、势力委托、辖区易主都会加，满了（100）次夜开门直接生成战线；战线里玩家可选边参战或观望，打完改辖区归属 |
| 5 | 主动离职 | 好感过低、长期高疲劳、欠约太久会先警告再走人；不碰侵蚀度 |
| 6 | 故事线多结局 + 多线门禁 | 蓝图至少两个不同结局，校验不过就重写；一个角色可以有多段故事线，必须完成上一段才解锁下一段 |

版本：`GameState.version` 12 → **13**。`loadState` 接受 `1, 3..13`，旧存档补齐新字段后照常开局，不清空任何数据。

---

## 1. 技能池与基础命中率

### 1.1 现状

- `src/content/skills.ts` 共 29 条：少女 18 条（星光 / 糖霜 / 月影 / 梦境 / 自然 / 赤焰 各 3）+ 魔物 10 条 + `night-prayer` 1 条。三条一组：`basic` / `signature` / `ultimate`。
- `Skill` 只有 `power / targets / cooldown / tier / effects / resource`，没有命中率。
- `src/combat.ts:315-321` 把命中写死成全局 50：

```ts
const chance = clamp(15, 95, 50 + agility - targetAgility + bonus);
const roll = skill.side === 'enemy' ? rng() * 100 : 0;
const hit = skill.side !== 'enemy' || roll <= chance;
```

`bonus` 来自伤疤与 buff/debuff 的 `hit` 项，`roll` 只对敌方技能生效（我方必中）。

### 1.2 数据模型

`Skill` 新增三个可选字段：

```ts
export interface Skill {
  /* 既有字段不变 */
  /** 基础命中率（%）：写在技能上，替代原来写死的 50。 */
  accuracy?: number;
  /** 自身代价：施放时按比例扣自己的资源，或给自己挂状态。 */
  selfCost?: { resource: SkillResource; pct: number } | null;
  selfEffects?: SkillEffect[] | null;
}
```

- `accuracy` 缺省时按目标数推导，保证旧存档、内容工坊旧技能、魔物技能的行为可预期：
  `defaultSkillAccuracy(targets) = 50 - 6 * (targets - 1)`，夹在 `20–95`：1 目标 50、2 目标 44、3 目标 38、4 目标 32、5 目标 26、6 目标 20。
- **目标数上限 6**（`MAX_SKILL_TARGETS`）：群体技能写满 6 个目标，奥义写 1–3 个目标。
- 新写的 50 条技能全部显式写 `accuracy`，不用推导值，这样数值是「设计出来的」而不是「算出来的」。
- `selfCost`：`pct` 相对**当前**值还是**上限**？定案：相对上限，`Math.max(1, Math.round(maxHp * pct / 100))`，且**不会把自己扣死**——扣到只剩 1 点为止；共情值同理。扣的是「施放成本」，不吃护盾。
- `selfEffects`：施放成功后挂到自己身上，绕过命中判定，`chance` 仍然生效（可以写「30% 概率自伤加倍」这种）。

### 1.3 命中公式

在 `src/combat.ts` 抽出纯函数，便于单测：

```ts
export function defaultSkillAccuracy(targets: number): number {
  const count = clamp(1, 6, Math.round(targets || 1));
  return clamp(20, 95, 50 - 6 * (count - 1));
}
export function skillAccuracy(skill: Skill): number {
  const base = skill.accuracy ?? defaultSkillAccuracy(skill.targets);
  return clamp(20, 95, Math.round(base));
}
export function hitChanceOf(attacker: BattleUnit, target: BattleUnit, skill: Skill): { base: number; chance: number } {
  const base = skillAccuracy(skill);
  const chance = clamp(10, 95, base + statOf(attacker, 'agility') - statOf(target, 'agility') + hitBonus(attacker));
  return { base, chance };
}
```

- 下限从 15 放到 10：高闪避的敌人可以真的把多目标高伤技能几乎躲干净，但永远保留一线命中。
- `hitCalc` 的 `base` 字段改成实际基础命中，战斗回放的断言不受影响（回放读的是 `chance` 与 `hit`）。
- 我方增益/治疗技能维持必中（`side !== 'enemy'` 直接算命中），不引入「奶空了」这种挫败感。

### 1.4 数值护栏

- `power` 与 `accuracy` 反向挂钩，避免「高倍率 + 高命中」：

| 档位 | power | accuracy | 目标数 | 说明 |
| --- | --- | --- | --- | --- |
| 基础 | 0.85–1.05 | 55–65 | 1 | 稳定输出 |
| 本职 | 0.90–1.25 | 45–60 | 1–2 | 带一个状态 |
| 本职·群体 | 0.42–0.60 | 26–38 | 6 | 清场用，倍率随目标数摊薄，最容易空 |
| 奥义 | 1.30–1.75 | 30–50 | 1–3 | 大伤，最多三个目标 |
| 自损型 | 1.60–2.10 | 60–70 | 1 | 自扣 15–30% 血或共情，换高倍率 |
| 自咒型 | 1.50–1.90 | 55–65 | 1–3 | 打完给自己上减益 |

硬约束（写进 `skills.test.ts` 风格的用例）：
- 单条 `power ≤ 2.10`，`accuracy ≤ 75`。
- `targets ≥ 4` 的技能 `power ≤ 0.60`（目标越多倍率越低）。
- `tier === 'ultimate'` 的 `targets` 必须落在 `1–3`。
- `selfCost` 的 `pct ≤ 30`。
- 每条技能 `effects` ≤ 2 项，`selfEffects` ≤ 1 项。

### 1.5 技能池：50 条，少女与魔物共用

**一个池子，不分家。** 现在 `skillById` 本来就只认 id，少女的 `skills` 与魔物的 `skillIds` 都从同一张表取。本版把这条讲明白并写进校验：**50 条技能全部对魔法少女与魔物开放**，魔物抢到「糖色庇护」、少女打出「空月凝视」都合法，只要 `side` 对得上。

- 现有 29 条 + 新增 21 条 = **50**。
- 新增分布：六系各 2 条（星光 / 糖霜 / 月影 / 梦境 / 自然 / 赤焰，共 12）、魔物系 4 条、通用 5 条 = 21 条。
- `school` 只当**流派标签**用（也是筛选条件），不再是「谁能用」的开关。`魔物` 系的 4 条新技能只是「写起来更像怪物」，少女想用也拦不住——那是玩家自己的审美选择。
- 通用档新增 5 条，另有既有的 `night-prayer` 也归进这一档。通用档是给「无所属」出身、自定义登记、以及任何想把流派当摆设的人用的：

| id | 名字 | 流派 | 资源 | power | targets | accuracy | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `plain-strike` | 素手 | 通用 | hp | 1.00 | 1 | 60 | 无消耗，任何人的底牌 |
| `steady-hand` | 稳手 | 通用 | hp | 0.90 | 1 | 68 | 命中最高的一档，代价是自挂「洞察 −6 · 1 轮」 |
| `borrowed-time` | 借来的时间 | 通用 | spirit | 0 | 1 | 必中 | 自己回 12 共情，自挂「敏捷 −10 · 2 轮」 |
| `cut-loss` | 止损 | 通用 | hp | 0.46 | 6 | 26 | 自扣 8% 血，群体 |
| `hold-the-line` | 守住门口 | 通用 | spirit | 0 | 2 | 必中 | 护盾 20 · 2 轮 |
| `night-prayer` | 夜祷 | 通用 | spirit | 0.85 | 2 | 52 | **现有技能**，本版归到通用 |

自损 / 自咒 / 多目标 / 上状态的写法示例（会真的进池子）：

| id | 名字 | 流派 | 资源 | power | targets | accuracy | 关键效果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `red-reckoning` | 赤色清算 | 赤焰系 | hp | 1.85 | 1 | 62 | 自扣 22% 血 |
| `candy-oath` | 糖誓反噬 | 糖霜系 | spirit | 1.70 | 1 | 58 | 自挂「共情 −14 · 2 轮」 |
| `dream-loan` | 借梦 | 梦境系 | spirit | 1.55 | 2 | 44 | 自扣 18% 共情，目标 stun 30% |
| `thorn-garden` | 荆棘庭园 | 自然系 | hp | 0.52 | 6 | 26 | dot 12 · 3 轮，群体 |
| `star-tax` | 星税 | 星光系 | spirit | 0.50 | 6 | 28 | 目标「魔力 −10 · 2 轮」，群体 |
| `silent-tithe` | 静默什一税 | 月影系 | spirit | 1.15 | 2 | 46 | 命中后自己「洞察 −8 · 1 轮」 |

魔物系新增 4 条：`monster-rot 腐糖`（6 目标 dot 12·3，power 0.46，命中 26）、`monster-lullaby 摇篮曲`（单体 stun 50%，命中 42）、`monster-armor 糖壳`（自身护盾 26·2，必中）、`monster-frenzy 狂糖`（自 buff 魔力 18·1，自 debuff 敏捷 12·2，命中 58）。

### 1.6 Boss 独立技能组

Boss 不进这个池子，避免「随机一个少女也会空月的手」。做法：

- `SkillTier` 加 `'boss'`，专属技能放 `src/content/bossSkills.ts`，共 8 条，**只能由 Boss 使用**。
- 池子函数集中在新文件 `src/skills.ts`：
  ```ts
  export function girlSkillPool(): Skill[];      // 50 条，排除 tier === 'boss'
  export function monsterSkillPool(): Skill[];   // 50 条，排除 tier === 'boss'
  export function bossSkillPool(): Skill[];      // 8 条 boss 专属
  export function skillsOfSchool(school: string): Skill[];
  ```
- `MonsterTemplate` 加两个可选字段：`bossSkillIds?: string[]`、`bossPhaseSkillIds?: string[]`。
- 空月本体 `hollow-moon` 的两阶段：
  - 第一形态（hp ≥ 50%）：`boss-hollow-veil 空月纱`（全场命中 −10 · 2 轮）、`boss-tide-of-names 名字的潮`（3 目标 dot 16·2，命中 40）。
  - 第二形态（hp < 50%，回合开始时换组）：`boss-second-moon 第二个月亮`（自 buff 魔力 20 · 3 + 群体 stun 25%）、`boss-collapse 塌缩`（单体 2.0、自扣 20% 血、命中 66）。
- 换组时机与提示：`combat.ts` 里 Boss 单位在每轮开始检查 `hp < maxHp / 2`，把 `skills` 换成 `bossPhaseSkillIds`，并在 `notes` 写一条「空月把另一面翻了过来」，玩家能在回放里看到，不至于莫名其妙挨新招。
- 校验护栏：
  - `girlSkillPool()` / `monsterSkillPool()` 不返回 `tier === 'boss'`；契约卡导入、自定义少女、内容工坊的自定义技能都只在这两个池子里选。
  - `sanitizeCustomSkill()` 拒绝 `tier: 'boss'`。
  - 状态测试断言：任一非 Boss 单位不会带 `tier === 'boss'` 的技能；`bossSkillIds` 里的 id 必须存在且 tier 为 boss。

### 1.7 自定义少女与内容工坊：按流派、阶级筛选

- 自定义少女（`CustomGirlDialog.tsx`）的技能区改成「可筛选的三选」：
  - 流派筛选 `#custom-skill-filter-school`：全部 / 星光系 / 糖霜系 / 月影系 / 梦境系 / 自然系 / 赤焰系 / 魔物系 / 通用。进面板时默认选中该少女的流派（自定义时没流派就选「全部」）。
  - 阶级筛选 `#custom-skill-filter-tier`：全部 / 基础 / 本职 / 奥义（`basic / signature / ultimate`）。
  - 列表条目 `#custom-skill-{id}`，右侧角标显示 `命中 62% · 2 目标`，Boss 技能**不出现在列表里**。
  - 已选三条 `#custom-skill-picked`，与现有「必须三个不同技能」的校验一致；同流派技能仍推荐但不强制。
- 内容工坊的自定义技能表单加四项：`accuracy`（滑块 20–95，留空走推导）、`selfCost`（资源 + 百分比）、`selfEffects`（最多 1 条，走模板下拉）、`school` 下拉（含通用，不含 Boss）。
- `src/content/effectPresets.ts` 增 4 个模板：`血偿`（drain 25）、`净化之息`（purify 2）、`自伤换势`（自扣 15% 血 → buff 魔力 14·2）、`过载`（自 debuff 敏捷 12·2）。
- 校验：`sanitizeCustomSkill()` 里加 `selfCost.pct ∈ [5, 30]`、`accuracy ∈ [20, 95]`、`tier !== 'boss'`，超界直接夹紧而不是拒绝整条技能。

### 1.8 效果种类

`SkillEffect['kind']` 现有 `dot | stun | shield | buff | debuff | regen`。新增两种，让「吸血」和「净化」不必拿 buff 硬凑：

```ts
export type SkillEffectKind = 'dot' | 'stun' | 'shield' | 'buff' | 'debuff' | 'regen' | 'drain' | 'purify';
```

- `drain`：伤害后按 `amount`（百分比）把实伤的一部分回给自己；`drain` 只对本回合那次伤害生效，不产生持续状态，因此**不进入** `ActiveEffect`，在 `combat.ts` 结算伤害的同一段里处理。
- `purify`：命中后清除目标身上至多 `amount` 条减益（`kind === 'debuff' | 'dot'`）；Boss 拿它清自己的负面，我们拿它清魔物的增益，两边都能用。
- 两者都要在 `effectKindLabels`、`EFFECT_CATEGORIES`（`sustain` / `control`）里登记，内容工坊的下拉会自动带上。

### 1.9 UI

- `MissionDialog` 与战斗回放里显示技能备注：`命中 62% · 2 目标 · 自扣 22% 血`。加在 `effectText` 旁边，即 `src/content/skills.ts` 的 `skillSummary(skill)`。
- 技能卡右上角加阶级角标：基础 / 本职 / 奥义 / **Boss**（`boss` 用另一套颜色，只在 Boss 战斗与图鉴里出现）。
- 战斗回放的落空行已有「攻击落空」，补上基础命中：`攻击落空（基础 34 + 命中修正 …）`，复用 `hitCalc`。

### 1.10 战斗任务：魔物上限 6 与群体目标

- 新增常量（`src/combat.ts`）：`MAX_ENEMIES = 6`、`MAX_SKILL_TARGETS = 6`。
- 一场战斗最多 6 只魔物；`annotateMission`、`missionSeed`、`storyMissionForBeat` 与叙事者生成的委托都在落库前 `slice(0, MAX_ENEMIES)`，多出来的静默丢弃，不报错。
- 群体技能（`side === 'enemy'` 的多目标技能）目标数写满 6，倍率随目标数摊薄到 `0.42–0.60`；奥义目标数落在 `1–3`。
- 工坊的委托编辑从 3 个魔物槽位放开到 6 个（`MAX_ENEMIES`）。
- 我方侧的多目标技能（护盾 / 恢复）同样按 6 写，实际只会命中在场的人，`pickTargets` 自己会截断。

---

## 2. 弹窗事件体系

### 2.1 现状

- `Incident`：`kind: 'faction' | 'environment' | 'girl'`，只有 `options`，没有过期、没有触发条件、没有「纯通报」形态。
- 生成点只有两处：`makeRuleIncident()`（三条写死的规则）与 `rollPoolIncident()`（内容工坊随机池），都在 `endNight()` 里各抽一次。
- 待处理上限写死 3（`makeRuleIncident` / `rollPoolIncident` 都判 `>= 3` 直接返回）。`App.tsx:748` 用 `state.incidents.find(pending)` 一次只弹一个，强制处理才能推进时间。
- 已有的 LLM 入口 `generateIncident()`（`src/llm.ts:1178`）能生成**一个**事件，带 3 个选项，由设置页的「强制事件」按钮手动触发。

### 2.2 数据模型

```ts
export type IncidentCategory = 'report' | 'decision' | 'scene';

export type IncidentTrigger =
  | { kind: 'dayStart' }
  | { kind: 'wave'; wave: number }
  | { kind: 'missionDone'; work?: Mission['work']; district?: DistrictId }
  | { kind: 'condition'; all: IncidentCondition[] };

export interface IncidentCondition {
  field: 'reputation' | 'gold' | 'faction' | 'pollution' | 'bond' | 'fatigue' | 'day' | 'girlCount';
  faction?: FactionId; district?: DistrictId; girlId?: string;
  op: '<' | '<=' | '>' | '>=' | '=='; value: number;
}

export interface Incident {
  /* 既有字段保留 */
  category?: IncidentCategory;        // 缺省按 options.length 推断：0/1 → report，≥2 → decision
  trigger?: IncidentTrigger;          // 记录它是怎么来的，日志与测试用
  ttlMinutes?: number;                // 存活时长，缺省 240
  expiresAt?: number;                 // 绝对分钟，endNight/advance 里判定过期
  expiredBy?: 'time' | 'superseded';
  scene?: IncidentScene;              // category === 'scene' 时的剧情内容
}

export interface IncidentScene {
  title: string; narration: string;
  lines: { speakerId?: string; speaker: string; tone?: string; text: string }[];
  /** 看完剧情的收尾效果，可以是空的。 */
  effect?: IncidentEffect;
}
```

- `options` 允许为空数组：空数组 = 纯通报，弹窗只显示「知道了」。
- 过期语义：`expiresAt` 到了还没处理 → `status: 'expired'`，应用 `expireEffect`（缺省 `{ reputation: -1 }`），写日志，**不再阻塞时间推进**。这是「可以过期」的真正含义：不处理也有代价，但不卡死。
- 待处理上限从 3 提到 **5**（含 scene），超出时新事件进 `state.incidentQueue` 排队，处理掉一个就顶上来。

### 2.3 内置 10 个事件

新文件 `src/content/incidents.ts`，导出 `builtinIncidents: BuiltinIncident[]`。每个含 `id / category / trigger / title / body（可用 {district} {girl} {faction} 占位）/ options / ttlMinutes / cooldownDays`。占位符在投放时用 `fillIncidentText(state, template)` 填。

| id | 形态 | 触发 | 内容要点 |
| --- | --- | --- | --- |
| `news-sugar-tax` | report | dayStart | 世界新闻：市役所加征夜巡税，附一句势力反应 |
| `news-clinic-queue` | report | condition 疲劳 ≥ 60 的少女 ≥ 2 | 世界新闻：月光诊所排起长队 |
| `faction-ultimatum` | decision | condition 某势力 < 35 | 势力施压（迁走现有规则事件，补上势力名与辖区） |
| `faction-patrol` | report | wave ≥ 1 | 某势力巡夜队路过门口，留下话 |
| `battle-aftermath` | report | missionDone combat | 上一场战斗的街坊反馈，附带安定度 ±1 |
| `girl-insomnia` | scene | condition 某少女疲劳 ≥ 80 | 直接进一段 3 句对白，收尾让玩家选「陪她坐一会 / 让她睡」 |
| `girl-letter` | scene | dayStart，随机一位好感 ≥ 30 | 她留了一封信，读到一半她本人出现 |
| `env-fog` | decision | wave ≥ 2 | 雾从辖区边缘渗进来（迁现有环境事件） |
| `env-blackout` | decision | condition 污染 ≥ 50 | 供灯线路跳闸，要不要动用储备星砂 |
| `market-rumor` | report | dayStart | 市场上有人打听事务所，指向一位候选者 |

- `cooldownDays`：同一条内置事件在 N 天内不重复（缺省 7），避免天天见同一张。
- 每条都要能在**没有 LLM**的情况下完整玩：纯本地文案，不依赖模型。
- 另有三条**战争预兆**模板（`war-signal-street` / `war-signal-patrol` / `war-signal-hoard`），见 §4.3。它们不算在这 10 条里：某对势力的敌意进到 `friction` 以上才会参与投放，且优先级最高（每天最多投一条，按 tier 决定是否必投）。

### 2.4 触发引擎

新文件 `src/incidents.ts`：

```ts
export function fillIncidentText(state: GameState, template: BuiltinIncident): { title: string; body: string; girlId?: string; faction?: FactionId; district?: DistrictId };
export function conditionMet(state: GameState, condition: IncidentCondition): boolean;
export function dueIncidents(state: GameState, cause: 'dayStart' | 'wave' | 'missionDone', at: { day: number; minutes: number }): Incident[];
export function expireIncidents(state: GameState, at: { day: number; minutes: number }): Incident[];
```

- `dueIncidents` 是纯函数：吃 `state` 与触发原因，返回**该投放的事件**（已被 cooldown、队列上限、当天已出现过筛掉）。
- 三个调用点：
  1. `endNight()`：`cause: 'dayStart'`，顺带跑 `expireIncidents()`。
  2. `syncShift()` 里 wave 变化时：`cause: 'wave'`。
  3. `settleCombat()` / `settleInvestigation()` 结束：`cause: 'missionDone'`。
- `advance()` 每次推进前先 `expireIncidents()`，保证过期事件不会卡住「必须处理才能推进」的判定。

### 2.5 叙事者每天补充

- 新状态：`state.incidentPool: PooledIncident[]`（已生成、还没投放的事件），`state.incidentSeq: number`。
- 开门时 `topUpIncidentPool(state)`：
  - `need = 10 - (incidentPool.length + 当天未投放的内置可用条数)`，`need <= 0` 直接返回。
  - `need > 0` 且有 API Key → 调 `generateIncidents(config, state, min(3, need))`（**一次调用**返回 1–3 条），成功的写进 `incidentPool`；失败的条数用内置模板兜底（循环用 `builtinIncidents` 里没用过的）。
  - 上限：一晚最多补 3 条、池子最多 10 条，避免大会话成本。
- `generateIncidents`：
  - 复用 `preset` scope `'incident'`，新 body 要求输出 `{"incidents":[{title, body, category, girlId?, faction?, district?, options:[{label,hint,effect}]}]}`。
  - 校验：`title ≤ 22`、`body ≤ 160`、`category ∈ {report,decision,scene}`；`report` 允许 0 选项；`decision` 必须 2–3 选项且效果不全相同；`scene` 必须带 `lines`（2–4 句）。
  - 不合格的条目**逐条丢弃**，不整批失败；全丢光就返回 `ok: false` 走兜底。
- 叙事者的弹窗**可以**牵动敌意，但只走同一条 `applyHostility` 通道：选项可带 `hostility: { pair, delta }`，`delta` 夹在 `±3` 以内、一条事件最多影响一对势力；模型**不能**直接判定开战，也不能把某对的 `value` 一次推满。校验时超界的条目按上限夹紧而不是丢弃。
- LLM 也要能写「世界新闻」：prompt 里给当前污染、势力态度、最近三条日志作为素材，禁止编造不存在的辖区/势力 id。
- 预算：新增 `incidentBatch` 预算项，沿用 v20 之前的预算体系（统一值 + 单项覆盖），默认 900 tokens。

### 2.6 UI

- `IncidentDialog` 改造（不加新弹窗，避免打断节奏）：
  - 头部按 `category` 换徽标：通报 / 抉择 / 剧情，`id: incident-category`。
  - 通报形态：正文下方只有一个按钮 `#incident-ack`（「知道了」），走 `resolveIncident(..., optionId: 'ack')`。
  - 抉择形态：保持现有 `#incident-option-{id}`。
  - 剧情形态：正文上方渲染 `scene.narration` 与逐句对白（复用 `.story-line` 样式），看完再选；对白用 `#incident-line-{i}`。
  - 右上角显示剩余时间：`#incident-expiry`（「还有 3 小时」/「今晚结束前有效」）。
  - 底部提示从「必须现在决定」改为按形态区分：通报「看完就行，不影响推进」。
- 待处理列表：`BaseView` 会客厅的「待办」标签页加一个「弹窗」分区，列出排队中的事件（`#incident-pending-{i}`）。
- 浏览器流程需要能判定「不处理会过期」：测试里推时间越过 `expiresAt`，断言 `status === 'expired'` 且时间推进不再被拦。

---

## 3. 首页左上角任务面板

### 3.1 数据来源

新文件 `src/tasks.ts`：

```ts
export interface TaskEntry {
  id: string; kind: 'war' | 'faction' | 'storyline' | 'mission' | 'incident' | 'council' | 'contract';
  title: string; hint: string;
  urgent: boolean;          // 有过期时间或今晚到期
  dueAt?: number;           // 绝对分钟
  target: { modal: 'faction' | 'girl' | 'mission' | 'incident' | 'council'; id?: string };
}
export function taskInbox(state: GameState): TaskEntry[];
```

- `faction`：已接的势力任务（`state.factions[*].envoyTaskId` 指向的委托还在 `active`）→「星灯协会：替协会送一盏灯 · 剩余 40 分」。
- `storyline`：每位少女 `active` 故事线的当前节拍标题 →「月见桃 · 第二幕：雨里的名字」。
- `mission`：`requiredGirlId` 的强制委托、`storylineId` 的故事委托、以及 `deadlineAt` 距今 < 60 分钟的委托。
- `incident`：待处理弹窗（最多 3 条，其余折叠成「还有 N 件事」）。
- `council`：待决议案。
- `contract`：明天到期、`pensionMissed >= 3` 的契约。
- `war`：存在 `friction` 以上的敌意对时置顶一条「{A} 与 {B} · {tier 中文} {value}/100」，`urgent` 为 `standoff` 以上，点开跳到势力档案（对应 §4.3 第 3 条）。
- 排序：`urgent` 优先，其次 `dueAt` 升序，然后 `war` 永远在最前，最后按 `kind` 固定顺序。最多显示 6 条，其余折叠。

### 3.2 UI

- 新组件 `src/components/TaskPanel.tsx`，挂在 `App.tsx` 的页面容器左上角（`position: sticky` 在桌面、`fixed` 在窄屏），只在 `page === 'base'` 显示。
- 折叠态：一枚竖条徽标，显示待办数 `#task-panel-count`；展开态：卡片列表。
- 选择器：`#task-panel`、`#task-panel-toggle`、`#task-panel-item-{index}`、`#task-panel-more`。
- 点击条目：调用既有 `navigate()` / `setModal()`（`target.modal`），不新增路由。
- 响应式：`≤ 560px` 收成一枚圆形按钮（`#task-panel-fab`）贴在左上角，点开是一张覆盖式列表；320px 下不能压住导航与时间条（`z-index` 低于 modal，高于地图）。
- 空状态：不渲染面板（避免开场就占位）。

---

## 4. 势力之间的战斗

### 4.1 敌意值：三方两两之间的一条曲线

战线不由掷骰子决定，也不由模型拍板。三方之间两两维护一条**敌意值**（0–100），它涨到 100 就一定会打起来。谁涨、涨多快，全由玩家能看见的事决定。

```ts
export type FactionPair = 'association-government' | 'association-witch' | 'government-witch';

export interface HostilityTrack {
  pair: FactionPair;
  value: number;               // 0–100，满 100 触发战线
  tier: 'calm' | 'friction' | 'standoff' | 'brink';   // 由 value 推导，不单独存
  updatedDay: number;          // 最后一次变动的日子
  reason: string;              // 最后一次变动的原因，一句话，写进面板与档案
}

GameState.hostility: Record<FactionPair, HostilityTrack>;
```

- 四档阈值（`hostilityTier(value)`，纯函数），满 100 直接开战：

| value | tier | 中文 | 玩家感受 |
| --- | --- | --- | --- |
| 0–39 | `calm` | 平静 | 平时不出现 |
| 40–69 | `friction` | 摩擦 | 势力档案出现一行提示，偶尔一条预兆弹窗 |
| 70–89 | `standoff` | 对峙 | 每晚必有一条预兆，地图上开始有对峙标记 |
| 90–99 | `brink` | 临战 | 面板常驻置顶，两条调停委托同时挂出 |
| 100 | — | 开战 | 次夜开门生成战线 |

- `value` 夹在 `0–100`。`value === 100` 且该对没有未结束战线时，**次日开门**生成战线，然后回落到 25（战后敌意不归零，还会接着涨）。
- 三条曲线互相影响但不合并：A 打 B 会让 B 对 A 的敌意保持在 25 左右，而 A 与 C 的曲线照常走。

### 4.2 敌意值怎么涨、怎么降

所有增减都在 `src/hostility.ts` 里集中成一张表，公式之外没有隐式来源：

```ts
export function hostilityGain(state: GameState): { pair: FactionPair; delta: number; reason: string }[];
export function applyHostility(state: GameState, changes: { pair: FactionPair; delta: number; reason: string }[]): void;
```

| 来源 | 变化 | 说明 |
| --- | --- | --- |
| 每夜自然积累 | `+1`（tier 到 `standoff` 后 `+2`） | 城市自己在磨，`reason` 取最后一条日志的摘要句 |
| 弹窗选项 | 内置 `+5 ~ +9`／叙事者生成 `±3` | 模板或选项上写 `hostility: { pair, delta }`；挑拨、站队、抢货都会加；模型生成的条目按 `±3` 夹紧 |
| 站边类势力委托 | `+8` | 帮一方就是得罪另一方（`tension-{pair}-push`） |
| 调停类势力委托 | `−10` | 花钱花人手把事按住（`tension-{pair}-calm`） |
| 拦截战获胜 | `+5` | 玩家替某方打了对方的附属少女 |
| 辖区易主 | `+6` | 归属一变，旧主与新主的敌意同时涨 |
| 空月降临期间 | `−2` | 共同的敌人在头顶，先放下账 |
| 玩家连续三次拒绝势力委托 | `+3` | 谁都不给面子，谁都在攒火气 |
| 同一辖区双方都有附属少女且污染 ≥ 40 | `+2` | 脏的地方先起争执 |

- 每次变动都写 `updatedDay` 与 `reason`，并在日志里留一条（`kind: 'faction'`），玩家能回溯「这次是谁点的火」。
- 上下限夹在 `0–100`；`applyHostility` 不做跨对联动，保持可预测。
- 通关/失败不重置敌意值——它们是这个世界自己的事，不随玩家存档走。

### 4.3 阈值事件：预兆与可介入的委托

敌意值跨过阈值时触发固定动作，**不依赖模型**：

三条 `war-signal-*` 预兆模板本身**不改敌意**（只是让玩家看懂气氛），敌意值只由 §4.2 那张表里的来源推动。

1. **预兆弹窗**：`content/incidents.ts` 里三条 `war-signal-*` 模板按 tier 选：
   - `friction`：`war-signal-street`（通报），且 3 天内有 30% 概率再来一条。
   - `standoff`：每晚必投一条，`war-signal-street` / `war-signal-patrol` 轮换。
   - `brink`：每晚必投，且额外挂出两条委托。
2. **两条势力委托**（`brink` 才会出现，`standoff` 起给调停那一条）：
   - `tension-{pair}-calm`：帮**弱势方**护送证人，`work: 'investigation'`，完成 → 敌意 `−10`、该方态度 `+3`。
   - `tension-{pair}-push`：帮**强势方**运一批不该问的东西，完成 → 敌意 `+8`、该方态度 `+3`、安定度 `−1`。
   - 都带 `faction` 字段、`envoy: false`（不触发拦截战）、`reward` 800 星砂、`duration 45`、挂 2 天。
3. **任务面板**：取敌意最高的那一对，置顶一条「A 与 B · 临战 93/100」，点开进势力档案的摩擦页。
4. **势力档案**：顶部显示该势力与另两方的两条敌意条（`#faction-hostility-*`），附 `reason` 一句话。

模型在这里只做**文案**：可选让叙事者把 `reason` 改写得更像人话（失败就算了，用原始 `reason`），**不参与是否开战**。

### 4.4 战线：数据与生成



```ts
export interface FactionFront {
  id: string;                 // front-{day}-{district}
  pair: FactionPair;
  day: number;
  district: DistrictId;
  attacker: FactionId;
  defender: FactionId;        // 该辖区当前归属方
  startsAt: number; endsAt: number;   // 绝对分钟
  attackerPower: number; defenderPower: number;   // 0–100
  status: 'open' | 'joined' | 'resolved' | 'expired';
  side?: 'attacker' | 'defender';
  squad?: string[];
  result?: 'attackerWin' | 'defenderWin' | 'stalemate';
  battleId?: string;
}
```

- `GameState.fronts: FactionFront[]`。
- 生成条件唯一：某一对敌意 `value >= 100` 且没有未结束的战线。`planFronts(state)` 只读 `hostility`，不掷骰子、不调接口。
- 生成时把该对的 `value` 落到 25，`warHistory` 记一条 `{ pair, day }`，同一对 10 天内不会再打（若 10 天内又满了，把 `value` 夹在 95 并记一条「双方都在等一个借口」）。
- 进攻方 = 该对里态度更低的一方；`district` 取防守方名下污染最高的辖区（污染高的地方值得抢，也最容易出事）。
- 势力强度：`power = 30 + standing * 0.3 + (辖区污染 / 2) + 麾下少女数 * 6`，夹在 10–95。
- 持续：`startsAt = 开门后 60 分钟`，`endsAt = startsAt + 240`；到点未处理就 `autoResolveFront()`。

### 4.5 玩家参与与结算

- 地图上渲染战线标记：`#map-front-{district}`，带两方徽记与剩余时间。
- 点击打开 `FrontDialog`：
  - 顶部一行起因：该对势力的 `reason` + 「这几天发生过的事」（把该对 `value` 的变动日志按时间列出来）。
  - 双方卡片（名称、态度、战力条、辖区归属）。
  - 「帮进攻方 / 帮守方 / 观望」三选一（`#front-side-{side}`）。
  - 选边后挑 1–2 位在岗少女（`#front-girl-{id}`），`#front-commit` 出发。
  - 参战消耗时间与体力同普通战斗（`duration 45`，疲劳 +12）。
- 结算：
  - 玩家参战 → 立刻按现有 `settleCombat` 打一场，敌人由**对方势力的附属少女**组成（`factionGirlsOf(opponent)`，没有就用 `makeCandidate` 现造同等级对手），战力按势力强度缩放。
  - 赢：所选一方拿下辖区（`shiftTerritory`），声望 `+6 / −4` 对两方分别结算；输：辖区不动，己方声望 `−2`。
  - 观望：`autoResolveFront()` 按 `attackerPower + hash` 对比，赢面 `attackerPower / (attackerPower + defenderPower)`。
- 与环境互动：战线开打当天该辖区污染 `+6`；打完后参与方少女疲劳 `+12`、`hp −10%`。
- 拦截战与战线的关系：战线期间该辖区**不再触发**普通拦截，`canIntercept` 加一条 `!state.fronts.some(open && district)`。

### 4.6 UI 与文案

- 战线卡片配色用两方势力色（`factionInfo[id].color`），地图上用一个交叉剑图标（`lucide` 的 `Swords`）。
- `FrontDialog` 选择器：`#front-dialog`、`#front-reason`、`#front-signal-{i}`、`#front-attacker`、`#front-defender`、`#front-power-*`、`#front-close`。
- 摩擦阶段也有入口：势力档案页顶部显示两条敌意条（`#faction-hostility-{pair}`），带 tier 标签与 `reason`，点开显示最近的预兆与两条调停 / 站边委托。
- 会客厅的势力卡上加一枚小角标：`临战 93`（只在 `standoff` 以上出现），点击进势力档案。
- 打完后写一条编年史：`《{district}的夜战》`，正文记录谁赢了、玩家帮了谁、起因那句话。

---

## 5. 已契约少女主动离职

### 5.1 判定（不碰侵蚀度）

```ts
export interface GirlStrain { lowBondDays: number; highFatigueDays: number; }
export type LeftReason = 'bond' | 'fatigue' | 'pension';
export function resignationPressure(girl: Girl): { reason: LeftReason; days: number } | null;
```

- 好感：`bond < 25` 连续 3 天 → `bond`。
- 疲劳：`fatigue >= 85` 连续 3 个夜晚（开门时快照）→ `fatigue`。
- 欠约：`pensionMissed >= 7`（现在是 15 天才强制退休）→ `pension`，走「主动解约」而不是「强制退休」，文案与退休区分。
- 硬条件：`status === 'idle'`、`!retired`、`!dead`、`!left`。正在出勤的人不会当场走，等她回来再判。
- 计数：`state.girls[].strain`，开门时 `tickStrain(state)`，条件消失就清零（好感回到 30 就归零）。

### 5.2 流程：先警告，再走人

1. 第 1 天触发 → 投放一条 `girl` 类弹窗（`category: 'scene'`）：她坐下来把话说了一半。选项：挽留（花 600 星砂 + 好感 +8）、放她走（立即离职）、再想想（她再给 2 天，`graceUntilDay`）。
2. 宽限期（2 天）内没改善 → 第 3 天开门直接离职，不再询问。
3. 离职结算：
   - `girl.left = true; girl.leftReason = reason; girl.status = 'left'`
   - 编年史与日志各一条：`{name} 解除了契约，理由是……`
   - 空出宿舍位；不退还签约费；不产生退休金。
   - 该少女不再出现在名册主列表，进「离开的人」分区（`Roster` 底部，最多列 6 位）。
4. 挽留成功：`bond +8`，`strain` 清零，本晚不再判定。

### 5.3 与现有系统

- `GirlStatus` 现有 `idle | mission | healing | resting | retired | expedition`，本版加 `'left'`；`retiredReason` 不动，新增 `leftReason: 'bond' | 'fatigue' | 'pension'`，两者互斥。
- 所有「在册」过滤（`presentGirls()`、`activeGirls()`、派遣候选、宿舍容量、任务面板）都要排除 `left`。
- 存档迁移：旧存档 `strain` 缺省 `{0,0}`。
- 契约到期与离职的关系：`contractEndDay` 到期仍走续约流程；连续 3 次拒绝续约直接算 `pension` 离职。

### 5.4 UI

- `Roster` 加「离开的人」折叠区（`#roster-left`），条目只读，不能再派遣。
- 档案页顶部显示徽标 `已离开`（`#girl-left-badge`）。
- 通知：弹窗警告是主要入口，日志为辅；不做 toast（会被错过）。

---

## 6. 故事线多结局与多线门禁

### 6.1 多结局

- 蓝图节点已有 `kind: 'end'`，但 `StoryNodeData` 的 end 只有 `summary`。本版加一个 `ending?: string` 标签（`good` / `bad` / `true` / 自定义字符串），蓝图编辑器在 end 节点上多一个下拉。要求：**至少两个 `end` 节点，且标签不同**。
- 校验：`validateStoryEndings(graph)`：
  - `ends.length < 2` → 错误「故事线至少要通向两个不同的结局」。
  - `new Set(ends.map(e => e.ending ?? e.title)).size < 2` → 同样是错误。
  - 从 `start` 到每个 `end` 都要可达（复用现有可达性检查），避免「写了两个结局但有一条是死路」。
- LLM 契约：`storyline` / `arc` 两个 scope 的提示词加硬约束——「必须写出至少两个结局节点，且两条路线在关键选择处分叉，禁止用同一个结局换个标题充数」。
- 修复策略沿用现状：结构不合格只重写**一次**；第二次仍不合格就落到本地模板，模板本身给两个结局（「留下 / 离开」）。
- `Storyline.ending?: string` 记录实际到达的结局，`status: 'done'` 时写进编年史。
- `StoryPlan.beats` 的四幕结构不变，但第四幕 `choices` 要给两个方向（模板层面就分叉）。

### 6.2 多故事线门禁

- `Storyline.slot: number`（1 起）、`requires?: string`（上一段的 id）。
- 门禁：`canStartStoryline(state, girl, slot)` = 该少女不存在 `slot` 更小的 `active` 故事线，且 `slot > 1` 时上一段 `status === 'done'`。
- 现有查找点全部改成「当前段」：`activeStorylineOf(state, girlId)` 返回 `slot` 最小且 `status === 'active'` 的那条。
  - `src/App.tsx:524`、`src/components/CharacterDialog.tsx:77`、`src/App.tsx:175`（按 id 查，保留）。
- 资产复用：蓝图、事件、剧情播放器全部按 `storyline.id` 走，不需要新引擎。
- 上限：一位少女最多 3 段故事线，`slot ∈ [1,3]`。

### 6.3 UI

- `CharacterDialog` 故事线分区改成列表：已完成的段（可回看）、进行中的段（继续）、已解锁的下一段（「开始新的一段」`#storyline-start-{slot}`）、未解锁的段（置灰 `#storyline-locked-{slot}`，提示「先完成上一段」）。
- 生成按钮区分：`#storyline-generate` 生成当前段；完成最后一段后显示「她的故事讲完了」（`#storyline-finished`）。
- 门禁失败提示用现有的 `perform` 消息通道，不新增弹窗。

---

## 7. 迁移与兼容

`GameState.version` 12 → 13，`loadState` 接受 `1, 3..13`：

| 新字段 | 旧存档默认值 |
| --- | --- |
| `incidentPool` | `[]` |
| `incidentSeq` | `0` |
| `fronts` | `[]` |
| `hostility` | `{}`（读不到就按 0 起算，不写死两两默认值） |
| `warHistory` | `[]` |
| `departedCount` / `girls[].left` | `false` |
| `girls[].strain` | `{ lowBondDays: 0, highFatigueDays: 0 }` |
| `storylines[].slot` | 按创建顺序补 `1..n`，同一少女多条时重排 |
| `skills[].accuracy` | 代码侧推导，不写进存档 |
| `Skills` 的 `tier: 'boss'` | 旧数据没有，也不需要迁移（只有 Boss 模板带） |

- 旧存档继续可读，不清空任何数据。已经 `done` 的故事线补 `slot`。
- 自定义技能没有 `accuracy`：走推导，不强制迁移。

---

## 8. 测试

### 8.1 状态测试（+85，178 → 263）

> 第一批已落地：魔物上限 6、群体 6 目标、奥义 1–3 与命中率推导已实装，状态测试 182 条、浏览器流程 69 组全绿。下表其余各行仍待实施。

| 组 | 数量 | 断言要点 |
| --- | --- | --- |
| 技能池 | 9 | 总数 = 50；每条 `power/accuracy` 在护栏内；6 目标技能 `power ≤ 0.60`、奥义 `targets ≤ 3`；`selfCost.pct ≤ 30`；`drain/purify` 在标签表里；`girlSkillPool()` 与 `monsterSkillPool()` 都返回 50 且不含 boss |
| 命中率 | 8 | `skillAccuracy` 推导（1/2/3/4/5/6 目标 → 50/44/38/32/26/20）；显式 `accuracy` 优先；下限 20 与实战下限 10 各测一次；敏捷差 + buff 后仍夹在 10–95；我方辅助必中 |
| 目标数与魔物上限 | 4 | `pickTargets` 最多打 6 个；6 敌阵容里 6 目标技能命中 6 人；`enemyIds` 超过 6 会被夹到 6；工坊槽位能加到 6 个 |
| 自损与自咒 | 4 | 扣血不吃护盾、不会自死；`selfEffects` 必中挂上；共情不足时仍可施放（扣到 1） |
| Boss 技能组 | 5 | boss 池 8 条且 tier 全为 `boss`；Boss 单位初始带 `bossSkillIds`；hp < 50% 后换 `bossPhaseSkillIds` 并记一条 notes；契约卡导入拒绝 boss 技能；自定义技能拒绝 `tier: 'boss'` |
| 技能筛选 | 3 | 按流派过滤只返回该流派；按阶级过滤含 basic/signature/ultimate 三档；自定义少女默认选中自身流派 |
| 弹窗触发 | 8 | 三条内置事件各自在正确 `cause` 下投放；cooldown 生效；队列上限 5；超限进队列；`fillIncidentText` 替换占位符 |
| 过期 | 4 | 到 `expiresAt` 变 `expired` 且不阻塞推进；`expireEffect` 默认 −1 声望；过期后日志一条 |
| LLM 补充 | 4 | `topUpIncidentPool` 在不足 10 时补、达标不补；失败走内置兜底；一晚最多补 3 |
| 敌意值 | 7 | 三对初始为 0；`applyHostility` 加值后夹在 0–100；跨过 40/70/90 时 tier 与中文正确；预兆弹窗只在 `friction` 以上投；调停委托 `−10`、站边委托 `+8`；辖区易主时旧主新主同时 `+6`；同一对 10 天内不重复开战 |
| 战线触发 | 4 | `value 99` 不生成；`value 100` 且次夜开门生成；生成后回落到 25；有未结束战线时不重复生成，改为夹在 95 |
| 任务面板 | 4 | 势力任务/故事线/强制委托/议案各自出现在 `taskInbox`；存在 `friction` 以上敌意时该条置顶；排序 urgent 优先；上限 6 |
| 战线 | 7 | `planFronts` 只在某对敌意到 100 时出；战力公式夹紧；观望按概率定归属；玩家赢 → 辖区易主 + 声望；战线期间不触发拦截；污染 +6；生成后敌意回落到 25 |
| 离职 | 6 | 好感连续 3 天触发警告；宽限期内改善则不清算；欠约 7 天走 `pension`；出勤中不离职；离职后不可派遣、宿舍位回收 |
| 多结局 | 4 | 单结局蓝图校验失败；两个同名结局失败；两个不同结局通过；`ending` 写进编年史 |
| 多故事线 | 4 | `slot` 递增；未完成上一段不能开下一段；`activeStorylineOf` 返回最前段；最多 3 段 |

### 8.2 浏览器流程（+16，69 → 85）

1. 技能详情显示基础命中与自扣代价，战斗回放出现落空行。
2. 多目标技能命中率低于单体（读同一场战斗的两条日志）。
3. 自定义少女技能区：切流派筛选只剩该流派、切阶级筛选只剩该档，Boss 技能不出现。
4. 通报型弹窗：只有一个「知道了」，处理完可继续推进。
5. 抉择型弹窗：三个选项，选完写日志。
6. 剧情型弹窗：逐句对白 + 收尾效果。
7. 弹窗过期：推过 `expiresAt` 后自动消失且不再拦推进。
8. 首页任务面板：展开列出故事线当前段，点条目跳到对应弹窗。
9. 敌意值：把一对势力拉到 `standoff`，势力档案出现两条敌意条与「对峙 72/100」，弹窗连续两晚各来一条预兆。
10. 临战与开战：拉到 100，次夜开门在污染最高的辖区生成战线，地图标记与对话框顶部的起因都能读。
11. 调停委托：完成后敌意 −10，日志出现「被按了下去」。
12. 帮守方打赢：辖区归属不变、声望变化正确。
13. 帮进攻方打赢：辖区易主。
14. Boss 战：打到半血后技能组换一批，回放出现「空月把另一面翻了过来」。
15. 离职警告：把好感压到 24 推三天，出现警告弹窗；选择放她走，名册出现「离开的人」。
16. 双结局故事线：生成蓝图后校验到两个 `end`，走到其中一个后 `status: done`，下一段解锁。

> 共 16 条新增流程 → 69 + 16 = 85。既有 69 条里只有 §8.3 列出的三处预期行为变化。

### 8.3 回归

- 既有 69 条流程必须全绿；只有三处预期变化：
  - 技能相关断言如果读了「命中 50」需要改成实际基础值。
  - 弹窗上限从 3 变 5，若有流程断言排队数量需要同步。
  - 战线不再由随机数直接出现，测试要先把某对敌意拉到 100（走状态测试同款的 `applyHostility` 路径），否则等不到。

---

## 9. 实施顺序

1. 类型与版本（`types.ts`、`version` 13、迁移）。
2. 技能池：`skills.ts` 扩到 50 + `src/skills.ts` 三个池子函数 + `combat.ts` 命中公式。
3. Boss 技能组：`content/bossSkills.ts` + `MonsterTemplate` 阶段字段 + 换组逻辑。
4. 自定义与工坊：流派/阶级筛选、`selfCost`/`selfEffects`/`accuracy` 表单、校验。
5. 弹窗：`incidents.ts`、`content/incidents.ts`（含 3 条战争预兆）、触发与过期、`IncidentDialog`、LLM 批量生成。
6. 敌意值系统：`hostility` 数据与夹值、tier 与预兆投放、调停/站边委托、开战触发与同一对 10 天冷却。
7. 战线：`fronts.ts`（生成/结算）+ 地图标记 + `FrontDialog`。
8. 任务面板：`tasks.ts` + `TaskPanel.tsx` + 样式（摩擦条目置顶）。
9. 离职：`strain` 计数 + 警告弹窗 + 名册分区。
10. 故事线：多结局校验 + `slot` 门禁 + 档案 UI。
11. 文档：README 版本说明、`tasks/todo.md`、本方案回填实际实现。

每一步都先跑 `npx tsc -b` + 相关单测，最后统一跑 263 / 85 全量回归。

---

## 10. 风险与取舍

| 风险 | 处理 |
| --- | --- |
| 50 条技能让战斗节奏变复杂 | 数值护栏 + 命中上限 95/下限 10，单场回合数目标仍 ≤ 8 |
| 弹窗变多打扰节奏 | 待处理上限 5、可过期、通报型不阻塞推进、同一事件 7 天冷却 |
| LLM 补事件成本失控 | 一晚一次调用、最多 3 条、失败全走本地兜底、独立预算项 |
| 敌意值变成隐藏数值，玩家不知道为何开战 | 三条敌意条常驻势力档案、会客厅角标、跨阈值必有预兆弹窗、日志逐条记 reason |
| 预兆变得像骚扰 | 每晚最多一条预兆、同一对 10 天冷却、三条模板轮换 + LLM 只改写文案 |
| 玩家被「看不懂为什么打起来」 | 会客厅角标 + 势力档案敌意条（带起因）+ 预兆时间线，进 `FrontDialog` 顶部 |
| Boss 换技能组显得突兀 | 换组时写一条 notes、回放可见；第二形态技能与第一形态同族，不给全新机制 |
| 战线与拦截战叠加导致连打两场 | 战线期间该辖区关闭拦截 |
| 离职让玩家「白练」 | 提前一天警告 + 可花星砂挽留 + 宽限期 2 天 |
| 多结局被模型糊弄 | 结构化校验（两个不同 `ending` 标签 + 双路径可达），不合格只重写一次，然后走模板 |
| 任务面板挤占首页 | 默认折叠成徽标，空状态不渲染，窄屏转浮球 |

---

## 11. 待确认

1. 敌意值的推进节奏：方案是「弹窗偶尔 +1～+3、势力委托 +8、辖区易主 +6、每晚自然 +1」，从平静烧到 100 大约 8–12 个夜晚。这个长度合适吗？（想更快可以把自然增长提到 +2）
2. 弹窗「未满 10 个」按**待用池**理解（本方案），还是按**同时待处理**理解？后者会强制同一晚最多 10 张弹窗，体验偏重。
3. 临战期那两条委托的奖励给多少合适？（方案：中等，`+800 星砂`，不动声望以外的数值）
4. 离职是否要允许「花星砂挽留」？（方案：允许，600 星砂换好感 +8）
5. 故事线最多 3 段是否够用？
