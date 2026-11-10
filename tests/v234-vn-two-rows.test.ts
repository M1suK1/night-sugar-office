import test from 'node:test';
import assert from 'node:assert/strict';
import { BACK_ROW_BOTTOM, stageRows, stageSlots } from '../src/vn/stage.ts';

/**
 * v234：两排舞台的落位。
 *
 * 旧算法把前后排放在同一列，后排整张立绘压在前排背后——六人同台时只剩头顶一条缝，
 * 看着像只站了四个人。现在前后排交错占槽位。
 */

const ids = (n: number) => Array.from({ length: n }, (_, i) => `g${i + 1}`);

test('v234 六人同台：六个人各有自己的落位，前后排横向交错', () => {
  const rows = stageRows(ids(6));
  assert.equal(rows.front.length, 3);
  assert.equal(rows.back.length, 3);
  const slots = stageSlots(rows);
  assert.equal(slots.length, 6, '六个人都要上台');
  assert.equal(new Set(slots.map(slot => slot.left.toFixed(2))).size, 6, '没有两个人叠在同一位置');

  // 按左边界排序后，前后排必须交替出现（F B F B F B）
  const ordered = [...slots].sort((a, b) => a.left - b.left);
  const pattern = ordered.map(slot => slot.row).join(' ');
  assert.equal(pattern, 'front back front back front back', `前后排应交错，实际是 ${pattern}`);

  for (const slot of slots) {
    assert.ok(slot.left >= 0 && slot.left + slot.width <= 100.01, `${slot.id} 不能跑出舞台`);
    assert.ok(slot.width >= 24 && slot.width <= 100 / 3 + 0.01, '单人格宽不超过三人并排那一档');
  }
});

test('v234 相邻两人的中心至少隔开一个人的头，脸不会被完全挡住', () => {
  const slots = stageSlots(stageRows(ids(6)));
  const centers = slots.map(slot => ({ id: slot.id, center: slot.left + slot.width / 2 })).sort((a, b) => a.center - b.center);
  for (let i = 1; i < centers.length; i += 1) {
    const gap = centers[i]!.center - centers[i - 1]!.center;
    assert.ok(gap >= 8, `${centers[i - 1]!.id} 与 ${centers[i]!.id} 只隔了 ${gap.toFixed(1)}%，会互相遮挡`);
  }
});

test('v234 后排抬高一层，前排贴底', () => {
  const slots = stageSlots(stageRows(ids(6)));
  for (const slot of slots) {
    assert.equal(slot.bottom, slot.row === 'back' ? BACK_ROW_BOTTOM : 0);
  }
});

test('v234 三人和两人仍是一排均分，不受两排逻辑影响', () => {
  const three = stageSlots(stageRows(ids(3)));
  assert.equal(three.length, 3);
  assert.ok(three.every(slot => slot.row === 'front' && slot.bottom === 0));
  assert.deepEqual(three.map(slot => Number(slot.left.toFixed(1))), [0, 33.3, 66.7]);

  const two = stageSlots(stageRows(ids(2)));
  assert.deepEqual(two.map(slot => Number(slot.width.toFixed(1))), [50, 50]);
});

test('v234 四人、五人、七人都能排开且不叠在同一位置', () => {
  for (const count of [4, 5, 7]) {
    const slots = stageSlots(stageRows(ids(count)));
    assert.equal(slots.length, count);
    const lefts = new Set(slots.map(slot => slot.left.toFixed(2)));
    assert.equal(lefts.size, count, `${count} 人时有人叠在同一位置`);
    for (const slot of slots) assert.ok(slot.left >= 0 && slot.left + slot.width <= 100.01);
  }
});
