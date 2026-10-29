/**
 * 三方势力的档案与行为参数。
 *
 * 数据只在这里定义一次：净化参数走 `FACTION_PURIFICATION`，长文本走 `factionDossiers`，
 * 首领与所属少女分别来自 `content/factionLeaders.ts` 与 `content/factionGirls.ts`。
 * 档案 UI 与结算都经由访问器读取，不各自复制一份数值。
 */
import type { FactionGirl, FactionId, FactionLeader, GirlFaction } from './types.ts';
import { factionInfo } from './content/items.ts';
import { factionLeaders } from './content/factionLeaders.ts';
import { girlsOfFaction } from './content/factionGirls.ts';
import { factionAttitude } from './economy.ts';

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
    origin: '樱雾市最老的契约者互助会，战后由几支旧家族出资重建，把「登记在册」写进了协会章程第一行。',
    membership: '旧家族子弟、被推荐入会的新人、以及少数赎买名额的人。名录外的魔法少女不在他们的救助范围内。',
    doctrine: '灯要有人守着才算灯。契约必须可追溯，力量必须有人负责。',
    method: '净化班按街区排班，护送队跟着回收车走；能用人手填的污染，就不上机器。',
    publicFace: '对外是慈善与秩序：孤儿收容、夜间巡守、公开听证。',
    tension: '年轻监察员开始质疑名录；会长把质疑者调去了最远的辖区，而不是回答他们。',
    technologyStance: '明确反对克隆量产与抑制剂：前者让「谁是自己」变成账目问题，后者让魔女化变成可以拖延的账单。',
    witchStance: '魔女化是不可逆的坠落，应该被记录、隔离、在最后一刻之前送走。不接受「带病共存」。',
    girlStance: '把普通魔法少女当作需要监护的未成年人：保护，也管束。名录之外的人，他们不会主动去找。',
    leaderId: 'leader-association',
    girlIds: ['fg-association-tou', 'fg-association-sayo', 'fg-association-rin'],
    relations: {
      association: '内部：改革派与旧家族在名录问题上已经不再同桌。',
      government: '互相看不起，却常常合作：协会出人，市役所出车。协会厌恶他们的编号制度，也依赖他们的回收效率。',
      witch: '公开定性为敌对组织。护送队被伏击过三次之后，协会内部已经没人主张谈判。',
    },
    color: '#F1A7C6',
    seal: '灯',
  },
  government: {
    epithet: '夜勤编号',
    origin: '市政体系在魔物潮之后成立的夜间特别勤务课，最初只是消防与救护的延伸，后来接管了整座城市的夜间治安。',
    membership: '在编专员、外包清扫队，以及量产序列 A-01 之后的全部克隆体。',
    doctrine: '城市不需要英雄，需要可替换的班次。',
    method: '压测、轮值、回收。把魔物控制在统计可接受的损耗以内，然后写进下一年的预算。',
    publicFace: '效率与透明：伤亡公开、配额公开、连回收车的路线都公开。',
    tension: '课长记得每个编号的忌日，却仍然签字扩产。一线专员把这叫做「用记忆抵账」。',
    technologyStance: '量产克隆是唯一能把损耗压进预算的办法；抑制剂被列为管制物资，因为「能拖的就不算死」。',
    witchStance: '魔女化是设备故障与工伤的混合体，走回收流程，不走葬礼流程。',
    girlStance: '量产少女是编号与配额；在编专员是同事。两套语言在同一间办公室里并存。',
    leaderId: 'leader-government',
    girlIds: ['fg-government-mio', 'fg-government-shiori', 'fg-government-aoi'],
    relations: {
      association: '需要他们的净化班，也嫌他们的听证会拖慢排班。合作时称「兄弟单位」，背后叫「那帮守灯的」。',
      government: '内部：伤亡统计口径与扩产配额是每周例会的老话题。',
      witch: '把月蚀庭当走私渠道处理：抑制剂要买，人不能认。',
    },
    color: '#9CC9D2',
    seal: '印',
  },
  witch: {
    epithet: '受洗者',
    origin: '原本是收治魔女化末期患者的救济组织，在旧教堂地窖里熬了十几年抑制剂，直到净血派在一次内部表决里拿走了钥匙。',
    membership: '受洗者、庭医、猎手。拒绝受洗的人一律算外人，哪怕她昨天还是病人。',
    doctrine: '城市既然把人分成人与魔物，那就由我们来写分界线。',
    method: '配方控制、强制受洗、伏击护卫队。净血派相信「先清干净，再谈救治」。',
    publicFace: '仍然对外出售抑制剂，仍然接诊重症，只是诊室门口多了一张未受洗者名单。',
    tension: '救治派还在配药，猎手已经在街上找人。两拨人共用一间药房。',
    technologyStance: '抑制剂是他们发明的，也是他们垄断的。对克隆保持沉默——克隆体没有魔女化记录，不算研究对象。',
    witchStance: '魔女化是进阶，不是坠落；但只有受洗者配得上这个说法。',
    girlStance: '普通魔法少女是需要被清洗的隐患：猎杀、勒索，或者强制受洗。曾经的求助者不再被当成求助者。',
    coup: '三年前的净血派政变：原议长在药房里被换掉，配方与地窖钥匙一并易手。政变当夜没有流血，之后每个月都在流血。',
    leaderId: 'leader-witch',
    girlIds: ['fg-witch-mian', 'fg-witch-soga', 'fg-witch-shika'],
    relations: {
      association: '彼此都认为对方才是这座城市真正的病。协会的护送队是猎手的首选目标。',
      government: '唯一还愿意做生意的对象：抑制剂卖给他们，人一个都不认。',
      witch: '内部：救治派在配药，净血派在清人。药房是唯一还共享的地方。',
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

/** 2–3 行的势力提要，供 LLM prompt 使用，不塞整篇档案。 */
export function factionBrief(faction: FactionId, standing: number): string {
  const dossier = factionDossiers[faction];
  const info = factionInfo[faction];
  const leader = factionLeaders[faction];
  const attitude = factionAttitude(standing).label;
  return [
    `${info.name}（${dossier.epithet}）· 首领 ${leader.name}（${leader.title}）· 当前态度 ${attitude}`,
    leader.quote,
    dossier.doctrine,
  ].join('\n');
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
  const owner = state.territories?.[mission.district];
  if (!owner) return false;
  const standing = state.factions?.[owner]?.standing ?? 0;
  if (factionAttitude(standing).label !== '戒备') return false;
  return factionGirlsOf(owner).length > 0;
}
