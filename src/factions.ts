/**
 * 三方势力的档案与行为参数。
 *
 * 数据只在这里定义一次：净化参数走 `FACTION_PURIFICATION`，长文本走 `factionDossiers`，
 * 首领与所属少女分别来自 `content/factionLeaders.ts` 与 `content/factionGirls.ts`。
 * 档案 UI 与结算都经由访问器读取，不各自复制一份数值。
 */
import { portraitString, type PortraitSubjectLike } from './portrait.ts';
import type { FactionGirl, FactionId, FactionLeader, FactionRoster, GameState, GirlFaction, PortraitSpec, StatKey, Outfit, Expression } from './types.ts';
import { factionInfo } from './content/items.ts';
import { factionLeaders } from './content/factionLeaders.ts';
import { factionGirls, girlsOfFaction } from './content/factionGirls.ts';
import { factionAttitude } from './economy.ts';
import { FACTION_ORDER } from './territories.ts';

/** 完成委托时额外的净化量；唯一会被势力改变的污染参数。 */
export interface FactionPurification {
  relief: number;
}

export const FACTION_PURIFICATION: Record<FactionId, FactionPurification> = {
  association: { relief: 2 },
  government: { relief: 3 },
  witch: { relief: 0 },
};

/** 唯一读取入口；档案与结算都走它，不再各自持有一份。 */
export function factionPurification(faction: FactionId): FactionPurification {
  return FACTION_PURIFICATION[faction] ?? { relief: 0 };
}

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
  leaderId: string;
  girlIds: string[];
  relations: Record<FactionId, string>;
  color: string;
  seal: string;
}

