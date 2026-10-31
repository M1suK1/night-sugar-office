# v24 方案：内容池扩容（装备 80 / 魔物 20 + 精英 buff / 委托 16 / Boss 池）

> 目标一句话：把「能买到什么、会打到什么、能接什么、最终要面对什么」这四件事，从各 6～12 条的手写样本，扩成有分层、有抽取规则、能在工坊里继续编辑的内容池。
>
> 本版按你的四条修改重写：五阶装备声望门槛 80；取消独立的精英魔物，改成「精英 buff」；Boss 首只改为糖霜王座，第 10 天登场、击败后隔 10 天；委托只做战斗 10 + 调查 6，低危中危优先，不绑辖区。

## 1. 范围与边界

### 1.1 要做的

| # | 需求 | 落地位置 | 规模 |
|---|---|---|---|
| 1 | 装备池 80 种，5 阶级，越高越稀有，五阶需势力关系 80 | `src/content/equipment/`（新建）+ `Equipment.tier` | 12 → 80 |
| 2 | 魔物池 20 只普通，精英由 buff 改造 | `src/content/monsters.ts` + `src/content/eliteBuffs.ts`（新建） | 6 → 20，buff 6 条 |
| 3 | 战斗委托 10 条、调查委托 6 条，难度由辖区污染决定，不绑辖区 | `src/content/seed-pack.ts` | 7 → 16 |
| 4 | Boss 池，首只「糖霜王座」，工坊可编辑，登场即常驻、血量继承 | `src/content/bosses.ts`（新建）+ `BossTemplate` | 0 → 1 |
| 5 | 污染变成 10 天循环：地板每天 +3、Boss 每日全城 +3、击败归零 | `src/pollution.ts` + `game.ts` 的 `processDay` | 3 处 |
| 6 | 顺带整理委托池：`done` 归档上限 30、Boss 委托不被打烊清掉 | `src/game.ts` 的 `closeShift` | 2 处 |

### 1.2 不做的

- 不新增「精英魔物」这一层内容：**所有魔物都是普通怪**，精英是运行时挂上去的 buff。
- 不重做战斗公式、不加新状态效果种类（现有 `EffectKind` / `MonsterRuleEffect` 够用）。
- 不动 `moon-drug`、`star-kit`、`moon-weapon` 等被代码硬引用的 id（`src/game.ts` 的 `drugTick` 直接查 `moon-drug`）。
- 不给装备加随机词缀（`generatedItems` 逻辑保持原样，只补 tier 推断）。
- 不把「空月」做成 Boss：它降级为普通池里的一只魔物，继续出现在 `hollow` 这条剧情委托里。
- 不改委托的生成方式：仍是每晚定时本地确定性刷新，LLM 夜间提案仍是「有余量时顺手补一条」的可选增强，不做成「完成一条补一条」的循环。
- 不保留 Boss 的 48 小时超时撤离：旧逻辑（扣 6 声望、清空 Boss、删委托）整段删掉，不改成「残影委托」之类的软化版本。

## 2. 数据模型改动

### 2.1 `Equipment` 加阶级

```ts
export type EquipmentTier = 1 | 2 | 3 | 4 | 5;

export interface Equipment {
  // …现有字段不动
  /** 阶级：1 最低、5 最高。旧数据缺省时由 tierOf() 按价格推断。 */
  tier?: EquipmentTier;
}
```

- 可选字段而非必填：`generatedItems`、旧存档、内容包导入都可能是没有 tier 的对象。
- 统一访问器放 `src/items.ts`（新建）：

```ts
export function tierOf(item: Equipment): EquipmentTier;
export const TIER_LABEL: Record<EquipmentTier, string> = { 1: '一阶', 2: '二阶', 3: '三阶', 4: '四阶', 5: '五阶' };
export const TIER_COLOR: Record<EquipmentTier, string>;
```

- 价格推断（旧数据 / LLM 装备）：`<1200 → 1`、`<2600 → 2`、`<5000 → 3`、`<9000 → 4`、`else 5`。
- 共情加成一律用 v25 的 `spiritBonusPct`（0–15%），不再写绝对 `spiritBonus`——共情上限已改为按血量派生，绝对值会被等级稀释。

### 2.2 精英 buff（替代精英魔物）

```ts
export interface EliteBuff {
  id: string; name: string; blurb: string; color: string;
  /** 血量倍率，1.4–1.9。 */
  hpMul: number;
  /** 四项属性倍率，1.05–1.30。 */
  statMul: number;
  /** 共情单独再乘一次，精英的「压迫感」主要来自这里。 */
  empathyMul: number;
  /** 额外挂上的被动技能（必须已存在于技能表）。 */
  skillIds: string[];
  /** 额外挂上的魔物规则，与 MonsterRule 同构。 */
  rules?: MonsterRule[];
}
```

- `MonsterTemplate` **不加** `tier` 字段：分层不在数据里，在出场时决定。
- 精英化不改模板本体，只在生成战斗单位时套一层：

```ts
function applyEliteBuff(monster: MonsterTemplate, buff: EliteBuff): MonsterTemplate;
// 返回浅拷贝：maxHp/属性乘倍率，empathy 再乘 empathyMul，
// skillIds 追加 buff.skillIds，rules 追加 buff.rules（去重）
```

- 落点：`src/combat.ts:94 unitFromMonster` 增加一个可选 `buffId` 参数，在 `pool.find` 之后套 buff。这是全游戏**唯一**的敌人构造入口（`combat.ts:280` 调用），改一处就覆盖全部战斗、拦截战、Boss 战。
- 委托上存 buff：

```ts
export interface Mission {
  // …现有 enemyIds 不动
  /** 与 enemyIds 下标对齐；null 表示这只不是精英。 */
  enemyBuffs?: (string | null)[];
}
```

