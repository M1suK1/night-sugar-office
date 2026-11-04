import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProposalCheck, repairRejectOptions } from '../src/proposalCheck.ts';

test('v110 宽松模式就地修好驳回：只留提出者的羁绊，不再整份作废', () => {
  const raw = {
    opinions: [{
      authorId: 'tang',
      options: [
        { id: 'accept', changes: [{ kind: 'gold', amount: -400 }] },
        { id: 'reject', changes: [{ kind: 'faction', faction: 'witch', amount: -4 }, { kind: 'gold', amount: -300 }, { kind: 'girl', girlId: 'tang', field: 'bond', amount: -3 }] },
      ],
    }],
  };
  const repaired = repairRejectOptions(raw) as { opinions: { options: { id: string; changes: unknown[] }[] }[] };
  const reject = repaired.opinions[0]!.options[1]!;
  assert.deepEqual(reject.changes, [{ kind: 'girl', girlId: 'tang', field: 'bond', amount: -3 }], '别的变化全删掉');
  assert.equal(repaired.opinions[0]!.options[0]!.changes.length, 1, 'accept 原样不动');
});

test('v110 驳回一条蛮横的变化都没有时，补一条 −2 的羁绊', () => {
  const raw = { opinions: [{ authorId: 'ling', options: [{ id: 'reject', changes: [{ kind: 'gold', amount: -300 }] }] }] };
  const repaired = repairRejectOptions(raw) as { opinions: { options: { changes: { kind: string; amount: number }[] }[] }[] };
  assert.deepEqual(repaired.opinions[0]!.options[0]!.changes, [{ kind: 'girl', girlId: 'ling', field: 'bond', amount: -2 }]);
});

test('v110 默认是宽松模式（node 里没有 localStorage 也不报错）', () => {
  assert.equal(loadProposalCheck(), 'lenient');
});
