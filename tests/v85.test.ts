import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPointsMuted, pointsKey, savePointsMuted, shouldShowPointBadge } from '../src/points.ts';

test('v85 加点角标：只在手动模式下、没被关掉时提醒', () => {
  const girl = { id: 'g1', unspentPoints: 10 };
  assert.equal(shouldShowPointBadge(girl, 'manual', []), true);
  assert.equal(shouldShowPointBadge(girl, 'auto', []), false, '自动加点不该提醒');
  assert.equal(shouldShowPointBadge(girl, undefined, []), false, '旧档按自动处理');
  assert.equal(shouldShowPointBadge({ id: 'g1', unspentPoints: 0 }, 'manual', []), false);
  assert.equal(shouldShowPointBadge(girl, 'manual', [pointsKey('g1', 10)]), false, '关掉之后不亮');
  assert.equal(shouldShowPointBadge({ id: 'g1', unspentPoints: 20 }, 'manual', [pointsKey('g1', 10)]), true, '升级发了新点数就重新提醒');
  assert.equal(shouldShowPointBadge(girl, 'manual', [pointsKey('g2', 10)]), true, '别人的提醒不影响她');
});

test('v85 关掉的记录存在本机，没有 localStorage 也不报错', () => {
  assert.deepEqual(loadPointsMuted(), [], 'node 环境没有 localStorage，读不到就当空');
  assert.doesNotThrow(() => savePointsMuted(['g1:10']));
});
