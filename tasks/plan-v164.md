# 方案 v164 · 流派被动技能（与主动混选，最多 1 条）

## TASK

给六个元素流派各 2 条被动技能，魔物 2 条，通用 4 条，共 18 条。被动与主动技能放在同一张技能表、同一个选择器里；
任何单位一次最多选 1 条被动，被动占一个技能位，不额外开槽。

**已确认的规则**：被动和主动混在一起选，每次最多 1 个被动；三个技能位任意排，被动可以占任意一位。
生成候选不再强制「一基础一本职一奥义」，只硬卡「最多 1 条被动」；剩下按阶级权重抽，避免三条全是奥义或全是基础。

## 规则

### 一个技能位

- 少女 / 魔物 / 名册首领与随从的技能列表里，`tier === 'passive'` 的条目 **最多 1 条**。
- 被动占一个技能位：带被动的少女有 2 条主动；带被动的魔物在原有主动之外最多再加 1 条被动。
- 装备附带的技能只能是主动：否则「技能位 1 条被动 + 装备 1 条被动」会绕过上限。
- Boss 阶段技能只能是主动：Boss 的三阶段换招已经够重，不再叠被动。
- 战报里被动单独记为 `被动 · 名称`，不参与每回合的出招选择。

### 各入口怎么卡

| 入口 | 规则 |
| --- | --- |
| 候选生成 `pickCandidateSkills` | 30% 概率带 1 条被动，占任意一位；三格自由组合，只硬卡「最多 1 条被动」。主动按阶级权重抽（基础 55 / 本职 30 / 奥义 15），避免三奥义或三基础 |
| 自定义建人 `CustomGirlDialog` | 3 格混选，最多 1 条被动；点第二条被动时提示并拒绝，其余主动不限阶级 |
| 契约卡 `parseGirlCard` | 3 个 id 里最多 1 条被动，多了整张卡拒收 |
| 工坊魔物 | 最多 1 条被动；Boss 阶段选择器过滤掉被动 |
| LLM 起草 | 模型给超过 1 条时只留第一条；缺的按抽取补主动 |
| 名册首领 / 随从 | 清洗时最多留 1 条被动 |
| 装备 `skillId` | 只接受主动；工坊与清洗都过滤 |

## 数据

被动不是新的 `SkillTier` 之外的体系，而是技能表里的一类：

```ts
export type SkillTier = 'basic' | 'signature' | 'ultimate' | 'passive' | 'boss';

export interface PassiveSpec {
  always?: {                    // 进战斗单位时结算一次
    hit?: number;
    initiative?: number;
    damageBonus?: number;       // 百分比整数
    damageReduce?: number;      // 百分比整数，最多 20
    maxHpPct?: number;          // 最多 15
    guardPct?: number;          // 心防上限百分比，最多 15
    stats?: Partial<Record<StatKey, number>>;
    belowHpPct?: number;        // 常驻条件：血量低于该比例才生效
  };
  trigger?: {
    on: 'battleStart' | 'roundStart' | 'onHit' | 'onHurt' | 'onKill';
    target: 'self' | 'allies' | 'attacker' | 'target';
    effect: SkillEffect;        // 复用 shield / regen / dot / buff / debuff / stun
    belowHpPct?: number;
    maxUses?: number;           // 每场次数上限；1 等同「每场一次」
    oncePerRound?: boolean;
  };
}

export interface Skill {
  // …现有字段
  tier: SkillTier;
  passive?: PassiveSpec;
}
```

被动条目本身仍填 `power: 0`、`targets: 0`、`side: 'self'`、`cooldown: 0`、`effects: []`，
但这些数字不参与任何计算；所有被动行为只读 `passive`。

## 18 条设计

### 星光系 · 校准与守夜

| id | 名称 | 触发 | 效果 |
| --- | --- | --- | --- |
| `passive-star-calibration` | 星轨校准 | 常驻 | 命中 +7。她把每一次抬手都先在心里走一遍星图。 |
| `passive-constellation-watch` | 星座守夜 | 开场 | 我方全员获得 6 点护盾，持续 2 轮。最先亮的那颗星替所有人挡了一下。 |

### 糖霜系 · 外壳与回甘

| id | 名称 | 触发 | 效果 |
| --- | --- | --- | --- |
| `passive-sugar-shell` | 糖壳护心 | 常驻 | 心防上限 +12%。硬糖壳裂开之前，里面的人不会碎。 |
| `passive-sweet-aftertaste` | 回甘 | 回合开始 | 自身血量低于 60% 时回复 5 点，每场最多 3 次。苦味过去之后，甜才慢慢返上来。 |

### 月影系 · 先手与尾音

