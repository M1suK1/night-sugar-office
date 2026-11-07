import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { loadState } from '../src/rules/persistence.ts';

test('v194 日志再长也完整保留，不再被判坏档', () => {
  const state = createInitialState();
  state.day = 42;
  state.startersPicked = true;
  state.logs = Array.from({ length: 301 }, (_, index) => ({ id: `log-${index}`, time: '第 42 日', kind: 'story' as const, text: `第 ${index} 条` }));
  const back = loadState(JSON.stringify(state));
  assert.equal(back.day, 42, '不该退回第 14 日');
  assert.equal(back.startersPicked, true, '不该显示成未编成');
  assert.equal(back.logs.length, 301, '一条都不裁');
  assert.equal(back.logs.at(-1)!.id, 'log-300');
});

test('v194 日结与对话同样全量保留', () => {
  const state = createInitialState();
  state.day = 7;
  state.samples = Array.from({ length: 61 }, (_, index) => ({ day: index + 1, income: 0, expense: 0, reputation: 50 }));
  const girlId = state.girls[0]!.id;
  state.messages = { [girlId]: Array.from({ length: 61 }, (_, index) => ({ role: 'player' as const, text: `第 ${index} 句` })) };
  const back = loadState(JSON.stringify(state));
  assert.equal(back.day, 7);
  assert.equal(back.samples.length, 61);
  assert.equal(back.messages[girlId]!.length, 61);
  assert.equal(back.messages[girlId]![0]!.text, '第 0 句');
});

test('v194 结构坏了仍然退回新开局（只放宽度量，不放宽类型）', () => {
  const state = createInitialState();
  state.day = 42;
  state.startersPicked = true;
  const broken = { ...state, logs: 'not-an-array' } as unknown;
  const back = loadState(JSON.stringify(broken));
  assert.equal(back.day, 14);
  assert.equal(back.startersPicked, false);
});
