import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { FACTION_LEADER_LEVEL, FACTION_MEMBER_LEVELS, factionLeaderLevel, factionMemberLevel } from '../src/factions.ts';
import { factionGirls } from '../src/content/factionGirls.ts';
import { factionLeaders } from '../src/content/factionLeaders.ts';
import { sanitizeCustomGirl, sanitizeCustomLeader } from '../src/rules/candidate.ts';
import { makeGirl, makeLeader, seedRoster } from './fixtureRoster.ts';

test('v52 开局编成直接定助手：她同时是对外代表，好感抬到 60', () => {
  const state = createInitialState();
  const candidate = state.candidates[0]!;
  const seed = seedRoster();
  const drafted = [state.girls[0]!.id, candidate.id];
  const result = act(state, {
    type: 'setStarters', girlIds: drafted,
    roster: seed.roster, customLeaders: seed.leaders, customGirls: seed.girls,
    assistantId: candidate.id,
  });
  assert.equal(result.ok, true, result.ok ? '' : result.message);
  assert.equal(result.state.assistantId, candidate.id, '指定的助手要落到 assistantId');
  const assistant = result.state.girls.find(girl => girl.id === candidate.id);
  assert.ok(assistant);
  assert.equal(assistant?.bond, 60, '好感抬到 60');
  assert.equal(result.state.girls.find(girl => girl.id === state.girls[0]!.id)?.bond, state.girls[0]!.bond, '其他人好感不变');
  assert.ok(result.state.logs[0]?.text.includes('助手'));
});

test('v52 没指定或指定了名单外的人：助手位回落名册第一位，永不空着', () => {
  const state = createInitialState();
  const seed = seedRoster();
  const args = { roster: seed.roster, customLeaders: seed.leaders, customGirls: seed.girls };
  const drafted = [state.girls[0]!.id, state.candidates[0]!.id];
  const fallback = act(state, { type: 'setStarters', girlIds: drafted, ...args });
  assert.equal(fallback.state.assistantId, drafted[0]);
  const ghost = act(state, { type: 'setStarters', girlIds: drafted, ...args, assistantId: 'ghost' });
  assert.equal(ghost.state.assistantId, drafted[0], '名单外的人当不了助手');
});

test('v52 势力等级：首领一律 10 级，随从落在 8–9 级', () => {
  assert.equal(FACTION_LEADER_LEVEL, 10);
  assert.deepEqual([...FACTION_MEMBER_LEVELS], [8, 9]);
  assert.equal(factionMemberLevel(3), 8);
  assert.equal(factionMemberLevel(9), 9);
  assert.equal(factionMemberLevel(15), 9);
  assert.equal(factionLeaderLevel(4), 10);

  // v85：静态表只剩三个空席占位（等级 1 只是占位值），随从表恒为空。
  for (const leader of Object.values(factionLeaders)) assert.equal(leader.vacant, true);
  assert.deepEqual(factionGirls, []);

  // 真人口径走 `customLeaderOf` / `customGirlOf`：编成与卡库排人用的就是这条路径。
  for (const level of [1, 4, 9, 12]) {
    const leader = makeLeader('association', `首领${level}`, { level });
    const girl = makeGirl('association', `随从${level}`, { level });
    assert.equal(leader.level, 10, `首领输入 ${level} 级也该是 10 级`);
    assert.equal(girl.level, level >= 9 ? 9 : 8, `随从输入 ${level} 级落在 8–9`);
    assert.ok(FACTION_MEMBER_LEVELS.includes(girl.level as 8 | 9));
  }

  // 读档/导卡的清洗入口不放行别的等级。
  assert.equal(sanitizeCustomGirl({ name: '外来随从', level: 3 }, 'association', 'x')?.level, 8);
  assert.equal(sanitizeCustomGirl({ name: '外来随从', level: 9 }, 'association', 'x')?.level, 9);
  assert.equal(sanitizeCustomLeader({ name: '外来首领', level: 3 }, 'association', 'y')?.level, 10);
});
