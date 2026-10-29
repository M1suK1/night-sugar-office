# v19 方案：地区污染度与三势力樱雾市

> 状态：**已实施**（v19 全量落地，构建与 154 项状态测试 / 65 组浏览器流程通过）  
> 基线：v18 `38ba612`，126 项状态测试、56 组浏览器流程  
> 范围：地区污染度 + 三势力背景、首领与所属少女、势力标签、辖区拦截战、净化差异与档案 UI

---

## 1. 结论

v19 做两件事，彼此咬合，但不重做地图与势力战争：

1. **地区污染度**成为九块辖区的持续状态。它每天只按自然速度恶化，势力不改变每日涨幅；污染越高，辖区委托的目标与报酬越高、魔物生命与属性越强、出击少女的疲劳与侵蚀越重；完成委托会让污染下降，三势力只改变净化效率。
2. **三势力从“占地球队”升级为有理念、有历史、有内部矛盾、有首领与所属少女的城市阵营**。星灯协会、市役所、月蚀庭各自对魔女、对魔法少女、对城市秩序有不同答案；三方的态度都从 50 中立开局，态度跌到“戒备”后，进入其辖区执行委托会被其所属魔法少女拦截，触发覆盖原委托的拦截战。

核心原则：

- **污染是辖区状态，不是战斗临时 Buff。** 委托生成时快照到 `mission.environment`，避免派遣后辖区被净化导致战斗中途变数值。
- **在污染系统里，势力只影响净化，不新增第四套战争系统。** 污染每天只按自然速度上升；势力的污染参数只有“完成委托后的额外净化”。现有占地区块、当主效果、声望、代表委托继续用；新增势力档案、首领、所属少女与有限拦截战。
- **势力标签是少女的出身，不是雇主。** 三势力与无所属四种标签只影响档案显示、所属名单与文案；夜糖事务所是雇主，单独显示，绝不做成第五种势力标签。事务所对三方开放，不替任何一方站队。
- **事务所不是第四势力，而是中立的落脚点。** 玩家可以写事务所的背景、理念、目标；值班助理兼任对外代表，这些内容同步为一条世界书，让叙事者知道“这里收留所有人”。
- **旧存档必须能开。** `GameState.version` 从 11 升到 12，旧档补齐九块辖区的污染值，旧委托没有环境快照时按运行时辖区计算；旧少女与旧候选都按 id 确定性地补四种出身标签，不再默认“事务所”。
- **所有数值本地可算。** 不依赖 LLM 决定污染或战斗加成；LLM 只读取城市态势来写事件与故事。

---

## 2. 当前基础与问题

### 2.1 已有

- `src/districts.ts`：九块辖区 `DistrictId`，静态 `DistrictEffect`，`effectLines()`，地图坐标与描述。
- `src/territories.ts`：`FactionId = 'witch' | 'association' | 'government'`，`TerritoryMap`，占地区块、当主效果、声望门槛与易主。
- `src/game.ts`：委托生成、战斗/调查结算、每日推进、势力声望、辖区效果、存档迁移。
- `src/combat.ts`：战斗模拟读取辖区静态效果（`enemyHpPct`、伤害增减）。
- `src/components/DispatchMap.tsx`：九区地图、势力着色、辖区面板。
- `src/components/MissionDialog.tsx`：委托详情与辖区效果。
- `src/App.tsx`：地图上方城市态势条、三势力卡片、会客厅代表委托。
- `src/content/items.ts`：`factionInfo` 已有名称、短名、颜色、箴言、代表、头衔。
- `src/worldbook.ts`：已有一条三势力概述，但把月蚀写成“月蚀教团”，与现有 `月蚀庭` 不一致；`loadWorldbook()` 有自定义条目时**不再合并内置条目**，世界书页只在挂载时读一次。
- `src/types.ts`：`Girl` 没有势力标签；`BattleUnit.girlId` 的注释已经预留“敌方魔法少女也会带这个字段”，但战斗只把魔物放进敌方。
- 初始声望：普通档 `witch 20 / association 50 / government 45`，空白档相同；`factionAttitude()` 以 `<30` 为“戒备”。

### 2.2 问题

- 辖区只有静态地形效果，没有“会变坏、可治理”的状态。
- 占地区块只影响委托目标/报酬与少量疲劳，势力理念没有进入玩家可见的决策。
- 三势力缺少完整背景：为什么对立、各自怎么看待魔女、内部有什么裂缝。
- 星灯协会目前偏正面，只有“传统、登记、照护”，缺少保守排外、排斥克隆与抑制剂、只救名录内的人的黑暗面。
- 月蚀庭还停留在“救治组织”，缺少激进派政变后与普通魔法少女敌对的现状。
- 市役所“量产魔法少女降低魔物压力”目前只有 `targetPct: -4` 这一行效果，缺少可读解释。
- 地图面板点开后只有静态效果，玩家看不出“这块地现在多脏、谁在管、明天会怎样”。
- 少女没有出身标签，也没有“雇主”这个概念；三势力只有代表，没有首领档案与所属少女名单。
- 夜糖事务所本身没有可编辑档案：玩家不能写它为什么重开、信什么、想做什么，也不能指定谁在外头代表它。
- 世界书没有事务所条目；即使玩家在别处写了设定，叙事者也不会稳定读到。`loadWorldbook()` 还会在自定义条目存在时丢掉内置势力条目。
- 势力态度只影响商店价格与几句文案，没有真正的辖区行为；“戒备”应该让玩家在派遣时感到风险。
- v18 当前的初始声望 `20/50/45` 让月蚀庭开局即“戒备”，但玩家还没有理解原因；统一到 50 后，戒备必须由玩家的选择造成。

---

## 3. 目标与非目标

### 3.1 目标

- 九块辖区各有 `0–100` 污染度，地图与面板可见。
- 污染每日只按自然速度上升；当主势力不再改变每日涨幅，只改变完成委托后的净化量。
- 污染影响：委托目标、委托报酬、魔物生命、魔物属性、少女疲劳、少女侵蚀。
- 完成委托降低污染；失败或击退让污染略升。
- 三势力各有完整档案：起源、成员构成、理念、手段、公开面孔、内部矛盾、对魔女/普通魔法少女态度、首领、所属少女、彼此关系。
- 三势力都不是单纯正面：星灯协会保守排外、拒绝克隆与抑制剂；月蚀庭激进派政变后敌视普通魔法少女。
- 三势力初始态度统一为 50（中立）；“戒备”只能由玩家行为造成，不再继承旧初始值。
- 魔法少女新增**出身势力**标签：`星灯协会 / 市役所 / 月蚀庭 / 无所属`；标签不是雇主，夜糖事务所作为雇主另行显示。新契约者、导入卡与旧档都按 id/名字确定性分配四种出身，不再把所有人写成“事务所”。
- 夜糖事务所是中立机构，不占辖区、不参与三方争夺；它关闭多年后由玩家重开，接纳三方与无所属的魔法少女。
- 玩家可编辑事务所的背景、理念、目标；值班助理兼任事务所的对外代表。档案保存后，这些内容同步为一条世界书条目，叙事者能读到“这里收留所有人”和当前代表是谁。
- 市场候选覆盖四种出身；刷新时先补齐当前市场缺少的出身，再用确定性洗牌袋填满剩余名额，目标数量下四种都出现，而不是靠概率碰运气。
- 势力档案显示当前首领的立绘、姓名、头衔、主张、近况，以及该势力所属魔法少女名单。
- 当辖区当主态度为“戒备”时，玩家在该辖区执行普通委托会被该势力少女拦截，触发覆盖原委托的拦截战；代表委托、剧情委托与魔物首领委托豁免。
- 势力档案可在城市态势条打开，不离开地图也能读。
- LLM 事件、委托、故事蓝图能读到“城市污染 + 势力态势 + 首领/所属少女”的简短摘要。
- 旧 v11 存档可迁移，旧委托可继续，旧少女与旧候选按 id 补齐出身标签；旧世界书若缺事务所条目，载入后补写。

### 3.2 非目标

- 不做新的实时战棋地图、不做污染扩散寻路、不做天气系统。
- 不新增第四势力，不重写议会/选举；夜糖事务所不是可争夺、可易主的第四方，没有辖区、声望或净化加成。
- 不做“事务所自定义势力效果”或“玩家创建阵营”；背景/理念/目标只进档案与世界书，不生成新的战斗数值。
- 不做“污染怪”独立怪物种族；先用现有敌人池加数值与事件。
- 不做全城 NPC 模拟、不做势力自动开战。
- 不做所有少女每日按城市平均污染被动加侵蚀；污染通过出击、调查与结算生效，避免离线惩罚。
- 不做动态政变事件链；v19 的时间线设定为“月蚀庭政变已经发生”，先让世界状态、档案与代表委托成立；若要玩到政变过程，另开版本。
- 不做可自由招募的“势力直属名单少女”（白鹭千秋、雨宫澄、夜鸮及 §8.7 的所属少女）；她们只作为档案名单与拦截战对手，不进入玩家契约池。市场候选仍可拥有协会/市役所/月蚀庭/无所属的**出身**，那是普通魔法少女的来源，不是把势力干部变成可招募单位。
- 不做势力大地图战争或独立拦截战模式；拦截战只覆盖“态度戒备 + 辖区当主”的普通委托结算，复用现有战报。
- 不做运行中故事的蓝图热替换（沿用 v18）。
- 不引入后端、数据库或新依赖。

---

## 4. 玩家可见流程

### 4.1 看地图

1. 进入地图，九区仍按势力着色。
2. 每个辖区名旁多一枚污染徽记：`污染 34 · 微浊`，颜色按等级变化。
3. 地图图例多一行：`城市平均污染 28 · 微浊`。
4. 点击辖区，面板依次显示：
   - 地形描述与静态效果；
   - 当前当主与净化效率；
   - 污染仪表、等级、自然涨幅、完成委托可降低的估值；
   - 污染带来的战斗/疲劳/侵蚀风险；
   - “谁在管这块地”的一句话；若当主态度为“戒备”，追加“在此派遣会被其所属少女拦截”。

### 4.2 接委托

1. 委托详情保留辖区静态效果，新增“污染风险”区。
2. 显示派遣时快照：`污染 46 · 深染`，`魔物生命 +15%／属性 +8%`，`疲劳 +2／侵蚀 +1`，`目标 +5%／报酬 +7%`。
3. 玩家能看出“这块地很脏，报酬高，但队伍会被拖重”。
4. 委托完成后，结算消息明确写：`旧城区污染 46 → 38`。
5. 若辖区当主态度为“戒备”，详情与派遣按钮上方显示红色提示：`星灯协会在此戒备。派遣后会被其所属少女拦截，原委托将被覆盖。`
6. 拦截在委托结算时发生：进入战报，敌方为势力少女；战斗结束后原委托直接作废，不发放原委托报酬，也不推进该委托的故事节点。

### 4.3 看势力

1. 城市态势条的三张势力卡仍显示声望、态度、代表委托，并增加“掌控 N 区”和“辖区均污 X”；点击改为打开**势力档案**，不再直接跳到会客厅。
2. 档案顶部先显示**当前首领**：立绘、姓名、头衔、箴言、当前主张与一句近况。首领是档案的视觉中心，不藏在页签里。
3. 档案里有五个页签：
   - `理念`：起源、成员构成、箴言、公开面孔、内部矛盾、技术立场（对量产与抑制剂的态度）；
   - `成员`：首领完整信息 + 该势力所属魔法少女名单；每名少女显示立绘、姓名、代号、等级/职责、势力标签与一句立场；
   - `城市`：辖区数量、净化效率、当前辖区污染均值；
   - `魔女`：对魔女化的定义、对普通魔法少女的立场；有政变时在这里显示政变经过；
   - `关系`：与另外两方的关系、代表来使、前往会客厅按钮。
4. 档案底部保留“前往会客厅”按钮，原有代表委托流程不变。
5. 玩家少女的档案头与编队卡同时显示两件事：雇主徽记 `夜糖事务所` 与出身标签 `星灯协会 / 市役所 / 月蚀庭 / 无所属`；候选只显示出身标签，不显示雇主。
6. 城市态势条上方新增“事务所档案”入口；玩家可在这里改事务所背景、理念、目标，并任命值班助理为对外代表。

### 4.4 看事务所

1. 基础页标题区有 `事务所档案` 按钮，打开 `#office-dialog`。
2. 档案顶部显示事务所名、当前对外代表与一句“中立、收留三方与无所属”的定位。
3. 正文三个可编辑段：`背景`（为什么关闭、为什么重开）、`理念`（不替谁站队、先问名字不问出身）、`目标`（把事务所重新开成什么）。
4. 代表区显示当前值班助理；玩家可以从羁绊 ≥40 的在职少女中任命/更换代表，也可以取消。任命代表与任命值班助理是同一个动作，不维护两份名单。
5. 保存后提示“事务所档案已写入世界书”，世界书页立即出现 `夜糖事务所` 条目；代表更换后条目中的代表行同步更新。

---

## 5. 数据模型

### 5.1 污染类型

新增 `src/pollution.ts`：

```ts
export const POLLUTION_MAX = 100;
export const POLLUTION_MIN = 0;

export type PollutionTier = 'clean' | 'hazy' | 'murky' | 'deep' | 'calamity';

export interface PollutionEffect {
  enemyHpPct: number;
  enemyPowerPct: number;
  targetPct: number;
  rewardPct: number;
  fatigueFlat: number;
  corruptionFlat: number;
}

export interface PollutionForecast {
  level: number;
  tier: PollutionTier;
  dailyRise: number;
  /** 只在调用方传入 mission 时才有值；无 mission 时 UI 不显示净化估算 */
  estimatedRelief?: number;
  effect: PollutionEffect;
}

/** 委托生成时冻结的净化口径，不随辖区易主变化 */
export interface PollutionSnapshot {
  owner: FactionId;      // 派遣时的当主
  duration: number;      // 分钟
  work: WorkKind;       // 现有类型：'combat' | 'investigation'
}

export type PollutionMap = Record<DistrictId, number>;
```

