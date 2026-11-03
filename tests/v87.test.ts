import test from 'node:test';
import assert from 'node:assert/strict';
import { dismissToast, expireToasts, pushToast, type ToastEntry } from '../src/toasts.ts';

const entry = (id: number, message: string, createdAt = 1000): ToastEntry => ({ id, message, ok: true, createdAt });

test('v87 同一句话三秒内不重复入队，重复推送不再堆成关不掉的提示', () => {
  const once = pushToast([], entry(1, '调查完成 · 糖果街的失眠电波', 1000));
  const twice = pushToast(once, entry(2, '调查完成 · 糖果街的失眠电波', 1500));
  assert.equal(twice.length, 1, '三秒内重复的丢掉');
  const later = pushToast(twice, entry(3, '调查完成 · 糖果街的失眠电波', 5000));
  assert.equal(later.length, 2, '隔久了同一句话可以再出现（真的又完成了一次）');
});

test('v87 过期只看时间：即使定时器被打断，旧提示也会被清掉', () => {
  const list = [entry(1, '旧', 1000), entry(2, '新', 6500)];
  assert.deepEqual(expireToasts(list, 7000).map(item => item.id), [2], '六秒前的清掉');
  assert.deepEqual(expireToasts(list, 1000).map(item => item.id), [1, 2], '刚推的留着');
});

test('v87 点 ✕ 只关掉这一条', () => {
  const list = [entry(1, '甲'), entry(2, '乙')];
  assert.deepEqual(dismissToast(list, 1).map(item => item.id), [2]);
  assert.deepEqual(dismissToast(list, 99).map(item => item.id), [1, 2], '关不存在的 id 不动列表');
});