export const factionDossiers: Record<FactionId, FactionDossier> = {
  association: {
    epithet: '守灯的人',
    origin: '樱雾市最古老的契约者互助宗族，战后废墟上由数支传承百年的世家出资联合重构，并将“唯有登记在册者方得护佑”以金漆镌刻在协会章程第一页。',
    membership: '传承古血的旧家族子弟、经严格保荐入会的见习新人，以及少数耗费巨资赎买到登记者配额的外来者。名录之外的无所属少女，被冷酷地划归于协会的救助视线之外。',
    doctrine: '灯火唯有立于守夜人的掌中方成光明；力量必须受制于规矩，每一纸契约都必须追溯至可被问责的姓氏。',
    method: '纯白净化班严格依照街区时序巡守，重甲护送队紧贴着回收车的轨迹穿行；凡能用人命与法阵强行填平的污染裂口，绝不引入不可控的机械技术。',
    publicFace: '倾力向市民展现救济与秩序的典范面貌：孤儿庇护所、风雨无阻的深夜巡守，以及高悬明镜的公开听证大会。',
    tension: '年轻一代的基层监察员开始在死板的名录前产生动摇与质疑；而会长办公室的回应，仅仅是将质疑者不动声色地调往污染最凶险的边境，以沉默代替辩解。',
    technologyStance: '极度排斥克隆量产技术与月蚀抑制剂：在他们看来，前者让灵魂的本真贬值为可随意冲销的流水账，后者则把魔女化的清算沦为不断推迟却利息惊人的欠条。',
    witchStance: '视魔女化为不可逆转的灵魂堕落深渊，主张建立严密的监测、强制隔离，并在意识彻底崩溃的临界点到来前体面送别；绝不容忍所谓“带病共存”的虚妄幻想。',
    girlStance: '将普通魔法少女视为需要严加管束与保护的易碎孩童：庇护其肉身，亦剥夺其自由。至于名录之外游荡的野犬，他们从不主动垂怜。',
    leaderId: 'leader-association',
    girlIds: ['fg-association-tou', 'fg-association-sayo', 'fg-association-rin'],
    relations: {
      association: '内部暗流涌动：激进的青年改革派与老态龙钟的宗族执事，在名录准入门槛的争议上已彻底无法同席而坐。',
      government: '彼此打心底轻蔑，却在深夜行动中高度绑定：协会出动净化人手，市役所提供清运重车；协会鄙夷对方机械冰冷的编号制，却又深刻依赖其残忍高效的回收网络。',
      witch: '公开定性为极度危险的异端结社；在护送车队连续三次遭遇惨烈的死角伏击之后，协会高层内部已无人敢再提议和谈判。',
    },
    color: '#F1A7C6',
    seal: '灯',
  },
  government: {
    epithet: '夜勤编号',
    origin: '灾变时期市政体系为应对失控魔物潮而紧急编设的夜间特别勤务课，最初仅是消防与战地救援的临时外延，最终在秩序真空期顺理成章地接管了整座城市的夜防戒备与暴力机关。',
    membership: '享受全额津贴的在编勤务专员、承担脏活的外包清扫队，以及自量产计划序列A-01启动后源源不断填补进空缺的无名克隆体。',
    doctrine: '城市不需要英雄，需要可替换的班次。',
    method: '极限压测、梯次轮值、冷酷回收。将异象侵蚀控制在精算统计允许的生理损耗指标以内，随后心安理得地编入下一年度的市政预算表中。',
    publicFace: '标榜现代行政的极致效率与透明度：定期公开伤亡数字、配额指标，甚至向社会公示清障回收车每夜行经的巡查坐标。',
    tension: '特别勤务课长私下能默背出每一枚殉职编号的生卒日期，但在晨会扩产报告上签字的钢笔却从未有过半秒颤抖；一线老专员苦笑着将其称为“用老长官的记忆来抵偿城市的烂账”。',
    technologyStance: '坚信量产克隆是唯一能将人命损耗压进财政预算的现实路径；抑制剂则被扣上甲级管制物资的印信，因为在官僚眼中，“只要还能拖延不死的，在统计表上便不算折损”。',
    witchStance: '将魔女化等同于精密仪器不可修复的机械故障与重度工伤，一律按报废回收规程处理，绝不特批追悼抚恤流程。',
    girlStance: '冰冷的量产少女只是批次与损耗数字，而在编专员则是并肩饮茶的公务同僚；两套残酷自洽的评价语言，每日在同一间办公室的文件架两侧并行不悖。',
    leaderId: 'leader-government',
    girlIds: ['fg-government-mio', 'fg-government-shiori', 'fg-government-aoi'],
    relations: {
      association: '业务上亟需协会的净化法术撑场，私下又极度厌恶其漫长繁缛的听证会拖垮巡防排班；联合行动时口称“手足兄弟”，转过身便戏谑对方为“那帮抱着旧油灯不放的顽固守墓人”。',
      government: '内部争执不休：因公伤亡的认定口径与下一季度的扩产配额，永远是周一晨间安全例会上争吵不休的死结。',
      witch: '将月蚀庭定义为必须秘密管控的走私黑市：私底下的特效抑制剂照买不误，但在公开执法记录中，绝不承认任何对方的人身存在。',
    },
    color: '#9CC9D2',
    seal: '印',
  },
  witch: {
    epithet: '受洗者',
    origin: '最早起源于收治魔女化晚期患者的地下隐秘救济所，在旧教堂潮湿霉烂的地窖深处默默熬炼了十数年止痛糖浆与抑制试剂，直到激进的净血派在一次深夜的内部决议中夺走了配方与铁门钥匙。',
    membership: '完成净血洗礼的受洗者、游离于世俗医学外的庭医，以及巡弋于雨巷的猎手。任何拒绝受洗仪式之人皆被冷酷视作外物，哪怕在昨日她仍躺在救济所的病榻之上。',
    doctrine: '既然这座城市冷漠地将生命粗暴划分为人与魔物，那么这条生死界线的刻画权，便该由跨越过深渊的我们说了算。',
    method: '严格垄断药剂配方、推行强制受洗仪式，并不惜伏击协会的正规护送车队；净血派始终信奉“在奢谈救赎之前，必须先将虚伪的秩序清理干净”。',
    publicFace: '表面上依旧维持着高价出售特效抑制剂的地下窗口，并接纳重症异变患者求医，只是门诊铁栅处不知何时悄然立起了一张不可通融的未受洗者清洗黑名单。',
    tension: '慈悲的救治派遗老仍在深处摇晃着药瓶调制缓释剂，而冷酷的猎手已在潮湿的砖道上搜索落单者；两批理念南辕北辙的同行者，至今依然在同一座药房的阴影中进出。',
    technologyStance: '抑制剂由他们一手开创并绝对垄断；而对市役所的克隆技术则保持着冰冷的蔑视——无灵性的量产克隆体缺乏完整的魔女化心智折射，不配成为深渊探索的样本。',
    witchStance: '坚称魔女化是生命突破凡胎桎梏的超凡飞跃，绝非世俗口中的堕落残疾；然而他们也同时强调，唯有通过受洗仪式的坚韧信徒，才配冠以这一崇高桂冠。',
    girlStance: '将游离的普通魔法少女视为必须提前净化或收缴的隐患火种：要么受困于猎杀勒索，要么被迫跪受洗礼。旧日的求济者，如今已彻底沦为清洗名单上的待办条目。',
    coup: '记叙着三年前那一夜发生的净血派深层夺权：时任老议长在药房幽暗的火光前被强行收回徽记，秘传配方与重重铁闸的钥匙尽数易手；那一夜的地窖没有溅出一滴鲜血，但在此后的每一个深夜月圆，旧街道上便再也无法止住血腥味。',
    leaderId: 'leader-witch',
    girlIds: ['fg-witch-mian', 'fg-witch-soga', 'fg-witch-shika'],
    relations: {
      association: '双方皆坚信对方才是寄生于这座城市骨髓里的真正病灶；星灯协会那挂满银铃的护送车队，向来是月蚀庭猎手们最为热衷的伏击猎物。',
      government: '全市唯一还保留商业往来的老客户：走私的抑制试剂暗中源源不断输出，但在台面上，绝不与其产生任何法理层面的身份互认。',
      witch: '内部裂痕深重：救治派老人默默守在药釜前称量黑盐，净血派少壮已在门外擦拭尖刺长棍；这座充斥着苦味草药气味的旧药房，成了两派仅存的危险平衡点。',
    },
    color: '#B98AD9',
    seal: '蚀',
  },
};