函数：

```ts
pollutionTier(level): PollutionTier
pollutionEffect(level): PollutionEffect
pollutionDailyRise(level): number
pollutionRelief(snapshot: PollutionSnapshot): number
pollutionSnapshotOf(state, mission): PollutionSnapshot
pollutionForecast(state, district, mission?): PollutionForecast
initialPollution(): PollutionMap
repairPollution(raw?): PollutionMap
pollutionLines(effect): string[]
```

`pollutionEffect` 是纯函数；`pollutionForecast` 读 `state.pollution`（以及 `state.territories` 的当主）给出当前等级与自然涨幅，净化估值走 `mission` 参数。

- **`mission` 是可选参数。** 不传时 `PollutionForecast.estimatedRelief` 为 `undefined`，UI 只显示等级、每日自然增长与污染风险；传了才按该委托的时长/类型/快照当主算出确定值。
- 辖区面板没有具体委托可传，因此**不读** `estimatedRelief`，改为自己调 `pollutionRelief({ owner: state.territories[id], duration: 60, work: 'investigation' })` 估一个参考值，并在文案里明写“按 60 分钟调查估算”；卡片上的数字不伪装成精确值，具体委托由 `MissionDialog` 按该委托的快照给出。
- 净化数值一律走 `pollutionRelief`，它只接受 `PollutionSnapshot`（见 5.6）而不接受 `Mission` 对象，避免“结算用快照、UI 用当前当主”两套口径。

### 5.2 `GameState`

`src/types.ts`：

```ts
interface GameState {
  version: 12;
  // ...
  pollution: Record<DistrictId, number>;
  office: OfficeProfile;
}
```

- 初始值固定为九区主题基线，避免同一存档每次开局随机不同：

| 辖区 | 初始污染 | 理由 |
|---|---:|---|
| 糖果公园 `candy` | 6 | 日常净化最勤，游客多 |
| 北岸桥头 `station` | 22 | 货运与夜班人流 |
| 月见台 `plaza` | 10 | 观测塔与协会门面 |
| 玻璃温室 `greenhouse` | 16 | 封闭生态，污染积在土壤里 |
| 旧教堂 `cathedral` | 38 | 地窖曾是魔女救治所 |
| 南十字 `crossroad` | 30 | 废弃商业街，巡逻空隙 |
| 旧城区 `oldtown` | 46 | 人口密集、管线老旧，最脏 |
| 旧钟楼 `clocktower` | 26 | 旧行政中心，长期封楼 |
| 星见川码头 `docks` | 34 | 河雾与走私 |

- `initialPollution()` 返回上表；`createInitialState` 与 `createBlankState` 都使用同一份，保证普通档与空白档地图观感一致。
- 新档 `office` 写 `DEFAULT_OFFICE_PROFILE`：背景为“旧夜事故后关闭、由玩家重开”，理念为“不站队、先问名字”，目标为“重新成为中立落脚点”；三段都可改，旧档缺字段时补默认值。
- 新档 `factions` 初始 `standing` 统一为 `{ witch: 50, association: 50, government: 50 }`；空白档相同。旧档不重置。
- `version` 升到 `12`；`loadState` 接受 `1,3,4,...,12`，迁移时 `state.version = 12`，再 `state.pollution = repairPollution(state.pollution)`。
- `repairPollution`：缺块补初始值，非法/NaN 归零，`0..100` 截断；不因缺块报错。

### 5.3 `DistrictEffect` 扩展

`src/districts.ts`：

```ts
interface DistrictEffect {
  targetPct?: number;
  rewardPct?: number;
  damageDealtPct?: number;
  damageTakenPct?: number;
  enemyHpPct?: number;
  enemyPowerPct?: number;   // 新增：魔物攻防属性
  fatigueFlat?: number;
  corruptionFlat?: number;  // 新增：结算侵蚀
  spiritPerHour?: number;
  reputationFlat?: number;
}
```

- `enemyPowerPct` 只作用于魔物 `stats`（攻击/防御/速度等），不重复乘 HP。
- `corruptionFlat` 进入 `settleCombat` / `settleInvestigation` 的侵蚀结算。
- `effectLines` 增加两行：`魔物属性 +18%`、`侵蚀 +2`。
- 现有 `sanitizeEffect`/辖区事件效果清洗补上这两个可选字段，旧数据缺省为 0。

### 5.4 少女出身标签

`src/types.ts`：

```ts
export type GirlFaction = 'association' | 'government' | 'witch' | 'none';

export interface OfficeProfile {
  background: string;
  philosophy: string;
  goal: string;
}

interface Girl {
  // ...
  factionTag: GirlFaction;   // 出身，不是雇主
}

interface GirlDraft {
  // ...
  factionTag?: GirlFaction;
}

interface GirlCard {
  girl: {
    // ...
    factionTag?: GirlFaction;
  };
}

interface FactionLeader {
  id: string;
  faction: FactionId;
  name: string;
  title: string;
  portrait: string;
  portraitSpec?: PortraitSpec;
  color: string;
  quote: string;
  note: string;
}

interface FactionGirl {
  id: string;
  faction: FactionId;
  name: string;
  codename: string;
  title: string;
  portrait: string;
  portraitSpec?: PortraitSpec;
  color: string;
  level: number;
  stats: Record<StatKey, number>;
  skills: string[];
  tag: FactionId;   // 必须与 faction 一致
  quote: string;
  note: string;
}
```

- **标签语义是出身，不是雇主。** 只有 `association / government / witch / none` 四种；`office` 从 `GirlFaction` 删除。玩家少女可以出身协会却受雇于夜糖事务所；档案头用独立徽记显示“夜糖事务所”，旁边再显示出身标签。
- 新建 `src/office.ts`：`DEFAULT_OFFICE_PROFILE`、`sanitizeOfficeProfile(raw)`、`officeWorldbookContent(profile, representative)`、`representativeOf(state)`。`office.ts` 只做纯函数，不 import `worldbook.ts`，避免循环依赖。
- 确定性生成器 `factionTagFor(seed: string): GirlFaction`：用稳定 hash 取权重，协会 30%、市役所 30%、月蚀庭 22%、无所属 18%。同一 id/名字永远得到同一出身，刷新、重开、迁移都不会变。`factionTagFor` 与 `factionTagLabel` 放进 `src/factions.ts`，供 `game.ts`、`office.ts` 与 UI 共用。
- 玩家初始契约者与候选都由 `factionTagFor` 分配；手工角色可以显式指定四种之一，但不能写 `office`。生成器不改变属性、技能、契约或编队，只影响档案与文案。
- 市场候选：`makeCandidate(state, level, salt, tag?)` 接受可选出身；`refreshMarket` 先统计当前市场缺少哪些出身，优先用显式 `tag` 补齐，缺口补完后再用确定性洗牌袋填剩余名额。
- **覆盖承诺要带前提，不能写死“目标 ≥4 就四种齐全”**：补齐只在**非自定义槽位**足够时成立。具体规则：
  - 先从空位补缺口；仍缺且没有空位时，只替换“出身重复的**非自定义**候选”（`candidate.custom !== true`）；
  - 自定义候选永不替换。若自定义候选占满且出身全同，实际种类数上限 = `4 - (被占用且无法覆盖的出身数)`，此时**达不到 4 种是允许的**；
  - 因此验收表述改为“`min(4, 非自定义槽位数 + 缺口中可补齐数)` 种”，测试用“至少 2 名非自定义候选时至少两种出身”这类带前提的断言，并补一条**全自定义反例**（5 个同出身自定义候选 → 不抛错、不替换、种类数如实为 1）。

- 旧 v11 存档迁移：`state.girls` 与 `state.candidates` 的每一项都补 `factionTagFor(girl.id)`；不按“已签约/候选”写死，也不再默认 `office`。
- `sanitizeGirl` 对缺失/非法标签回退 `factionTagFor(girl.id)`；历史数据里的字面量 `'office'` 也走同一生成器清洗，不保留为第五种标签。
- `GirlCard` 导出/导入保留 `factionTag`；旧卡缺字段或值非法时按 `factionTagFor(card.girl.name)` 回退，卡牌往返只接受四种合法值。
- `factionTag` 只用于档案显示、所属名单与拦截战文案，不改变玩家编队、属性或契约规则。
- `factionTagLabel(tag)` 统一映射：`association=星灯协会`、`government=市役所`、`witch=月蚀庭`、`none=无所属`；UI 不各自拼字符串。雇主徽记固定写 `夜糖事务所`，不走 `factionTagLabel`。
- 三势力所属少女存放在新文件 `src/content/factionGirls.ts`，用 `FactionGirl` 静态定义；不写入 `state.girls`，避免被误当成可招募契约者。`FactionGirl.tag` 必须等于其 `faction`，不另造第五种身份。
- 三势力首领存放在 `src/content/factionLeaders.ts`，用 `FactionLeader` 静态定义；首领可以是人类（如雨宫澄），不强制是魔法少女，也不参与拦截战。

### 5.5 事务所档案

`OfficeProfile` 放进 `src/types.ts`，纯函数与默认值放进 `src/office.ts`：

```ts
export const DEFAULT_OFFICE_PROFILE: OfficeProfile = {
  background: '夜糖事务所曾在一次没有结果的夜事后关门，直到你重新把灯点亮。它不属于任何一方，收留三方与无所属的魔法少女。',
  philosophy: '不替任何一方站队，只给愿意值夜的人一盏灯；进门以后，先问她叫什么，不问她从哪来。',
  goal: '把事务所重新开成樱雾市的中立落脚点：接委托、养伤、记录名字，也让三方愿意坐到同一张桌前。',
};

export function sanitizeOfficeProfile(raw?: Partial<OfficeProfile>): OfficeProfile;
export function representativeOf(state: GameState): Girl | undefined;
export function officeWorldbookContent(profile: OfficeProfile, representative?: Girl): string;
```

- **唯一事实来源是 `state.office`。** 不新增 `representativeId`：对外代表就是 `state.assistantId` 指向的值班助理。任命/更换/取消助理，等于任命/更换/取消代表，避免两份名单打架。
- `sanitizeOfficeProfile` 逐字段 trim；空串或非法类型回退该字段默认值；`background` 上限 180 字，`philosophy` 与 `goal` 各 120 字，防止一条世界书吃掉全部预算。
- `representativeOf` 返回 `state.girls` 中 `id === state.assistantId` 且 **`!dead && !retired`** 的少女；找不到、已死亡或已退休时返回 `undefined`，不抛错。死人或已离职的人不能继续当“对外代表”，世界书里也不能这么写。
- 助理死亡/退休时不清 `assistantId`（会毁掉玩家的选择记录），但世界书写“尚未任命对外代表。”；`BaseView` 的 `值班助理` 文案同步回退为“尚未任命”，保持两处一致。

- `officeWorldbookContent` 输出纯文本：第一行写“中立机构、关闭后重开、接纳三方与无所属”，随后三行 `背景：` / `理念：` / `目标：`，最后一行 `对外代表：…`。无代表时写 `尚未任命对外代表。`；代表行里的出身用 `factionTagLabel` 转成中文，不把 `association` 等内部 ID 写进世界书。
- 事务所没有辖区、声望、净化加成或战斗数值；它只提供身份、可编辑设定与代表，不参与 `FactionId` / `Territories` / 拦截战判定。
- `office.ts` 不 import `worldbook.ts`；世界书的读写包装留在 `worldbook.ts`，避免循环依赖。

### 5.6 `Mission` 快照

`src/types.ts`：

```ts
export interface Interception {
  faction: FactionId;
  girlIds: string[];
  outcome?: 'win' | 'loss';
}

interface Mission {
  // ...
  district?: DistrictId;
  environment?: DistrictEffect;      // 派遣时快照：静态 + 当主 + 污染
  pollutionAtSpawn?: number;         // 用于 UI 显示与战报
  ownerAtSpawn?: FactionId;          // 派遣时的辖区当主；净化口径与拦截判定都用它
  interception?: Interception;       // 结算时被势力少女拦截
}
```

- `environment`、`pollutionAtSpawn`、`ownerAtSpawn` 在生成委托时一次性写入，之后**不再随辖区变化**。
- **净化用快照当主，不用当前当主。** `Mission` 是纯数据，不加方法；改为 `src/pollution.ts` 导出自由函数 `pollutionSnapshotOf(state, mission): PollutionSnapshot`，返回 `{ owner: mission.ownerAtSpawn ?? state.territories[mission.district!], duration: mission.duration, work: mission.work }`（现有 `state.territories` 就是 `Record<DistrictId, FactionId>`，直接取值）。旧委托无快照时回退当前当主，并由调用方在 UI 标注“按当前辖区估算”。`applyPollutionRelief` 与 `MissionDialog` 的“完成委托预计净化 −9”都只经这个函数取快照，避免“面板写着市役所 +3、结算按易主后的月蚀庭 +0 打脸”。
- `interception` 在结算判定成立时写入；战斗结束后原委托置为 `expired`，不再发原报酬。
- 旧委托没有这三个字段：战斗/结算/详情按当前辖区计算，行为与旧版兼容；不强制回填旧档。
- `sanitizeMission` 保留这四个字段；`environment` 走效果清洗，`ownerAtSpawn` 只接受三个合法 `FactionId`，`interception.girlIds` 过滤未知/非法 id。

