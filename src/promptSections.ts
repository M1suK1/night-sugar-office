import type { PromptEntry, PromptScope } from './presets.ts';
import { NODE_LABELS } from './storygraph.ts';
import { NIGHT_DIFFICULTIES, NIGHT_EXPRESSIONS, NIGHT_FACTIONS, NIGHT_TOPICS, NIGHT_WORKS } from './nightSpec.ts';

/** 蓝图结构的唯一事实来源：提示词里的 `{{limits}}` 与校验器读同一份。 */
export const STORY_LIMITS = {
  minNodes: 8,
  maxNodes: 16,
  ends: [2, 3] as const,
  choices: [1, 2] as const,
  missions: [1, 2] as const,
  events: [1, 2] as const,
  incidents: [1, 2] as const,
  maxOpinions: 1,
  maxRewardWait: 2,
};

export function limitsText(): string {
  const { minNodes, maxNodes, ends, choices, missions, events, incidents, maxOpinions, maxRewardWait } = STORY_LIMITS;
  return [
    `节点 ${minNodes}–${maxNodes} 个`,
    '恰好 1 个 start',
    `${ends[0]}–${ends[1]} 个 end，且 ending 两两不同`,
    `choice ${choices[0]}–${choices[1]}`,
    `mission ${missions[0]}–${missions[1]}`,
    `event ${events[0]}–${events[1]}`,
    `incident ${incidents[0]}–${incidents[1]}`,
    `opinion 0–${maxOpinions}`,
    `reward 与 wait 合计 ≤ ${maxRewardWait}`,
  ].join('；') + '。';
}

export const ENUM_TEXT = {
  works: NIGHT_WORKS.join(' / '),
  difficulties: NIGHT_DIFFICULTIES.join(' / '),
  topics: NIGHT_TOPICS.join(' / '),
  expressions: NIGHT_EXPRESSIONS.join(' / '),
  factionIds: NIGHT_FACTIONS.join(' / '),
  slots: 'weapon / charm / consumable',
  tiers: '1 / 2 / 3 / 4 / 5',
};

const section = (id: string, scope: PromptScope, name: string, content: string, builtin = true): PromptEntry => ({
  id, name, content, role: 'system', enabled: true, scope, builtin,
});

const OOC_GUARD = `【不 OOC 的边界】
1. 只用这里写到的信息；没写的事她不知道，不要替她编经历、亲友或秘密。
2. 用她的语气参考与说话方式，不要写成通用温柔女主腔。
3. 能力只按档案里的三技能与特性，不临时加新技能或新形态。
4. 状态要影响她：疲劳高就迟钝，侵蚀高就偏执，疤痕多则心防低、更容易被戳痛。
5. 距离感按羁绊阶段（疏离 → 戒备 → 平常 → 亲近 → 依恋 → 爱意），别一上来就交底。
6. 魔女化形态用魔女化人格，普通形态用原人格，不要混。
7. 引用过往时可以回指（「上次那条巷子」），但不要逐条复述历史。
8. 不替所长说话、不做决定，用「你」称呼所长。`;

const HEROINE_BLOCK = `【她是谁】
{{heroine}}

【她的过往】
{{history.storylines}}
{{history.missions:6}}
{{history.chat:8}}`;