用平行数组而不是给 id 加后缀（`echo-cat+elite`），是因为 `enemyIds` 已经被工坊、内容包、旧存档、LLM 多处解析，加后缀会让每一处都要拆字符串。

### 2.3 Boss 模板与状态

```ts
export interface BossPhase {
  /** 进入该阶段的血量比例（0–1），第一阶段固定 1。 */
  atHpPct: number;
  skillIds: string[];
  /** 阶段开场把这几只普通魔物拉进场。 */
  addIds?: string[];
  /** 阶段台词，战斗日志里显示。 */
  line: string;
}

export interface BossTemplate {
  id: string; name: string; title: string; blurb: string;
  /** 主体魔物的模板 id。 */
  monsterId: string;
  maxHp: number;
  /** 共情值（也就是敌方的 spirit 条）。Boss 要撑得住多轮消耗战，所以单独写。 */
  // v25 起不再有 maxSpirit：心防 = 面板共情（见 plan-v25）
  stats: Partial<Record<StatKey, number>>;
  phases: BossPhase[];
  reward: number;
  duration: number;
  recommendedLevel: number;
  color: string;
  /** 首只登场日；之后每 defeatGapDays 天来一次。 */
  firstDay: number;
  defeatGapDays: number;
  /** Boss 在场时，每天给九区各加的污染（压迫）。 */
  pollutionPressure: number;
}
```

```ts
export interface BossState {
  // …现有字段不动（deadline 保留但不再参与判定）
  /** 是哪只 Boss。旧存档缺省补 'boss-candy-throne'。 */
  template?: string;
  /** 血量在这一场里剩多少；每次战斗后写回，下一次直接从这里开始。 */
  hp?: number;
  maxHp?: number;
}
```

```ts
// GameState 新增
customBosses: BossTemplate[];
/** 本轮循环的起始日：Boss 被击败当天重置，污染地板按 day - cycleStart 算。 */
cycleStartDay: number;
```

- `ContentLibrary` 加 `bosses: BossTemplate[]`，`LIBRARY_SCHEMA` 17 → 18。
- `GameState.version` 17 → 18（`loadState` 接受 `1,3..18`）。**v25 已占掉 16 → 17，v24 在其后实施**。
- 迁移：`cycleStartDay ??= 1`；`boss.hp ??= boss.maxHp`；`boss.template ??= 'boss-candy-throne'`。

### 2.4 污染循环：地板随时间抬高，击败 Boss 归零

污染从「只会涨的背景数值」升级成**驱动难度的循环变量**。一轮的节奏是：清干净 → 十天里越攒越脏 → Boss 带来最后一段压迫 → 打掉 Boss，城市归零，进入下一轮。

```ts
/** 本轮第几天；`cycleStartDay` 在 Boss 被击败当天重置。 */
export function cycleDay(state: GameState): number {
  return Math.max(1, state.day - state.cycleStartDay + 1);
}

/** 污染地板：净化的下限，随时间抬高，第十天到 30。 */
export function pollutionFloor(state: GameState): number {
  return Math.min(30, cycleDay(state) * 3);
}
```

每晚结算（`processDay`，`game.ts:2237-2252`）改成三步，顺序不能换：

1. **抬地板**：`level = max(level, pollutionFloor(state))`——地板涨了，昨天擦干净的地方也会重新脏起来。
2. **自然上升**：`level = clamp(level + pollutionDailyRise(level))`，`pollutionDailyRise(level) = 1 + floor(level / 30)` 不变。
3. **Boss 压迫**：`if (state.boss) level += boss.pollutionPressure`（首只 3）。Boss 在场时九区一起变脏。

净化（完成委托时）改成受地板约束：`after = max(pollutionFloor(state), level - relief)`。这条改动让「擦地」从「能一直擦到 0」变成「只能擦到当天的底线」，玩家越往后越只能延缓。

击败 Boss 的那一战（`settleCombat` 里 `battle.outcome === 'victory' && mission.boss`）：

- 九区 `pollution = 0`；
- `cycleStartDay = state.day`；
- `nextBossDay = state.day + defeatGapDays`；
- 写日志「糖霜王座塌了。城市在一夜之间干净得不像话，钟楼上的灯第一次照到了地面。」

十天的弧线（地板 / 典型单区实际值，起始值取 `INITIAL_POLLUTION`）：

| 本轮第几天 | 地板 | 说明 |
|---|---|---|
| 1 | 3 | 刚清零，擦一下就回到 3 |
| 3 | 9 | 还能压住 |
| 5 | 15 | 微浊普遍化 |
| 7 | 21 | 开始跨进浑浊 |
| 10 | 27 | Boss 登场，压迫每天再 +3 |

### 2.5 难度权重：污染越高，高危越多

```ts
/** 按辖区自身污染度给难度权重；返回四档的整数权重，合计 100。 */
export function difficultyWeights(pollution: number): Record<'低危' | '中危' | '高危' | '绝望', number> {
  if (pollution >= 80) return { 低危: 5, 中危: 25, 高危: 45, 绝望: 25 };
  if (pollution >= 60) return { 低危: 15, 中危: 35, 高危: 35, 绝望: 15 };
  if (pollution >= 40) return { 低危: 30, 中危: 40, 高危: 22, 绝望: 8 };
  if (pollution >= 20) return { 低危: 50, 中危: 38, 高危: 12, 绝望: 0 };
  return { 低危: 70, 中危: 28, 高危: 2, 绝望: 0 };
}
```

- 用的是**委托落在的那块辖区**自己的污染度，不是全城平均——所以同一晚不同区的委托难度不一样，玩家能主动去干净的地方接单。
- 城市总量只做展示（地图图例的「城市平均」），不参与抽取。
- 抽取仍走 `hashText(missionId + ':difficulty')`，同一天刷新结果稳定。

## 3. 装备池：80 种 / 5 阶级

