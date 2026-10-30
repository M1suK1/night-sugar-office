/**
 * 开场三幕：只交代「三方是谁 / 你是谁 / 今夜做什么」。
 * 纯静态数据——开场必须每次一样，没配 API 也要能看，所以不进存档、不走 LLM。
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

export const PROLOGUE: PrologueBeat[] = [
  {
    id: 'ledger',
    title: '三本账',
    scene: 'table',
    narration: [
      '这座城市由三方分着管：星灯协会登记少女、发委托；市役所管夜禁、管辖区；月蚀庭不问出身，只问价钱。',
    ],
    lines: [
      { speaker: '白鹭千秋', color: '#8fd3c7', text: '「名录之外，没有灯。」', side: 'left' },
      { speaker: '雨宫澄', color: '#c9b36a', text: '「编号不会哭，城市才睡得着。」', side: 'left' },
      { speaker: '蚀医·夜鸮', color: '#9b6bc4', text: '「城市不把女巫当人，我们就自己写人的定义。」', side: 'right' },
    ],
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
