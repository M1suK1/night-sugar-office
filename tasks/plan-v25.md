# v25 方案：共情值 = 面板共情，作为「心防条」

> 用户定义（User said m19437，m19457 修订系数）：共情值 = 数值面板的共情 × 2；共情值存在时血量伤害减伤 30%；归零时眩晕 1 回合，当前战斗中不再恢复；归零后所有共情伤害 ×0.7 直接攻击血量，血量伤害恢复 100%；一回合中所有魔法少女都处于眩晕或血量归零则直接判负。
> 定位：战斗层重做。先做 v25，做完再回到 v24 的内容扩容（v24 的 Boss 共情依赖这里的口径）。

## 1. 规则逐条落成

| # | 规则 | 判定实现 |
|---|---|---|
| 1 | 共情值 = 面板共情 × 2 | `guardMax(unit) = stats.empathy × 2 + 装备加成`；系数 2 让高共情的守护型少女显著更抗，低共情角色依旧一碰就破 |
| 2 | 共情 > 0 时，血量伤害 −30% | 血量类伤害在 `raw` 之后乘 `GUARD_HP_MUL = 0.7`；共情类伤害不受此影响 |
| 3 | 共情归零 → 眩晕 1 回合 | 破防瞬间给该单位加 `stun` 效果（`duration 1`），复用现有眩晕结算 |
| 4 | 当前战斗中不再恢复 | 战斗内没有任何途径回共情；破防后 `spiritBroken = true`，整场不再回填 |
| 5 | 归零后共情伤害 ×0.7 打血量 | 目标 `spiritBroken` 时，共情类伤害转成血量伤害：`round(raw × 0.7)`，走护盾与减伤 |
| 6 | 破防后血量伤害回到 100% | 规则 2 的 `×0.7` 只在 `spirit > 0` 时生效 |
| 6b | 破防后护持散掉，挨打更实 | 目标 `spiritBroken` 时血量伤害乘 `BROKEN_TAKEN_MUL = 1.4`（与规则 6 的「回 100%」叠加，合计 ×1.4） |
| 7 | 全队眩晕或血量归零 → 判负 | `outcomeNow()` 新增一条：友方**全部**满足 `hp <= 0 \|\| down \|\| 有 stun` → `defeat`。**只在轮末检查**，且「本轮刚被打穿」的单位不计入（豁免一次），避免同轮连锁破防直接判负 |

这套设计的本质：**共情是心防条（poise），不是第二条血条**。它不承受长期消耗，只决定「这一击会不会被打得踉跄」——被打穿之前血量伤害打七折，被打穿之后自己晕一回合、护持消失，但攻击者的共情技不会落空（转成 70% 血量伤害）。

## 2. 与旧模型的关键差异

| 维度 | 旧（现状） | 新（v25） |
|---|---|---|
| 共情上限来源 | `girl.maxSpirit = 80 + 等级×2`；魔物手写常数；`spiritMax()` 是死代码 | 面板 `empathy × 2`（+ 装备百分比） |
| 共情的作用 | 与血量并列的第二条命，打空即 `down` | 心防条：打空不倒下，改为眩晕 1 回合 + 卸掉 30% 减伤 |
| 血量伤害 | 100% | 心防在 → 70%；心防破 → 100% |
| 共情伤害 | 打共情条；条空后无意义 | 打共情条；条空后 ×0.7 转血量伤害，永不打空 |
| 战斗内恢复 | 无 | 无（明确禁止） |
| 战败判定 | 全员 `hp<=0 \|\| spirit<=0` | 全员 `hp<=0 \|\| down \|\| 眩晕` |

**为什么这版更好**：`empathy` 从一个只用于任务门槛的面板数字，变成同时决定「心防长度」与「被击穿前能扛多久」的核心属性；而共情条长度天然与角色定位绑定——高共情的少女本来就该扛得住精神冲击，不必再另设一套派生公式。

## 3. 数据模型（`src/types.ts`）

```ts
export interface BattleUnit {
  // …现有字段不动
  /** 心防已被打穿：本场不再恢复，共情伤害转血量伤害。 */
  spiritBroken?: boolean;
}

export interface Equipment {
  // …现有字段不动
  spiritBonus?: number;      // 保留兼容：绝对值，迁移时折成百分比
  spiritBonusPct?: number;   // 新增：心防上限的百分比加成（0–60）
}
```

- `MonsterTemplate.maxSpirit` / `BossTemplate.maxSpirit` **删除语义**：不再读写（魔物心防 = `stats.empathy × 2`）。为兼容旧存档保留字段解析，但读入即丢弃。
- `GameState.version` 16 → **17**（v24 随后 17 → 18）。
- 不需要 `downReason`：共情归零不再是 `down`，改判定眩晕。