### 3.1 阶级配比与数值预算

| 阶级 | 件数 | 价格带 | 声望门槛 | 属性合计 | 额外 |
|---|---|---|---|---|---|
| 一阶 | 28 | 400–900 | 0 | +4…8 | 无 |
| 二阶 | 24 | 1200–2200 | 20 | +8…14 | 25% 带 1 条小被动 |
| 三阶 | 16 | 2600–4200 | 35 | +14…22 | 必有 1 条被动 |
| 四阶 | 9 | 5000–7200 | 50 | +22…30 | 1–2 条被动，或 1 个技能 |
| 五阶 | 3 | 9800–14000 | **80** | +30…40 | 专属技能 + 1 条明确代价 |

- **五阶门槛 80**：`standingReq` 直接写 80，商店过滤按 `item.standingReq <= 该势力 standing`。声望到 80 需要长期站队（现有涨声望途径：完成该势力代表委托、剧情选择），所以五阶是「关系确立」而不是「攒够了钱」。
- 五阶允许跨势力购买：只要你在其所属势力有 80 声望，就能买该势力的五阶；不额外做 3 件互斥绑定的机制。
- 消耗品按阶级缩放：`heal` 30 / 55 / 90 / 140 / 200；`purify` 6 / 10 / 16 / 24 / 34 点污染。
- 三势力均衡：月蚀庭 27、星灯协会 27、市役所 26。
- 槽位分布：`weapon` 30、`charm` 30、`consumable` 20。

### 3.2 命名与 id

- id 前缀按阶级：`t1-`…`t5-`，后缀「势力简写 + 主题」：`t4-witch-eclipse-staff`。
- 现有 12 条**保留原 id**，补 `tier`：`star-kit`/`purify-course`/`permit`/`tax-voucher` → 1；`silver-wand`/`association-badge`/`black-sugar`/`riot-charm`/`pocket-watch` → 2；`moon-drug` → 3；`moon-weapon`/`night-ring` → 4。
- 五阶 3 件全部新写，中文名走传说气质（禁忌器物 / 协会禁书里的名字 / 市役所封存物）。

### 3.3 文件拆分

```
src/content/equipment/tier1.ts   export const tier1: Equipment[]   // 28
src/content/equipment/tier2.ts   // 24
src/content/equipment/tier3.ts   // 16
src/content/equipment/tier4.ts   // 9
src/content/equipment/tier5.ts   // 3
src/content/equipment/index.ts   export const items = [...tier1, ...tier2, ...tier3, ...tier4, ...tier5];
src/content/items.ts             保持导出 { factionInfo, items }，内部 re-export
```

保留 `src/content/items.ts` 门面，是为了不动 `seed-pack.ts`、市场、`game.ts` 里已有的 `import { items, factionInfo }`。

### 3.4 获取：商店抽取

现在 `makeFactionStock(faction, day)` 从该势力全池随机 3 件、重复率 32%。改为先按阶级加权、再按声望过滤：

| marketLevel | 一阶 | 二阶 | 三阶 | 四阶 | 五阶 |
|---|---|---|---|---|---|
| 1 | 55 | 30 | 12 | 3 | 0 |
| 2 | 40 | 32 | 20 | 7 | 1 |
| 3 | 28 | 30 | 24 | 14 | 4 |
| 4 | 18 | 26 | 28 | 20 | 8 |
| 5+ | 10 | 20 | 30 | 28 | 12 |

- 过滤：`item.standingReq <= state.factions[faction].standing`。门槛不足的高阶装备**不进池**，不摆出来让人看得到买不到。
- 保底：`marketLevel ≥ 3` 时，连续 5 个商店日没出现四阶及以上，则本日第一件强制四阶（用 `hashText` 派生，保持可复现）。
- 同一商店日内三件不重复（现在 32% 概率直接重复，改成先重掷一次）。
- 商店头部显示「当前声望可解锁到 X 阶」，让被过滤掉的东西变成可见目标。

## 4. 精英 buff

### 4.1 六条 buff

| id | 名 | 血量× | 属性× | 共情× | 追加技能 | 追加规则 |
|---|---|---|---|---|---|---|
| `elite-overload` | 过载 | 1.60 | 1.15 | 1.10 | `monster-static` | `roundStart` haste 3 |
| `elite-mirror` | 镜面 | 1.50 | 1.10 | 1.25 | `monster-mirror` | `always` damageReduce 10 |
| `elite-sweet` | 嗜甜 | 1.70 | 1.10 | 1.20 | `monster-sweet-decree` | `roundStart` heal 8 |
| `elite-night` | 夜行 | 1.45 | 1.30 | 1.05 | `monster-scream` | `always` buff agility 6 |
| `elite-swarm` | 群聚 | 1.40 | 1.12 | 1.30 | `monster-mosaic` | `hit` debuffAttacker hit 4 |
| `elite-plague` | 结症 | 1.65 | 1.08 | 1.35 | `monster-dissolve` | `roundStart` dot 3 / 2 轮 |

- 追加技能全部取自现有 `monster-*` 技能，不新增技能条目。
- 六条 buff 分别偏向「硬度 / 减伤 / 自愈 / 速度 / 扰乱 / 持续伤害」，保证玩家看名字就知道该怎么打（图鉴里也写一句对策）。

### 4.2 表现

- 战斗界面单位条上，精英在名字后加一个「精英 · 过载」的角标（复用现有 buff 角标样式），血条描边用 buff 的 `color`。
- 战报标题与委托详情里写明「（精英）」，让玩家在接单时就知道要带谁。

### 4.3 图鉴：精英 buff 独立条目

`EliteBuff` 除了 `blurb`（一句话气质）再加一个 `counter`（怎么打），图鉴里与魔物并列成第二栏：

