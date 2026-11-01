import type { GameState } from './types.ts';
import { FACTION_ORDER } from './territories.ts';
import { rosterLeader } from './factions.ts';
import { representativeOf } from './office.ts';
import { SHIFT_START } from './shift.ts';

/**
 * 开场三幕：只交代「三方是谁 / 你的名册上有谁 / 今夜做什么」。
 * 数据全部本地推导（名册人数、三方首领、值班日），不存档、不走 LLM——
 * 没配 API 也要能看，所以 `PROLOGUE` 保底是常量版本。
 */

export interface PrologueLine {
  speaker: string;
  /** 说话人的势力色，用来给台词行上色；主角用中性色。 */
  color?: string;
  text: string;
  /** 台词从哪一侧滑入，纯视觉分组。 */
  side?: 'left' | 'right';
}

export interface PrologueBeat {
  id: string;
  title: string;
  /** 场景提示词，只用于视觉分组。 */
  scene: 'table' | 'lamp' | 'night';
  narration: string[];
  lines: PrologueLine[];
}

const LEADERS: PrologueLine[] = [
  { speaker: '白鹭千秋', color: '#8fd3c7', text: '「名录之外，没有灯。」', side: 'left' },
  { speaker: '雨宫澄', color: '#c9b36a', text: '「编号不会哭，城市才睡得着。」', side: 'left' },
  { speaker: '蚀医·夜鸮', color: '#9b6bc4', text: '「城市不把女巫当人，我们就自己写人的定义。」', side: 'right' },
];

/** 没有存档时的兜底：和 v26 之前完全一致，重播与静态渲染都能用。 */
export const PROLOGUE: PrologueBeat[] = [
  {
    id: 'ledger',
    title: '三本账',
    scene: 'table',
    narration: [
      '这座城市由三方分着管：星灯协会登记少女、发委托；市役所管夜禁、管辖区；月蚀庭不问出身，只问价钱。',
    ],
    lines: LEADERS,
  },
  {
    id: 'lamp',
    title: '这盏灯',
    scene: 'lamp',
    narration: [
      '夜糖事务所关门七年，灯还亮着。房租付到了年底，欠着的是人情——现在这家店归你，名册上一个人也没有。',
    ],
    lines: [],
  },
  {
    id: 'tonight',
    title: '今夜',
    scene: 'night',
    narration: [
      '接委托、派人出勤、把辖区守到天亮。九块地各有各的脏，天上那轮月亮缺着一角，它每晚都在等着什么。',
    ],
    lines: [],
  },
];

export interface PrologueOptions {
  /** 事务所名册上的人数（`state.girls` 里非退役、未离世）。 */
  rosterSize: number;
  /** 其中有几位是从契约卡库带回来的。 */
  cardSize: number;
  /** 三方现任首领的名字，换了自定义首领就跟着变。 */
  leaderNames: Record<string, string>;
  /** 值班助理（对外代表）；没有就是 undefined。 */
  representative?: string;
  day: number;
  /** 叙事者是否接上了（决定第三幕那句旁白）。 */
  narrator: boolean;
}

const shiftLabel = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** 按当前存档生成三幕：第二幕讲你自己的名册，第三幕讲这一夜要做什么。 */
export function prologueFrom(options: PrologueOptions): PrologueBeat[] {
  const { rosterSize, cardSize, leaderNames, representative, day, narrator } = options;
  const leaderLine = FACTION_ORDER.map(faction => leaderNames[faction]).filter(Boolean).join(' / ');
  const roster: string[] = [];
  if (rosterSize > 0) {
    roster.push(`${rosterSize} 位少女签了字${cardSize > 0 ? `，其中 ${cardSize} 位是你从卡库里带回来的` : ''}。`);
  } else {
    roster.push('名册还是空的。');
  }
  if (leaderLine) roster.push(`三方各自坐定了人——${leaderLine}。`);
  return [
    {
      id: 'ledger',
      title: '三本账',
      scene: 'table',
      narration: [
        '这座城市由三方分着管：星灯协会登记少女、发委托；市役所管夜禁、管辖区；月蚀庭不问出身，只问价钱。',
        '三方都在这张桌上留了位置，谁也没打算先走。',
      ],
      lines: LEADERS,
    },
    {
      id: 'roster',
      title: '名册',
      scene: 'lamp',
      narration: [
        '事务所的灯关了七年，今晚又亮起来。灯下摊开的名册上，名字是你自己写的。',
        ...roster,
      ],
      lines: representative
        ? [{ speaker: representative, text: '「名册定了，就别再改主意。」', side: 'left' }]
        : [{ speaker: '你', text: '「名册还空着一行，等你写。」', side: 'left' }],
    },
    {
      id: 'tonight',
      title: '今夜',
      scene: 'night',
      narration: [
        `第 ${day} 日的值班从 ${shiftLabel(SHIFT_START)} 开始。七条委托已经压在桌角，议会的议题今晚会有人提上来。`,
        narrator
          ? '街上会冒出什么事，谁也说不准——叙事者会替你补上这一夜的空缺。'
          : '街上会冒出什么事，谁也说不准——今夜先按本地写好的内容开着。',
      ],
      lines: [{ speaker: '你', text: '「灯留着。人派出去了，就等他们回来。」', side: 'left' }],
    },
  ];
}

/** 按存档生成三幕；`state` 为空（或老档缺字段）时回落到静态版本。 */
export function prologueFor(state: GameState | null | undefined): PrologueBeat[] {
  if (!state || !Array.isArray(state.girls)) return PROLOGUE;
  const living = state.girls.filter(girl => !girl.dead && !girl.retired);
  const leaderNames = FACTION_ORDER.reduce<Record<string, string>>((map, faction) => {
    map[faction] = rosterLeader(state, faction).name;
    return map;
  }, {});
  return prologueFrom({
    rosterSize: living.length,
    cardSize: living.filter(girl => Boolean(girl.cardId) || girl.custom).length,
    leaderNames,
    representative: representativeOf(state)?.name,
    day: state.day,
    narrator: true,
  });
}
