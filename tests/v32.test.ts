import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, missionKey, opinionLimit, trimOpinions } from '../src/game.ts';
import { buildNightPrompt, NIGHT_SCHEMA_EXAMPLE } from '../src/llm-night.ts';
import type { Opinion } from '../src/types.ts';

const pending = (index: number): Opinion => ({
  id: `op-v32-${index}`, day: 14, authorId: 'yue', topic: '经费',
  title: `测试议题 ${index}`, text: '测试', request: '测试', status: 'pending', options: [],
});

test('v32 新档：5 名在册、无默认退役、140 条委托与 50 只魔物', () => {
  const state = createInitialState();
  assert.equal(state.girls.length, 5);
  assert.equal(state.girls.some(girl => girl.id === 'zhi' && girl.retired), false);
  assert.equal(state.missions.filter(mission => mission.work === 'combat').length, 120);
  assert.equal(state.missions.filter(mission => mission.work === 'investigation').length, 20);
  assert.equal(state.customMonsters.length, 50);
  assert.equal(state.opinions.length, 0, '不再预置默认议题');
  assert.equal(new Set(state.missions.map(missionKey)).size, state.missions.length, '地图委托内容不重复');
});

test('v32 议题上限随会客厅等级提升，超出部分转为暂缓', () => {
  const state = createInitialState();
  assert.equal(opinionLimit(state), 3);
  state.rooms = state.rooms.map(room => room.type === 'lounge' ? { ...room, level: 3 } : room);
  assert.equal(opinionLimit(state), 4);
  state.opinions = [1, 2, 3, 4, 5].map(pending);
  assert.equal(trimOpinions(state), 1);
  assert.equal(state.opinions.filter(opinion => opinion.status === 'pending').length, 4);
  assert.equal(state.opinions.filter(opinion => opinion.status === 'shelved').length, 1);
});

test('v32 提案提示词要求补足议题，不再要求生成魔物', () => {
  const state = createInitialState();
  const prompt = buildNightPrompt(state);
  assert.ok(prompt.includes('本次需要 3 条议题'));
  assert.ok(prompt.includes('不再生成新魔物'));
  assert.ok(!JSON.stringify(NIGHT_SCHEMA_EXAMPLE).includes('\"monster\"'));
  state.opinions = [1, 2].map(pending);
  assert.ok(buildNightPrompt(state).includes('本次需要 1 条议题'));
});

test('v32 每日提案只补委托与议题，不再新增魔物', () => {
  const state = createInitialState();
  const before = state.customMonsters.length;
  assert.equal(before, 50);
  assert.ok(buildNightPrompt(state).includes('opinions'));
});