```ts
export interface EliteBuff {
  // …见 §2.2
  /** 图鉴正文：这条 buff 让怪物变成了什么。 */
  blurb: string;
  /** 图鉴对策：玩家该怎么应对。 */
  counter: string;
}
```

| buff | 图鉴正文（blurb） | 对策（counter） |
|---|---|---|
| 过载 | 糖分在体内烧成了静电，它的动作比同类快半拍，抽动时会漏出白色的光。 | 别跟它比先手：带一个高洞察的少女，把它的加速拖到第二轮再打断。 |
| 镜面 | 表皮像糖壳一样反光，所有落在它身上的伤口都会先被照一遍。 | 减伤是固定的，堆一次高伤的收益高于多段小伤害。 |
| 嗜甜 | 它一直在吃，吃到伤口自己长回去。地上留下的糖渣是它吃过的证据。 | 拖长战斗只会喂饱它，两轮内打完，或用持续伤害压掉回复。 |
| 夜行 | 它不反射光，只反射声音，出手比看见的更快。 | 敏捷领先时先控后打；命中不够就别硬拼，先降它速度。 |
| 群聚 | 它把自己拆成了很多份，每一份都以为自己才是本体。 | 群攻技能一次清掉分身，否则每轮都在补人。 |
| 结症 | 它走过的地方会结晶，伤口里也长出糖。 | 带净化或解毒，别让持续伤害叠到第三层。 |

- 图鉴入口沿用现有魔物图鉴的位置，加一个「精英」分段（`#codex-tab-elite`），条目选择器 `#codex-elite-{id}`。
- 这 12 段文本（6 条 buff × 正文 + 对策）是本次唯一新增的纯文案量，写进 `src/content/eliteBuffs.ts`，不单独建文件。
- 图鉴里同时显示「会携带这条 buff 的魔物」不列清单——所有普通怪都可能被挂上，列出来反而误导。

## 5. 魔物池：20 只普通

### 5.1 分层与预算

| 分层 | 来源 | 血量 | 属性合计 | 规则 |
|---|---|---|---|---|
| 普通 | 模板本体 | 100–300 | 180–280 | 0–2 条 |
| 精英 | 普通 + buff | ×1.4–1.9 | ×1.05–1.30（共情再 ×1.05–1.35） | 本体规则 + buff 规则 |

- 现有 6 只（`echo-cat`、`sugar-moth`、`night-tram`、`mirror-nun`、`candy-king`、`hollow-moon`）全部并入普通池，**需要新写 14 只**，合计 20。
- 每只都要有 `spec`（程序化立绘参数）与 `codex`，否则工坊预览与图鉴是空白；普通怪允许共用 `bodyPlan`，靠 `palette` + `motif` + 简介区分。
- 元素分布覆盖全部 7 个 `Element`，避免委托列表里敌人全是一个色系。

### 5.2 出场规则

替换现在写死的 `factionEnemies` 与部分 `seedMissions.enemyIds`：

```ts
export interface SpawnedEnemies { ids: string[]; buffs: (string | null)[]; }
export function rollEnemies(state: GameState, opts: { count: number; difficulty: Difficulty; pollution: number; missionId: string }): SpawnedEnemies;
```

- 低危 / 中危：只出普通，`count = 2–3`。
- 高危 / 绝望：`count = 3`，并按 §9 的概率给其中一只挂 buff。
- `hollow-moon` 保留在池里，但只由 `hollow` 这条剧情委托显式引用，不进随机抽取（`storyOnly?: true`）。
- 抽取用 `hashText(missionId + index)` 派生，同一天刷新结果稳定，与现有商店/市场一致，不用 `Math.random`。

## 6. 委托模板：战斗 10 + 调查 6

### 6.1 现有 7 条的分类

战斗 4：`station`、`mirror`、`arcade`、`hollow`（这条是剧情关，保留显式 `enemyIds`）。
调查 3：`candy`、`cat`、`tower`。

→ 新写 **6 条战斗 + 3 条调查**，凑满 10 + 6。

### 6.2 难度不再写死在模板里

模板只决定「这一单是什么事」（战斗还是调查、判哪个属性、文案与辖区风味）。**难度在生成时由辖区污染度决定**（§2.5），然后反向缩放模板：

| 抽到的难度 | 时长 | 报酬 | 目标值 | 推荐等级 | 敌人数（战斗） | 精英概率 |
|---|---|---|---|---|---|---|
| 低危 | ×0.85 | ×0.75 | ×0.90 | 2–3 | 2 | 0 |
| 中危 | ×1.00 | ×1.00 | ×1.00 | 4–5 | 2–3 | 8–25% |
| 高危 | ×1.25 | ×1.40 | ×1.10 | 5–6 | 3 | 35–60% |
| 绝望 | ×1.50 | ×1.90 | ×1.20 | 7–8 | 3–4 | 必有一只 |

- 所以模板池里不再「低 4 / 中 4 / 高 2」，而是 **战斗 10 + 调查 6，各自只按主题铺开**；模板自带的 `difficulty` 字段保留，含义降级为「基线」，只用于工坊预览与故事线套用，`makeCommission` 生成时会覆盖它。
- 缩放后的 `target` 上限锁 96（现有 Boss 委托是 95），避免绝望档把它顶到必失败。
- 缩放只在 `makeCommission` 里发生；故事线委托、代表委托、LLM 提案委托、工坊投放测试**都不缩放**，保持作者写的数值。
- 缩放结果写进 `Mission.difficulty` 与 `Mission.scaledFrom?`（记基线），工坊与战报里能看出「基线中危 → 绝望」。

### 6.3 模板自身该写的字段

