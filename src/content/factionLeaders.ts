/**
 * 三方势力的首领。
 *
 * v85：静态首领已废弃。三方名册的首领必须来自契约卡库（`cardLibrary` → 编成 →
 * `customFactionLeaders`）；没有编成时这里给出的是「空缺」占位，界面据此提示
 * 「契约卡不足，需要导入」，而不是退回某个内置人物。
 */
import type { FactionId, FactionLeader } from '../types.ts';
import { factionInfo } from './items.ts';

/** 占位首领的 id 前缀：任何以它开头的 id 都表示这个位置还空着。 */
export const VACANT_LEADER_PREFIX = 'vacant-';

const vacantLeader = (faction: FactionId): FactionLeader => ({
  id: `${VACANT_LEADER_PREFIX}${faction}`,
  faction,
  name: '席位空缺',
  title: '尚未派人',
  portrait: '',
  color: factionInfo[faction].color,
  quote: '这里还没有人签字。',
  note: '这一类位置要靠契约卡补齐：开局编成时从卡库选人，或者先去卡库导入。',
  level: 1,
  stats: { magic: 0, insight: 0, agility: 0, empathy: 0 },
  skillIds: [],
  archetype: '输出',
  origin: faction,
  titles: { association: '', government: '', witch: '' },
  duty: { faction, note: '席位空缺。' },
  vacant: true,
});

export const factionLeaders: Record<'association' | 'government' | 'witch', FactionLeader> = {
  association: vacantLeader('association'),
  government: vacantLeader('government'),
  witch: vacantLeader('witch'),
};
