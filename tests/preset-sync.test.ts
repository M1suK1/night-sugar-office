import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinPresets, DEFAULT_PRESET_BINDING, mergeLocalBinding, mergeLocalPresets } from '../src/presets.ts';
import type { ChatPreset, PresetBinding } from '../src/presets.ts';

function preset(id: string, name = id): ChatPreset {
  return {
    id, name, description: '从本地存档同步过来的预设。',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    schema: 6, settings: { temp_openai: 0.8 }, prompts: [], promptOrder: [],
  } as ChatPreset;
}

test('v178 本地预设同步：同 id 不重复，缺的按顺序补在后面', () => {
  const mine = [preset('preset-a'), preset('preset-b')];
  const merged = mergeLocalPresets(mine, [preset('preset-a', '改过的'), preset('preset-c')]);
  assert.deepEqual(merged.map(item => item.id), ['preset-a', 'preset-b', 'preset-c']);
  // 已有的那份保持原样（本地优先），新补的标成「同步自带」。
  assert.equal(merged[0]?.name, 'preset-a');
  assert.match(merged[2]?.description ?? '', /同步自带/);
});

test('v178 本地预设同步：不会覆盖内置预设，也不进内置标记', () => {
  const builtins = builtinPresets();
  const merged = mergeLocalPresets(builtins, [preset('preset-x')]);
  assert.equal(merged.length, builtins.length + 1);
  assert.equal(merged.at(-1)?.builtin, undefined);
});

test('v178 本地绑定同步：只接管还停在出厂默认的那几项', () => {
  const presets = [preset('preset-news'), preset('preset-chat')];
  const mine: PresetBinding = {
    ...DEFAULT_PRESET_BINDING,
    news: 'preset-news',
    chat: 'preset-chat',
  };
  const untouched = mergeLocalBinding({ ...DEFAULT_PRESET_BINDING }, mine, presets);
  assert.equal(untouched.news, 'preset-news');
  assert.equal(untouched.chat, 'preset-chat');

  const edited = mergeLocalBinding({ ...DEFAULT_PRESET_BINDING, news: 'preset-own' }, mine, presets);
  assert.equal(edited.news, 'preset-own', '玩家自己选的不能被抢走');
  assert.equal(edited.chat, 'preset-chat');

  // 目标预设不在这份列表里就不接管。
  const missing = mergeLocalBinding({ ...DEFAULT_PRESET_BINDING }, mine, []);
  assert.equal(missing.news, DEFAULT_PRESET_BINDING.news);
});