export function factionLeader(faction: FactionId): FactionLeader {
  return factionLeaders[faction];
}

export function factionGirlsOf(faction: FactionId): FactionGirl[] {
  return girlsOfFaction(faction);
}

/** 全部首领（按原属顺序），编成界面用来做待选区。 */
export const allFactionLeaders: FactionLeader[] = FACTION_ORDER.map(faction => factionLeaders[faction]);

export function leaderById(id: string): FactionLeader | undefined {
  return allFactionLeaders.find(leader => leader.id === id);
}

/**
 * 默认阵容（v85）：全是空席。
 *
 * 静态名册废掉之后，三方位置只能靠开局编成从卡库填。空席会让界面提示
 * 「契约卡不足，需要导入」，而不是悄悄塞进内置人物。
 */
export function defaultFactionRoster(): Record<FactionId, FactionRoster> {
  const roster = {} as Record<FactionId, FactionRoster>;
  for (const faction of FACTION_ORDER) roster[faction] = { leaderId: '', memberIds: [] };
  return roster;
}

/** 某一方是否还空着（没有首领或没有随从）。 */
export function factionSeatEmpty(state: RosterState, faction: FactionId): boolean {
  const roster = state.factionRoster?.[faction];
  if (!roster?.leaderId) return true;
  return roster.memberIds.length === 0;
}