---

## 6. 污染公式与平衡

### 6.1 等级

| 等级 | 区间 | 名称 | 地图色 | 文案 |
|---|---:|---|---|---|
| clean | 0–19 | 清洁 | 青绿 | 空气里有雨后金属味 |
| hazy | 20–39 | 微浊 | 灰金 | 路灯下浮着一层细灰 |
| murky | 40–59 | 浑浊 | 赭红 | 呼吸会粘在喉咙里 |
| deep | 60–79 | 深染 | 紫黑 | 影子比人先一步移动 |
| calamity | 80–100 | 灾厄 | 暗红 | 这一带已经不欢迎活人 |

### 6.2 对委托与战斗

```ts
enemyHpPct     = round(level * 0.32)
enemyPowerPct  = round(level * 0.18)
targetPct      = round(level * 0.10)
rewardPct      = round(level * 0.16)
fatigueFlat    = floor(level / 20)        // 0..5
corruptionFlat = level >= 80 ? 2 : level >= 50 ? 1 : 0
```

| 污染 | 魔物生命 | 魔物属性 | 目标 | 报酬 | 疲劳 | 侵蚀 |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | +0% | +0% | +0% | +0% | +0 | +0 |
| 25 | +8% | +5% | +3% | +4% | +1 | +0 |
| 50 | +16% | +9% | +5% | +8% | +2 | +1 |
| 75 | +24% | +14% | +8% | +12% | +3 | +1 |
| 100 | +32% | +18% | +10% | +16% | +5 | +2 |

解释：

- 污染越高，委托目标与报酬同步上涨，玩家有“脏地冒险”的收益动机。
- 魔物生命涨幅高于属性，避免高污染战斗变成单纯一击秒杀。
- 疲劳按每 20 点一档，高污染不会让单次委托直接累倒，但会明显压缩连续出勤。
- 侵蚀在 50/80 两档跳变，和现有“疲劳≥80 每日 +2 侵蚀”形成叠加风险。

### 6.3 每日自然上升

```ts
base = 1 + floor(level / 30)   // 0–29:1, 30–59:2, 60–89:3, 90–100:4
dailyRise = base
```

- 势力**不参与**每日涨幅；星灯协会、市役所、月蚀庭辖区的自然涨幅完全相同。
- 例：旧城区 46：`2/日`，无论当主是谁。
- 例：糖果公园 6：`1/日`。
- 每日结算在 `processDay` 中执行；只有跨等级时写一条 `world` 日志，避免每天刷屏。
- 这样“城市在变脏”是共同背景，玩家不会因为换当主就得到完全不同的污染曲线；势力差异只体现在玩家完成委托后的净化效率。

### 6.4 完成委托的净化

```ts
relief = 5
       + floor(snapshot.duration / 30)
       + (snapshot.work === 'combat' ? 1 : 0)
       + factionPurification(snapshot.owner).relief
```

- `snapshot` 由 `pollutionSnapshotOf(state, mission)` 生成：`owner` 取 `mission.ownerAtSpawn`，时长与类型取 `mission.duration` / `mission.work`；派遣后辖区易主不改变这次净化量。
- 旧委托缺快照时 `owner` 回退为当前当主，并在结算日志里注明“按当前辖区”。

| 当主 | `relief` 修正 | 解释 |
|---|---|---:|
| 星灯协会 | +2 | 协会按规程做善后净化 |
| 市役所 | +3 | 量产队伍顺带做工业化清理 |
| 月蚀庭 | 0 | 只扫自己人的街区，公共污染留给城市 |

- 60 分钟调查、协会辖区：`5 + 2 + 0 + 2 = 9`。
- 120 分钟战斗、市役所辖区：`5 + 4 + 1 + 3 = 13`。
- 失败/击退：`+1`（调查失败）或 `+2`（战斗失败），写日志但不跨等级刷屏。
- 只对 `mission.district` 生效；无辖区委托不改变地图。
- BOSS 委托同样净化，不额外乘倍率。

### 6.5 势力净化参数

新增 `src/factions.ts`：

```ts
export interface FactionPurification {
  relief: number;          // 加到完成委托净化；唯一会被势力改变的污染参数
}

export const FACTION_PURIFICATION: Record<FactionId, FactionPurification> = {
  association: { relief: 2 },
  government:  { relief: 3 },
  witch:       { relief: 0 },
};

/** 唯一读取入口；dossier 与 UI 都走它，不再各自持有一份 */
export function factionPurification(faction: FactionId): FactionPurification;
```

- **只此一份数据。** `FACTION_PURIFICATION` 是常量，`factionPurification()` 是访问器（未知 id 回退 `{ relief: 0 }`），`FactionDossier.purification` 不再存自己的副本，档案 UI 直接调访问器。这样“+2/+3/0”只有一个定义点，测试锁一份即可。

- 星灯协会：**净化最稳，但只对名录内的人稳**。完成委托额外净化 +2；拒绝工业净化设备，高污染区只能靠人手硬填。
- 市役所：**压得住魔物，也最会做工程净化**。完成委托额外净化 +3；但辖区目标压制来自现有当主效果，不是污染修正。
- 月蚀庭：**只治理庭内人，不治理城市**。完成委托不额外净化；政变后普通魔法少女进入其辖区会被猎杀、勒索或强制“受洗”，但这属于拦截与文案，不是污染数值修正。

`factionPurification` 不包含 `dailyRise` 或 `corruptionFlat`；污染每日涨幅、污染疲劳与污染侵蚀全部只由 `pollutionEffect` 决定。

---

## 7. 战斗与结算接入

### 7.1 合并辖区效果

`src/territories.ts` 保持 `effectiveDistrictEffect`（静态 + 当主）不变；新增：

```ts
pollutedDistrictEffect(state, id): DistrictEffect
```

实现为：

```ts
mergeDistrictEffects(
  districts[id].effect,
  factionEffect[state.territories[id]],
  pollutionEffect(state.pollution[id]),
)
```

`mergeDistrictEffects` 对所有数值字段求和，缺省 0。这样：

- 地图/委托可显示完整环境；
- 战斗只读一个快照；
- 不把污染逻辑塞进 `territories.ts` 的纯占领函数。

### 7.2 委托生成

`makeCommission` / `deployMissionTemplate` 统一走：

```ts
const environment = pollutedDistrictEffect(state, regionId);
mission.environment = environment;
mission.pollutionAtSpawn = state.pollution[regionId];
mission.target = applyPct(mission.target, environment.targetPct);
mission.reward = applyPct(mission.reward, environment.rewardPct);
```

规则：

- 只应用一次；`annotateMission` 检测到 `mission.environment` 已存在时只跳过目标/报酬乘算，仍补齐 district/window/deadline，避免重复乘算而不是跳过整段标注。
- 现有 `makeCommission` 的 `effectiveDistrictEffect` 调用删除，改为一次 `pollutedDistrictEffect`，防止“地形 + 当主 + 污染”重复叠加。
- `deployMissionTemplate` 目前只设置基础目标/报酬，v19 必须补 `environment` 与快照；这是顺手修掉的旧缺口。
- 旧档未完成委托没有 `environment`：`MissionDialog` 显示当前辖区，战斗/结算临时计算，不写回存档。

### 7.3 战斗

`src/combat.ts`：

```ts
interface BattleSetup {
  // ...
  districtEffect?: DistrictEffect;
}
```

- `simulateBattle` 使用 `setup.districtEffect ?? mission.environment ?? region.effect`。
- `unitFromMonster(..., effect?: DistrictEffect)` 除现有 `hpPct` 外，按 `1 + enemyPowerPct / 100` 缩放 `stats`；HP 仍只走 `enemyHpPct`，不双乘。
- 伤害计算继续读 `damageDealtPct` / `damageTakenPct`；污染不额外改伤害，避免和属性缩放叠加过度。
- 战报摘要增加一行 `辖区污染 46 · 深染`，便于玩家理解数值来源。

### 7.4 结算

`settleCombat`：

- 胜利/击退/失败都取 `mission.environment`（缺省按当前辖区），疲劳加 `environment.fatigueFlat`。
- **`applySettleEnvironment` 改为只消费快照。** 现状（`src/game.ts:1721-1730`）会自己再读 `region.effect.fatigueFlat` 和 `effectiveDistrictEffect` 的 `fatigueFlat`；而 `mission.environment` 已经包含“静态地形 + 当主 + 污染”三项，两处相加会把地形与当主疲劳算两遍。v19 起该函数只做：
  - `fatigueFlat = mission.environment?.fatigueFlat ?? 现有静态+当主之和`（后者仅用于没有快照的旧委托）；
  - `spiritDrain` 仍按 `region.effect.spiritPerHour` 计算（污染不提供精神力字段，保持现状）。
- 也就是：**有快照时不再读 `region.effect` / `effectiveDistrictEffect` 的疲劳字段**，避免重复叠加；这条要写专门的测试（同一委托的总疲劳等于快照值，不是两倍）。
- 侵蚀：`addCorruption(girl, 3 + gearCorruption + (boss ? 6 : 0) + (defeat ? 2 : 0) + (environment.corruptionFlat ?? 0))`。
- 胜利调用 `applyPollutionRelief(state, mission, 'win')`；失败 `'loss'`。

`settleInvestigation`：

- 疲劳加 `environment.fatigueFlat`；成功/失败都加 `environment.corruptionFlat`（调查也会暴露在污染里）。
- 成功 `applyPollutionRelief(..., 'win')`；失败 `'loss'`。
- 现有调查没有侵蚀，v19 起有；这是用户要求的“污染提升侵蚀”的一部分。

`applyPollutionRelief`：

- 计算 `relief` 或惩罚，更新 `state.pollution[district]`；
- 写 `world` 日志：`旧城区污染 46 → 38（完成委托「夜巡河岸」）`；
- 跨等级时追加一句等级变化；
- 不改变已完成委托的其他奖励。

月蚀庭任务额外声望：在战斗胜利/调查成功的既有结算之后，若 `mission.faction === 'witch'`，再执行协会 −2、市役所 −2、月蚀庭 +3，全部夹在 0–100；失败不额外变化。这样“帮月蚀庭”与“被另外两方记恨”同时发生，不需要新增敌对度。

`processDay`：

- 每日对所有辖区执行 `pollution + dailyRise`；`dailyRise` 不含任何势力修正；
- 只对跨等级/达到 80 的辖区写日志；
- **固定顺序写死，不留“之前或之后均可”**：`drugTick`（药物依赖）→ 疲劳侵蚀 → 污染日增与日志 → 势力库存/来使刷新 → 市场刷新 → BOSS/故事推进。顺序本身就是可测行为，留给实现“顺手放”会导致日志顺序与测试分叉。

### 7.5 污染与事件

- `IncidentEffect.district` 已支持临时 `targetPct/rewardPct/untilDay`；v19 保持不动。
- 如需事件直接改污染，扩展可选 `pollution?: number`（完成事件时一次性加减），但**不放进 v19 首批实现**；先让委托成为唯一稳定净化手段，避免事件刷分。
- 夜间事件/议会提案可以引用污染等级与势力净化，作为叙事文本，不直接改数值。

### 7.6 辖区拦截战

**触发**

在 `advance()` 的委托到期分支里、选择 `settleCombat` / `settleInvestigation` 之前判定：

```ts
function interceptionFor(state: GameState, mission: Mission): Interception | null
function canIntercept(state: GameState, mission: Mission): boolean
```

- **`canIntercept` 是唯一判定入口**：`interceptionFor` 内部先调它，委托详情/辖区面板的红色预警也调它。这样不会出现“UI 说会被拦截、结算却不触发”的谎报；不满足条件时预警根本不渲染。
- 命中拦截时不再走原结算分支，统一调用 `settleCombat(state, mission, squad, at, interception)`；调查委托也会被拦成战斗，而不是先结算调查再补一场战斗。
- 相应修改 `advance()` 里“只有 `mission.work === 'combat' && mission.enemyIds?.length` 才走 `settleCombat`”的短路：先调用 `interceptionFor`，命中就进拦截分支；否则再按原来的战斗/调查条件分流。

满足全部条件才触发：

1. `mission.district` 有值；
2. `state.territories[district]` 的当主态度为 `戒备`（`factionAttitude(standing) === '戒备'`，现有阈值 `< 30`）；
3. `mission` 不是 `mission.boss`、`mission.envoy`、`mission.storylineId`（故事节点/代表委托/魔物首领不参与）；
4. `mission.interception` 尚未写入；
5. 当主势力有可用的 `factionGirls`。

**选人**

- 用 `mission.id` 的稳定 hash 选 1–3 人：`count = clamp(1 + floor(recommendedLevel / 4), 1, 3)`。
- 第一名固定选该势力 `level` 最高的少女，其余按 hash 选，避免每次刷新名单变化。
- 不选首领：首领只在档案中出现，不参与日常拦截。
- 结果写入 `mission.interception = { faction: owner, girlIds }`，同一委托只触发一次。

**战斗**

- `BattleSetup` 增加：

```ts
interface BattleSetup {
  // ...
  battleKind?: 'commission' | 'interception';
  enemyGirls?: FactionGirl[];
}
```