- 调查委托的 `requirement` 分布：`empathy` 2、`insight` 2、`agility` 1、`magic` 1。
- `category` 沿用现有词表（异象调查 / 紧急委托 / 结界修复 / 市民求助 / 心愿回收），不造新词。
- **不写 `district`**：全部按 `x/y` 由 `districtAt()` 自动判定，避免同一模板永远刷在同一区。
- 战斗模板不写死 `enemyIds`，只写 `enemyCount` 与主题标签，实际敌人由 §5.2 抽。

### 6.4 委托池的循环：现状与本次改动

先说清现在的实际行为（v23 代码，`src/game.ts`），因为「完成移出 + LLM 补充」这个印象已经和实现对不上了：

| 环节 | 现状 | 位置 |
|---|---|---|
| 生成 | **纯本地、确定性**。每晚三个时段按 `WAVE_SIZES = [3, 2, 2]`（`src/shift.ts:16`）刷 7 条，模板从 `commissionPool()` 取（seed-pack 里非 boss 的 7 条 + 工坊自制），模板选择用 `hashText(day:wave:slot:district)` | `game.ts:756 makeCommission`、`game.ts:889 syncShift` |
| 过期 | 到 `deadlineAt` 就置 `expired` 并写日志「超过接取时限，委托已自动撤销」 | `game.ts:880-887` |
| 打烊 | `closeShift` 只留：`done` / `active` / 未到期长期委托里期限最晚的 8 条 / 带剧情线的；其余（含 `expired`、没接的短委托）全部删除 | `game.ts:913-924` |
| 完成 | `status = 'done'`，**永远留在 `state.missions` 里**，地图与列表当作「已完成」历史继续显示 | `game.ts:1915`、`DispatchMap.tsx:50` |
| LLM | **不是完成即补位**。夜间提案只拿到 `pool.missions = poolLimits.missions(12) − 未完成委托数` 的余量，可以顺便产出新委托/魔物/候选/舆评，但不保证生成，也不由完成事件触发 | `llm-night.ts:705` |

也就是说现在的循环是「每晚定时刷 7 条 + 到期作废 + 打烊清板」，LLM 是叠加在余量上的随机补充，不是驱动循环的引擎。

本次要改两处，都是上面这张表暴露出来的问题：

1. **完成委托归档**：`state.missions` 只保留 `open` / `active` / 最近 **30 条** `done`，更早的从数组里删掉。历史不丢——`state.completed` 已经记了 id（`game.ts:1915`），统计口径不变。现在每天最多 7 条 `done` 只增不减，几十天后地图与存档都在发胖。
2. **Boss 委托常驻**：见 §7.2。现在 `closeShift` 会把 `status: 'open'` 的 Boss 委托当普通短委托删掉，`state.boss` 却还在继续扣声望，直到 48 小时期限把人赶走。

这两处都不改生成方式：仍然本地确定性刷新，LLM 仍然是可选的余量补充。

## 7. Boss 池

### 7.1 首只：糖霜王座

```ts
export const bosses: BossTemplate[] = [{
  id: 'boss-candy-throne', name: '糖霜王座', title: '加冕的蛀牙',
  blurb: '糖果街的甜味在某个夜里被抽干了。游乐场中央的王座长高了一截，坐上去的东西正在给自己加冕。',
  monsterId: 'candy-throne',
  maxHp: 2400,
  // 心防由 empathy 决定：v25 的规则是「心防 = 面板共情」，所以共情就是它的心防长度
  stats: { magic: 96, insight: 88, agility: 72, empathy: 180 },
  phases: [
    { atHpPct: 1.00, skillIds: ['boss-sugar-crown', 'boss-clock-hands'], line: '它把糖冠按回头顶，全城的灯都暗了一格。' },
    { atHpPct: 0.62, skillIds: ['boss-sugar-crown', 'boss-mirror-litany'], addIds: ['sugar-moth', 'sugar-moth'], line: '王座开始融化，甜味变成了粘住脚踝的东西。' },
    { atHpPct: 0.30, skillIds: ['boss-tide-of-names', 'boss-clock-hands'], line: '它张了张嘴，吐出的全是别人的名字。' },
  ],
  reward: 5200, duration: 90, recommendedLevel: 6, color: '#F2A0C0',
  firstDay: 10, defeatGapDays: 10, pollutionPressure: 3,
}];
```

- **血量按「多轮消耗战」定**：`maxHp 2400`（普通王座级 360 的 6.7 倍）。一次满编（3 人、6 回合）大约能削 500–700，正常要 4–5 次派遣才打完；带齐装备与高等级能压到 3 次。心防不是血条，是 v25 的「被打穿前血量伤害 −30%」，靠 `empathy: 180` 撑到心防 360，需要 4–5 发共情技才破。
- 共情值抬高的意义是把「靠精神条速杀」这条捷径堵掉，让玩家必须按阶段拆血。
- `empathy: 180` 撑出心防 360（v25：心防 = 面板共情 × 2），普通王座只有 80–144，所以糖霜王座被共情技打穿需要 4–5 发而不是 1–2 发。
- 主体魔物是新写的 `candy-throne`「糖霜王座」（普通池里另有一只 `candy-king`「糖王」，两者不是同一个东西：糖王是街上那只吉祥物，王座是它坐的那把椅子长出来的东西）。
- 技能全部取自 v20 已建的 `src/content/bossSkills.ts`（8 条 `tier: 'boss'`），不新增技能。
- 三阶段血量线 1.00 / 0.62 / 0.30；第二阶段添两只糖蛾，第三阶段换成高伤害组。

### 7.2 节奏：不超时，常驻到被清掉

