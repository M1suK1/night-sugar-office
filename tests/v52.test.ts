import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { customGirlOf, customLeaderOf, defaultFactionRoster, FACTION_LEADER_LEVEL, FACTION_MEMBER_LEVELS, factionLeaderLevel, factionMemberLevel, subjectOfGirl } from '../src/factions.ts';
import { factionGirls } from '../src/content/factionGirls.ts';
import { factionLeaders } from '../src/content/factionLeaders.ts';
import { sanitizeCustomGirl, sanitizeCustomLeader } from '../src/rules/candidate.ts';

test('v52 开局编成直接定助手：她同时是对外代表，好感抬到 60', () => {
  const state = createInitialState();
  const candidate = state.candidates[0]!;
  const roster = defaultFactionRoster();
  const drafted = [state.girls[0]!.id, candidate.id];
  const result = act(state, { type: 'setStarters', girlIds: drafted, roster, customLeaders: [], customGirls: [], assistantId: candidate.id });
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
  const roster = defaultFactionRoster();
  const drafted = [state.girls[0]!.id, state.candidates[0]!.id];
  const fallback = act(state, { type: 'setStarters', girlIds: drafted, roster, customLeaders: [], customGirls: [] });
  assert.equal(fallback.state.assistantId, drafted[0]);
  const ghost = act(state, { type: 'setStarters', girlIds: drafted, roster, customLeaders: [], customGirls: [], assistantId: 'ghost' });
  assert.equal(ghost.state.assistantId, drafted[0], '名单外的人当不了助手');
});

test('v52 势力等级：首领一律 10 级，随从落在 8–9 级', () => {
  assert.equal(FACTION_LEADER_LEVEL, 10);
  assert.deepEqual([...FACTION_MEMBER_LEVELS], [8, 9]);
  assert.equal(factionMemberLevel(3), 8);
  assert.equal(factionMemberLevel(9), 9);
  assert.equal(factionMemberLevel(15), 9);
  assert.equal(factionLeaderLevel(4), 10);
  for (const leader of Object.values(factionLeaders)) assert.equal(leader.level, 10);
  for (const girl of factionGirls) assert.ok(girl.level === 8 || girl.level === 9, `${girl.name} 是 ${girl.level} 级`);
  const base = subjectOfGirl(factionGirls[0]!);
  assert.equal(customGirlOf('association', { ...base, level: 4 }).level, 8);
  assert.equal(customGirlOf('association', { ...base, level: 12 }).level, 9);
  assert.equal(customLeaderOf('association', { ...base, level: 4 }).level, 10);
  assert.equal(sanitizeCustomGirl({ name: '外来随从', level: 3 }, 'association', 'x')?.level, 8);
  assert.equal(sanitizeCustomGirl({ name: '外来随从', level: 9 }, 'association', 'x')?.level, 9);
  assert.equal(sanitizeCustomLeader({ name: '外来首领', level: 3 }, 'association', 'y')?.level, 10);
});