/** 三方一共还缺几个席位；>0 时界面要提示去导卡。 */
export function factionSeatsMissing(state: RosterState): number {
  return FACTION_ORDER.reduce((sum, faction) => {
    if (!state.factionRoster?.[faction]?.leaderId) return sum + 1;
    return sum;
  }, 0);
}

type RosterState = Pick<GameState, 'factionRoster'>
  & Partial<Pick<GameState, 'customFactionLeaders' | 'customFactionGirls'>>;

/** 编成面板里的一个人：原属首领、原属随从、或者玩家自己带来的少女，统一成同一形状。 */
export interface RosterSubject {
  id: string;
  name: string;
  /** 她原本属于哪一方；自定义少女用她的出身标签。 */
  faction: GirlFaction;
  title: string;
  level: number;
  color: string;
  portrait: string;
  portraitSpec?: PortraitSpec;
  quote: string;
  origin: 'leader' | 'member' | 'custom';
  /** 自定义少女的原始数据，编成确认时要拿它做快照。 */
  stats?: Record<StatKey, number>;
  skillIds?: string[];
  codename?: string;
  /** 来自契约卡库的卡编号。 */
  cardId?: string;
  witch?: boolean;
  witchForm?: Outfit;
  /** v88：卡面图常在衣柜里，编成条目也要带得动。 */
  wardrobe?: Outfit[];
  outfitId?: string;
  expression?: Expression;
}

/** 原属首领 → 面板条目。 */
export function subjectOfLeader(leader: FactionLeader): RosterSubject {
  return {
    id: leader.id, name: leader.name, faction: leader.faction, title: leader.title,
    level: leader.level, color: leader.color, portrait: leader.portrait,
    portraitSpec: leader.portraitSpec, quote: leader.quote, origin: 'leader',
    wardrobe: leader.wardrobe, outfitId: leader.outfitId, expression: leader.expression,
    stats: leader.stats, skillIds: leader.skillIds,
  };
}

/** 原属随从 → 面板条目。 */
export function subjectOfGirl(girl: FactionGirl): RosterSubject {
  return {
    id: girl.id, name: girl.name, faction: girl.tag, title: girl.title,
    level: girl.level, color: girl.color, portrait: girl.portrait,
    portraitSpec: girl.portraitSpec, quote: girl.quote, origin: 'member',
    wardrobe: girl.wardrobe, outfitId: girl.outfitId, expression: girl.expression,
    stats: girl.stats, skillIds: girl.skills, codename: girl.codename,
  };
}

/** 玩家自定义的少女 → 面板条目；出身决定她默认算哪一方的人。 */
export function subjectOfCustom(input: {
  id: string; name: string; factionTag: GirlFaction; level: number; color: string;
  portrait: string; portraitSpec?: PortraitSpec; stats: Record<StatKey, number>;
  skillIds: string[]; codename?: string; quote?: string; title?: string; cardId?: string;
  witch?: boolean; witchForm?: Outfit; wardrobe?: Outfit[]; outfitId?: string; expression?: Expression;
}): RosterSubject {
  return {
    id: input.id, name: input.name, faction: input.factionTag, title: input.title ?? '外来者',
    level: input.level, color: input.color, portrait: input.portrait,
    portraitSpec: input.portraitSpec, quote: input.quote ?? '她只对自己的名字负责。',
    origin: 'custom', stats: input.stats, skillIds: input.skillIds, codename: input.codename, cardId: input.cardId,
    witch: input.witch, witchForm: input.witchForm,
    wardrobe: input.wardrobe, outfitId: input.outfitId, expression: input.expression,
  };
}

/** 把面板条目固化成某一方的随从。 */
/** 编进势力的等级口径：首领 10 级，随从 8–9 级。 */
export const FACTION_LEADER_LEVEL = 10;
export const FACTION_MEMBER_LEVELS = [8, 9] as const;
export function factionMemberLevel(level?: number): number {
  return typeof level === 'number' && level >= 9 ? 9 : 8;
}
export function factionLeaderLevel(_level?: number): number {
  return FACTION_LEADER_LEVEL;
}