## 4. 公式（新建 `src/spirit.ts`）

```ts
export const GUARD_PER_EMPATHY = 2;     // 心防 = 面板共情 × 2
export const GUARD_HP_MUL = 0.7;        // 心防在：血量伤害 ×0.7
export const BROKEN_SPIRIT_MUL = 0.7;   // 心防破：共情伤害转血量 ×0.7
export const BROKEN_TAKEN_MUL = 1.4;    // 心防破：护持散了，再挨打更实
export const GUARD_STUN_ROUNDS = 1;     // 破防眩晕回合数

export function guardMax(unit: { stats: { empathy: number } }, bonusPct?: number): number;  // empathy × 2 × (1 + pct)
export function guardHpMul(unit: BattleUnit): number;      // 0.7 / 1
export function brokenSpiritDamage(raw: number): number;   // round(raw * 0.7)
export function isGuarded(unit: BattleUnit): boolean;      // spirit > 0 && !spiritBroken
```

三条访问器是整个机制的唯一入口，战斗里不再各写一份判断。

## 5. 战斗流程改动（`src/combat.ts`）

| 位置 | 现在 | 改成 |
|---|---|---|
| `:58-61` `spiritMax()` | 死代码，没人调用 | 删除；`guardMax()` 取代 |
| `:80/86` | `effectiveMaxSpirit(girl)`（`80 + 等级×2 + 装备`） | `guardMax(girl)`（= 面板共情 + 装备百分比） |
| `:111` | `round(monster.maxSpirit * scale)` | `guardMax(monster)`（= 魔物共情 × 2），不吃血量的 `scale` |
| `:117` `alive()` | `!down && hp > 0 && spirit > 0` | `!down && hp > 0`（心防破了依然活着） |
| `:298-301` `outcomeNow()` | 只看 `alive()` | 追加「友方全部眩晕或血量归零 → `defeat`」，仅轮末生效、本轮刚破防者豁免 |
| `:354` / `:419` / `:475` | `hp<=0 \|\| spirit<=0 → down` | 只 `hp<=0 → down`；共情归零走新函数 `breakGuard()` |
| `:402-412` 伤害结算 | 共情伤害无条件打共情 | 三支：① 目标有心防 → 共情伤害扣心防；② 目标已破 → `round(raw*0.7)` 打血量；③ 血量伤害在有心防时 `×0.7` |
| `:403` 护盾 | `skill.resource === 'spirit' ? 0 : …` | 共情伤害仍不吃护盾；「已破 → 转血量」那一支**照吃护盾** |
| `:324-329` `regen` | 回血量 | 不变；**新增禁止**：任何 `resource: 'spirit'` 的恢复在战斗中直接跳过并记日志「共情已破，无法恢复」 |

### 5.1 `breakGuard()` 与眩晕

```ts
function breakGuard(unit: BattleUnit, round: number): void {
  if (unit.spiritBroken) return;
  unit.spirit = 0;
  unit.spiritBroken = true;
  addEffect(unit, { kind: 'stun', amount: 1, duration: GUARD_STUN_ROUNDS, source: '共情耗尽' });
  log({ round, …, note: `${unit.name}的共情被打穿，踉跄了一拍` });
}
```

复用现有 `stun`：行动时若 `stun.remaining > 0` 则该单位本轮无法行动并消耗一层（`combat.ts:365-371`）。

### 5.2 判负

```ts
const allyOutOfAction = (u: BattleUnit) =>
  u.down || u.hp <= 0 || u.effects.some(e => e.kind === 'stun' && e.remaining > 0);

const outcomeNow = (roundEnd: boolean) => {
  if (!alive(units, 'enemy').length) return 'victory';
  if (!alive(units, 'ally').length) return 'defeat';
  if (!roundEnd) return undefined;                         // 连锁破防不在回合中途判负
  const allies = units.filter(u => u.side === 'ally');
  const waived = allies.filter(u => brokenThisRound.has(u.uid));   // 本轮刚破防 → 豁免一次
  const judged = allies.filter(u => !brokenThisRound.has(u.uid));
  if (judged.length && judged.every(allyOutOfAction) && allies.every(allyOutOfAction)) return 'defeat';
  return undefined;
};
```

每次行动后只用 `roundEnd=false` 检查胜负平局；`roundEnd=true` 的判负检查放在轮末（`snapshot()` 之前），并清空 `brokenThisRound`。这样「同轮三名少女被 `monster-scream` 连锁打穿」不会当场判负——下一轮还有一次机会。

