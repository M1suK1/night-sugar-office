/**
 * 三方势力的所属少女。
 *
 * 静态名册：出现在势力档案的「成员」页，也会在辖区戒备时出来拦截玩家。
 * 她们永远不进玩家契约池，拦截战的胜负也不会改写这里的数据。
 */
import type { FactionGirl } from '../types.ts';

export const factionGirls: FactionGirl[] = [
  {
    id: 'fg-association-tou', faction: 'association', name: '篠宫灯里', codename: '灯守', title: '净化班·一级契约者',
    portrait: '', color: '#F1A7C6', level: 4, stats: { magic: 58, insight: 61, agility: 54, empathy: 57 },
    skills: ['glimmer-spear', 'peach-ward', 'starlight-fall'], tag: 'association',
    quote: '名单上有名字的人，我背也要背回来。', note: '旧家族出身，相信自己能守住传统，也开始怀疑名录本身。',
  },
  {
    id: 'fg-association-sayo', faction: 'association', name: '藤枝小夜', codename: '夜铃', title: '新人监察员',
    portrait: '', color: '#F1A7C6', level: 2, stats: { magic: 46, insight: 55, agility: 52, empathy: 48 },
    skills: ['frequency-prick', 'silent-band', 'moon-phase'], tag: 'association',
    quote: '推荐信是我爷爷写的，所以我得更严格一点。', note: '被推荐入会，替老家主值最危险的班。',
  },
  {
    id: 'fg-association-rin', faction: 'association', name: '朝仓凛', codename: '断灯', title: '护送队队长',
    portrait: '', color: '#F1A7C6', level: 5, stats: { magic: 64, insight: 52, agility: 66, empathy: 44 },
    skills: ['glimmer-spear', 'starlight-fall', 'peach-ward'], tag: 'association',
    quote: '查缉和收尸是同一条流程的后半段。', note: '负责查缉黑市抑制剂，也负责把死人带回来。',
  },
  {
    id: 'fg-government-mio', faction: 'government', name: 'A-07「澪」', codename: '澪', title: '量产勤务单元',
    portrait: '', color: '#9CC9D2', level: 3, stats: { magic: 55, insight: 44, agility: 58, empathy: 41 },
    skills: ['sugar-needle', 'goodnight-candy', 'white-night-frost'], tag: 'government',
    quote: '报告书第九栏，我写的是名字。', note: '第一次被允许使用名字，仍会在报告里写编号。',
  },
  {
    id: 'fg-government-shiori', faction: 'government', name: 'A-12「栞」', codename: '栞', title: '回收班',
    portrait: '', color: '#9CC9D2', level: 4, stats: { magic: 60, insight: 50, agility: 56, empathy: 38 },
    skills: ['sugar-needle', 'white-night-frost', 'goodnight-candy'], tag: 'government',
    quote: '别让我写第二次死亡证明。', note: '负责把失控单元带回，语气比刀还平。',
  },
  {
    id: 'fg-government-aoi', faction: 'government', name: '东云葵', codename: '葵', title: '一线专员',
    portrait: '', color: '#9CC9D2', level: 5, stats: { magic: 57, insight: 62, agility: 53, empathy: 60 },
    skills: ['flower-thorn', 'flower-prescription', 'spring-growth'], tag: 'government',
    quote: '制度能救人，只是它算得太慢。', note: '仍相信制度能救人，和课长在伤亡统计上争吵。',
  },
  {
    id: 'fg-witch-mian', faction: 'witch', name: '黑川眠', codename: '夜祷', title: '对外代表 / 夜祷使',
    portrait: '', color: '#B98AD9', level: 4, stats: { magic: 63, insight: 58, agility: 49, empathy: 45 },
    skills: ['dream-touch', 'deep-dream-fall', 'sheep-nebula'], tag: 'witch',
    quote: '交易可以谈，措辞不行。', note: '表面仍谈交易，实际每句话都要被净血派审核。',
  },
  {
    id: 'fg-witch-soga', faction: 'witch', name: '苏我夜', codename: '庭医', title: '庭医',
    portrait: '', color: '#B98AD9', level: 3, stats: { magic: 50, insight: 63, agility: 46, empathy: 66 },
    skills: ['flower-thorn', 'spring-growth', 'flower-prescription'], tag: 'witch',
    quote: '配方是我的，给谁由我决定。', note: '救治派，暗中给普通魔法少女配药。',
  },
  {
    id: 'fg-witch-shika', faction: 'witch', name: '鹿岛棘', codename: '棘', title: '净血猎手',
    portrait: '', color: '#B98AD9', level: 6, stats: { magic: 68, insight: 54, agility: 70, empathy: 30 },
    skills: ['frequency-prick', 'moon-phase', 'silent-band'], tag: 'witch',
    quote: '没受洗的，本来就不该走这条路。', note: '专门伏击协会护送队与市役所回收车。',
  },
];

export function girlsOfFaction(faction: 'association' | 'government' | 'witch'): FactionGirl[] {
  return factionGirls.filter(girl => girl.faction === faction);
}