- `firstDay = 10`：第 10 天首次登场。
- **Boss 不会超时**：登场后一直挂在板上（`status: 'open'`），直到被击败。不做 48 小时撤离，也不做委托作废。
- **击败后隔 10 天**：`nextBossDay = day + defeatGapDays`（10），在击败结算时写入。首只第 10 天来，清掉后第 20 天再来。
- 需要改掉的三处现状：
  1. `bossTick`（`game.ts:539-556`）删掉 `now >= state.boss.deadline` 的撤离分支——现在它会扣 6 点声望、清空 `state.boss`、删掉委托并写「空月自行离开了城市上空」。
  2. `closeShift`（`game.ts:913-924`）的保留条件加上 `mission.boss`。现在 Boss 委托是 `status: 'open'` 且没有 `deadlineAt`，正好落在「既不是 done/active、也不在未到期长期委托里」的缝里，**登场当晚就打烊被删**（实测：第 10 天板上有 `boss-10`，睡一觉后板上没了，`state.boss` 却还在扣声望，直到 48 小时期限把它抹掉）。
  3. `game.ts:2267` 的 `state.nextBossDay = state.day + 3` 从「登场时写死」改成「击败时按 `defeatGapDays` 写」。
- 压迫感：**声望一直扣，不封顶**。
  - 每 3 小时 −1 声望（沿用 `bossTick` 现有节奏），从登场一直扣到被击败，没有上限、也不会自己停下。
  - 同时每天给九区各 +3 污染（`pollutionPressure`），也就是拖得越久，市面上的委托越难打——两条代价是叠加的。
  - 城市页与地图顶部给一条压迫条（`#boss-pressure`），写明「已失去 X 声望 · 每日全城 +3 污染 · 血量剩 Y%」，让玩家随时知道自己在为拖延付账。
- `BossState.deadline` 字段保留（旧存档里还有值），但不再参与任何判定；迁移时不动它，读取时忽略。

### 7.2.1 血量继承：一次打不完，接着打

Boss 不再是「一场定胜负」，而是**跨多次派遣的消耗战**：

- `BossState.hp` / `maxHp` 是本轮剩余血量，登场时初始化为模板满血。
- `simulateBattle` 的 `BattleSetup` 加 `enemyHpOverride?: number[]`（与 `enemyIds` 下标对齐，和 `enemyBuffs` 同一套约定），Boss 那一场用它把 0 号敌人的 `hp` 设成 `state.boss.hp`。
- 战斗结束（胜利 / 击退 / 失败**都算**）把 Boss 单位的剩余 `hp` 写回 `state.boss.hp`：`state.boss.hp = endHp`。这样打输一次也不是白跑——只是换了点血。
- 只有把 `hp` 打到 0 才算击败（走 §7.2 的清零与重置）。`mission.worsened` 那条「下次血量 −20%」对 Boss 不生效，避免和继承叠加成双重削弱。
- **只有血量继承，心防每场重置为满**：v25 规定战斗内不可恢复共情，跨战斗也不记账，每场从满值开始。
- Boss 委托不消耗次数、不进冷却，`mission.status` 一直保持 `open`，可以连着几晚反复派。
- 战报与地图上的 Boss 委托显示「血量 1480 / 2400（62%）」，打完一次当晚就能看到进度。
- 阶段切换按**绝对血量比例**判定（`hp / maxHp`），所以第二次进场时会直接从上一轮留下的阶段开始，不会把已经打过的阶段重放一遍。

### 7.3 生成流程替换

现在 `makeBossMission(state)` 是定值函数（写死「空月降临」、`hollow-moon` 主体、reward 8000）。改为：

```ts
function pickBoss(state: GameState): BossTemplate;                      // bosses + customBosses 里按 cycle 轮取
function makeBossMission(state: GameState, boss: BossTemplate): Mission;
function spawnBossMonster(state: GameState, boss: BossTemplate): string; // 合成 Boss 版魔物副本，注册进 customMonsters
```

- `spawnBossMonster` 把 `maxHp` / `stats` / 三阶段技能写进**一份副本**（id `boss-mon-<bossId>`），于是 `combat.ts:310` 原有的 `bossPhaseSkillIds` 换组逻辑不用改。
- 副本上额外带 `bossPhases?: BossPhase[]`，供战斗日志读阶段台词；工坊怪物编辑器不展示这个字段。
- 旧存档里正在进行的 `boss-*` 委托**不重写**：那是玩家已经在打的东西，中途换模型比留着更糟。

## 8. 工坊扩展

`WorkshopKind` 现在 5 种：`mission` / `skill` / `item` / `monster` / `incident`。加第 6 种 `boss`。

### 8.1 Boss 编辑器

- 入口 `#workshop-kind-boss`，与现有 `#workshop-kind-*` 同排。
- 字段：名称、称号、简介、主体魔物（下拉，来自 `monsters` + `customMonsters`）、血量、奖励、时长、推荐等级、首日、击败后间隔、三组阶段（血量比例 / 技能多选 / 添怪多选 / 台词）。
- 保存校验（拦下并给出原因）：
  - 阶段 1–3 段，`atHpPct` 严格递减且第一段为 1。
  - 技能 id 必须存在且 `tier === 'boss'`（或已存在的自定义技能）。
  - 主体魔物必须存在；`boss-mon-` 前缀的副本不能被选为主体（防止套娃）。
  - id 冲突时加 `-2` 后缀，不覆盖内置。
- 选择器：`#workshop-boss-name`、`#workshop-boss-monster`、`#workshop-boss-hp`、`#workshop-boss-reward`、`#workshop-boss-first-day`、`#workshop-boss-gap`、`#workshop-boss-phase-1..3`、`#workshop-boss-save`、`#workshop-boss-delete`。

### 8.2 顺带补的字段

- 装备编辑器加「阶级」下拉（`#workshop-item-tier`）：新建必填，编辑旧数据时显示推断值。
- 魔物编辑器**不加**分层下拉（分层已不在数据里）；改为在预览区显示「可携带精英 buff：过载 / 镜面 / …」的只读一行。
- 精英 buff 本期只做内容文件，不做工坊编辑（六条够用，且它们动的是战斗平衡，随手改容易失衡）。

### 8.3 内容库