- `simulateBattle` 在 `battleKind === 'interception'` 时，用 `unitFromEnemyGirl()` 生成 `side:'enemy'` 的单位，不生成 `mission.enemyIds` 的魔物。
- `settleCombat` 增加可选第五参 `interception?: Interception`；有值时把 `battleKind:'interception'` 与 `enemyGirls` 传给 `simulateBattle`，没有值时保持现有行为。
- `unitFromEnemyGirl` 复用 `FactionGirl` 的立绘、颜色、属性、技能；等级差按 `recommendedLevel` 做 ±10% 以内的缩放，避免低级玩家必败。
- **`FactionGirl` 必须能独立生成 `BattleUnit`**：现有 `BattleUnit`（`src/types.ts:486`）需要 `hp/maxHp/spirit/maxSpirit/element/color/portrait`，而 `FactionGirl` 只有 `stats/level/skills`。因此派生公式写死，不留实现自由发挥：
  - `maxHp = 60 + factionGirl.level * 14`，`maxSpirit = 40 + level * 6`；
  - `element` 由 `id` 的稳定 hash 在现有元素表里取，`archetype` 取 `undefined`（与魔王/无原型单位一致）；
  - **±10% 只缩放 `maxHp` 与 `maxSpirit`**（`1 + clamp((recommendedLevel - level) * 0.05, -0.1, 0.1)`），`stats` 保持静态，避免和污染 `enemyPowerPct` 叠成三层缩放；
  - 技能只取 `skills` 里现有技能池已存在的 id，缺省用基础攻击。
- 辖区污染仍生效：`BattleSetup.districtEffect` 使用原委托快照；污染提高敌方属性/生命，也提高玩家疲劳与侵蚀。
- 战报标题写成 `拦截战 · 星灯协会`，正文第一行保留 `原委托「夜巡河岸」被覆盖`。
- **只复用一段战后处理**：HP/精神、战斗经验、羁绊、关系、疲劳、侵蚀、疤痕、击倒、战报记录继续走 `settleCombat` 现有代码；拦截分支只跳过原本的委托奖励与状态（`gold`、`reputation`、`completed`、故事节点、模板奖励、辖区易主、污染净化），不复制第二套战后逻辑。拦截战只发战斗经验，`rewards.gold` 置 0，避免把原委托报酬混进战报。

**结算**

- 拦截战结束，无论胜负：
  - 原委托 `status = 'expired'`，不进入 `completed`；
  - **同时清空派工字段**：`mission.squad = []`、`mission.girlId = undefined`（若存在）；否则 `advance()` 只在 `work === 'combat' && status === 'done'` 时清 `squad`（`src/game.ts:1933-1936`），`expired` 的委托会留下旧编队 id，下一轮推进可能继续匹配到它。参战少女的 `status` 仍由 `settleCombat` 的战后逻辑恢复为 `idle`，两者不冲突；
  - 不发放原委托目标/报酬；
  - 不推进原委托的故事节点；
  - 不给辖区污染净化（这不是完成委托）；
  - 不改变辖区归属；
  - 记录 `mission.interception.outcome`。
- `settleCombat` 的拦截分支在战斗后只做一次：`victory → outcome='win'`，`defeat` 或 `repelled → outcome='loss'`；`repelled` 不算打赢，避免“没打下也算赢”的声望漏洞。
- 参战少女仍按战斗结算疲劳与侵蚀；战斗伤害、击倒、疤痕、战报与普通战斗一致。
- 声望：胜利（`victory`）`owner -4`，失败或击退（`defeat` / `repelled`）`owner -2`；不额外影响另外两方。理由是“你打了他们的人”，赢比输更招恨。
- 若战斗中全灭，按现有失败规则处理，但不额外触发原委托的失败惩罚。
- 日志：`world` 记录 `星灯协会在月见台拦截了「夜巡河岸」，原委托作废。`
- 战斗结束后不再二次判定拦截，避免循环。

**不做**

- 不做拦截战独立入口、独立体力或独立奖励；
- 不做“说服/绕过”分支；玩家在派遣前只能选择不去；
- 不做首领亲自下场；首领只出现在档案与后续剧情。

---

## 8. 三势力背景设计

### 8.0 夜糖事务所

- **全称**：夜糖事务所（玩家重开后仍沿用旧名）。
- **一句话**：不是第四势力，是三方都愿意进门、又都不肯先交出名字的那盏灯。
- **定位**：中立委托机构，不占辖区、不参与易主、没有声望与净化加成。它关闭多年，原因写成“一次没有结果的夜事”；玩家重开它，也由玩家决定它为什么重开。
- **成员观**：收留三方与无所属的魔法少女。协会出身的人在这里不必先过名录，市役所编号不必先报勤务号，月蚀庭的人不必先受洗；反过来，事务所也不替她们向各自的组织背书。
- **对外关系**：协会把它当成“不在名录里的灰色据点”，市役所把它当成“未登记的夜间设施”，月蚀庭把它当成“可以谈价的中立柜台”。三方都需要一个不设门槛的落脚点，因此都容忍它存在，但没人完全信任它。
- **玩家可写**：`背景`（为什么关门、为什么重开）、`理念`（不站队、先问名字）、`目标`（把事务所开成什么）。三段都是 `state.office`，不是世界书里的自由文本；世界书条目由它生成，保证叙事者读到的是同一份设定。
- **对外代表**：由值班助理兼任。代表不是第四位首领，没有独立立绘与势力技能；她只是事务所对外说话的人。换助理就换代表，档案与世界书同步更新。
- **为什么不做成第五种标签**：事务所是雇主，不是出身。一个协会旧家族的少女可以在夜糖事务所值夜；把她说成“事务所出身”会抹掉她与协会的冲突。因此 `GirlFaction` 只有四种，雇主徽记单独显示。
- **玩法职责**：提供契约/委托的叙事落点、少女养伤与记录的场所、三方都能出现的市场；不新增基地经营、不新增声望条、不新增辖区。

### 8.1 星灯协会

- **全称**：星灯协会（旧称“星灯契约者互助会”）
- **一句话**：最早的魔法少女组织，守住了传统，也守住了“谁有资格被称作魔法少女”的权力。
- **起源**：上一次“空月”后，第一批契约者为了互相收尸、互相作证而结成的互助会；后来被市议会承认为公开登记机构，逐渐变成半官方组织。
- **成员**：以旧式契约者为主，几乎不承认其他来源的魔法少女；名录内也分“老家族”和“被推荐的新人”，后者要替前者承担最危险的班次。
- **公开理念**：`让每一盏灯都不必独自亮着。`
- **实际手段**：登记、派单、监察、公开悼念、资格推荐。《星灯名录》决定谁算魔法少女、谁算失控者；协会用“正统契约审查”控制新人入口，用推荐名额分配资源。
- **技术禁令**：拒绝克隆/量产技术，称量产少女是“没有灵魂的复制品”；拒绝抑制剂技术，称其“逃避契约的代价”。协会推动《正统契约法》，要求所有魔法少女必须通过旧仪式登记，游说市议会冻结克隆与抑制剂预算，并拒绝为量产少女提供登记、保险、葬礼与退役安置。
- **公开面孔**：对名录内的人温柔、可靠，会为阵亡者办葬礼、给新人配导师；对名录外的人，连葬礼都不办。
- **内部矛盾**：老牌契约者家族把持推荐名额，用“血统/契约纯度”审查新人；改革派监察官被调离。部分老家主私下购买抑制剂续命，公开却投票支持禁药——这是协会最不愿被写进档案的裂缝。
- **对魔女**：魔女化是“契约失败”的耻辱，不是需要治疗的病；主张隔离、记录、终身监视。协会拒绝抑制剂，认为抑制只会让魔女“假装还活着”，公开说照护，实际是等她们自己消失。
- **对普通魔法少女**：只承认《星灯名录》内的契约者；名录外、克隆/量产、拒绝旧仪式者不算“真正的魔法少女”，没有登记、保险、葬礼与退役安置。协会不主动猎杀她们，但会用程序把她们排除在城市照护之外。
- **对另外两方**：
  - 市役所：拒绝承认量产技术，称其为“伪造灵魂”；但需要市役所的灾害数据，表面合作。
  - 月蚀庭：拒绝承认抑制剂，公开清剿；老家族私下买药，形成伪善裂缝。
- **治理**：只净化《星灯名录》内的辖区，坚持手工仪式净化；完成委托额外净化 +2。拒绝市役所的工业净化设备，高污染区只能靠人手和命去填。它不改变污染每天自然上升的速度。
- **代表**：白鹭千秋，协会监察官。说话有礼，记录一切；她记录谁有资格被记住，也记录谁不配。

### 8.2 樱雾市役所

- **全称**：樱雾市役所・夜间特别勤务课
- **一句话**：把魔法少女变成城市基础设施的市政机构。
- **起源**：魔物潮之后，市役所接管夜间灾害应对，设立“特别勤务课”；在财政与人口压力下，批准了魔法少女量产技术。
- **成员**：少量正式专员，加上大量量产/克隆少女；后者没有完整姓名，只有勤务编号与轮换表。
- **公开理念**：`秩序是城市最慢、也最稳的魔法。`
- **实际手段**：量产契约、标准化装备、绩效与轮换、执勤许可、伤亡统计。用“可替换的勤务单元”降低对少数精英的依赖。
- **公开面孔**：高效、克制、不浪漫；他们把魔物入侵压力压下去了，普通市民确实睡得更好。
- **内部矛盾**：特别勤务课要成绩，财政局要预算；一线专员开始隐瞒“损耗”，因为报上去也只会换来下一批编号。
- **对魔女**：视魔女化为“设备故障/污染源”，主张回收、封存、切断传播；不承认魔女还有人格。
- **对普通魔法少女**：统一称“勤务编号”，按绩效与损耗率管理；不鼓励使用名字，退役安置低于装备折旧。她们被当作可替换的夜间基础设施，而不是需要被记住的人。
- **对另外两方**：
  - 星灯协会：嫌其保守、低效、护短；市役所的量产少女被协会骂作“伪造灵魂”，双方在预算听证会上互相拆台。
  - 月蚀庭：政变后视为恐怖组织与非法行医集团，回收车与猎杀队互相伏击，冲突最深。
- **量产与魔物压力**：现有 `targetPct: -4` 代表标准化巡逻与量产队伍对委托难度的压制；v19 不新增刷怪率公式，避免再开一套系统。
- **治理**：工业化压制，完成委托额外净化 +3；辖区委托目标 −4、声望 +1 沿用现有当主效果。它同样不改变自然涨幅。
- **代表**：雨宫澄，夜间事务专员。永远带着盖章器，称呼魔法少女为“勤务编号”，但会记得每个编号的忌日。

### 8.3 月蚀庭

- **全称**：月蚀庭（前身“月蚀救治所”）
- **一句话**：从救治魔女开始，最后把刀对准了普通魔法少女。
- **起源**：旧教堂地窖里的魔女救治组织。第一支抑制剂在这里熬成，最早只是为了让人多活几个月。
- **成员**：救治派医师、被两方追捕的魔女、走投无路的逃亡者；政变后混入净血派的猎手与投机者。
- **公开理念**：`禁忌不是警告，是价格。`
- **实际手段**：抑制剂、黑市、庇护所、债务契约；政变后增加“净血”猎杀队、强制受洗、对协会护送队与市役所回收车的伏击。
- **公开面孔**：对庭内人危险但慷慨，不问你过去，只问你付不付得起；对庭外人，除了黑市的高价药，月蚀庭现在只给两个选项——受洗，或者被当成猎物。
- **理念转折**：月蚀庭起初只救人。后来发现星灯协会把魔女当“需要隔离的病例”，市役所把魔女当“需要回收的故障”，两方都在等魔女死。激进派提出：既然城市不把魔女当人，月蚀庭就不再服从城市的规则。
- **政变（v19 开局已发生）**：激进派“净血派”在庭内发动政变，架空救治派，控制抑制剂配方与旧教堂地窖。领袖“蚀医·夜鸮”宣布：普通魔法少女是“未受洗者”，是替城市续命的消耗品，不配得到抑制剂。黑川眠仍是对外代表，但她的每句话都要经净血派审核；档案对“黑川眠是否参与政变”留下两种互相矛盾的说法。
- **内部矛盾**：救治派只想配药，净血派想用抑制剂当武器；债务与药物依赖把求助者留在庭里，也把“救治”变成了筛选。政变后，部分老医师仍在暗中给普通魔法少女配药，被抓住就按“叛庭”处理。
- **对魔女**：魔女不是怪物，是“走到另一侧的自己”；反对隔离、反对回收，主张由魔女自己决定是否抑制——但只有庭内魔女享有这个选择权。
- **对普通魔法少女**：政变后正式敌对。称她们“未受洗者”“契约的逃兵”，认为她们不配抑制剂，袭击协会护送队与市役所回收车；普通魔法少女进入月蚀庭辖区，会被猎杀、勒索或强制“受洗”。这是月蚀庭与另外两方彻底开战的标志。
- **对另外两方**：
  - 星灯协会：伪善的牧羊人，嘴上说照护，实际在等魔女死；政变后直接袭击其护送队。
  - 市役所：编号屠宰场，回收车比魔物更可怕；净血派炸毁回收车，市役所则把月蚀庭列为恐怖组织。
- **对玩家**：月蚀庭代表委托改成“最后通牒”口吻，措辞不留退路；委托结构仍走现有调查/战斗。在现有结算之外，完成会额外降低星灯协会与市役所声望各 2 点、提高月蚀庭声望 3 点。不接不会立刻受罚，但月蚀庭的耐心会随声望下降；黑市仍卖抑制剂，不问立场、只问价格。
- **治理**：抑制剂只给庭内人；完成委托不额外净化；污染仍按自然速度上升。它不治理城市，但会用拦截战阻止玩家替城市清理辖区。
- **代表**：黑川眠，月蚀庭夜祷使。说话很轻，价格说得很清楚；她提供的药从来不问“你配不配”，只问“你拿什么换”。现在她的价格里多了一条：不要问政变那晚谁开的枪。

