import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { repairRejectOptions } from '../src/proposalCheck.ts';
import { validateNightProposal } from '../src/llm-night.ts';

const rejectWithExtras = () => [
  { id: 'accept', label: '批准', effect: '', changes: [{ kind: 'gold', amount: -100 }], outcomes: [] },
  { id: 'reject', label: '驳回', effect: '', changes: [
    { kind: 'faction', faction: 'witch', amount: -4 },
    { kind: 'gold', amount: -300 },
    { kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 },
  ], outcomes: [] },
];

const opinion = () => ({
  authorId: 'yue', topic: '经费', faction: 'witch', title: '窗边的空位',
  text: '有人希望把靠窗的位置留给新来的孩子。', request: '把窗边留给纸灯。', dialogue: [],
  options: rejectWithExtras(),
});

test('v192 单数 opinion 写法也要被宽松模式修好', () => {
  const raw = { opinion: opinion() };
  const repaired = repairRejectOptions(raw) as { opinion: { options: { id: string; changes: unknown[] }[] } };
  assert.deepEqual(repaired.opinion.options[1]!.changes, [{ kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 }]);
});

test('v192 单数 opinion 没有羁绊时补一条 −2', () => {
  const raw = { opinion: { authorId: 'yue', options: [{ id: 'reject', changes: [{ kind: 'gold', amount: -300 }] }] } };
  const repaired = repairRejectOptions(raw) as { opinion: { options: { changes: { amount: number }[] }[] } };
  assert.deepEqual(repaired.opinion.options[0]!.changes, [{ kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 }]);
});

test('v192 数组写法不受影响，两种写法同时出现都修', () => {
  const raw = { opinions: [opinion()], opinion: opinion() };
  const repaired = repairRejectOptions(raw) as { opinions: { options: { changes: unknown[] }[] }[]; opinion: { options: { changes: unknown[] }[] } };
  assert.equal(repaired.opinions[0]!.options[1]!.changes.length, 1);
  assert.equal(repaired.opinion.options[1]!.changes.length, 1);
});

test('v192 宽松模式（默认）不再因驳回写多而整份作废', () => {
  const state = createInitialState();
  const raw = { version: 2, opinion: opinion() };
  const checked = validateNightProposal(raw, state);
  assert.equal(checked.errors.some(text => text.includes('驳回只能')), false, checked.errors.join(' / '));
  assert.equal(checked.errors.some(text => text.includes('羁绊降幅')), false);
});

test('v192 严格模式才拦：同一份提案在 strict 下会报驳回的问题', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>([['night-sugar:proposal-check', 'strict']]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, String(value)); },
      removeItem: (key: string) => { data.delete(key); },
      clear: () => data.clear(), key: () => null, length: 1,
    },
  });
  try {
    const state = createInitialState();
    const checked = validateNightProposal({ version: 2, opinion: opinion() }, state);
    assert.ok(checked.errors.some(text => text.includes('驳回只能')), checked.errors.join(' / '));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