## 6. 战后结算（`src/game.ts`）

| 位置 | 改动 |
|---|---|
| `settleCombat` L1955-1957 | `girl.spirit = Math.max(0, unit.spirit)` → 战后**一律回满**：`girl.spirit = guardMax(girl)`（对应「当前战斗中不再恢复」的言下之意） |
| `settleCombat` L1971-1983 疤痕 | 战败仍给每名参战者造疤；**若失败原因是「全队眩晕」判负，则只抽精神疤痕**（`makeScar(..., { mentalOnly: true })`） |
| `closeShift` L2382-2384 | `girl.spirit + 20` 保留（因为战后已满，实际是 no-op），不新增百分比恢复 |
| `processDay` | 不加夜间共情恢复（与旧草案相反，这版不需要） |
| `hydrate` L322 | `girl.spirit = min(…, effectiveMaxSpirit(g))` → `girl.spirit = min(girl.spirit ?? 上限, guardMax(g))` |
| 创建处（`:362` / `:1343` / `:2671` / `:3051` / `:3124` / `:3592`） | `spirit: 80 + level*2` / `88` / `80` 等一律改为 `spirit: 0` 占位，由 `hydrate()` 填 `guardMax()` |

### 6.1 精神疤痕（新增，User said m19479 第 2 条）

- 因「全队眩晕」判负的失败，疤痕只从 `kind: 'mental'` 的 5 条里抽（`创伤后夜惊`/`幻听`/`失语`/`解离`/`强迫性清点`）；血量归零导致的正常战败仍从全 10 条抽。理由：被打懵和被打伤不是一回事。
- 诊所新增 `mode: 'clear'`「记忆清除」：**1,200 星砂**移除一条精神疤痕，等级、属性、血量全部不动（对比 `mode: 'wipe'` 记忆重塑 4,000 星砂会把等级归 1）。出勤中不可用。没有精神疤痕时按钮禁用并提示「没有可清除的精神疤痕」。
- 肉体疤痕不可清除，这条规则不变——现在 `wipe` 的日志「疤痕仍在」也是这么写的。
- `GameAction.clinic` 的 `mode` 联合类型加 `'clear'`，`clearScarId?: string`（缺省取第一条精神疤痕）。

## 7. 数值与内容

### 7.1 心防长度（改后实测）

| 单位 | 面板共情 | 心防（改前 → 改后） | 一次共情伤害 | 几下破防 |
|---|---|---|---|---|
| 女孩 Lv1 | 60 | 82 → **120** | 47–74 | 2–3 下 |
| 女孩 Lv10 | 80 | 100 → **160** | 47–74 | 2–4 下 |
| 守护型（共情 120） | 120 | — → **240** | 47–74 | 3–5 下 |
| 末班车 | 40 | 120 → **80** | 25–91 | 1–2 下 |
| 回声猫 | 55 | 90 → **110** | 25–91 | 1–2 下 |
| 镜修女 | 52 | 160 → **104** | 25–91 | 1–2 下 |
| 糖王 | 72 | 150 → **144** | 25–91 | 2 下 |
| 空月 | 64 | 200 → **128** | 25–91 | 1–2 下 |

血量伤害的 30% 减伤等价于**有效血量 ×1.43**：女孩 Lv1 从「2 下被打倒」变成「2.8 下」；心防破了回到 2 下。

### 7.2 装备

| 装备 | 现在 | 改后 |
|---|---|---|
| `moon-drug` | `spiritBonus: 10` | `spiritBonusPct: 10`（共情 60 → 心防 132） |
| `association-badge` | `spiritBonus: 12` | `spiritBonusPct: 15`（共情 80 → 心防 184） |

`src/content/library.ts:209` 的编辑器范围由 `0–200` 改为百分比 `0–60`，并清洗 `spiritBonusPct`。
绝对值字段保留读取：迁移时 `spiritBonusPct = round(spiritBonus × 1.5)`（+10 → 15%）后清零。

### 7.3 技能 power 一行都不改

现有共情技能（女孩 7 条、魔物 5 条、Boss 8 条）的 `power` 原样保留：它们打的是心防，不是为了「打死」谁，破防之后按 70% 转成血量伤害，所以不存在「打空后浪费回合」的问题。这是本设计最大的收益——**不用改任何技能数值**。

## 8. 存档迁移（`version` 16 → 17）