### 8.4 三方关系矩阵

| | 星灯协会 | 市役所 | 月蚀庭 |
|---|---|---|---|
| 星灯协会 | — | 表面合作，互相鄙视；协会骂量产是“伪造灵魂” | 公开战争；协会拒绝抑制剂，老家族私下买药 |
| 市役所 | 需要协会的合法性，又嫌其保守 | — | 公开战争；回收车与净血猎杀队互相伏击 |
| 月蚀庭 | 骂协会是“伪善的牧羊人”，袭击其护送队 | 骂市役所是“编号屠宰场”，炸其回收车 | — |

共同点：三方都认为自己在救这座城市；分歧在于“谁有资格定义人”。政变后，普通魔法少女不再是中立的旁观者，而是协会的登记对象、市役所的勤务编号、月蚀庭的“未受洗者”——三方都在争夺她们的身体与名字。

### 8.5 主导权如何体现

不新增一条“影响力”数值，避免和声望、辖区数重复。三方的争夺继续落在现有三套东西上：

| 势力 | 明面争夺 | 暗面手段 | 现有数值载体 |
|---|---|---|---|
| 星灯协会 | 登记权、正统性审查、净化配额、公开悼念 | 技术禁令、名录封锁、隔离名单、推荐名额 | 声望、协会辖区、代表委托 |
| 市役所 | 夜间勤务预算、量产配额、执勤许可 | 伤亡统计、回收车、封锁令 | 声望、市役所辖区、目标压制 |
| 月蚀庭 | 要求承认魔女自治、抑制剂合法化 | 政变、猎杀普通魔法少女、袭击护送队与回收车 | 声望、月蚀庭辖区、净化效率 |

- 辖区易主仍是“主导权”最直接的结果；v19 只让领地多了一层“污染净化”的长期价值。
- 代表委托是明面争夺；夜间事件与议会提案是暗面争夺，继续走现有 `IncidentCard` / 提案池。
- 城市态势条不再只显示声望，还显示三方辖区数与辖区平均污染，让“谁把城市管成什么样”可见。
- 月蚀庭政变按“开局已发生”处理，不新增独立“敌对度”：敌意通过辖区拦截战、代表委托“最后通牒”、事件文案与声望变化表达。
- 月蚀庭代表委托只换文案与结算，不新增“袭击人类”战斗类型；把 `factionTaskTitle.witch` 改为“月蚀庭的最后通牒”，`description` 改成不留退路的措辞，任务本体仍是调查/战斗，避免把势力冲突扩成第二套战斗系统。
- 星灯协会的技术禁令也先落在档案、事件与议会提案文案上，不新增科技树或法案系统；《正统契约法》只作为档案里的既成事实，它的保守会通过“只救名录内的人”被玩家感受到。
- 不新增“势力胜利”终局；三方始终在拉扯，符合“明争暗斗”的持续状态。

### 8.6 势力档案数据

新增 `src/factions.ts`：

```ts
export interface FactionDossier {
  epithet: string;
  origin: string;
  membership: string;
  doctrine: string;
  method: string;
  publicFace: string;
  tension: string;
  technologyStance: string;
  witchStance: string;
  girlStance: string;
  coup?: string;
  leaderId: string;                 // 指向 factionLeaders
  girlIds: string[];                // 该势力所属少女，不含首领
  relations: Record<FactionId, string>;
  color: string;
  seal: string;
}

export const factionDossiers: Record<FactionId, FactionDossier>;
export function factionBrief(faction: FactionId, standing: number): string;
export function factionPurification(faction: FactionId): FactionPurification;
export function factionRelationLine(from: FactionId, to: FactionId): string;
export function factionLeader(faction: FactionId): FactionLeader;
export function factionGirls(faction: FactionId): FactionGirl[];
export function factionTagLabel(tag: GirlFaction): string;
```

- `factionInfo` 继续留在 `src/content/items.ts`，避免一次性改十余处 import；`factionDossiers` 只承载长文本、首领/成员引用与净化参数。
- `technologyStance` 解释该势力为什么支持或排斥克隆、抑制剂；`girlStance` 解释它把普通魔法少女当什么，不能只写在背景里。
- `membership` 放在“理念”页的起源之后，用一两行说明“谁算自己人”，避免三个组织都写成抽象理念。
- `coup` 只在月蚀庭填写，档案“魔女”页会先显示政变经过；其它势力传空字符串，不渲染空段。
- `leaderId` / `girlIds` 只引用 `src/content/factionGirls.ts` 的静态数据；档案首领卡从 `factionLeader()` 取，所属名单从 `factionGirls()` 取，不在 UI 里重复写人名。
- `purification` 不进 dossier：净化数值只在 `FACTION_PURIFICATION` 里定义一次，档案与结算都经 `factionPurification()` 读取。
- `factionBrief` 输出 2–3 行，供 LLM prompt 使用，不把整篇档案塞进上下文；其中必须带首领名与“当前态度”。
- `color` 与 `factionInfo.color` 保持一致；档案 UI 不另造色板。

### 8.7 首领与所属少女

新增 `src/content/factionLeaders.ts` 与 `src/content/factionGirls.ts`，只存静态档案与战斗数值，不进入玩家契约池。

| 势力 | 首领 | 头衔 | 一句主张 | 近况 |
|---|---|---|---|---|
| 星灯协会 | 白鹭千秋 | 协会会长 / 监察官 | 名录之外，没有灯。 | 主持《正统契约法》听证，拒绝为量产少女登记。 |
| 市役所 | 雨宫澄 | 夜间特别勤务课长 | 编号不会哭，城市才睡得着。 | 把量产损耗写进预算，也记得每个编号的忌日。 |
| 月蚀庭 | 蚀医·夜鸮 | 净血派领袖 | 城市不把魔女当人，我们就自己写人的定义。 | 政变后控制抑制剂配方与旧教堂地窖。 |

所属少女（档案“成员”页显示，不含首领）：

| 势力 | 少女 | 职责 | 一句话 |
|---|---|---|---|
| 星灯协会 | 篠宫灯里 | 净化班·一级契约者 | 旧家族出身，相信自己能守住传统，也开始怀疑名录。 |
| 星灯协会 | 藤枝小夜 | 新人监察员 | 被推荐入会，替老家主值最危险的班。 |
| 星灯协会 | 朝仓凛 | 护送队队长 | 负责查缉黑市抑制剂，也负责把死人带回来。 |
| 市役所 | A-07「澪」 | 量产勤务单元 | 第一次被允许使用名字，仍会在报告里写编号。 |
| 市役所 | A-12「栞」 | 回收班 | 负责把失控单元带回，口头禅是“别让我写第二次死亡证明”。 |
| 市役所 | 东云葵 | 一线专员 | 仍相信制度能救人，和课长在伤亡统计上争吵。 |
| 月蚀庭 | 黑川眠 | 对外代表 / 夜祷使 | 表面仍谈交易，实际每句话都被净血派审核。 |
| 月蚀庭 | 苏我夜 | 庭医 | 救治派，暗中给普通魔法少女配药。 |
| 月蚀庭 | 鹿岛棘 | 净血猎手 | 专门伏击协会护送队与市役所回收车。 |

- 首领是档案顶部的固定卡，不参与日常拦截；所属少女参与拦截战。
- 首领立绘使用 `FactionLeader.portrait`（静态立绘 key），所属少女使用 `FactionGirl.portrait`；不新增图片上传入口。
- 首领/所属少女的名字、职责、一句话都可在档案中读取，方便玩家在拦截战前知道“来的是谁”。
- 所属少女的 `stats` 以玩家同级少女为基准，按势力偏科：协会均衡、市役所高血低灵、月蚀庭高灵低防；`skills` 只引用现有技能池，缺省用基础攻击。
- `FactionGirl.tag` 必须与 `faction` 一致；它只是统一列表渲染用的标签，不另造第五种身份。
- 拦截战失败/胜利都不改写这些静态数据，只写 `state` 中的战报与声望。

---

## 9. UI 方案

### 9.1 地图：污染层

`src/components/DispatchMap.tsx`：

- 在势力着色多边形之后、可点击 `district-fill` 之前，加一层只读污染多边形：

```tsx
<polygon
  className={`district-pollution ${tier}`}
  points={points}
  style={{ '--pollution-alpha': 0.04 + level / 100 * 0.26 }}
/>
```

- 颜色用 `--pollution` CSS 变量按 tier 取色；只做低透明度叠色，不遮住地形线条。
- 辖区标签下方加第二行徽记：`污染 34`；不再额外加第三个数字，避免九区拥挤。
- 顶部/底部图例新增：

```text
污染  ● 清洁  ● 微浊  ● 浑浊  ● 深染  ● 灾厄
城市平均 28 · 微浊
```

- 顺手修掉 `DispatchMap.tsx` 第 60 行附近的字面量 `r`n` 文本残留（现有 JSX 文本 bug）。

### 9.2 地图：辖区面板

面板在现有描述与效果后插入：

```text
污染 34 · 微浊
[████████░░░░░░░░]
每日 +2（自然增长，不受势力影响）
完成委托约 −10（按 60 分钟调查估算，市役所净化 +3）
魔物生命 +11% · 属性 +6%
疲劳 +1 · 侵蚀 +0
```

- 仪表条用 `div.district-pollution-meter > i`，宽度按 `level%`。
- 趋势走 `pollutionForecast(state, id)`（不传 `mission`）：只显示自然增长与污染风险，`estimatedRelief` 为 `undefined`，面板**不读它**。
- 上方那行“完成委托约 −10”由面板自己算：`pollutionRelief({ owner: state.territories[id], duration: 60, work: 'investigation' })`，把结果拼成 `−${n}`，并在同一行写“按 60 分钟调查估算，{势力名}净化 +{r}”。这样面板不假装知道具体委托，也不和 `applyPollutionRelief` 分叉——两者都调同一个 `pollutionRelief`。

- 效果行分开渲染：`静态地形`、`当主效果`、`污染风险`，避免玩家以为所有数值都来自污染。
- 若当主态度为“戒备”，面板底部追加一行红字：`此区派遣会被${factionName(owner)}所属少女拦截。`
  - 同样只在 `canIntercept` 对该区任意普通委托成立时显示；若该区当前所有委托都是 boss/代表/故事委托，则不显示，避免面板承诺一个不会发生的事。

- 底部一句势力口吻：
  - 协会：`协会的净化班每天清晨经过这里。`
  - 市役所：`勤务课把这里排进了夜间轮值表。`
  - 月蚀庭：`庭里只救受洗的人；未受洗者，绕路。`

### 9.3 委托详情

`src/components/MissionDialog.tsx`：

- 保留现有 `.district-effects` 静态效果。
- 新增 `.mission-pollution`：
  - 徽记 `污染 46 · 深染`；
  - 三行风险：`魔物生命 +15%`、`疲劳 +2`、`侵蚀 +1`；
  - 一行提示：`完成委托预计净化 −9`。
- 用 `mission.environment` 快照；旧委托无快照时按当前辖区计算并标 `（按当前辖区估算）`。
- 若 `canIntercept(state, mission)` 为真，在按钮上方显示 `.mission-interception-warning`：`星灯协会在此戒备。派遣后会被其所属少女拦截，原委托将被覆盖。`
- **预警与结算同源**：预警只在 `canIntercept` 为真时渲染，因此 boss / 代表 / 故事委托、当主无可用所属少女、已写过 `interception` 的委托都不会出现这条红字，不会出现“警告了却不触发”。
- 净化估算走 `pollutionRelief(pollutionSnapshotOf(state, mission))`，与 `applyPollutionRelief` 同一个函数、同一份快照；`mission.ownerAtSpawn` 缺失时该函数自动回退当前当主，此时额外显示 `（按当前辖区估算）`。

- 不新增按钮，不改变接单流程；玩家仍可取消派遣。

### 9.4 势力档案

新增 `src/components/FactionDialog.tsx`，由 App 的 `Modal` 承载：

```ts
type Modal =
  | ...
  | { type: 'faction'; id: FactionId };
```

- 城市态势条三张卡的 `onClick` 从 `navigate('base')` 改为 `setModal({ type: 'faction', id: fid })`；`title` 改为 `查看${info.name}档案`。
- 档案结构：
  - 顶部首领卡：立绘、姓名、头衔、箴言、当前主张、一句近况；首领是固定视觉中心，不藏在页签里；
  - 首领卡下显示势力印、名称、别称、当前声望/态度、掌控辖区数；
  - 页签：`理念` / `成员` / `城市` / `魔女` / `关系`；
  - `理念`：起源、成员构成、手段、公开面孔、内部矛盾、技术立场（量产与抑制剂）；
  - `成员`：首领完整信息 + 所属少女名单；每名少女显示立绘、姓名、代号、职责、等级、势力标签与一句立场；
  - `城市`：辖区数、辖区列表、净化加成、辖区平均污染；不显示“每日势力修正”（不存在）；
  - `魔女`：对魔女化的定义、对普通魔法少女的立场；月蚀庭先显示 `#faction-coup` 政变经过；
  - `关系`：与另外两方的关系、来使、`事务所对外代表：{name}`、`前往会客厅`。
