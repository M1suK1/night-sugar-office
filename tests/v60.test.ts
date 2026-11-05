import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { BUDGET_MAX, DEFAULT_TASK_BUDGETS, taskRuntime } from '../src/llm.ts';
import type { ChatPreset } from '../src/presets.ts';

const presetWith = (maxTokens?: number): ChatPreset => ({
  id: 'p-test', name: '测试预设',
  settings: maxTokens === undefined ? {} : { openai_max_tokens: maxTokens },
} as unknown as ChatPreset);

function girlWithPoints(points: number) {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.unspentPoints = points;
  return { state, girl };
}

test('v60 预设的上限也生效：与输出预算取较大者', () => {
  // 统一额度 8000：预设比它高才听预设。
  assert.equal(taskRuntime(presetWith(12000), 'whisper').maxTokens, 12000, '预设更高时听预设');
  assert.equal(taskRuntime(presetWith(800), 'daily').maxTokens, 8000, '预设更低时听预算');
  assert.equal(taskRuntime(presetWith(6000), 'battle').maxTokens, DEFAULT_TASK_BUDGETS.battle, '长文任务听自己的 24000');
  assert.equal(taskRuntime(presetWith(99000), 'battle').maxTokens, BUDGET_MAX, '再高也要夹在 BUDGET_MAX');
});

test('v60 没绑预设时不借用内置预设的额度', () => {
  assert.equal(taskRuntime(undefined, 'whisper').maxTokens, 8000);
  assert.equal(taskRuntime(undefined, 'news').maxTokens, 8000);
  assert.equal(taskRuntime(undefined, 'battle').maxTokens, DEFAULT_TASK_BUDGETS.battle);
});

test('v60 滑条一次提交四项：属性与剩余点数都正确', () => {
  const { state, girl } = girlWithPoints(5);
  const before = { ...girl.stats };
  const result = act(state, { type: 'allocateStats', girlId: girl.id, plan: { magic: 3, empathy: 2 } });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(entry => entry.id === girl.id)!;
  assert.equal(after.stats.magic, before.magic + 3);
  assert.equal(after.stats.empathy, before.empathy + 2);
  assert.equal(after.stats.insight, before.insight);
  assert.equal(after.unspentPoints, 0);
});

test('v60 点数不够时整批作废，不会半截生效', () => {
  const { state, girl } = girlWithPoints(2);
  const before = { ...girl.stats };
  const result = act(state, { type: 'allocateStats', girlId: girl.id, plan: { magic: 2, agility: 3 } });
  assert.equal(result.ok, false);
  const unchanged = result.state.girls.find(entry => entry.id === girl.id)!;
  assert.deepEqual(unchanged.stats, before, '失败时一点都不能加');
  assert.equal(unchanged.unspentPoints, 2);
});

test('v60 单项封顶 120，空计划直接拒绝', () => {
  const { state, girl } = girlWithPoints(10);
  girl.stats.magic = 119;
  const result = act(state, { type: 'allocateStats', girlId: girl.id, plan: { magic: 10 } });
  assert.equal(result.ok, false, '超过 120 应当失败');
  assert.equal(act(state, { type: 'allocateStats', girlId: girl.id, plan: {} }).ok, false);
  assert.equal(act(state, { type: 'allocateStats', girlId: 'nope', plan: { magic: 1 } }).ok, false);
});