export function customGirlOf(faction: FactionId, subject: RosterSubject): FactionGirl {
  return {
    id: subject.id, faction, name: subject.name, codename: subject.codename ?? subject.name,
    title: subject.title, portrait: subject.portrait, portraitSpec: subject.portraitSpec,
    color: subject.color, level: factionMemberLevel(subject.level),
    stats: subject.stats ?? { magic: 50, insight: 50, agility: 50, empathy: 50 },
    skills: subject.skillIds ?? [], tag: faction, quote: subject.quote, note: '由事务所编入名册的少女。',
    cardId: subject.cardId,
    // v85：编进月蚀庭的人默认按魔女形态出场（玩家自己的角色不受影响，只在这里落到名册条目上）。
    witch: subject.witch ?? (faction === 'witch' ? true : undefined),
    witchForm: subject.witchForm,
    wardrobe: subject.wardrobe, outfitId: subject.outfitId, expression: subject.expression,
  };
}

/** 把面板条目固化成某一方的首领。 */
export function customLeaderOf(faction: FactionId, subject: RosterSubject): FactionLeader {
  return {
    id: subject.id, faction, name: subject.name, title: subject.title,
    portrait: subject.portrait, portraitSpec: subject.portraitSpec, color: subject.color,
    quote: subject.quote, note: '由事务所编入名册的少女。',
    witch: subject.witch ?? (faction === 'witch' ? true : undefined), witchForm: subject.witchForm,
    wardrobe: subject.wardrobe, outfitId: subject.outfitId, expression: subject.expression,
    level: factionLeaderLevel(subject.level),
    stats: subject.stats ?? { magic: 50, insight: 50, agility: 50, empathy: 50 },
    skillIds: subject.skillIds ?? [],
    archetype: '输出',
    origin: faction,
    titles: { association: subject.title, government: subject.title, witch: subject.title },
    duty: { faction, note: '被事务所编进名册的少女，出勤时替这一方办事。' },
    cardId: subject.cardId,
  };
}

/** 某一方现存的首领；自定义首领优先，其次原属首领，最后退回静态映射。 */
export function rosterLeader(state: RosterState, faction: FactionId): FactionLeader {
  const id = state.factionRoster?.[faction]?.leaderId;
  if (!id) return factionLeaders[faction];
  const custom = state.customFactionLeaders?.find(leader => leader.id === id);
  return custom ?? leaderById(id) ?? factionLeaders[faction];
}

/** 某一方现存的随从（按编成结果）。自定义随从优先。 */
export function rosterMembers(state: RosterState, faction: FactionId): FactionGirl[] {
  const ids = state.factionRoster?.[faction]?.memberIds;
  if (!ids) return girlsOfFaction(faction);
  return ids.map(id => state.customFactionGirls?.find(girl => girl.id === id) ?? factionGirls.find(girl => girl.id === id))
    .filter((girl): girl is FactionGirl => Boolean(girl));
}

/** 会客厅与议会里的「三方代表」：就是玩家开局指派的首领；旧档解析不到时才退回静态代表。 */
export interface FactionRepresentative {
  id: string;
  name: string;
  title: string;
  color: string;
  faction: FactionId;
  level: number;
  portrait?: string;
  portraitSpec?: PortraitSpec;
  quote?: string;
  note?: string;
  /** 首领也是要出场的人：外貌与性格要跟着代表一起传下去，提示词才写得出他的样子。 */
  appearance?: string;
  personality?: string;
  /** v85：这位首领默认以魔女形态出场（目前只有月蚀庭）。 */
  witch?: boolean;
  witchForm?: Outfit;
  /** v88：卡面图在衣柜里时，界面靠这三个字段取图。 */
  wardrobe?: Outfit[];
  outfitId?: string;
  expression?: Expression;
  /** v85：这个席位还空着——界面要提示「契约卡不足，需要导入」。 */
  vacant?: boolean;
  kind: 'leader' | 'envoy';
}

