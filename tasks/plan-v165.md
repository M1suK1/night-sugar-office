# 方案 v165 · 战斗与调查委托报酬重算（按机会成本与治疗费）

## TASK

标准战斗与调查委托的星砂报酬改成「队伍机会成本 + 治疗准备金 + 风险溢价」；战斗经验改成「魔物阶级与数量 × 时长」，调查经验按难度 × 时长折算。
基准是星象台：1 个人每小时 300 星砂、没有受伤风险；战斗一次通常要 2–3 人，还可能留下需要诊所处理的伤。

Boss、势力首领、剧情委托保留作者填写的特殊报酬。

## 为什么上一版给低了

- 星象台 1 人 1 小时 300，3 人 60 分钟的机会成本就是 900；上一版中危 60 分钟只有 1076，扣掉治疗就接近白干。
- 诊所报价是 120 起步 + 每缺失 1 点血 5 星砂；一个 3 人队各掉 40 血就是 3 × 320 = 960。
- 战斗通常要 2–3 人，6 只魔物时 squadLimit 会放到 6 人；上一版没有把队伍规模算进去。
- 调查虽然不受伤，但也要占 1–2 个人；按星象台的机会成本，60 分钟 2 人至少 600。

## 公式

新增 src/missionReward.ts。标准委托只从这里取报酬：

    const EXPEDITION_HOURLY = 300;                 // 星象台每人每小时
    const TREATMENT_PER_MEMBER = 160;             // 约等于 50% 概率掉 40 血的治疗费
    const MIN_REWARD = 520;

    const RISK = { 低危: 1.15, 中危: 1.25, 高危: 1.45, 绝望: 1.70 };

    // 战斗按推荐编成：1 只 1 人、2 只 2 人、3 只以上 3 人；4 只以上再加多怪加成
    const team = work === 'combat' ? Math.min(3, Math.max(1, enemyCount)) : 2;

    const opportunity = team * EXPEDITION_HOURLY * duration / 60;
    const treatment = work === 'combat' ? team * TREATMENT_PER_MEMBER : 0;
    const countBonus = work === 'combat'
      ? 1 + Math.max(0, enemyCount - 3) * rewardPerExtraMonster / 100
      : 1;

    reward = round((opportunity + treatment) * RISK[difficulty] * countBonus);

    // 再乘窗口与辖区修正
    reward = round(reward * windowMultiplier * (1 + environment.rewardPct / 100));

- windowMultiplier：急件 1.15；长期 0.95 + 0.12 × longDays（2 天 1.19，3 天 1.31）。比旧版 1.30 / 1.34–1.56 低，避免把成本公式再抬一遍。
- rewardPerExtraMonster 继续用数值页现有字段，但语义收窄为「超过 3 只后每多一只」；1–3 只已经由队伍人数体现。
- 未知难度按中危；最低 500。

## 公式后示例

以下「新值」已含常见急件 ×1.15；旧实际是界面报酬再乘多怪倍率后的到手值。

| 委托 | 队伍 | 机会成本 | 治疗准备 | 旧显示 | 旧实际 | 新值 |
| --- | --- | --- | --- | --- | --- | --- |
| 战斗低危 40 分 / 1 怪 | 1 | 200 | 160 | 520 | 520 | 520（下限） |
| 战斗中危 60 分 / 2 怪 | 2 | 600 | 320 | 960 | 1104 | 1323 |
| 战斗高危 80 分 / 3 怪 | 3 | 1200 | 480 | 1260 | 1638 | 2801 |
| 战斗绝望 100 分 / 6 怪 | 3 + 3 只加成 | 1500 | 480 | 2350 | 4112 | 5613 |
| 调查低危 40 分 | 2 | 400 | 0 | 520 | 520 | 529 |
| 调查中危 60 分 | 2 | 600 | 0 | 780–820 | 780–820 | 863 |
| 调查高危 85 分 | 2 | 850 | 0 | 1220 | 1220 | 1417 |
| 调查绝望 110 分 | 2 | 1100 | 0 | 2300 | 2300 | 2151 |

- 低危 1 人战斗刚好压着下限；玩家如果派 2 人，仍然是 520，利润变薄，这是「按推荐编成定价」的代价。
- 6 只魔物：3 人基础 + 3 只额外 ×15% = ×1.45，正好补上多出来的 3 人机会成本。
- 调查低危 40 分新值 529，基本持平；中危/高危略有提高；绝望 110 分略低，因为旧版 21 星砂/分钟本身偏高。

## 队伍与治疗口径