| id | 名称 | 触发 | 效果 |
| --- | --- | --- | --- |
| `passive-moon-first-step` | 月相先手 | 常驻 | 速度 +5。月亮升到哪个位置，她就该在哪个位置。 |
| `passive-silent-coda` | 静默尾音 | 命中 | 每轮第一次命中，目标敏捷 −8，持续 2 轮。声音撤走之后，动作会慢半拍。 |

### 梦境系 · 共感与入梦

| id | 名称 | 触发 | 效果 |
| --- | --- | --- | --- |
| `passive-empathic-circuit` | 共感回路 | 常驻 | 共情 +6。她能听见别人没说出口的那半句。 |
| `passive-drift-off` | 入梦 | 命中 | 每场第一次命中，目标眩晕 1 轮。只失神一拍，足够改写整场夜班。 |

### 自然系 · 蔓生与回礼

| id | 名称 | 触发 | 效果 |
| --- | --- | --- | --- |
| `passive-overgrowth` | 蔓生 | 回合开始 | 自身回复 3 点血量。伤口边缘长出细小的白花。 |
| `passive-thorn-return` | 荆棘回礼 | 受击 | 每轮第一次被击，攻击者获得 4 点持续伤害，持续 2 轮。碰过她的人，手上会留下刺。 |

### 赤焰系 · 余烬与燎原

| id | 名称 | 触发 | 效果 |
| --- | --- | --- | --- |
| `passive-ember` | 余烬 | 常驻 | 造成伤害 +9%。火熄了，灰还是烫的。 |
| `passive-wildfire` | 燎原 | 击杀 | 自身回复 8 点血量，每场最多 2 次。倒下一个，火就往前挪一步。 |

### 魔物 · 困兽与残响

| id | 名称 | 触发 | 效果 |
| --- | --- | --- | --- |
| `passive-cornered-beast` | 困兽 | 常驻（血量 < 50%） | 造成伤害 +15%。被逼到墙角的东西最不该被低估。 |
| `passive-echo-return` | 残响 | 受击 | 每轮第一次被击，攻击者命中 −6，持续 2 轮。打它的人会听见自己的手在抖。 |

### 通用 · 夜班底子

| id | 名称 | 触发 | 效果 |
| --- | --- | --- | --- |
| `passive-night-shift-kid` | 夜班底子 | 常驻 | 生命上限 +10%。熬过太多夜的人，比看起来能扛。 |
| `passive-plain-steady` | 稳手 | 常驻 | 命中 +4。手不抖，是因为已经没什么好怕的了。 |
| `passive-quick-step` | 快一步 | 常驻 | 速度 +4。她总比麻烦早到半步。 |
| `passive-unbroken` | 不熄 | 受击 | 每场第一次血量降到 30% 以下时，回复 10 点。灯灭之前，她还会再亮一次。 |

## 战斗接入

`src/passives.ts` 负责派生与查询；`src/combat.ts` 只加几个小口子：

| 位置 | 做什么 |
| --- | --- |
| `unitFromGirl` / `unitFromEnemyGirl` / `unitFromMonster` | 从 `skills` / `skillIds` 里认出那条被动；结算 `always`（生命、心防、属性、命中、速度、伤害、减伤） |
| 开场（第 1 轮行动前） | 触发 `battleStart`（星座守夜） |
| 每轮开始（现有 DOT / regen 结算之后） | 触发 `roundStart`（回甘、蔓生） |
| 命中结算之后 | 攻击者触发 `onHit`（静默尾音、入梦），目标触发 `onHurt` |
| 目标血量归零时 | 攻击者触发 `onKill`（燎原） |

- `pickSkill` 先过滤 `tier === 'passive'`；一条主动都不剩时回落 `plain-strike`，不会把被动当技能放出来。
- `BattleUnit` 增加 `passive?: Skill`、`passiveUsed?: Record<string, number>`、`passiveRound?: Record<string, number>`。
- 每次触发写 `BattleEvent`：`skillId: 'passive-…'`、`skillName: '被动 · 名称'`；战报能解释数字变化。
- 「每轮第一次」「每场第一次」用 `passiveRound` / `passiveUsed`；多个单位带同一条被动时各自独立计数。
- 触发全部确定性，不掷额外骰子；同种子同编队仍然同结果。

## 数值上限

- 命中 / 速度单条 ≤ 8；伤害加成 ≤ 15%；减伤 ≤ 20%；生命 / 心防百分比 ≤ 15%。
- 单次护盾 ≤ 6 / 人，回复 ≤ 8，持续伤害 ≤ 4，减益 ≤ 8，眩晕最多 1 轮且每场 1 次。
- 与装备叠加沿用现有上限：减伤 `0.9`、命中 `15–95`、速度 `0–400`。
- 被动替掉一个主动位，本身就是成本；契约价按 `SKILL_PREMIUM` 现有三元式自然算 0，不额外补贴。