export function factionRepresentativeOf(state: RosterState, faction: FactionId): FactionRepresentative {
  const leader = rosterLeader(state, faction);
  return {
    id: leader.id,
    name: leader.name,
    title: leaderTitle(leader, faction),
    color: leader.color,
    faction,
    level: leader.level,
    portrait: leader.portrait,
    portraitSpec: leader.portraitSpec,
    quote: leader.quote,
    note: leader.note,
    appearance: (leader as { appearance?: string }).appearance,
    personality: (leader as { personality?: string }).personality,
    // v85：月蚀庭的首领开局就是魔女形态；玩家自己的月蚀庭角色不沾这条。
    witch: leader.witch || undefined,
    witchForm: leader.witchForm,
    wardrobe: leader.wardrobe, outfitId: leader.outfitId, expression: leader.expression,
    vacant: leader.vacant,
    kind: 'leader',
  };
}

/** 三方名册里所有的自定义少女（含首领），用于校验与去重。 */
export function customRosterOf(state: Partial<Pick<GameState, 'customFactionLeaders' | 'customFactionGirls'>>): RosterSubject[] {
  const leaders = (state.customFactionLeaders ?? []).map(subjectOfLeader);
  const girls = (state.customFactionGirls ?? []).map(subjectOfGirl);
  return [...leaders, ...girls];
}

/** 首领的现属头衔。 */
export function leaderTitle(leader: FactionLeader, faction: FactionId): string {
  return leader.titles?.[faction] ?? leader.title;
}

/** 该势力是否已被打空辖区（首领可被雇佣的前提）。 */
export function factionCollapsed(state: Pick<GameState, 'territories'>, faction: FactionId): boolean {
  const owned = state.territories as Record<string, FactionId | undefined>;
  return Object.values(owned).filter(owner => owner === faction).length === 0;
}

/**
 * 2–3 行的势力提要，供 LLM prompt 使用，不塞整篇档案。
 *
 * `leader` 传当前在场的首领（玩家开局指派的那位）：不传才退回静态内置首领，
 * 否则提示词里的「城市态势」会一直写着开局前的老首领，和编成界面自相矛盾。
 */
export function factionBrief(faction: FactionId, standing: number, leader?: { id?: string; name: string; title: string; quote?: string }): string {
  const dossier = factionDossiers[faction];
  const info = factionInfo[faction];
  const base = factionLeaders[faction];
  const current = leader ?? base;
  // 静态首领自带一句台词；换成本局指派的卡面首领时，档案里那句就作废，不要张冠李戴。
  const quote = leader && leader.id !== base.id ? leader.quote ?? '' : base.quote;
  const attitude = factionAttitude(standing).label;
  const seat = base.vacant && (!leader || leader.id === base.id)
    ? '首领席位空缺（契约卡不足，需要导入）'
    : `首领 ${current.name}（${current.title}）`;
  return [
    `${info.name}（${dossier.epithet}）· ${seat} · 当前态度 ${attitude}`,
    quote,
    dossier.doctrine,
  ].filter(Boolean).join('\n');
}

/**
 * 界面与日志里要写「代表是谁」的地方，一律走这两个函数。
 *
 * 玩家开局指派的首领可能与内置首领不是同一个人；写死 `factionInfo[x].envoy`
 * 会在换人之后继续显示老名字（v48 修的就是这一类残留）。
 */
export function representativeNameOf(state: Pick<GameState, 'assistantId' | 'girls'> | undefined | null, faction: FactionId): string {
  const name = state ? factionRepresentativeOf(state as GameState, faction)?.name : undefined;
  return name?.trim() || factionInfo[faction].envoy;
}

export function representativeTitleOf(state: Pick<GameState, 'assistantId' | 'girls'> | undefined | null, faction: FactionId): string {
  const title = state ? factionRepresentativeOf(state as GameState, faction)?.title : undefined;
  return title?.trim() || factionInfo[faction].title;
}