- 推荐编成不是强制：玩家可以少派人，报酬不变，但判定更难过；多派人也不会临时加价。
- 治疗准备金按「每名出战成员 160」计，约等于 120 起步 + 40 点缺失血（200）的一半；实际治疗可能更贵，风险倍率再补一层。
- 战斗胜利后仍按胜负系数（1.0 / 0.9 / 0.5 / 0）结算，准备金已经包含在 mission.reward 里，不再二次乘多怪倍率。
- 星象台 300/人是机会成本基准，不是任务必须支付给少女的工资；它只用来保证委托不比把人放上星象台更亏。

## 经验重算（v165 追加）

战斗经验不再按推荐等级给，而是按魔物阶级、数量与时长：

    threat = battleScore(enemyIds)   // 碎屑 1 / 游荡 2 / 灾厄 4 / 王座 7
    baseExp = round((28 + 6 * threat) * duration / 60)

调查没有魔物，把难度折算成威胁值，再乘 0.5：

    const INVESTIGATION_THREAT = { 低危: 2, 中危: 4, 高危: 7, 绝望: 10 };
    baseExp = round((28 + 6 * threat) * duration / 60 * 0.5)

- 旧的 battleExp / investigationExp 与 MISSION_EXP_SHARE 删除；不再按推荐等级，也不再按半级/四分之一级封顶。
- 每次委托最多升 1 级：missionExp 返回 min(baseExp, expNeeded(level) - 当前 exp)；溢出部分丢弃，grantExp 只触发一次升级。
- 战斗报告的 rewards.exp 显示公式基础值，并注明「每人最多升 1 级」；实际发放按个人剩余经验截断。
- 调查沿用同一套基础，但系数 0.5，避免调查比同档战斗更肥。

### 等级经验曲线

同时把 expNeeded 从线性改成二次：

    expNeeded(level) = 60 + 18 × (level - 1) + 3 × (level - 1)²

| 升级 | 旧线性 | 新曲线 |
| --- | --- | --- |
| 1 → 2 | 60 | 60 |
| 2 → 3 | 80 | 81 |
| 3 → 4 | 100 | 108 |
| 4 → 5 | 120 | 141 |
| 5 → 6 | 140 | 180 |
| 6 → 7 | 160 | 225 |
| 7 → 8 | 180 | 276 |
| 8 → 9 | 200 | 333 |
| 9 → 10 | 220 | 396 |

1 → 10 总计从 1260 提高到 1800；前两级几乎不变，后面逐步拉开。旧档只需保留已有等级与 exp，不需要迁移。

| 委托 | threat | 旧经验（约） | 新经验 |
| --- | --- | --- | --- |
| 战斗低危 40 分 / 1 碎屑 | 1 | 40 | 23 |
| 战斗中危 60 分 / 2 游荡 | 4 | 60 | 52 |
| 战斗高危 80 分 / 3 灾厄 | 12 | 70（旧封顶） | 133 |
| 战斗绝望 100 分 / 6 灾厄 | 24 | 70（旧封顶） | 287 |
| 调查低危 40 分 | 2 | 20 | 13 |
| 调查中危 60 分 | 4 | 30 | 26 |
| 调查高危 85 分 | 7 | 40 | 50 |
| 调查绝望 110 分 | 10 | 55 | 81 |

- 低危/中危战斗经验会比旧值低一些：一只碎屑不再按推荐等级白送；高难战斗靠阶级与数量补回来。
- 不保留旧的半级封顶；改成单次最多 1 级的硬顶。低级少女被带着刷高难，也只会升 1 级，不会连跳。

## 接入点

| 位置 | 改动 |
| --- | --- |
| makeCommission | 先定难度、时长、敌人，再算机会成本与治疗准备金；之后才应用窗口、辖区、污染 |
| deployMissionTemplate | 工坊/池子投放走同一公式；模板 reward 不再作为最终值 |
| annotateMission | 普通 LLM/外部委托重算；Boss、势力、剧情跳过 |
| missionSeed | 自制模板进池时用公式算预估值 |
| combat.ts | 删除结算里的 monsterRewardMultiplier 乘法；mission.reward 已是最终值 |
| persistence.ts | 旧档 open 委托重算，写 rewardVersion: 2；进行中/已完成不动 |
| ContentWorkshopDialog | 委托报酬改为只读估算，注明按推荐编成与时长的公式 |
| MissionDialog | 报酬旁补一行「按队伍机会成本 + 治疗准备金 × 难度结算」 |

### 旧档

