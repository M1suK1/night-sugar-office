import test from 'node:test';
import assert from 'node:assert/strict';
import { __resetKvForTests } from '../src/store.ts';
import {
  WORLDBOOK_STORE_KEY, builtinWorldbook, loadWorldbookFromStore, saveWorldbookToStore, worldbookContext,
} from '../src/worldbook.ts';

test('v169 世界书：保存到存档后能原样读回，编辑内容不会被内置词条顶掉', async () => {
  __resetKvForTests();
  const entries = builtinWorldbook().map(item => item.id === 'factions'
    ? { ...item, content: '我改过的三方势力：这就是玩家自己写的那一版。', enabled: true, constant: true }
    : item);
  assert.equal(await saveWorldbookToStore(entries), true);

  const loaded = await loadWorldbookFromStore();
  assert.ok(loaded, '存档里应该有世界书');
  const edited = loaded!.find(item => item.id === 'factions')!;
  assert.ok(edited.content.includes('我改过的三方势力'), '读回来的必须是玩家改过的那一版');
  assert.equal(edited.constant, true);

  // 注入提示词时用的也是改过的那份内容。
  const context = worldbookContext('三方势力 辖区', loaded!);
  assert.ok(context.text.includes('我改过的三方势力'), context.text);
});

test('v169 世界书：没保存过时读存档返回 undefined，调用方继续用浏览器里的那份', async () => {
  __resetKvForTests();
  assert.equal(await loadWorldbookFromStore(), undefined);
});

test('v169 世界书：存档里的坏条目会被丢掉，不会让整份读失败', async () => {
  __resetKvForTests();
  await saveWorldbookToStore([
    { id: 'ok', name: '好的词条', content: '这条是正常的。', keys: [], enabled: true, constant: true, priority: 50, order: 1 },
    { id: 'bad', name: '空的', content: '   ', keys: [], enabled: true, constant: false, priority: 50, order: 2 },
  ] as never);
  const loaded = await loadWorldbookFromStore();
  assert.ok(loaded);
  assert.deepEqual(loaded!.map(item => item.id), ['ok']);
  assert.equal(WORLDBOOK_STORE_KEY, 'worldbook/entries');
});
