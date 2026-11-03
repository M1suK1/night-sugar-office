import test from 'node:test';
import assert from 'node:assert/strict';
import { loadChimeEnabled, playChime, resolveChime, saveChimeEnabled, CHIME_KEY } from '../src/audio.ts';

test('v69 该不该响：关掉不响、连接测试不响、成功与失败两种音', () => {
  assert.equal(resolveChime({ kind: '灯下私语', ok: true }, true), 'done');
  assert.equal(resolveChime({ kind: '灯下私语', ok: false }, true), 'fail');
  assert.equal(resolveChime({ kind: '连接测试', ok: true }, true), null, '连接测试一次会响两声，索性不响');
  assert.equal(resolveChime({ kind: '每日提案', ok: true }, false), null, '开关关掉就不响');
});

test('v69 没有 localStorage 时默认开着，写入不抛错', () => {
  assert.equal(loadChimeEnabled(), true);
  assert.doesNotThrow(() => saveChimeEnabled(false));
  assert.doesNotThrow(() => saveChimeEnabled(true));
  assert.equal(CHIME_KEY, 'night-sugar:llm-chime');
});

test('v69 没有 AudioContext 的环境里播放只是一个空操作', () => {
  assert.doesNotThrow(() => playChime('done'));
  assert.doesNotThrow(() => playChime('fail'));
});
