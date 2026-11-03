import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { OPINION_HISTORY_DAYS, dailyHistoryBlock, opinionHistoryText, recentOpinions, repeatsRecentOpinion } from '../src/opinionHistory.ts';
import { resolveMacros } from '../src/promptMacros.ts';
import type { Opinion } from '../src/types.ts';

function seed(day: number, authorId: string, title: string, status: Opinion['status'] = 'accepted'): Opinion {
  const state = createInitialState();
  return {
    id: `op-${day}-${title}`, day, authorId, topic: '设施', title, text: '正文',
    request: '诉求', status, options: [],
  };
}

function historyState() {
  const state = createInitialState();
  const author = state.girls[0]!;
  const other = state.girls[1]!;
  state.opinions = [
    seed(state.day - 1, author.id, '星轨推演法阵架设'),
    seed(state.day - 2, other.id, '巡夜排班表'),
    seed(state.day - 3, author.id, '供灯线路检修'),
  ] as Opinion[];
  return { state, author, other };
}

test('v66 议题历史：带上日期、作者、主题、标题与结论', () => {
  const { state, author } = historyState();
  const text = opinionHistoryText(state);
  assert.match(text, /第 \d+ 日｜/);
  assert.match(text, new RegExp(author.name));
  assert.match(text, /设施/);
  assert.match(text, /星轨推演法阵架设/);
  assert.match(text, /通过/);
  assert.equal(text.split('\n').length, 3);
});

test('v66 历史只看最近几天，且条数受参数限制', () => {
  const { state } = historyState();
  state.opinions.push(seed(state.day - OPINION_HISTORY_DAYS - 5, state.girls[0]!.id, '很久以前的议题'));
  assert.equal(recentOpinions(state, 12).some(opinion => opinion.title === '很久以前的议题'), false, '太老的题目不再要求回避');
  assert.equal(recentOpinions(state, 2).length, 2);
  assert.equal(opinionHistoryText(state, 1).split('\n').length, 1);
});

test('v66 喂给模型的那一块：先声明别重复，再给清单与换法', () => {
  const { state } = historyState();
  const block = dailyHistoryBlock(state);
  assert.match(block, /【最近提过的议题 · 不要重复】/);
  assert.match(block, /换法：/);
  assert.match(block, /星轨推演法阵架设/);
  const empty = createInitialState();
  empty.opinions = [];
  assert.equal(dailyHistoryBlock(empty), '', '没有历史就不加这一块');
});

test('v66 撞题判定：同作者同名才算撞，换人不算', () => {
  const { state, author, other } = historyState();
  assert.equal(repeatsRecentOpinion(state, author.id, '星轨推演法阵架设'), true);
  assert.equal(repeatsRecentOpinion(state, other.id, '星轨推演法阵架设'), false, '换个人提同一个题目不算重复');
  assert.equal(repeatsRecentOpinion(state, author.id, '完全新的题目'), false);
  assert.equal(repeatsRecentOpinion(state, author.id, '  '), false);
});

test('v66 宏 {{opinions}} 能展开，编辑器里看得到', () => {
  const { state } = historyState();
  const expanded = resolveMacros('清单：\n{{opinions:2}}', { state });
  assert.equal(expanded.text.split('\n').length, 3, '两行记录 + 标题行');
  assert.ok(expanded.used.includes('opinions:2'));
  assert.doesNotMatch(expanded.text, /\{\{/);
});