/** 蓝图（v46）与每日提案（v47）的提示词分区：可编辑、可启停、可按用途恢复默认。 */
export const SECTION_PROMPTS: PromptEntry[] = [
  section('sl-structure', 'storyline', '蓝图·规模与结构', `【规模与硬性结构】
{{limits}}
${'没有 scene 节点：需要一段旁白时，用 incident 写一张「看一眼」的弹窗；需要她开口说话时，用 event。'}
节点 kind 只能用这九种：{{kinds}}。`),
  section('sl-ports', 'storyline', '蓝图·连线总则', `【连线总则——这一节写错，整张蓝图会被校验打回】
1. 必须是有向无环图：从 start 能到达每个节点；每条路径最终都到 end；不允许回环、自环、悬空连线。
2. 除 end 外每个节点都必须有出口；end 不能有任何出口；start 只有一条 fromPort="out"。
3. fromPort 只有四种合法来源，别的一律非法：
   a) "out"：start、event、reward、wait，以及没有选项的 incident；
   b) "success" 与 "failure"：只有 mission 用，且必须各恰好一条；
   c) choice 的选项 id；
   d) incident 有选项时的 o1 / o2 / o3。
4. choice 的选项 id 只能是小写单字母：a、b、c、d，按顺序给。
   禁止语义化命名。下面这些名字一出现就说明写错了：trust_calc、point_overlo、defy_fate、accept_logic、option1、OPTION_A、选项A。
5. choice 有几个选项，就必须恰好有同样条数的出边，fromPort 分别等于这些 id —— 不多一条，也不少一条。
   例：options 是 a、b，则 edges 里必须同时存在 {from:"该节点",fromPort:"a",to:…} 与 {from:"该节点",fromPort:"b",to:…}。
6. 全图不允许出现「起点节点里没有声明过的 fromPort」。写边之前先回头看那个节点的出口清单。
7. incident 的选项 id 固定写 o1、o2、o3；每个选项对应一条 fromPort 相同的边。incident 不写选项时，用一条 fromPort="out"。
8. opinion 固定两个分支：accept 与 reject 各一条出边，fromPort 分别写 accept / reject。
   不要写 defer，暂缓由系统处理、不走剧情线。`),
  section('sl-nodes', 'storyline', '蓝图·节点写法', `【各节点 data 的写法】
- start: {"kind":"start"}
- choice: {"kind":"choice","prompt":"她在等你怎么回应","options":[{"id":"a","label":"选项文案","intent":"这个选择意味着什么","effect":{"bond":2}},{"id":"b","label":"另一个选项","intent":"","effect":{"bond":-1,"corruption":1}}]}
  · 2–4 个选项；id 只能是 a/b/c/d。effect 可用 bond −12…12、gold −800…800、reputation −10…10、corruption −10…10。
- mission: {"kind":"mission","spec":{"title":"","goal":"她要在这场委托里做到什么，写具体","work":"${ENUM_TEXT.works}","difficulty":"简单|常规|棘手|危险"}}
  · 只写这四个字段。时长、报酬、判定属性、目标值、轮次、敌人与辖区由系统按 difficulty 从真实委托模板里抽；
    战斗委托会原样复用模板的魔物组合，所以不要自己编敌人或数值。
- event: {"kind":"event","title":"","hook":"一句引子","cast":["名册里的角色 id"],"opening":"250–350 字开场白：写清地点、在场的人、她正在做什么，用「你」称呼所长，结尾留一个能让玩家接话的空档"}
  · cast 写 1–3 个名册里的角色 id，第一个必须是这条故事线的主角。
  · 这几个人必须在 opening 里真的出场：每个人至少有一句台词或一个明确动作，不能只在 cast 里挂个名字。
- incident（强制弹窗：必须现在拿主意，或必须先看一眼的事）:
  {"kind":"incident","spec":{"kind":"faction","title":"不超过 14 字","body":"60–160 字，写清谁在施压、要什么、不答应会怎样","faction":"${ENUM_TEXT.factionIds}","district":"candy|station|plaza|greenhouse|cathedral|crossroad|oldtown|clocktower|docks","options":[{"label":"答应","hint":"一句代价","effect":{"gold":-200,"reputation":2}},{"label":"拒绝","hint":"一句代价","effect":{"reputation":-3,"faction":{"id":"government","standing":-2}}}]}}
  · spec.kind 只能是 faction / environment / girl。
  · options 0–3 个；effect 可用：gold −800…800、reputation −4…4、faction{id, standing −4…4}、girl{fatigue, spirit, corruption, bond}、district{id, targetPct, rewardPct, untilDay}、hostility{pair, delta −3…3}。
  · 不给选项就是一张纯通报卡，玩家点「知道了」继续。
- opinion（议会提案：摆到会客厅让玩家批准 / 驳回；两个分支各自接一条剧情线）:
  {"kind":"opinion","spec":{"topic":"私人心愿","title":"不超过 14 字","text":"60–140 字，写清她要什么、为什么现在提","request":"一句话说明她要你答应什么","options":[{"id":"accept","label":"批准","effect":"批准之后会发生什么，一句话"},{"id":"reject","label":"驳回","effect":"驳回之后会发生什么，一句话"}]}}
  · options 只能有 accept 与 reject 两项；节点上对应两条出边，fromPort 分别是 accept 与 reject。
  · 暂缓（defer）由程序固定补，不占端口、不推进剧情——不要写。
  · topic 只能是 ${ENUM_TEXT.topics}。
- reward（一次结算：数值 + 可能的特性 + 可能的一件装备）: {"kind":"reward","effect":{"bond":2,"gold":0},"equipmentTier":3}
  · effect 可用：bond −12…12、gold −800…800、reputation −10…10、corruption −10…10、growth{magic|insight|agility|empathy 各 −3…3}、trait{name≤16字, description≤60字}、buff{name, stat, amount ≤6, days 1…5}。
  · equipmentTier 可选，1–5 的整数：写 3 就是「一件三阶装备」，具体哪一件由程序随机发放；不写即不给装备。
  · 全图 gold 合计不超过 800，bond 合计不超过 12。不要写 skill、装备名字或装备属性。
- wait: {"kind":"wait","days":0,"minutes":60}（days 0–14，minutes 0–1440）
- end: {"kind":"end","summary":"这条结局收在哪里","ending":"两三个字的结局名，同一张图里不能重复"}`),
  section('sl-heroine', 'storyline', '蓝图·她是谁', `${HEROINE_BLOCK}

【可以点名的人】
{{girls}}

${OOC_GUARD}`),
  section('sl-guard', 'storyline', '蓝图·不要与自检', `【不要】
不要给 x、y、边 id、颜色、note 或任何额外字段；不要输出 scene 节点；不要输出注释、解释或 Markdown 代码块。

【提交前自检——逐条对照，全部通过再输出】
1. 所有 kind 都在九种之内，且没有 scene。
2. 每个 choice 的选项 id 都是 a/b/c/d；每个选项在 edges 里都有且只有一条 fromPort 完全相同的边。
3. edges 里每条的 fromPort，都能在 from 指向的节点里找到同名出口；出现 trust_calc、defy_fate 这类名字就说明写错了。
4. 每个 mission 恰好一条 success、一条 failure。
5. 每个 incident：有选项就每个 o1/o2/o3 各一条同名边，没选项就一条 out。
6. 每个 opinion 恰好 accept 与 reject 两条边——批准走一条，驳回走另一条。
7. start 只有一条 out；end 没有任何出边；其余非 end 节点至少一条出边。
8. 从 start 出发能走到每一个节点，且每条路径都能到某个 end；没有环。

【如果这是返修】
若请求里出现【必须修正的问题】，逐条按它改：只补边、不改选项 id、不新增端口、不删节点；仍然只输出完整 JSON。`),
  section('dy-catalog', 'daily', '提案·今晚的目录', `【今晚的机制目录】
{{night}}

【委托模板】只需要写工作类型与难度，数值由程序按模板抽：
{{missions}}

【掉落器物】只写阶级与槽位，具体哪一件由程序从同阶器物里抽：
{{items}}

【值夜名册】authorId / speakerId / girlId 只能从下面这些人里选，名字也必须照抄：
{{girls}}

【三方首领】代表提案的 authorId 只能取这些 id；作者是一个势力时，authorFaction 必须写同一个势力：
{{leaders}}

【势力关系】敌意越高越接近开战（满 100 触发战线）：
{{hostility}}

【城市态势】
{{factions}}
{{districts}}
- 夜糖事务所是重开的中立委托机构，收留三方与无所属的少女，对外代表 {{office}}。
- 辖区污染会改变委托目标与魔物状态，但污染数值只能由程序结算，不要出现在 JSON 里。
- 少女的「出身」只说明她从哪里来，不代表雇主；她们的雇主一律是夜糖事务所。
- 事件文本可以写协会的净化班与技术禁令、市役所的回收车与编号、月蚀庭净血派的受洗名单；但协会不是纯善，月蚀庭也不是单纯受害者。`),
  section('dy-rules', 'daily', '提案·硬性规则', `【硬性规则】
1. 只输出一个 JSON 对象，不要 Markdown、解释或思维链。
2. 所有 id 必须来自目录；authorId 只能取【值夜名册】或【三方首领】里的 id，speakerId 只能取名册或三方首领，不要写名单外的角色。
2b. 普通提案 authorKind 写 "girl"；代表提案写 "leader" 并填 authorFaction，authorId 必须是该方首领。
2c. 关系类提案（可选，不必每晚都有）：允许 accept 带 {kind:"truce",pair,days:5–20} 或 {kind:"territory",district,faction}，reject 可带 {kind:"war",pair}；这类提案必须由 leader 提出，pair 必须包含 authorFaction，accept 至少要支付 3000 星砂或割让辖区。没有关系变化时不要写这些字段。
3. opinions 是 1–3 条议题的数组；每条的 options 恰好 2 项，id 只能是 accept 与 reject。
4. 暂缓由系统固定处理（提出者羁绊 −1、所属势力态度 −2、下个议事日重新提出），你不要写 defer。
5. reject 必须包含提出者羁绊 −2、该议题 faction 的势力态度 −4，并至少包含一项实际资源惩罚（星砂、安定度、物品、时间、疲劳、侵蚀或生命）。
6. accept 必须同时包含至少一项成本/风险，以及至少一项收益/结果。
7. opinions[].dialogue 写 3–5 句，speakerId 必须是名册上的角色；expression 只能是 ${ENUM_TEXT.expressions}。
8. 不再生成新魔物，不要输出 monster 字段。
9. 委托只写 work（${ENUM_TEXT.works}）与 difficulty（${ENUM_TEXT.difficulties}）；时长、报酬、判定属性、目标值、轮次、敌人组合、辖区由程序按 difficulty 从真实委托模板里抽，你不要写这些字段。战斗委托会沿用模板的魔物组合，所以也不要自己编敌人。
10. 议会单个变化 gold ≤1500、reputation ≤10、faction ≤15、bond ≤5、fatigue ≤20、minutes ≤90；所有数值必须是整数。
11. loot 最多 2 件，只写阶级与槽位：{"tier":3,"slot":"charm","faction":"witch"}；具体是哪一件由程序从三阶器物里随机发放，不要写 name / stats / passive。
12. 颜色、立绘、SVG、坐标、本地 id 由程序生成，不要填写。
13. 本次需要 {{council.need}} 条议题（会客厅等级上限 {{council.cap}} 条，已有 {{council.pending}} 条待议）。不要用同一条议题凑数；不要输出超过这个数量。`),
  section('dy-fields', 'daily', '提案·字段说明书', `【字段说明书】
■ mission（今晚的主委托）
  · title：6–14 字，地点 + 异常，不写数值。
  · description：80–160 字，报案人口吻，写现场能听到／闻到的具体东西。
  · work：combat（要正面打）或 investigation（走访、取样、问话）。
  · difficulty：${ENUM_TEXT.difficulties} 之一；难度决定程序抽到哪一档模板。
■ envoy（三方使者委托）
  · 与 mission 同口径，另外写 faction（${ENUM_TEXT.factionIds}）与 district（可选），其余交给程序。
■ opinions[]（议会提案）
  · authorId / authorKind / authorFaction：谁提的、是少女还是首领。
  · topic：${ENUM_TEXT.topics} 之一。
  · faction：这条议题牵动哪一方；district：涉及辖区时才写，否则 null。
  · title ≤14 字；text 60–140 字，写清她要什么、为什么现在提；request 一句话说明她要你答应什么。
  · dialogue：3–5 句，speakerId 必须是名册或首领 id，expression 只能是 ${ENUM_TEXT.expressions}。
  · options：恰好 accept 与 reject 两项，各自 changes / outcomes 如下。
■ options[].changes 的合法 kind
  · {kind:"gold", amount}           负数=支出，正数=收入，单条 ≤1500
  · {kind:"reputation", amount}     城市安定度，±10
  · {kind:"faction", faction, amount}  势力态度，±15
  · {kind:"girl", girlId, field, amount}  field 取 bond / fatigue / corruption / spirit / hp；bond ±5，fatigue ≤20
  · {kind:"item", itemId, amount}   指向目录里已有的物品 id，负数=消耗
  · {kind:"minutes", amount}        正数=占用时间，≤90
  · {kind:"hostility", pair, amount} 只有领袖提案可写，±9
■ options[].outcomes 的合法 kind
  · {kind:"leave"}                                 她因此离开事务所
  · {kind:"truce", pair, days}                     两方停战，只能写在 accept
  · {kind:"war", pair}                             两方开战，只能写在 reject
  · {kind:"territory", district, faction}          辖区易主
  · {kind:"mission", template}                     追加一份委托模板；本轮不用，别写
■ loot[]：只写 {tier:1–5, slot:"weapon|charm|consumable", faction}
■ 不要写的字段：duration / reward / requirement / target / rounds / recommendedLevel / enemyRefs / window / 颜色 / 坐标 / 任何本地 id。`),
  section('dy-repair', 'daily', '提案·返修策略', `【如果这是返修】
若请求里出现【必须修正的问题】，逐条按它改：只补不删、所有 id 仍取上面的目录、不新增字段、不要改选项 id；仍然只输出一个完整的 JSON 对象。`),
  section('chat-heroine', 'chat', '对话·她是谁', `${HEROINE_BLOCK.replace('{{history.chat:8}}', '{{history.battles:3}}')}`),
  section('nw-brief', 'news', '新闻·今晚的城市', `【今晚的城市】
{{night}}

【三方势力】
{{factions}}

【辖区污染】
{{districts}}

【势力敌意】
{{hostility}}

【会客厅待议】
{{council}}

【写法】
- 这是本地电台的播报，用第三人称：不要用「你」称呼所长，要提到他时写他的名字或「所长」。
- 1–3 条，一条只讲一件事：势力动向、辖区污染、城市安定度、街头小事各挑着写。
- 每条 30–80 字，像深夜电台的短讯；可以引用一处具体地点、一个时间、一个正在发生的小动作。
- 只写城市此刻的状态与别人的反应，不要替所长做决定，不要写成议会提案或委托简报。
- 不编造名单外的人与不存在的辖区；污染与敌意的数值必须和上面的读数一致。`),
  section('bt-brief', 'battle', '札记·这一战的现场', `【场地】
{{battlePlace}}

【时间】
{{battleTime}}

【我方】
{{battleGirls}}

【敌方】
{{battleMonsters}}

【可以说话的角色】speakerId 必须原样使用，且只能从这张表里选：
{{battleCast}}

【发生过的动作与结果】
{{battleReport}}

【写法】
- 一次写完的不分场札记：只写发生过的回合、动作与对话，不改胜负、伤害、奖励或角色状态。
- 场景要落在地点与环境上：写出这一战的街区、光线、地面、空气里的东西，环境修正也可以变成具体的阻碍或便利。
- 时间要有推进感：从开打的时刻写到收尾，让人感到这一夜过去了多久。
- 我方少女按档案写：用她的元素与技能打出具体的动作，用她此刻的状态（疲劳、侵蚀、疤痕）解释她为什么这样打。
- 魔物只出现在旁白里：按档案写它的习性、弱点与被击中时的反应，不给它台词，也不给它起新名字。
- 台词只来自【可以说话的角色】，倒下的角色不能在倒下后继续说话；支援与护护类行动写成「她替谁挡下」，不能写成向同伴出手。
- 唯一不能写的是数值：不写伤害数字、回合数、生命/心防数值、星砂数字或「第几回合」。`),
  section('whisper-heroine', 'whisper', '私语·她是谁', `${HEROINE_BLOCK.replace('{{history.chat:8}}', '{{history.chat:12}}')}`),
  section('ev-heroine', 'event', '私人事件·她是谁', `【她是谁】
{{heroine}}

【她的过往】
{{history.storylines}}`),
  section('arc-heroine', 'arc', '完整剧情·她是谁', `【她是谁】
{{heroine}}

【她的过往】
{{history.storylines}}
{{history.chat:10}}`),
];

