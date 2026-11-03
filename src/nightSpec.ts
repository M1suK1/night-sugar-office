import type { Archetype, Element, Expression, FactionId, GoalKind, MissionTemplate, MonsterTemplate, Opinion, StatKey, WorkKind } from './types.ts';
import type { CommissionWindow } from './shift.ts';

/** 每日提案与蓝图共用的枚举、JSON 骨架：提示词宏与校验器都读这一份，避免两处漂移。 */
export const NIGHT_VERSION = 2;

export const NIGHT_STATS: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];
export const NIGHT_ELEMENTS: Element[] = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系'];
export const NIGHT_ARCHETYPES: Archetype[] = ['输出', '守护', '治愈', '控制', '侦查'];
export const NIGHT_RANKS: MonsterTemplate['rank'][] = ['碎屑', '游荡', '灾厄', '王座'];
export const NIGHT_TOPICS: Opinion['topic'][] = ['经费', '排班', '设施', '同伴', '城市', '私人心愿'];
export const NIGHT_DIFFICULTIES: MissionTemplate['difficulty'][] = ['低危', '中危', '高危', '绝望'];
export const NIGHT_FACTIONS: FactionId[] = ['witch', 'association', 'government'];
export const NIGHT_GOALS: GoalKind[] = ['战斗', '调查', '社交', '生活', '成长'];
export const NIGHT_EXPRESSIONS: Expression[] = ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'];
export const NIGHT_WINDOWS: CommissionWindow[] = ['urgent', 'long'];
export const NIGHT_WORKS: WorkKind[] = ['combat', 'investigation'];

export const NIGHT_SCHEMA_EXAMPLE = {
  version: 2,
  mission: {
    title: '', description: '', work: 'combat', difficulty: '中危',
  },
  opinions: [{
    authorId: '', authorKind: 'girl', authorFaction: null, topic: '经费', faction: 'witch', district: null, title: '', text: '', request: '',
    dialogue: [{ speakerId: '', speaker: '', text: '', expression: 'sad' }],
    options: [
      { id: 'accept', label: '批准', effect: '', changes: [{ kind: 'gold', amount: -600 }], outcomes: [] },
      { id: 'reject', label: '驳回', effect: '', changes: [{ kind: 'girl', girlId: '', field: 'bond', amount: -2 }, { kind: 'faction', faction: 'witch', amount: -4 }, { kind: 'gold', amount: -300 }], outcomes: [] },
    ],
  }],
  envoy: {
    faction: 'association', title: '', description: '', work: 'investigation', difficulty: '中危', district: 'station', rewardGirlLevel: 0,
  },
  loot: [{ tier: 3, slot: 'charm', faction: 'witch' }],
};