- Mission 增加可选 rewardVersion?: number，新委托写 2。
- rebaseOpenMissionRewards 只处理 open、无版本、且不是 boss / faction / envoy / storylineId 的委托。
- 用已存的 difficulty / duration / enemyIds / window / longDays / environment.rewardPct 重算；不重新冻结环境。
- 已接取（active）的委托保留旧报酬；重复读档幂等。

## 不重算的范围

- Boss、势力首领、剧情委托：保留作者填写的报酬。
- 经验、掉落、契约价、目标值、轮次、时长：不动。
- 星象台收益本身：不动，仍按每人每小时 300 为基准。
- 诊金本身：不动；只是在委托报酬里预留。

## FILES

| 文件 | 改动 |
| --- | --- |
| src/missionReward.ts | 新增：机会成本、治疗准备金、风险倍率、窗口、战斗/调查经验与旧档重算 |
| src/types.ts | Mission.rewardVersion 可选字段 |
| src/rules/missions.ts | 四个生成入口接入公式 |
| src/combat.ts | 结算不再乘多怪倍率；rewards.exp 改用 missionBaseExp |
| src/progression.ts | expNeeded 改二次曲线；删除 battleExp / investigationExp / MISSION_EXP_SHARE；missionExp 改读 missionBaseExp 并限制单次 1 级 |
| src/rules/battle.ts | 战斗经验改按时长、阶级、数量发放 |
| src/rules/investigation.ts | 调查经验按难度与时长发放 |
| src/components/CharacterDialog.tsx | 经验说明改成阶级/数量/时长与「每次最多 1 级」 |
| src/rules/state.ts | 初始 12 条委托也走公式，避免开局仍是旧价 |
| src/rules/persistence.ts | 读档后重算 open 标准委托 |
| src/balance.ts | 多怪奖励提示改成「超过 3 只后每多一只」 |
| src/components/workshop/ContentWorkshopDialog.tsx | 委托报酬改为只读估算 |
| src/components/MissionDialog.tsx | 报酬说明改成本公式 |
| src/components/BattleReport.tsx / src/battleNote.ts | 经验标注「每人最多升 1 级」 |
| tests/v165.test.ts | 新增公式、队伍、治疗、经验、旧档与特殊委托用例 |
| tests/game.test.ts / tests/v47.test.ts / tests/v61.test.ts | 更新报酬与经验断言 |
| package.json / tasks/todo.md | 登记测试与完成项 |

## 测试

1. 机会成本：战斗 1/2/3 只分别按 1/2/3 人；4–6 只超过 3 的部分乘多怪加成；调查固定 2 人。
2. 治疗准备金：战斗每个出战名额 +160；调查为 0。
3. 单调：同类型同时长，低危 < 中危 < 高危 < 绝望；同档位 60 < 90 < 120 分钟。
4. 下限：低危 1 人 40 分钟不低于 520。
5. 窗口/辖区：急件 ×1.15、长期按天数、辖区 rewardPct 依次叠加。
6. 生成：makeCommission 显示值等于公式值；战斗结算不再二次乘多怪倍率。
7. 外部来源：LLM 自带 reward 被重算；Boss / 势力 / 剧情保持原值。
8. 旧档：open 重算并写版本；active / done 不动；重复读档幂等。
9. 经验：同一编成下，阶级越高、数量越多、时长越长，经验越高；王座 > 灾厄 > 游荡 > 碎屑；调查按难度与时长，且约为同档战斗的 50%。
10. 经验曲线：expNeeded 按二次曲线；1→2 到 9→10 的数值与总计 1800 对得上。
11. 经验一致性：战斗报告 rewards.exp 与公式一致；实际发放被个人剩余经验截断，单次最多升 1 级。
12. 回归：npm test、check:rules、build 全绿；逐条核对旧断言。

## EDGE OUT

- 不把星象台 300 改成动态；本次只把它作为机会成本基准。
- 不调整诊所价格、疲劳恢复、等级上限与升级属性点。
- 不按玩家实际派遣人数动态改价；报酬按推荐编成算，少派人利润高、风险也高。
- 工坊模板的 reward 字段保留给旧内容，但标准投放不再采用。

## 风险

- 战斗高难报酬会明显高于旧值（高危险 3 人 80 分从 1.6k 提到 2.8k），可能让中后期经济变松；先上线观察，必要时只调 RISK 的绝望项。
- 低危 1 人任务压着 520 下限；如果诊所等级很高，玩家会觉得低危仍划算，这是预期的低风险收益。
- 旧档只重算 open，已接取的单子保持旧价，同板可能出现两个价，需要在更新说明里写清楚。
- 后期等级需求升到 333–396，低危/中危委托的经验占比会明显变小；单次 1 级上限保证高级少女不会被一次高难直接带飞。
