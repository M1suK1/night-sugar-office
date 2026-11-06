import test from 'node:test';
import assert from 'node:assert/strict';
import { statsAtLevel } from '../src/progression.ts';
import { customGirlOf, customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { sanitizeCustomGirl, sanitizeCustomLeader } from '../src/rules/candidate.ts';

const base = { magic: 50, insight: 50, agility: 50, empathy: 50 };

test('v159 等级换算：1→10 主属性 +54、副属性 +36，其余不变', () => {
  const stats = statsAtLevel(base, 1, 10, '输出');
  assert.equal(stats.magic, 50 + 54);
  assert.equal(stats.agility, 50 + 36);
  assert.equal(stats.insight, 50);
  assert.equal(stats.empathy, 50);
});

test('v159 等级换算：10→1 回到 1 级基准；上限 120 会截住', () => {
  const up = statsAtLevel(base, 1, 10, '输出');
  assert.deepEqual(statsAtLevel(up, 10, 1, '输出'), base);
  const capped = statsAtLevel({ ...base, magic: 100 }, 1, 10, '输出');
  assert.equal(capped.magic, 120);
});

test('v159 首领固化：Lv.10 的数值按自动升级算', () => {
  const subject = subjectOfCustom({ id: 'x', name: '测试首领', factionTag: 'association', level: 1, color: '#fff', portrait: '', stats: base, skillIds: [] });
  const leader = customLeaderOf('association', subject);
  assert.equal(leader.level, 10);
  assert.equal(leader.stats.magic, 104);
  assert.equal(leader.stats.agility, 86);
  assert.equal(leader.statsLevel, 10);
});

test('v159 随从固化：Lv.8 / Lv.9 的数值按自动升级算', () => {
  const subject = subjectOfCustom({ id: 'y', name: '测试随从', factionTag: 'government', level: 1, color: '#fff', portrait: '', stats: base, skillIds: [] });
  const eight = customGirlOf('government', { ...subject, level: 7 });
  assert.equal(eight.level, 8);
  assert.equal(eight.stats.magic, 50 + 42);
  assert.equal(eight.stats.agility, 50 + 28);
  const nine = customGirlOf('government', { ...subject, level: 9 });
  assert.equal(nine.level, 9);
  assert.equal(nine.stats.magic, 50 + 48);
});

test('v159 老存档：没有 statsLevel 时按 1 级基准补一次，再读档不再膨胀', () => {
  const legacy = { name: '老随从', level: 8, stats: base, faction: 'witch', id: 'z' };
  const first = sanitizeCustomGirl(legacy, 'witch', 'z');
  assert.ok(first);
  assert.equal(first!.level, 8);
  assert.equal(first!.stats.magic, 92);
  assert.equal(first!.stats.agility, 78);
  assert.equal(first!.statsLevel, 8);
  const second = sanitizeCustomGirl(first, 'witch', 'z');
  assert.deepEqual(second!.stats, first!.stats);
});

test('v159 老存档首领：同样补到 10 级', () => {
  const legacy = { name: '老首领', level: 10, stats: base, faction: 'association', id: 'w' };
  const first = sanitizeCustomLeader(legacy, 'association', 'w');
  assert.ok(first);
  assert.equal(first!.stats.magic, 104);
  assert.equal(first!.stats.agility, 86);
  const second = sanitizeCustomLeader(first, 'association', 'w');
  assert.deepEqual(second!.stats, first!.stats);
});