| 字段 | 迁移 |
|---|---|
| `girl.maxSpirit` | 全部改为 `guardMax(girl)`（= 面板共情 × 2 + 装备百分比） |
| `girl.spirit` | 视为满值：`girl.spirit = girl.maxSpirit`（旧值 82–100 无意义） |
| `Equipment.spiritBonus` | 有值则写 `spiritBonusPct = round(v × 1.5)` 并清零 |
| `customMonsters[].maxSpirit` | 丢弃（心防由 `empathy × 2` 决定） |
| `customBosses[].maxSpirit` | 同上 |
| 进行中的 `battle` | 重算所有单位心防上限；`spirit` 超过上限的截平；`spiritBroken` 缺省 `false` |

不重置疤痕、不改 `hp`、不动已完成的委托。

## 9. UI 改动

| 位置 | 改动 | 选择器 |
|---|---|---|
| 战报单位行 | 血量条 + 心防条；心防在时血量条带 `护持 −30%` 角标 | `#battle-unit-{uid}-guard`、`.unit-guard-tag` |
| 战报事件 | 破防事件写成「踉跄」而非「倒下」 | `.event-break` |
| 角色详情 | 共情一栏标注「心防：被击穿前血量伤害 −30%」 | `#girl-guard-hint` |
| 角色详情 | 显示当前心防上限 = 共情 × 2 | `#girl-guard-value` |
| 魔物图鉴 | 共情一栏换成「心防」并说明派生自共情 | `#codex-monster-guard` |
| 工坊 · 装备 | 心防加成（%） | `#workshop-item-spirit-pct` |
| 工坊 · 魔物 | 去掉 `maxSpirit` 输入，改为提示「心防 = 共情 × 2」 | — |
| 诊所 | 新增「记忆清除 · 1,200 星砂」按钮，只能清精神疤痕 | `#clinic-clear` |

响应式：320px 下血量条与心防条上下排列，不并排。

## 10. 测试计划

`tests/game.test.ts` 255 → **277**（+22，实测 276/276 通过；除下表 17 条外还补了「破防后挨打 ×1.4」「精神型失败之外仍抽全表」「v16 旧档整档读入」等）：

| # | 用例 |
|---|---|
| 1 | 女孩心防上限 = 面板共情 × 2（Lv1 / Lv10 各一） |
| 2 | `spiritBonusPct` 按百分比加成，旧 `spiritBonus` 按 ×1.5 折算 |
| 3 | 魔物心防 = `stats.empathy × 2`，与 `maxHp` 无关 |
| 4 | 心防在时血量伤害 ×0.7（同条件对比无心防） |
| 5 | 心防在时共情伤害只扣心防、不扣血量 |
| 6 | 心防归零 → `spiritBroken`、加 1 回合眩晕、不再是 `down` |
| 7 | 破防后共情伤害 = `round(raw × 0.7)` 打血量，且吃护盾 |
| 8 | 破防后血量伤害回到 100% |
| 9 | 破防后战斗内无法恢复共情（含 `resource: 'spirit'` 的 regen） |
| 10 | 友方全部眩晕（未掉血）→ 判 `defeat` |
| 11 | 一名眩晕 + 一名存活 → 不判负 |
| 12 | 全队共情归零但未眩晕、血量健康 → 不判负 |
| 13 | 胜利条件不变（敌方血量全空即 `victory`） |
| 14 | 迁移：旧存档 `maxSpirit 82` → 心防 120，`spiritBonus 10` → `spiritBonusPct 10` |
| 15 | 全队眩晕但其中一人本轮刚破防 → 不判负（豁免一次） |
| 16 | 因全队眩晕判负 → 产出的疤痕全部是 `kind: 'mental'` |
| 17 | 记忆清除：1,200 星砂移除一条精神疤痕，等级与肉体疤痕不变 |

`tests/browser.mjs` 83 → **86**（实测 86/86 通过）：战报护持角标与心防条、破防「踉跄」事件、档案心防读数与记忆清除按钮、工坊装备百分比与魔物只读心防。

## 11. 实施顺序

1. 新建 `src/spirit.ts`（三个常量 + 三个访问器）。
2. `src/types.ts`：`BattleUnit.spiritBroken`、`Equipment.spiritBonusPct`、`version` 16 → 17；删除 `maxSpirit` 的读写语义。
3. `src/combat.ts`：单位构造、`alive()`、`outcomeNow()`、伤害三支、`breakGuard()`、`regen` 禁止回共情。
4. `src/game.ts`：战后回满、`hydrate`、六处创建点改占位。
5. 迁移 + `src/content/library.ts` 清洗。
6. 内容重标：2 件装备、6 只魔物去掉 `maxSpirit`。
7. 精神疤痕：`makeScar` 加 `mentalOnly`、诊所 `mode: 'clear'`、UI 按钮。
8. UI：战报双条 + 护持角标 + 破防文案、角色页提示、图鉴、工坊两个输入框。
9. 测试 17 + 3 条，`npx tsc -b`、`node --test`、构建、浏览器流程。
10. 更新 `README.md`、`tasks/todo.md`、本方案的实施记录。

