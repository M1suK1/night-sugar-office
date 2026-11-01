import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_BYTES, readCardFile, scanCardDir } from '../scripts/cards-api.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = path.join(root, '.tmp', `cards-api-${process.pid}`);

const card = (name, extra = {}) => JSON.stringify({
  format: 'night-sugar/girl-card', version: 1, exportedAt: '2026-01-01T00:00:00.000Z', sourceDay: 1,
  girl: {
    name, codename: 'T-1', title: '测试卡', element: '星光系', color: '#8fd3c7', level: 3,
    stats: { magic: 60, insight: 60, agility: 60, empathy: 80 },
    skillIds: ['glimmer-spear', 'night-prayer', 'moon-phase'], traitIds: [], factionTag: 'none',
    ...extra,
  },
});

beforeEach(async () => {
  await fs.rm(base, { recursive: true, force: true });
  await fs.mkdir(base, { recursive: true });
});
after(async () => { await fs.rm(base, { recursive: true, force: true }); });

test('卡库扫描：小卡带内容，带立绘的大卡只报名字与大小', async () => {
  await fs.writeFile(path.join(base, '小卡.json'), card('小卡'));
  await fs.writeFile(path.join(base, '大卡.json'), card('大卡', { goal: 'A'.repeat(400_000) }));
  await fs.writeFile(path.join(base, '说明.txt'), '不是卡');

  const result = await scanCardDir(base);
  assert.equal(result.ok, true);
  assert.equal(result.files.length, 2, '只认 .json');
  const small = result.files.find(file => file.name === '小卡.json');
  const big = result.files.find(file => file.name === '大卡.json');
  assert.ok(small.text.includes('小卡'), '小卡直接把内容带回');
  assert.equal(big.text, undefined, '大卡不把内容塞进扫描结果');
  assert.ok(big.bytes > 256 * 1024, `大卡要报出真实大小：${big.bytes}`);
  assert.equal(result.skipped.length, 0);
});

test('卡库扫描：超过 24MB 的文件被跳过并说明原因', async () => {
  await fs.writeFile(path.join(base, '太大.json'), Buffer.alloc(MAX_BYTES + 4096, 0x61));
  const result = await scanCardDir(base);
  assert.equal(result.ok, true);
  assert.equal(result.files.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reason, /24\.0MB/);
});

test('单张读取：按名字把大卡完整读回来', async () => {
  const text = card('大卡', { goal: 'B'.repeat(400_000) });
  await fs.writeFile(path.join(base, '大卡.json'), text);
  const result = await readCardFile(base, '大卡.json');
  assert.equal(result.ok, true, result.message);
  assert.equal(result.text, text);
  assert.ok(result.bytes > 400_000);
});

test('单张读取：越界名字与目录外路径一律拒绝', async () => {
  await fs.writeFile(path.join(base, '真卡.json'), card('真卡'));
  for (const name of ['../真卡.json', '..\\真卡.json', '子目录/真卡.json', '不是卡.txt', '']) {
    const result = await readCardFile(base, name);
    assert.equal(result.ok, false, `应当拒绝：${JSON.stringify(name)}`);
    assert.equal(result.status, 400);
  }
});

test('单张读取：文件不存在时给出可读的失败', async () => {
  const result = await readCardFile(base, '没有这张.json');
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.match(result.message, /读不到这个文件/);
});