## FILES

| 文件 | 改动 |
| --- | --- |
| `src/content/skills.ts` | 新增 18 条被动、`tierLabels` 加「被动」 |
| `src/types.ts` | `SkillTier` 加 `passive`；`Skill.passive`；`BattleUnit` 计数 |
| `src/skills.ts` | `isPassiveSkill` / `countPassives` / 池子筛选；`pickCandidateSkills` 支持 30% 被动 |
| `src/passives.ts` | 新增：`passiveOf` / 常驻修正查询 / 触发判定 |
| `src/combat.ts` | 单位构建结算 `always`；5 个触发点；`pickSkill` 过滤被动 |
| `src/content/library.ts` | `sanitizeMonster` / `sanitizeCustom*` 卡 1 条；`sanitizeItem` 拒收被动；`sanitizeBoss` 阶段过滤被动 |
| `src/rules/candidate.ts` | 名册技能清洗最多 1 条被动 |
| `src/rules/cards.ts` | `parseGirlCard` 校验最多 1 条被动 |
| `src/llm.ts` | 起草结果最多留 1 条被动，缺位按主动补 |
| `src/components/CustomGirlDialog.tsx` | 阶级筛选加「被动」；混选；第二条被动拒绝；被动卡片不显示威力/目标 |
| `src/components/CharacterDialog.tsx` | 档案技能卡支持被动文案，不显示倍率 |
| `src/components/workshop/ContentWorkshopDialog.tsx` | 自建技能不提供「被动」阶级；魔物最多 1 条；Boss 阶段过滤 |
| `tests/v162.test.ts` | 阶位断言改成「3 条不重复、最多 1 条被动、全部属于公共池」；不再要求一基础一本职一奥义 |
| `tests/v164.test.ts` | 新增用例（见下） |
| `package.json` | 测试列表加入 `tests/v164.test.ts` |
| `tasks/todo.md` | 记 v164 |

## 测试

1. **数据完整**：六流派各 2、魔物 2、通用 4，共 18；id 唯一且不与现有技能 / 魔物技能 / Boss 技能撞名。
2. **混选上限**：自定义建人选到第二条被动被拒；`parseGirlCard` 拒收两条被动的卡；`sanitizeMonster` 与名册清洗最多留 1 条；装备 `skillId` 收不到被动。
3. **候选规则**：`pickCandidateSkills` 同种子结果固定；3 条不重复、最多 1 条被动；400 个种子两种形态（带被动 / 不带）都出现，且不出现三条全是奥义。
4. **常驻修正**：命中、速度、生命上限、心防上限、伤害加成各一条断言（挑固定 id 找到对应被动后进 `simulateBattle`）。
5. **五个触发点**：开场护盾、回合开始回血、命中减益、受击反伤、击杀回血各一条。
6. **次数限制**：回甘 3 次、燎原 2 次、入梦每场 1 次、不熄每场 1 次。
7. **出招不受污染**：带被动的单位 `pickSkill` 不会选中被动；只有被动没有主动时回落 `plain-strike`。
8. **确定性**：同样配置跑两遍，`events` 与 `outcome` 完全一致。
9. **回归**：全量 `npm test`。被动会改变既有战斗结果，逐条核对是预期变化还是数值 bug，不为了让测试过而削被动。

## EDGE IN

- 六个元素流派、魔物、通用的 18 条；主动 / 被动同表混选，全入口最多 1 条。
- 候选、自定义建人、契约卡、工坊魔物、LLM 起草、名册首领与随从、装备附带技能。
- 老档：已有角色没有被动也能打；不新增存档字段，不需要迁移。

## EDGE OUT

- 不给内置初始角色和内置魔物手写被动（先看新内容与自制内容的实战，再单独做内容补丁）。
- 不做「两个被动槽」或洗点；一次最多 1 条是硬规则。
- 不让内容工坊创建自定义被动；被动只能来自本表的 18 条。
- 不让 Boss 阶段、装备附带技能携带被动。
- 不改 `data/` 玩家数据。

## 风险

- 生成候选不再强制一基础一本职一奥义，可能抽到三条同阶级；v162 的测试与部分战斗期望会移动，需要逐条核对。
- 被动替掉奥义位后，部分少女只有 2 条主动，遇到双主动都在冷却时会更容易空过一回合；这是设计代价，先实测。
- 「入梦」每场 1 次眩晕是强控；若战报显示过强，先降成「命中减益」而不是加抗性。
- 18 条同时上线，叠加面变大；单条上限已写死，后续按战报调。