- 关键选择器：
  - `#faction-dialog`
  - `#faction-leader` / `#faction-leader-portrait` / `#faction-leader-name`
  - `#faction-tab-origin` / `#faction-tab-members` / `#faction-tab-city` / `#faction-tab-witch` / `#faction-tab-relations`
  - `#faction-girl-{id}`
  - `#faction-coup`（仅月蚀庭）
  - `#faction-close`
  - `#faction-go-base`
- `#faction-go-base` 关闭弹窗并 `setPage('base')`，保留原有会客厅代表委托入口。
- 320/390 宽度下页签横向滚动，首领卡纵向堆叠，正文单列；不出现横向溢出。

### 9.5 事务所档案与代表

新增 `src/components/OfficeDialog.tsx`，由 App 的 `Modal` 承载：

```ts
type Modal =
  | ...
  | { type: 'office' };
```

- 入口：`BaseView` 标题区新增 `#open-office-profile` 按钮（文案 `事务所档案`），点击 `setModal({ type: 'office' })`。
- 档案结构：
  - 顶部：`夜糖事务所`、定位一句、当前对外代表；
  - 三个编辑区：`#office-background`、`#office-philosophy`、`#office-goal`，均为 `textarea`，显示字数上限；
  - 代表区：`#office-representative` 显示当前助理姓名/代号/出身；未任命时显示“尚未任命对外代表”；
  - 任命列表：只列 `active.filter(g => g.bond >= 40)`，每人一个 `#office-assistant-{id}` 按钮；当前代表可点 `#office-assistant-clear` 取消；
  - 底部：`#office-save`、`#office-cancel`。
- 打开时把 `state.office` 复制到本地 draft；取消不写回。保存时 `onSave(draft)` 派发 `{ type: 'setOfficeProfile', profile }`，成功后关闭并提示“事务所档案已写入世界书”。
- `OfficeDialog` 的 props 为 `profile`、`girls`、`assistantId`、`onSave`、`onAssistant`、`onClose`；`active = girls.filter(g => !g.dead && !g.retired)`，代表候选人仍要求 `bond >= 40`，与 `BaseView` 的助理规则一致。
- 任命代表直接复用现有 `onAssistant(girlId)`（`setAssistant`），不新增 action；取消传 `undefined`。dialog 用稳定的 `key="office"`，换代表不会丢草稿。
- 代表区显示“代表由值班助理兼任”，不提供独立代表字段；玩家想换代表，只能换助理，规则与会客厅一致。
- 档案顶部不再重复显示“势力标签”；这里显示的是雇主，不是出身。
- `#office-dialog` 在 320/390 宽度下单列，按钮不换行溢出；三个 textarea 不固定高度，随内容增长到上限。

`src/views/AuxViews.tsx` 的 `BaseViewProps` 增加 `onOffice?: () => void`；`src/App.tsx` 在 `BaseView` 处接 `onOffice={() => setModal({ type: 'office' })}`。

### 9.6 少女档案里的雇主与出身

- `src/components/CharacterDialog.tsx` 与 `src/components/Roster.tsx`：
  - 在名字下方加雇主徽记 `夜糖事务所`（固定文案，不带势力色）；
  - 旁边加出身徽记，走 `factionTagLabel(girl.factionTag)`，使用势力色；
  - 候选卡（`src/views/MarketView.tsx`）只显示出身标签，不显示雇主，因为候选还没签约。
- `src/components/CustomGirlDialog.tsx` 增加 `出身` 选择器，四个选项；默认 `factionTagFor(name)`（名字为空时 `none`），玩家可改；玩家一旦手动选择，就不再随名字变化；提交时仍未选择则按名字补。提交的 `GirlDraft.factionTag` 只接受四种值。
- 少女详情不新增“势力效果”说明；出身只解释她从哪里来、为什么可能不信任某一方，不改数值。
- `src/views/WorldbookView.tsx` 增加“事务所档案自动生成”提示与刷新：
  - 挂载时监听 `window.addEventListener('night-sugar:worldbook', reload)`；
  - 卸载时移除；
  - `office-profile` 条目渲染为只读卡片：显示正文与 `comment`，不渲染 textarea 编辑框，提供 `#worldbook-open-office` 按钮回到基础页档案；
  - 若玩家在只读条目上仍想改，按钮旁的提示写“这条由事务所档案生成，请到基础页修改”。

### 9.7 视觉与文案

- 污染色板：
  - 清洁 `#8fd3c7`
  - 微浊 `#c9b36a`
  - 浑浊 `#c08a5e`
  - 深染 `#9b6bc4`
  - 灾厄 `#c04f6a`
- 不要把所有辖区都染成高饱和色；地图只叠 4%–30% 透明度，文字徽记承担主要信息。
- 势力档案沿用现有暗色玻璃/细线边框，不引入新的 UI 框架。
- 文案保持“市政档案 + 夜间广播”的口吻，不用说明文式 UI 提示。

---

## 10. LLM 与世界书

### 10.1 世界书

`src/worldbook.ts` 默认势力条目改为：

```text
樱雾市由三方拉扯：星灯协会守着契约与登记，拒绝量产和抑制剂，只救名录内的人；市役所用克隆魔法少女压住魔物，把她们当耗材；月蚀庭从魔女救治所起家，政变后由净血派掌权，开始猎杀普通魔法少女。
九块辖区各有污染度；污染越高，魔物越强，少女越容易疲劳与侵蚀。完成委托能净化辖区。
夜糖事务所是三方之外的中立委托机构，关闭多年后由玩家重开，收留三方与无所属的魔法少女；它不占辖区，也不替任何一方站队。
```

新增**一条**自动生成条目，避免代表条目与档案条目重复吃预算：

| 字段 | 值 |
|---|---|
| `id` | `office-profile` |
| `name` | `夜糖事务所` |
| `constant` | `true` |
| `priority` | `92` |
| `order` | `4`（排在势力概述之前；世界书清洗只接受整数） |
| `keys` | `夜糖事务所`、`事务所`、`背景`、`理念`、`目标`、`对外代表` |
| `comment` | `由事务所档案自动生成；请到基础页的事务所档案修改` |

- 条目正文由 `officeWorldbookContent(state.office, representativeOf(state))` 生成：
  - 第一段：中立机构、关闭后由玩家重开、接纳三方与无所属；
  - `背景：` / `理念：` / `目标：` 三段，来自玩家编辑；
  - `对外代表：{name}（{codename}，出身{factionTagLabel(tag)}）；代表由值班助理兼任。`；
  - 无代表时写 `尚未任命对外代表。`
- `src/worldbook.ts` 新增 `syncOfficeWorldbook(profile, representative, options?: { onlyIfMissing?: boolean }): boolean`：读当前条目，按 `id` upsert，保留其它所有条目（包括玩家自建与内置），写回，然后 `window.dispatchEvent(new CustomEvent('night-sugar:worldbook'))`。返回是否写入成功；localStorage 失败时由调用方提示，不静默吞掉。
- **`office-profile` 是只读生成条目，玩家不手改。** 处理顺序：
  - App 初次挂载：`onlyIfMissing: true`，只在条目缺失时补写，**不覆盖**已有条目——避免刷新页面把玩家刚在世界书页看到的内容立刻改回去；
  - `state.office` 或 `assistantId` 变化：`onlyIfMissing: false`，整条重写；
  - `WorldbookView` 对 `id === 'office-profile'` 的条目禁用正文编辑，只显示正文 + `comment` + `#worldbook-open-office` 按钮；其它条目编辑不变。
- 这样“世界书不是事实来源”不再靠一句提示语维持，而是靠 UI 不允许手改。`comment` 写成 `由事务所档案自动生成，修改请到基础页的事务所档案`。

- 旧自定义世界书若已有 `factions` 条目，同一同步做最小归一化：把旧称 `月蚀教团` 替换为 `月蚀庭`，并在末尾补一句“夜糖事务所是三方之外的中立委托机构”。只改这一处措辞，不覆盖玩家其它编辑；条目不存在时不强行复活。
- `builtinWorldbook()` 用 `DEFAULT_OFFICE_PROFILE` 生成同一条默认条目，保证全新档第一次打开世界书就能看到；旧自定义世界书没有该条时，App 挂载后的同步会补上。
- `src/App.tsx` 用 `useEffect` 监听 `state.office` 与 `state.assistantId`：
  - 用 `JSON.stringify([office, assistantId])` 做 ref key，相同不重复写；
  - 变化时调用 `syncOfficeWorldbook(office, rep, { onlyIfMissing: false })`；
  - 初次挂载调用 `syncOfficeWorldbook(office, rep, { onlyIfMissing: true })`，只负责给旧世界书补缺失条目，不覆盖已有内容。
- **唯一事实来源**是 `state.office` 与 `state.assistantId`，不是世界书文本。`office-profile` 在世界书页是只读生成条目（正文不可编辑），玩家要改只能回事务所档案改；不存在“手动改完又被覆盖”的困惑。

- 不新增世界书 schema；不新增第二条“代表”条目，代表行合并进 `office-profile`，避免固定条目把 `WORLDBOOK_BUDGET = 1200` 挤爆。
- 统一“月蚀庭”称谓，删掉“月蚀教团”旧称。
- 协会不是纯正面：保守、排外、技术禁令、推荐名额与“只救名录内的人”都要在档案与事件里出现；月蚀庭不是单纯受害者：政变、强制受洗、猎杀普通魔法少女要写清楚。

### 10.2 夜间事件

`src/llm-night.ts`：

- 夜间事件 prompt 增加城市态势摘要：
  - 三方当前声望/态度；
  - 三方首领名与一句主张；
  - 污染最高的两个辖区与等级；
  - 当前当主；
  - 事务所对外代表与一句中立定位；事务所条目已由世界书常驻提供，prompt 只补“当前代表是谁”；
  - 涉及玩家少女时，带其 `factionTag` 的出身标签（如“协会出身”“无所属”），并明确她受雇于夜糖事务所；不要把出身写成雇主。
- 夜间提案 prompt 的辖区列表带 `污染等级/当主/态度`；LLM 可以据此选更脏或更危险的辖区，但**不能返回污染数值**。生成后的 `Mission` 仍由本地 `annotateMission` 快照环境、重算目标/报酬。
- 事件仍走现有 `IncidentCard` JSON；不要求 LLM 返回污染数值。
- 事件文本可以写“市役所的回收车开进旧城区”“协会净化班在糖果公园拉警戒线”“净血派在巷口贴出未受洗者名单”，但数值仍由本地事件效果决定。
- 事件摘要里带上协会的“技术禁令”与月蚀庭的“净血派掌权”，避免 LLM 继续把协会写成纯善、把月蚀庭写成单纯受害者。

### 10.3 故事蓝图

`src/llm.ts` 的 `generateStoryBlueprint`：

- prompt 增加一行城市背景：
  `樱雾市由星灯协会、市役所、月蚀庭三方拉扯；协会会长白鹭千秋保守并排斥克隆与抑制剂，市役所课长雨宫澄把量产少女当勤务编号，月蚀庭净血派领袖夜鸮政变后与普通魔法少女敌对；夜糖事务所是重开的中立委托机构，收留三方与无所属的少女，当前对外代表是{assistantName}；辖区污染会改变委托与魔物。`
- 不改变 v18 的 8–16 节点契约、严格校验、一次修复、无 Key 四幕兜底。
- `girlBrief` 增加 `出身` 一行，写 `factionTagLabel(girl.factionTag)`；另写 `雇主：夜糖事务所`。不再把“夜糖事务所”塞进 `factionTag`，也不把玩家少女误写成协会/市役所/月蚀庭成员。
- 不把完整势力档案塞进 prompt；只给 `factionBrief` 级别的两三行，避免挤占蓝图 token。

### 10.4 议会/意见

- `opinions.ts` 的势力标签继续用 `factionInfo.short`。
- 可选：议会提案池增加“强化契约登记 / 扩大克隆配额 / 抑制剂合法化”三条立场，分别对应星灯协会、市役所、月蚀庭；但不在 v19 首批实现，先保证地图与结算闭环。
- 星灯协会的提案以“审查、隔离、禁用”为主，市役所以“扩产、回收、封锁”为主，月蚀庭以“合法化、庇护、复仇”为主；三方立场不能写成同一种治理口吻。

---

## 11. 兼容与迁移

- `GameState.version: 12`。
- `loadState` 接受 `1,3,4,5,6,7,8,9,10,11,12`；旧档迁移：
  1. `state.version = 12`；
  2. `state.pollution = repairPollution(state.pollution)`；
  3. `state.territories = repairTerritories(...)` 保持现有逻辑；
  4. `state.office = sanitizeOfficeProfile(state.office)`；缺失时写默认档案；
  5. `state.girls` 每项补 `factionTagFor(girl.id)`；`state.candidates` 每项同样补，不按签约状态写死；
  6. 旧任务不强制回填 `environment`，不补 `interception`。
- `createInitialState` / `createBlankState` 都写 `pollution: initialPollution()`、`office: DEFAULT_OFFICE_PROFILE`，三势力 `standing: 50`。
- `createInitialState` 里手工写死的初始少女也写入显式 `factionTag`（协会/市役所/月蚀庭/无所属之一），不靠 `hydrate` 临时抽；`createBlankState` 没有初始少女，候选交给 `refreshMarket` 的缺口补齐。
- 旧存档的势力声望**不重置**：玩家已经打成 20 的月蚀庭仍然是 20；只有新档/空白档从 50 开始。这样“初始态度 50”不会抹掉旧档进度。
- 极端旧档完全没有 `factions` 字段时，补齐为 `{ witch:50, association:50, government:50 }`，不再使用旧的 20/50/45 缺省。
- `sanitizeState` 保留 `pollution`，非法值走 `repairPollution`；`office` 非法/缺失走 `sanitizeOfficeProfile`；少女标签缺失/非法（含历史 `'office'`）走 `factionTagFor(id)`。
- 旧世界书没有 `office-profile` 时，App 挂载后的同步会补写；已有 `office-profile` 则按当前 `state.office` 与 `assistantId` 覆盖，其它条目不动。
- `Mission` 新增字段均为可选；旧任务 JSON 不需要改写。
- `DistrictEffect` 新增字段均为可选；旧事件/旧辖区效果按 0 处理。
- `GirlCard.girl.factionTag` 为可选字段；旧卡缺字段或非法值按 `factionTagFor(card.girl.name)` 回退，不再默认 `office`。卡牌导出/导入不包含污染、事务所档案与势力档案（运行时状态）。
- 不改变 localStorage key；不做破坏性清档。

