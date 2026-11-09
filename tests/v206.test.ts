import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { BALANCE_FIELDS, DEFAULT_BALANCE, sanitizeBalance } from '../src/balance.ts';
import { leaveProgress } from '../src/ending.ts';
import { importState } from '../src/rules/persistence.ts';

/**
 * v206：离城结局。
 * 星砂达到门槛后，首页进度卡可点开确认并写入结局；不锁档，可继续看落幕页。
 */

test('v206 进度：99,999 未达成、100,000 达成；已记录时 done 为真', () => {
  const state = createInitialState();
  state.gold = 99_999;
  const low = leaveProgress(state, 100_000);
  assert.equal(low.ready, false);
  assert.equal(low.done, false);
  assert.equal(low.pct, 99);

  state.gold = 100_000;
  const ready = leaveProgress(state, 100_000);
  assert.equal(ready.ready, true);
  assert.equal(ready.done, false);
  assert.equal(ready.pct, 100);

  state.endings = [{ id: 'leave', day: state.day, at: '第 14 日', gold: 100_000, reputation: 76, girls: 3 }];
  const done = leaveProgress(state, 100_000);
  assert.equal(done.done, true);
  assert.equal(done.ready, false);
});

test('v206 未达标不能完成：不写记录、不扣星砂', () => {
  const state = createInitialState();
  state.gold = 99_999;
  const result = act(state, { type: 'finishEnding', endingId: 'leave' });
  assert.equal(result.ok, false);
  assert.equal(result.state.gold, 99_999);
  assert.deepEqual(result.state.endings ?? [], []);
});

test('v206 达标完成：写入快照、编年史与日志，星砂不动', () => {
  const state = createInitialState();
  state.gold = 100_000;
  state.reputation = 72;
  const girls = state.girls.filter(girl => !girl.dead && !girl.retired && !girl.left).length;

  const result = act(state, { type: 'finishEnding', endingId: 'leave' });
  assert.equal(result.ok, true, result.message);
  const record = result.state.endings?.[0];
  assert.ok(record);
  assert.equal(record!.id, 'leave');
  assert.equal(record!.day, state.day);
  assert.equal(record!.gold, 100_000);
  assert.equal(record!.reputation, 72);
  assert.equal(record!.girls, girls);
  assert.equal(typeof record!.at, 'string');
  assert.equal(result.state.gold, 100_000, '离城不扣星砂');
  assert.ok(result.state.chronicle.some(entry => entry.title.includes('离开樱雾市')));
  assert.ok(result.state.logs.some(entry => entry.text.includes('樱雾市')));
});

test('v206 重复完成被拒绝，记录不重复', () => {
  const state = createInitialState();
  state.gold = 100_000;
  const first = act(state, { type: 'finishEnding', endingId: 'leave' });
  assert.equal(first.ok, true);
  const second = act(first.state, { type: 'finishEnding', endingId: 'leave' });
  assert.equal(second.ok, false);
  assert.equal(second.state.endings?.length, 1);
});

test('v206 旧档没有 endings 读成空数组；坏记录丢掉', () => {
  const base = createInitialState();
  base.gold = 120_000;
  const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  delete raw.endings;
  const missing = importState(JSON.stringify(raw));
  assert.ok(missing);
  assert.deepEqual(missing.endings, []);

  raw.endings = [
    { id: 'leave', day: 'x' },
    { id: 'other', day: 2, at: '第 2 日', gold: 1, reputation: 0, girls: 0 },
    { id: 'leave', day: 3, at: '第 3 日', gold: 100_000, reputation: 70, girls: 2 },
  ];
  const mixed = importState(JSON.stringify(raw));
  assert.ok(mixed);
  assert.deepEqual(mixed.endings?.map(record => record.id), ['leave']);
  assert.equal(mixed.endings?.[0]?.day, 3);
});

test('v206 默认门槛 100,000，且在世界书「终局」组可调', () => {
  assert.equal(DEFAULT_BALANCE.endingLeaveGold, 100_000);
  const field = BALANCE_FIELDS.find(item => item.key === 'endingLeaveGold');
  assert.ok(field);
  assert.equal(field!.group, '终局');
  assert.equal(sanitizeBalance({ ...DEFAULT_BALANCE, endingLeaveGold: 120_000 }).endingLeaveGold, 120_000);
});