export function factionRelationLine(from: FactionId, to: FactionId): string {
  if (from === to) return factionDossiers[from].relations[from];
  return factionDossiers[from].relations[to];
}

/** 出身的统一中文名；UI 不各自拼字符串。 */
export const girlFactionLabels: Record<GirlFaction, string> = {
  association: '星灯协会',
  government: '市役所',
  witch: '月蚀庭',
  none: '无所属',
};

export const girlFactionColors: Record<GirlFaction, string> = {
  association: '#F1A7C6',
  government: '#9CC9D2',
  witch: '#B98AD9',
  none: '#8d8a99',
};

export function factionTagLabel(tag: GirlFaction | undefined): string {
  return girlFactionLabels[tag ?? 'none'] ?? girlFactionLabels.none;
}

export function factionTagColor(tag: GirlFaction | undefined): string {
  return girlFactionColors[tag ?? 'none'] ?? girlFactionColors.none;
}

/** 雇主固定文案；出身与雇主是两件事，UI 不要混用。 */
export const EMPLOYER_LABEL = '夜糖事务所';

const GIRL_FACTION_ORDER: GirlFaction[] = ['association', 'government', 'witch', 'none'];

function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 确定性出身生成器：同一 id/名字永远得到同一出身。
 *
 * 权重 协会 30 / 市役所 30 / 月蚀庭 22 / 无所属 18。刷新、重开、迁移都不会改，
 * 所以「她的来历」不会被一次市场刷新悄悄换掉。
 */
export function factionTagFor(seed: string): GirlFaction {
  const roll = hashSeed(`faction:${seed}`) % 100;
  if (roll < 30) return 'association';
  if (roll < 60) return 'government';
  if (roll < 82) return 'witch';
  return 'none';
}

export function isGirlFaction(value: unknown): value is GirlFaction {
  return typeof value === 'string' && (GIRL_FACTION_ORDER as string[]).includes(value);
}

/** 读档/导卡的统一入口：合法值原样返回，其余（含历史 `office`）按种子重算。 */
export function sanitizeGirlFaction(value: unknown, seed: string): GirlFaction {
  return isGirlFaction(value) ? value : factionTagFor(seed);
}

/**
 * 辖区拦截判定：唯一入口。
 *
 * 委托详情里的红色预警和 `advance()` 的结算分支都调它，所以不会出现
 * 「UI 说要被拦、结算却放过」或者反过来的情况。
 */
export function canIntercept(
  state: { territories: Record<string, FactionId>; factions: Record<FactionId, { standing: number }> },
  mission: { district?: string; boss?: boolean; envoy?: boolean; storylineId?: string; interception?: unknown },
): boolean {
  if (!mission.district) return false;
  if (mission.boss || mission.envoy || mission.storylineId) return false;
  if (mission.interception) return false;
  // 战线开打的那条街，夜里不会再有闲人上门找麻烦。
  if ((state as { fronts?: { district: string; status: string }[] }).fronts?.some(front => front.district === mission.district && (front.status === 'open' || front.status === 'joined'))) return false;
  const owner = state.territories?.[mission.district];
  if (!owner) return false;
  const standing = state.factions?.[owner]?.standing ?? 0;
  if (factionAttitude(standing).label !== '戒备') return false;
  return rosterMembers(state as unknown as Pick<GameState, 'factionRoster'>, owner).length > 0;
}

/**
 * 名册里的人的立绘（v85）。
 *
 * 静态三方名册的 portrait 是空的（走程序化绘制），只有从卡库/编成进来的人才带图；
 * 魔女形态的人优先用她卡上那张魔女化立绘，没有再退回普通立绘。
 */
export function witchAwarePortrait(person: PortraitSubjectLike): string {
  // v87：统一走 portraitSource——势力人物没有衣柜，会自动落到 witchForm / portrait。
  return portraitString(person);
}