---

## 12. 测试计划

### 12.1 状态测试（预计 +28，目标 154）

1. `initialPollution` 九区齐全、范围合法；`repairPollution` 补缺/截断/NaN。
2. `pollutionTier` 五档边界：19/20、39/40、59/60、79/80。
3. `pollutionEffect` 在 0/50/100 的六项数值符合表。
4. `pollutionDailyRise` 只按等级分段，与当主无关；`processDay` 只跨级写日志；**`processDay` 的固定顺序**（药物 → 疲劳侵蚀 → 污染日增 → 势力库存 → 市场 → BOSS）有断言，日志顺序稳定。
5. `pollutionRelief` 调查/战斗、时长、三方当主净化加成；完成下降、失败上升。
6. 委托生成：目标/报酬只应用一次；`environment`、`pollutionAtSpawn`、`ownerAtSpawn` 三份快照写入；派遣后改污染不影响该委托。
7. 战斗：高污染魔物 HP 与属性都提升；疲劳与侵蚀按快照增加；战报含污染行。
8. 调查：污染疲劳与侵蚀生效；成功净化。
9. v11 旧档迁移：九区补齐、版本 12、旧任务可读、旧少女与旧候选都补 `factionTagFor(id)`；`office` 缺省档案补齐。
10. `sanitizeState`/`sanitizeMission` 保留污染、环境、`ownerAtSpawn` 与拦截字段；非法字段不崩。
11. `factionDossiers` 三份都有 `membership`/`technologyStance`/`girlStance`；每份有 `leaderId` 与 `girlIds`；月蚀庭 `coup` 非空；星灯协会文本明确排斥克隆与抑制剂；净化数值只由 `FACTION_PURIFICATION` 提供，dossier 里没有第二份副本，且不含 `dailyRise/corruptionFlat`。
12. 初始声望：新档/空白档三势力都是 50；载入旧档不重置声望。
13. 少女标签：新档初始少女、后续契约者与候选都从四种出身生成；卡牌往返保留四值；非法值与历史 `'office'` 回退到 `factionTagFor`，不产生第五种标签。
14. 月蚀庭任务额外声望变化：战斗与调查结算都执行“协会 −2 / 市役所 −2 / 月蚀庭 +3”，其它势力任务不触发；声望照常夹在 0–100。
15. 拦截触发：当主态度 20（戒备）且普通辖区委托（战斗或调查）→ `interceptionFor` 返回当主与 1–3 名所属少女；态度 30（中立）不触发；代表/魔物首领/故事委托不触发；当主势力没有可用所属少女时不触发。调查委托命中后进入拦截战，而不是先结算调查。
16. 拦截结算：`victory` / `defeat` / `repelled` 都让原委托 `expired`，**同时 `mission.squad` 与 `mission.girlId` 被清空**；不发原目标/报酬、不净化污染、不换辖区；`interception.outcome` 为 `win` 或 `loss`，`repelled` 记 `loss`；声望变化为 `victory −4`，`defeat` / `repelled` −2。
17. 拦截战战斗：敌方单位来自 `factionGirls`，不出现原 `enemyIds` 魔物；`unitFromEnemyGirl` 产出的单位 `maxHp`/`maxSpirit`/`element` 均非空，`stats` 不被等级差缩放，±10% 只作用于 `maxHp`/`maxSpirit`；战报标题含“拦截战”。
18. 事务所档案：空档/缺字段补 `DEFAULT_OFFICE_PROFILE`；`sanitizeOfficeProfile` 逐字段 trim、超长截断、非法回退；保存 action 更新 `state.office`。
19. 对外代表：`representativeOf` 只认 `assistantId`；设/换/清助理后代表同步变化；指向不存在少女时返回 `undefined`；**助理死亡或退休后返回 `undefined`**，但 `assistantId` 本身不被清空。
20. 世界书同步：`syncOfficeWorldbook` 插入 `office-profile`；`onlyIfMissing: true` 时已有条目**不被覆盖**，缺失时才写入；`onlyIfMissing: false` 按 id 重写；其它自建条目与内置条目保留；旧 `factions` 条目里的 `月蚀教团` 被替换为 `月蚀庭` 且其它文字不动；无代表时含“尚未任命”；有代表时含姓名/代号/出身；重复调用不重复插入。
21. 市场出身覆盖：从空市场刷新到 ≥4 时四种出身都出现；已有 1–3 名同出身候选时，`refreshMarket` 先补缺口，槽位不足则替换重复出身的非自定义候选，最终达到 `min(target,4)` 种；=3 时至少三种；自定义候选不被替换；同一 state/salt 重复调用结果稳定；`makeCandidate` 显式 tag 不被覆盖。
22. 出身生成器：同一 seed 结果稳定；大样本覆盖四种且无 `office`；权重落在 30/30/22/18 的合理区间；不同 seed 不全部相同。
23. `GirlCard` 缺字段/非法字段/旧 `'office'` 值都按名字确定性回退；导出再导入不改变合法出身。
24. `pollutionForecast` 不传 `mission` 时 `estimatedRelief` 为 `undefined`；传 `mission` 时与其 `ownerAtSpawn`/时长/类型算出的 `pollutionRelief` 完全一致。
25. `canIntercept` 与 `interceptionFor` 同源：`canIntercept` 为假时 `interceptionFor` 必为 null；反之必返回非空。这样 UI 预警与实际触发不会分叉。
26. **全自定义候选反例**：5 个出身相同的自定义候选占满市场，`refreshMarket` 不抛错、不替换自定义候选、也不谎报覆盖，出身种类数如实为 1。
27. `applySettleEnvironment` 不重复计疲劳：带快照的委托，总疲劳增量等于 `environment.fatigueFlat`，不是“快照 + 静态 + 当主”；旧委托无快照时才回退静态+当主之和。
28. `ownerAtSpawn` 生效：委托生成后把辖区易主，结算净化仍按派遣时当主的 `relief` 计算，UI 估算与结算结果一致。

### 12.2 浏览器测试（预计 +9，目标 65）

1. **地图污染**：进入地图，九区仍有 `.district-fill`；`#district-panel-candy` 显示 `.district-pollution-meter`、`污染`、`微浊`、每日趋势 `自然`；地图图例含“城市平均”。
2. **委托污染风险**：打开一个带辖区的委托，`.mission-pollution` 可见，包含 `魔物生命`/`疲劳`/`侵蚀`；不破坏现有 `.district-effect` 断言。
3. **势力档案**：点击 `#dispatch-faction-association` 直接打开 `#faction-dialog`，看到 `#faction-leader` 立绘与姓名；切到 `#faction-tab-members` 看到所属少女；切到 `#faction-tab-city` 看到净化加成与辖区；协会“理念”含“量产/抑制剂”禁令文案；关闭后点 `#dispatch-faction-witch`，切到“魔女”页，`#faction-coup` 含“净血派/未受洗者”；`#faction-go-base` 回到会客厅；`#faction-close` 可关。
4. **拦截战**：把月见台当主设为星灯协会、声望 20，派一名少女执行该区普通委托，推进到结算；出现 `拦截战 · 星灯协会` 战报，原委托不进入已完成、不给原报酬，`mission.status === 'expired'` 且 `mission.squad` 已清空。
5. **戒备提示**：同一辖区委托详情出现 `.mission-interception-warning`，文案含“拦截”；对一条 boss/代表委托打开详情，**不出现**该警告（预警与 `canIntercept` 同源）。
6. **响应式**：320/390 宽度下地图面板、势力档案与事务所档案不横向溢出；单独成一条流程，不改动现有响应式断言。
7. **事务所档案**：基础页点 `#open-office-profile` 打开 `#office-dialog`；改 `#office-background`/`#office-philosophy`/`#office-goal` 后保存；重新打开值仍在；世界书页出现 `夜糖事务所` 条目且含新背景，且该条目**没有可编辑文本框**，只有 `#worldbook-open-office`。

8. **对外代表**：在档案里任命一名羁绊 ≥40 的少女；`#office-representative` 显示其姓名；势力档案“关系”页显示同一代表；世界书条目含代表行；取消后显示“尚未任命”。
9. **出身与雇主**：市场候选卡显示出身标签，随机刷新后能看到不止一种；已签约少女档案同时显示 `夜糖事务所` 与出身徽记；导入一张无标签旧卡后显示出身，不显示成事务所出身。
10. 现有 56 组流程全部保留；其中三方态度断言从“月蚀 20 = 戒备”改为“三方 50 = 中立”，势力卡点击改为打开档案；这是两处行为变更，不增加流程数；更新计数到 65。

### 12.3 手动验收

- 地图九区污染徽记颜色随等级变化，不遮住地形。
- 旧城区高污染委托的目标/报酬/风险明显高于糖果公园。
- 完成一次委托后，面板数字下降，日志有一行“污染 X → Y”。
- 同一污染等级下，星灯协会/市役所/月蚀庭辖区的每日自然涨幅相同；只有完成委托后的净化量不同。
- 新档三势力初始态度都是 50；旧档原有声望不被重置。
- 星灯协会档案读起来不全是好话：能看到“只救名录内的人”、拒绝克隆与抑制剂、把改革派调离。
- 市役所档案能看到量产少女被编号化、回收车与预算逻辑。
- 月蚀庭档案能看到政变后的敌意：普通魔法少女在其辖区会被猎杀/强制受洗，而不是继续被当成潜在求助者。
- 三份档案都能看到首领立绘、姓名、头衔、主张、近况，以及至少 3 名所属少女。
- 玩家少女档案/编队同时显示雇主 `夜糖事务所` 与出身（三势力/无所属）；候选只显示出身标签；导入卡能保留/确定性补齐四种出身。
- 事务所档案能改背景/理念/目标，保存后世界书条目同步；换值班助理后代表行同步；旧世界书不会被清空。
- 市场刷新后能看到协会、市役所、月蚀庭与无所属的候选，不是清一色同一种出身。
- 在某势力辖区把态度打到 20 以下后，派遣普通委托会出现拦截预警；结算进入“拦截战”战报，原委托作废。
- 完成一次月蚀庭代表委托，协会/市役所声望下降、月蚀庭声望上升；完成协会委托不会反向奖励月蚀庭。
- 三势力档案读起来像三个不同组织，而不是三套换色文案。
- 旧 v18 存档载入后地图有污染、少女有确定性出身标签与默认事务所档案，故事蓝图、卡牌、战斗均正常。

---

## 13. 风险与处理

| 风险 | 处理 |
|---|---|
| 污染叠加导致高污染战斗过难 | 上限 100；属性 +18% 封顶；先按表调，不改怪物基础数值 |
| 目标/报酬被重复乘算 | 委托生成只应用一次；`annotateMission` 检测 `environment` 已存在则跳过；测试固定 |
| 旧档缺污染导致地图空 | `repairPollution` 补初始值；迁移测试覆盖 v11 |
| 旧任务没有环境快照 | 运行时按当前辖区计算并标“估算”；不写回旧档 |
| 地图信息过密 | 只加一枚污染徽记 + 图例一行；详细数值放面板 |
| 势力档案变成大段说明文 | 五页签拆分；每段 2–4 行；档案只从城市态势条进入 |
| 把协会写成纯反派、月蚀庭写成纯受害者 | 三方都保留自洽立场：协会是程序性冷酷，月蚀庭有救治派与净血派的裂缝；不靠旁白定罪 |
| 政变后黑市仍卖抑制剂显得矛盾 | 黑市不是公开药房：净血派把少量掺价药放出去，既是财政来源，也是钓出“未受洗者”的饵；买到药不等于被庭里接纳 |
| 势力净化与现有当主效果重复 | 势力只加 `relief`；当主效果继续管目标/报酬/疲劳，互不覆盖 |
| 初始态度全 50 导致旧档月蚀庭从戒备变中立 | 旧档不重置声望，只有新档/空白档写 50；迁移测试覆盖 |
| 拦截战被误认为新战斗模式 | 只覆盖“态度戒备 + 普通辖区委托”的结算，复用现有战报与 `BattleSetup`，无独立入口 |
| 拦截战让玩家白亏体力 | 派遣前红字预警；代表/魔物首领/故事委托豁免；拦截战只作废原委托，不额外扣原委托失败惩罚 |
| 首领立绘需要新美术 | 先复用 `portrait` 数据与现有立绘生成/占位；档案布局不依赖新二进制资源 |
| 把事务所写成第四势力 | 不新增 `FactionId`、辖区、声望、净化或拦截；事务所只提供雇主徽记、档案与世界书条目 |
| 玩家改档案后世界书不同步 | `state.office` 是唯一来源；App 监听 office/assistantId 变化 upsert；世界书页监听事件重载；测试覆盖无代表/换代表 |
| 旧世界书被内置条目覆盖 | `syncOfficeWorldbook` 只 upsert `office-profile`，保留其它条目；`loadWorldbook` 的合并行为不在 v19 重写 |
| 出身标签被误当雇主 | UI 分两枚徽记；`factionTagLabel` 不含事务所；LLM `girlBrief` 分开写“出身/雇主” |
| 市场出身靠概率、玩家看不到三方 | 先补当前市场缺失出身，再用确定性洗牌袋填满；槽位不足时替换重复出身的非自定义候选；种类数上限受自定义候选约束，状态测试按“带前提的覆盖”断言，并补全自定义反例 |
| 净化数值出现三份副本 | 只保留 `FACTION_PURIFICATION` + `factionPurification()`，dossier 不存副本；测试锁单一来源 |
| 地形/当主疲劳被算两遍 | `applySettleEnvironment` 有快照时只消费 `environment.fatigueFlat`；专测总疲劳不翻倍 |
| 派遣后易主导致净化口径漂移 | `mission.ownerAtSpawn` 冻结当主；UI 估算与结算共用 `pollutionRelief(snapshot)` |
| 拦截预警与结算不一致 | `canIntercept` 单一判定，UI 与 `interceptionFor` 共用；不满足条件不渲染警告 |
| 事务所档案过长挤爆世界书 | 三段字数上限 180/120/120；只生成一条 `office-profile`，不拆代表条目 |
| 浏览器测试因新增按钮/弹窗变化 | 保留现有 `#district-panel-*`、`#dispatch-faction-*`、`#av-envoy-*`；新增选择器独立 |