- `ContentLibrary.bosses`，导出/导入带上；`sanitizeLibrary` 对 boss 用与工坊同源的校验，坏条目丢弃并计数。
- 库面板加「Boss」一栏，与装备、魔物并列。

## 9. 抽取数值汇总（实现时直接抄）

**商店阶级权重**：见 §3.4。

**精英 buff 出现率**（挂在 `rollEnemies` 里）：

| 难度 | 基础概率 | 污染 ≥ 50 | 污染 ≥ 80 |
|---|---|---|---|
| 低危 | 0 | 0 | 0 |
| 中危 | 8% | 15% | 25% |
| 高危 | 35% | 50% | 60% |

- 每次最多一只精英；buff 从 6 条里用 `hashText(missionId + 'buff')` 取。
- Boss 战不挂精英 buff（阶段添怪已经是普通怪，避免强度叠爆）。

**Boss 节奏**：第 10 天首现；血量跨战斗继承；打完为止；击败后 +10 天、九区污染清零、`cycleStartDay` 重置。

**污染循环**：

| 量 | 值 |
|---|---|
| 污染地板 | `min(30, 本轮天数 × 3)` |
| 自然日增 | `1 + floor(level / 30)` |
| Boss 每日压迫 | 九区各 +3 |
| 净化的下限 | 地板（擦不到 0） |
| 击败 Boss | 九区 = 0，地板回到 3 |
| 难度权重 | §2.5 的五段表 |

## 10. 存档兼容与迁移

`GameState.version` 17 → 18，迁移放在 `loadState` 现有补字段段落：

1. `state.customBosses ??= []`。
2. `state.boss?.template ??= 'boss-candy-throne'`；若指向的模板不存在，回落到内置第一只。
3. `state.boss` 存在时 `hp ??= maxHp ??= 模板.maxHp`（旧 Boss 没有血量继承，按满血补）。
4. `state.cycleStartDay ??= 1`（老的存档按第 1 天起算，地板从 3 开始）。
5. `state.missions` 里旧的 `boss-*` 委托保持原样（不重写）。
6. `enemyBuffs` 缺省补 `undefined`（旧委托没有精英）。
7. `customMonsters` 里的魔物不需要补字段（分层已不在数据里）。
8. 若委托的 `enemyIds` 引用了已被工坊删掉的魔物，回落到普通池第一只并记日志（沿用现有修复逻辑）。
9. `inventory` 里的装备 id 全部保留（12 条老 id 不改）。

## 11. 测试计划

### 11.1 状态测试（`tests/game.test.ts` + 新增 `tests/content.test.ts`）

1. 装备池 80 条、id 唯一、按 tier 计数 = 28/24/16/9/3。
2. 每条装备的 `price` 落在其阶级价格带内；`standingReq` 与前四阶表值一致，五阶**全部等于 80**。
3. `tierOf()` 边界（1200 / 2600 / 5000 / 9000）各一条。
4. 消耗品 `heal` / `purify` 随阶级单调递增。
5. 魔物池 20 条、id 唯一、每只都有 `spec` 与 `codex`；元素覆盖 7 种。
6. 精英 buff 6 条；`applyEliteBuff` 后血量与属性符合倍率，技能与规则被追加且不重复。
7. `rollEnemies`：低危不出精英；高危在固定 seed 下能出且只出一只；`hollow-moon` 不出现在随机结果里。
8. 委托模板 16 条、战斗 10 / 调查 6、全部没有 `district` 字段；`difficulty` 只是基线。
8b. `difficultyWeights`：五段分界（19/20/39/40/59/60/79/80）各一条，权重合计 100。
9. 商店：`marketLevel` 1 时不出五阶；声望 < 80 时五阶不进池；声望 80 时能出现；保底在连续 5 日后触发一次。
10. Boss：首次登场日为第 10 天；击败后 `nextBossDay = day + 10`；模板能生成委托与魔物副本；副本带三阶段。
11. 工坊：新建 Boss → 进 `customBosses` → 下一次 `pickBoss` 能选中；阶段比例非递减被拒。
12. 内容库：导出含 `bosses`；导入坏数据被丢弃且不污染其它条目。
13. 迁移：v17 存档读入后 `version === 18`、`customBosses === []`、`boss.template === 'boss-candy-throne'`、`cycleStartDay === 1`、`boss.hp === boss.maxHp`。
14. Boss 常驻：连过三晚 `endNight`，板上始终有 `boss-*` 委托且 `state.boss` 非空；声望每晚都在下降（**没有上限封停**）。
15. Boss 血量继承：固定 seed 打一场，`state.boss.hp` 小于满血且等于战报里 Boss 的剩余血量；下一场从该值开打；把 hp 设成 100 再打一场则 `state.boss === null`。
16. Boss 污染压迫：`state.boss` 在场时过一晚，九区各自至少 +3（叠加自然涨幅）。
17. 污染地板：`cycleStartDay = 1` 时第 10 天地板 27；完成委托把某区压到 0 后，当晚结算回到地板值；击败 Boss 后九区全 0 且 `cycleStartDay === 击败日`。
18. 委托难度跟着污染走：把某区污染设 10 / 45 / 85，各生成 20 条该区委托，高危（或绝望）占比依次上升且符合 §2.5 权重。
19. 难度缩放：同一模板在低危与绝望下生成的 `target` 与 `reward` 落在 §6.2 的倍率区间。
20. 委托归档：连续 5 晚全接全打，`state.missions` 里 `done` 不超过 30 条，`state.completed` 的长度照旧增长。
21. 图鉴：6 条精英 buff 都有非空 `blurb` 与 `counter`；`EliteBuff` 数量与图鉴分段渲染一致。

### 11.2 浏览器流程（+4）