## 9.1 玩法说明只在世界书里

- 界面不写规则：档案页只有「心防 120 / 160」这一行读数，战报只留「护持」「心防已破」的短标签，长说明一律不进 UI。
- 世界书新增常驻词条 `guard`「心防」（priority 84、order 2，`constant: true`）：完好时 −30%、被打穿踉跄一回合、本场不回、第二天长满、整队都倒才算输、这种败法只留精神疤痕并可用记忆清除抹掉。
- `src/worldbook.ts` 新增 `syncBuiltinWorldbook()`：启动时把缺失的**常驻**词条补进玩家已有世界书（老档也能读到新写的说明），已有同名条目一律不动；`App.tsx` 首次挂载时调用。
- `WORLDBOOK_BUDGET` 1600 → 1900：多一条常驻词条会把 `battle-note`（战斗札记，priority 55）挤出预算，实测它被丢掉后战斗札记请求里就没有「战斗札记」词条了。

## 12. 风险与取舍

- **× 2 之后节奏刚好**：女孩 Lv1 心防 120，被末班车（47/发）破需要 2–3 下；魔物 80–144，被一发 `moon-phase`（91）破需要 1–2 下。也就是说「护持窗口」从首轮延长到第 2–3 轮，30% 减伤真能吃到几轮。若以后觉得还是太快，唯一的正确旋钮是 `GUARD_PER_EMPATHY`（2 → 3），不要去改 `GUARD_HP_MUL`。
- **高共情直接等于坦度**：共情 120 的守护型少女心防 240，比共情 40 的攻击型（80）厚三倍。这是需求本身要的（「让高共情的守护型少女更能抗」），代价是 `empathy` 一项属性同时决定「心防长度」与「月蚀庭委托门槛」，堆共情的收益被放大。取舍：接受；若发现单一属性过强，再给 `magic` 系角色补「破心防效率」（例如高 `magic` 对心防伤害加成），不在这版做。
- **全队眩晕判负已按建议软化**（User said m19479：「其他按照你建议的来」）：判负检查收到轮末 + 本轮刚破防者豁免一次。代价是「险胜」变多，收益是不会因为同轮连锁破防直接结束一夜。
- **有效血量 ×1.43 会整体降低难度**：血量伤害打七折，战斗回合上限不变，等于玩家更耐打。取舍：怪物 `monster-claw` 数值不动，难度下降体现在「少输」，而 v24 的 Boss 消耗战会重新把压力拉回来。
- **低共情角色依旧脆，这是有意保留的**（User said m19479 第 1 条）：补偿路径是装备（`spiritBonusPct`）与辅助型少女的护盾——护盾只挡血量伤害，正好接在「心防被打穿后血量伤害回到 100%」那一段。所以脆不是缺陷，是分工。
- **共情属性变成唯一撑心防的属性**，高共情角色（月蚀庭系、`empathy` 要求委托）地位上升；这符合设定，但会让「低共情高敏捷」流派变脆。取舍：接受，作为角色分工。
- **战后共情回满**：消除了「跨战斗消耗」这层资源管理。取舍：规则明确要求战斗内不恢复，且心防每场从满开始才能让「30% 减伤」稳定出现，去掉跨场记账。

## 13. 与 v24 的衔接

- v25 占掉 `version 16 → 17`；v24 目标改为 **17 → 18**，`LIBRARY_SCHEMA` 18。
- v24 的糖霜王座 `maxSpirit: 900` 删除；心防 = 面板共情 × 2。为满足「大幅提高 Boss 共情」的要求，把 Boss 的 `empathy` 定到 **180**（`statOf` 上限 220），心防 **360**，玩家需要约 4–5 发共情技才能打穿（3 人满编每轮 1–2 发共情技），破防后 Boss 掉 30% 减伤并眩晕一回合——这在消耗战里是一次真正的窗口。
- v24 的 20 只普通魔物只写 `maxHp` 与 `stats.empathy`（心防随之确定），不再写 `maxSpirit`。
- v24 的 80 件装备用 `spiritBonusPct`（0–15%）。
- v24 的精英 buff `empathyMul` 现在直接放大心防——方向一致，无需改。
