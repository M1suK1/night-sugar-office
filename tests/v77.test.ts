import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldWarnAllSpend } from '../src/llm-night.ts';

const spend = { id: 'o1', label: '拨钱', changes: [{ kind: 'gold', amount: -300 }] };
const free = { id: 'o2', label: '让她们自己谈', changes: [{ kind: 'bond', amount: -6 }] };

test('v77 三条都在花钱时提醒，留一条不花钱就不提醒', () => {
  assert.equal(shouldWarnAllSpend([{ options: [spend] }, { options: [spend] }, { options: [spend] }]), true);
  assert.equal(shouldWarnAllSpend([{ options: [spend] }, { options: [spend] }, { options: [free] }]), false);
  assert.equal(shouldWarnAllSpend([{ options: [spend] }, { options: [spend, free] }, { options: [spend] }]), false, '有免费选项就不算');
  assert.equal(shouldWarnAllSpend([{ options: [spend] }]), false, '只有一条提案时不管');
  assert.equal(shouldWarnAllSpend([]), false);
});
