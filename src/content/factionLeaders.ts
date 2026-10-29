/**
 * 三方势力的首领。
 *
 * 只作档案顶部的固定卡：不进玩家契约池，也不参与日常拦截战。
 * 立绘走 `GirlPortrait` 的程序化绘制（`portrait` 留空），所以不需要新的图片资源。
 */
import type { FactionLeader } from '../types.ts';

export const factionLeaders: Record<'association' | 'government' | 'witch', FactionLeader> = {
  association: {
    id: 'leader-association',
    faction: 'association',
    name: '白鹭千秋',
    title: '协会会长 / 监察官',
    portrait: '',
    color: '#F1A7C6',
    quote: '名录之外，没有灯。',
    note: '主持《正统契约法》听证，拒绝为量产少女登记；私下把改革派调去了最远的辖区。',
  },
  government: {
    id: 'leader-government',
    faction: 'government',
    name: '雨宫澄',
    title: '夜间特别勤务课长',
    portrait: '',
    color: '#9CC9D2',
    quote: '编号不会哭，城市才睡得着。',
    note: '把量产损耗写进预算，也记得每一个编号的忌日——两件事她都不打算改。',
  },
  witch: {
    id: 'leader-witch',
    faction: 'witch',
    name: '蚀医·夜鸮',
    title: '净血派领袖',
    portrait: '',
    color: '#B98AD9',
    quote: '城市不把魔女当人，我们就自己写人的定义。',
    note: '政变后控制抑制剂配方与旧教堂地窖；对未受洗的普通魔法少女不再提供救治。',
  },
};
