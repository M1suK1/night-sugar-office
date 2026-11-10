import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { whisperPromptBody } from '../src/llm.ts';
import type { BattleState, Mission, WhisperJob } from '../src/types.ts';

/** v242：灯下私语里预设已经带过的东西不再在正文里重写一遍。 */

const runtimeOf = (contents: string[]) => ({
  entries: contents.map((content, index) => ({ id: `e${index}`, name: '测试', content, role: 'system', enabled: true })),
  contracts: [],
}) as never;

const setup = () => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const girl = state.girls[0]!;
  state.messages[girl.id] = [
    { role: 'player', text: '今晚辛苦了。', at: '第 14 日 · 01:10' },
    { role: 'girl', text: '还行。', at: '第 14 日 · 01:11' },
  ] as never;
  const mission = { id: 'm1', title: '糖果街的失眠电波', work: 'combat', difficulty: '中危', district: 'candy', reward: 1200, requirement: 'magic', target: 70 } as Mission;
  const battle = { round: 3, rounds: 5, outcome: 'victory' } as BattleState;
  const job: WhisperJob = { id: 'j1', girlId: girl.id, missionId: 'm1', day: state.day, outcome: 'victory', createdAt: 0 };
  return { state, girl, job, mission, battle, events: '- 第 2 回合：她使用「星屑穿刺」对 魔物，数值 40' };
};

const HEROINE_BLOCK = '【她是谁】\n{{heroine}}\n\n【她的过往】\n{{history.storylines}}\n{{history.missions:6}}\n{{history.chat:12}}';

test('v242 预设已经写了档案 / 出勤 / 聊天时，正文不再重复', () => {
  const { state, girl, job, mission, battle, events } = setup();
  const body = whisperPromptBody(state, girl, job, runtimeOf([HEROINE_BLOCK]), { mission, battle, events });
  assert.equal(body.includes('【她】'), false, '角色档案已经在预设里');
  assert.equal(body.includes('【最近参与】'), false, '出勤记录已经在 {{history.missions}} 里');
  assert.equal(body.includes('【最近对话】'), false, '聊天记录已经在 {{history.chat}} 里');
  assert.equal(body.includes('【战后】'), false, '当前状态在 {{heroine}} 的「此刻」里');
  assert.ok(body.includes('【这一次】'));
  assert.ok(body.includes('【战报】'));
  assert.ok(body.includes('【这一场之后】'));
});

test('v242 预设没有这些宏时，正文仍然把资料补全', () => {
  const { state, girl, job, mission, battle, events } = setup();
  const body = whisperPromptBody(state, girl, job, runtimeOf([]), { mission, battle, events });
  assert.ok(body.includes('【她】'));
  assert.ok(body.includes('【最近参与】'));
  assert.ok(body.includes('【最近对话】'));
  assert.ok(body.includes('【战后】'));
});

test('v242 预设带了 {{history.battles}} 时，不再另写战报', () => {
  const { state, girl, job, mission, battle, events } = setup();
  const body = whisperPromptBody(state, girl, job, runtimeOf(['{{history.battles:3}}']), { mission, battle, events });
  assert.equal(body.includes('【战报】'), false);
});