1. 商店：声望拉到 80、市场等级 4，刷新后能看到五阶装备并可购买；声望降到 79 后该条不再出现。
2. 工坊：新建一只 Boss（改名、选主体、填三阶段）→ 保存 → 重开面板仍在 → 出击列表能刷出以它为主体的城市级威胁。
3. 战斗：高危委托的敌人里出现「精英」角标，且该单位血量高于同名普通怪（用 `writeSave` 固定 seed 后断言）。
4. 图鉴：切到「精英」分段，6 条 buff 都能选中并显示正文与对策。
5. Boss 消耗战：`writeSave` 把 Boss 血量设成 60%，进 Boss 委托打一场，出来地图上的 Boss 血量低于 60%，且压迫条显示剩余声望损失。

目标规模（实际落地）：状态测试 277 → **302**（+25，`tests/v24.test.ts`）、浏览器流程 86 → **91**（+5：商店五阶、工坊 Boss、图鉴精英、委托精英角标、Boss 压迫与血量继承）。

## 12. 实施顺序

| 步 | 内容 | 产物 |
|---|---|---|
| 1 | 类型与访问器（`EquipmentTier`、`EliteBuff`、`BossTemplate`、`BossState.hp/template`、`Mission.enemyBuffs`、`cycleStartDay`、version 18） | `types.ts`、`src/items.ts`、`src/content/eliteBuffs.ts`、`pollution.ts`、迁移 |
| 2 | 装备 80 条 + 文件拆分 | `src/content/equipment/*.ts` |
| 3 | 商店抽取改造（权重、声望过滤、保底、头部提示） | `game.ts` 的 `makeFactionStock` |
| 4 | 魔物 20 只 + `applyEliteBuff` + `unitFromMonster` 接线 | `monsters.ts`、`combat.ts` |
| 5 | 污染循环（地板 / 压迫 / 击败清零）+ `difficultyWeights` + 难度缩放 | `pollution.ts`、`game.ts` |
| 6 | 委托 16 条 + `rollEnemies` 接入 + `done` 归档上限 30 | `seed-pack.ts`、`game.ts` |
| 7 | Boss 池（糖霜王座）+ 常驻/血量继承/击败后 10 天 + 副本生成 | `src/content/bosses.ts`、`game.ts`、`combat.ts` |
| 8 | 工坊 boss 类型 + 装备阶级字段 + 图鉴精英分段 + 库导出 | `ContentWorkshopDialog.tsx`、`library.ts`、图鉴视图 |
| 9 | 测试、`README` / `tasks/todo.md` 同步 | `tests/*`、文档 |

第 1 步是其余全部的前置；2–7 各自能单独验证；第 8 步依赖第 1、7 步。

## 13. 风险与取舍

- **内容量仍在内容本身**：14 只新魔物 + 9 条新委托 + 68 件装备，写崩了就是同质堆料。取舍：普通怪共用 `bodyPlan`、靠配色与主题区分；装备严格按阶级预算表写，超出预算先改预算表再写条目。
- **精英 buff 的平衡风险转移了**：以前调一只精英怪，现在调一条 buff 会同时影响 20 只怪。取舍：buff 倍率集中在 `eliteBuffs.ts` 的六个数字上，配合 §11 第 6、7 条测试锁住区间。
- **五阶 80 声望等于「几乎买不到」**：现有涨声望速度下，一周目可能只够一方到 80。取舍：这是有意的，五阶设计成关系确立的回报；商店头部写明解锁进度，避免被当成 bug。
- **Boss 首只不是空月**：空月原先是唯一的城市级威胁，现在降级为剧情怪。取舍：空月仍在 `hollow` 委托里，叙事分量不减；`bosses` 是数组，第二只（可以是空月）以后加数据即可。
- **Boss 的压力不设上限，必须靠 UI 说清**：每 3 小时 −1 声望且一直扣到打赢为止，玩家如果没注意到 Lords 在扣分，会觉得游戏坏了。取舍：压迫条常驻城市页与地图顶部，写清「已失去 X 声望 · 每日全城 +3 污染 · 血量剩 Y%」。
- **血量继承会让 Boss 变成必修课**：2400 血要打 4–5 次，玩家必须持续供给（少女疲劳、装备、药品）。取舍：继承同时意味着每次派遣都有进展、不会白跑；Boss 血量显示在委托上，进度可见。
- **污染地板让净化贬值**：第十天擦一次只能把 33 压到 27，收益肉眼下降。取舍：这正是循环想要的压迫感；净化的意义从「归零」变成「拖慢」，而且击败 Boss 会给一次彻底清零。
- **`enemyBuffs` / `enemyHpOverride` 平行数组**：两者的下标都必须与 `enemyIds` 对齐，任何裁剪敌人列表的地方都要同步裁。取舍：统一在 `rollEnemies` 与 `simulateBattle` 出口生成，其余地方只读不写。
- **`done` 归档不动历史**：只裁 `state.missions` 里的展示用副本，`state.completed`（id 列表）保留全量。取舍：地图上不再堆几十个「已完成」图钉，统计与成就判定不受影响。

## 14. 已确认的决定（留档）

1. **五阶只能靠关系**：望族关系 80 才解锁，不做「有钱就能买」。
2. **不做精英魔物**：精英是 buff，普通怪 20 只，buff 6 条。
3. **Boss 不超时**：登场即常驻，声望一直扣、每日全城 +3 污染，直到被击败。
4. **Boss 血量继承**：`maxHp 2400`；心防 = 共情 180（v25）；一次打不完，多派几次接着打。
5. **难度由辖区污染决定**：污染越高高危越多；不绑辖区，模板只分战斗 10 + 调查 6。
6. **污染按 10 天循环**：地板每天 +3（上限 30），击败 Boss 九区清零并重置本轮。
7. **精英 buff 进图鉴**：6 条各配正文与对策（§4.3）。

无待确认项，按 §12 直接实施。