---

## 14. 验收标准

- [ ] 九块辖区各自显示污染度、等级、每日自然趋势；地图图例有城市平均。
- [ ] 污染每天只按自然速度上升，任何势力都不改变涨幅；跨级有日志。
- [ ] 高污染提高委托目标/报酬、魔物 HP/属性、少女疲劳/侵蚀。
- [ ] 完成委托降低辖区污染，失败略升；势力只改变完成委托的净化量，结算日志可读。
- [ ] 委托生成时快照环境、污染值与当主，派遣后改污染或易主都不改变该委托的结算口径。
- [ ] 三势力各有完整档案，能从城市态势条打开；档案包含首领立绘/信息、所属少女名单与净化加成。
- [ ] 三势力初始态度都是 50；旧档声望不被重置。
- [ ] 魔法少女有四种**出身**标签：三势力 / 无所属；夜糖事务所是雇主徽记，不是第五种标签。玩家契约者、候选、导入卡都确定性分配，卡牌往返保留。
- [ ] 夜糖事务所是中立的雇主，不是第四势力：没有辖区、声望、净化加成与拦截战；对三方与无所属开放。
- [ ] 玩家可编辑事务所背景/理念/目标；值班助理兼任对外代表；保存后世界书出现/更新 `夜糖事务所` 条目，换代表同步，旧条目不被清空；该条目在世界书页只读，改动只能回档案。
- [ ] 市场候选在非自定义槽位足够时覆盖四种出身；自定义候选满位时种类数如实反映、不谎报覆盖，导入旧卡不会把出身写成事务所。
- [ ] 星灯协会不是纯正面：保守排外、排斥克隆与抑制剂、只救名录内的人；这些要能在档案、事件或提案里看到。
- [ ] 市役所的量产工具化成立：克隆魔法少女是耗材，回收车、配额与封锁令带着制度性冷酷。
- [ ] 月蚀庭政变按“已发生”落地：净血派掌权、普通魔法少女被猎杀/强制受洗、代表委托使用“最后通牒”口吻并结算额外声望变化。
- [ ] 当辖区当主态度为“戒备”时，普通委托派遣前有拦截预警；结算触发覆盖原委托的拦截战，原委托作废、不发原报酬且清空派工字段。预警与触发共用 `canIntercept`，不存在“警告了却不触发”。
- [ ] `applySettleEnvironment` 有快照时不再重复叠加静态/当主疲劳，总疲劳等于快照值。
- [ ] 世界书与档案统一使用“月蚀庭”，不再出现“月蚀教团”。
- [ ] 旧 v11 存档可进，旧任务可打，旧故事蓝图可开；旧少女与旧候选按 id 补出身标签，旧世界书补事务所条目。
- [ ] `npx tsc -b`、状态测试、production build、浏览器流程全部通过。
- [ ] 320/390 宽度无横向溢出；截图检查地图、面板、档案与首领卡。

---

## 15. 实施顺序

1. **类型与纯函数**：`types.ts` 加 `pollution`、`office`、`Girl.factionTag`（四值）、`Mission.environment/pollutionAtSpawn/ownerAtSpawn/interception`、`DistrictEffect` 新字段；新建 `src/pollution.ts`（含 `PollutionSnapshot` 与 `pollutionRelief(snapshot)`）；新建 `src/office.ts`（默认档案/清洗/代表/世界书正文）；`src/factions.ts` 放 `FACTION_PURIFICATION` + `factionPurification()`、档案与首领类型、`factionTagFor`/`factionTagLabel`、`canIntercept`；`src/content/factionLeaders.ts` / `factionGirls.ts` 放静态名单。
2. **迁移与初始值**：`createInitialState`、`createBlankState` 三势力声望 50、写入默认事务所档案；`loadState`/`sanitizeState` 接污染、事务所与确定性出身标签；`cards.ts` 保留四值并清洗旧 `office`；跑 tsc。
3. **污染闭环**：`pollutedDistrictEffect`、`pollutionSnapshotOf`、委托生成三份快照（environment / pollutionAtSpawn / ownerAtSpawn）、`processDay` 固定顺序、`applyPollutionRelief(state, mission, result)`、`applySettleEnvironment` 去重复计疲劳、战斗/调查疲劳与侵蚀、月蚀庭任务额外声望变化。
4. **拦截闭环**：`canIntercept` + `interceptionFor`、选人、`BattleSetup.enemyGirls`、`unitFromEnemyGirl`（含派生公式）、覆盖原委托的结算（清 `squad`/`girlId`）与战报。

5. **战斗**：`BattleSetup.districtEffect`、`unitFromMonster` 属性缩放、战报污染行。
6. **势力档案**：填三份 dossier、首领、所属少女、关系矩阵、`factionBrief`；更新势力世界书文本。
7. **地图 UI**：污染层、徽记、图例、辖区面板、委托详情与拦截预警。
8. **势力 UI**：`FactionDialog` 首领卡 + 五页签、App modal、城市态势条入口、关系页代表行、响应式。
9. **事务所闭环**：`OfficeDialog`、BaseView 入口、`setOfficeProfile` action、助理兼任代表、`syncOfficeWorldbook`、App 同步 effect、`WorldbookView` 监听与生成提示；少女档案/编队/候选/自定义卡显示雇主与出身。
10. **LLM 与文档**：夜间事件城市摘要、蓝图 prompt 与 `girlBrief` 的出身/雇主拆分；README、`tasks/todo.md`、计数。
11. **验收**：tsc、test、build、browser、截图、`git diff --check`、提交。

---

## 16. 文件清单

新增：

- `src/pollution.ts`
- `src/office.ts`
- `src/factions.ts`
- `src/content/factionLeaders.ts`
- `src/content/factionGirls.ts`
- `src/components/FactionDialog.tsx`
- `src/components/OfficeDialog.tsx`
- `tests` 内新增用例（不新建测试文件，继续放 `tests/game.test.ts` / `tests/browser.mjs`）
- `tasks/plan-v19.md`（本文件）

修改：

- `src/types.ts`
- `src/districts.ts`
- `src/territories.ts`
- `src/game.ts`
- `src/combat.ts`
- `src/cards.ts`
- `src/worldbook.ts`
- `src/llm-night.ts`
- `src/llm.ts`
- `src/App.tsx`
- `src/components/DispatchMap.tsx`
- `src/components/MissionDialog.tsx`
- `src/components/Roster.tsx`
- `src/components/CharacterDialog.tsx`
- `src/components/CustomGirlDialog.tsx`
- `src/views/AuxViews.tsx`
- `src/views/MarketView.tsx`
- `src/views/WorldbookView.tsx`
- `src/map.css`
- `src/styles.css`
- `src/dialogs.css`
- `tests/game.test.ts`
- `tests/browser.mjs`
- `README.md`
- `tasks/todo.md`

不修改：

- `src/storygraph.ts` 与故事蓝图 JSON 契约
- 存档 key 与后端（无后端）
- 现有 56 组浏览器流程保留；三方态度断言从“月蚀 20 = 戒备”改为“三方 50 = 中立”，势力卡点击改为打开档案，这是两处必要的行为变更；其余只加新断言并更新计数到 65。

---

## 17. 已确认的取舍

1. **污染只按自然上升，势力只影响净化。**  
   九区每天按等级自然变脏；当主不改变涨幅。星灯协会完成委托额外净化 +2，市役所 +3，月蚀庭 0。这样“城市变脏”是共同压力，势力差异体现在玩家愿意替谁清理、清理得多快。

2. **势力卡先打开档案，再从档案去会客厅。**  
   档案顶部显示当前首领立绘与信息，成员页显示所属少女；保留 `前往会客厅`，代表委托流程不变。多一步点击换来一个稳定的背景入口。

3. **污染只影响有辖区的委托。**  
   无 `mission.district` 的委托不受污染影响，也不改变地图；九区仍是污染系统主舞台，避免所有随机委托被同一套数值覆盖。

4. **月蚀庭政变后仍保留黑市抑制剂。**  
   药不公开上架：净血派把少量高价药放出来，既是财政来源，也是钓出“未受洗者”的饵。月蚀庭仍卖抑制剂，同时猎杀普通魔法少女；玩家可以在“救自己的女孩”和“资助敌对势力”之间做脏选择。

5. **事务所是雇主，不是第五种出身。**  
   把 `office` 从 `GirlFaction` 删掉，玩家少女的出身仍然只有三方/无所属；事务所用独立徽记显示。这样“协会出身的少女在事务所值夜”才能成立，也不会把三方冲突稀释成四种颜色。代价是 UI 要显示两枚徽记，但比再造一个“事务所阵营”便宜。

6. **对外代表由值班助理兼任，不新增 `representativeId`。**  
   玩家已经有一个“值班助理”的概念，代表只是它在对外场合的名字。合并后少一份名单、少一个同步点；代价是不能“助理是 A、代表是 B”，但这本来就不符合一个小事务所的规模。

7. **事务所档案写进世界书，但世界书不是事实来源。**  
   `state.office` 是唯一来源，`office-profile` 条目由它生成。该条目在世界书页是**只读**的：正文不提供编辑框，只能回事务所档案改，所以不存在“手改完又被覆盖”的情况；这样叙事者能稳定读到设定，又不会出现“世界书和档案各说一套”。

8. **出身用确定性生成，不追求开局全手工。**  
   初始契约者与市场候选大多由 `factionTagFor(id)` 分配；手工角色可显式指定。确定性保证刷新、迁移、卡牌往返都不变，也让“市场四种出身齐全”可测试；代价是少数名字的出身看起来像抽签，后续可用手工名单覆盖。

---

## 实施记录（v19 落地后回填）

- **落地范围**：§5 的新模块（`src/pollution.ts`、`src/factions.ts`、`src/office.ts`、`src/content/factionLeaders.ts`、`src/content/factionGirls.ts`）、§6 的状态层、§7 的地图与委托弹窗、§8 的势力档案与事务所档案、§9 的出身标签、§10 的世界书同步、§11 的提示词，全部按方案实现；核心模块没有偏离方案的接口名。
- **手动补的势力净化表**：`FACTION_PURIFICATION` 只保留 `relief` 一个字段（协会 2 / 市役所 3 / 月蚀庭 0），并且只经 `factionPurification()` 读取，缺项统一回落到 `{ relief: 0 }`。方案里提过的其他势力污染参数没有实现，避免出现“势力也能改每日涨幅”的第二条通道。
- **拦截判定与快照的归属不一致（刻意保留）**：`canIntercept()` 看的是辖区**当前**归属（谁现在占着这块地谁来拦），而 `pollutionSnapshotOf()` 用的是委托生成时冻结的 `ownerAtSpawn`（净化按成交时谈好的条件算）。两者语义不同，不强行统一。
  - 由此修掉一个真实缺陷：`MissionDialog` 的戒备预警原本打印 `snapshot.owner`，辖区易主后会说出错误的势力名；现改为打印当前归属，与“谁真的会来拦”一致。
- **`battleKind` 不落库**：`battleKind: 'interception'` 只传给 `simulateBattle` 的入参，`BattleState` 上没有这个字段。因此回归改用 `mission.interception.outcome` / `interception.girlIds` / 日志里的「拦截战」文本来断言，不新增持久字段。
- **世界书 `generated` 标记必须持久化**：只读判定读的是存档里的 `WorldbookEntry.generated`，不能在渲染时靠 id 猜测。旧数据缺该字段时按 `false` 处理，生成条目在 `builtinWorldbook()` 与 `syncOfficeWorldbook()` 两处都显式写入 `generated: true`。
- **市场出身轮转**：`refreshMarket()` 先补缺失出身，再用 `factionBag()`（按 `marketDay` 的确定性轮转）补足，最多四种；只有在名额允许时才补，不会挤掉自制候选。
- **回归规模**：154 项状态测试（+28）、65 组浏览器流程（+9），`npx tsc -b` 与 `vite build` 通过，浏览器 0 控制台错误、0 失败请求。
- **保留下来的两处既有行为变更**（已在 README 记录）：势力态度断言由「月蚀 20 = 戒备」改为「三方 50 = 中立」；地图势力卡由跳回基地改为打开势力档案。