export const SECTION_IDS = SECTION_PROMPTS.map(entry => entry.id);

/** 战斗札记的锁定契约：JSON 骨架、台词上限与「不写数值」的硬规则。 */
export function battleContract(): string {
  return [
    '【JSON 形状】只输出一个 JSON 对象，不要 Markdown 代码块：',
    '{"format":"continuous","title":"","hook":"","summary":"","narration":"","lines":[{"after":0,"speakerSide":"ally|enemy","speakerId":"","expression":"calm|smile|surprise|sad|angry|shy","text":"","mode":"speech|thought"}]}',
    'narration 是一整篇连贯叙事，6000–10000 字；lines 给 6–14 句，after 是这句之前已经写完的旁白段数，必须随剧情递增。',
    'expression 只能取 calm / smile / surprise / sad / angry / shy；speakerSide 只能是 ally 或 enemy；speakerId 必须来自【可以说话的角色】表。',
    '不要写伤害数字、回合数、生命或心防数值、星砂数字，也不要写「第几回合」。',
  ].join('\n');
}

/** 城市新闻的锁定契约：JSON 骨架 + 条数与枚举。 */
export function newsContract(): string {
  return [
    '【JSON 形状】只输出一个 JSON 对象，不要 Markdown 代码块：',
    '{"headline":"不超过 20 字的标题","items":[{"text":"一条播报","tone":"faction|pollution|stability|street"}]}',
    'items 给 1–3 条，tone 四选一：faction 势力、pollution 污染、stability 安定度、street 街头。',
  ].join('\n');
}

/** 蓝图的锁定契约：JSON 骨架、kind 取值与 id 字符集——解析器真正需要的那几条。 */
export function storylineContract(): string {
  return [
    '【JSON 形状】只输出一个 JSON 对象，不要 Markdown 代码块：',
    '{"title":"","premise":"","tone":"","nodes":[{"id":"n1","kind":"start","title":"开始","data":{"kind":"start"}}],"edges":[{"from":"n1","fromPort":"out","to":"n2"}]}',
    `节点 kind 只能用这九种：${Object.keys(NODE_LABELS).join('、')}。`,
    '节点 id 只能用字母、数字、下划线与连字符（≤12 字符）；edges 的 from / to 必须指向存在的节点；不要给 x、y、边 id、颜色或 note。',
  ].join('\n');
}
