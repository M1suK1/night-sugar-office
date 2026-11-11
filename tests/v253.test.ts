import test from 'node:test';
import assert from 'node:assert/strict';
import { presetPrompts, presetRuntime, shippedPresets } from '../src/presets.ts';
import { SECTION_PROMPTS } from '../src/promptSections.ts';
import { eventMemoryBlock } from '../src/llm.ts';
import { createInitialState } from '../src/game.ts';
import type { CharacterEvent } from '../src/types.ts';

/** v253：出厂预设默认带上 {{history.events}}，且同一份提示词里只出现一次。 */

const HEROINE_IDS = ['chat-heroine', 'whisper-heroine', 'sl-heroine', 'ev-heroine', 'arc-heroine'];
const count = (text: string) => (text.match(/\{\{history\.events\}\}/g) ?? []).length;

test('v253 代码默认的五个「她是谁」都带私人事件回忆', () => {
  for (const id of HEROINE_IDS) {
    const entry = SECTION_PROMPTS.find(item => item.id === id);
    assert.ok(entry, `缺少默认分区 ${id}`);
    assert.equal(count(entry!.content), 1, `${id} 应恰好一处 {{history.events}}`);
    assert.match(entry!.content, /【她的过往】[\s\S]*\{\{history\.events\}\}/, `${id} 的宏应写在【她的过往】里`);
  }
});

test('v253 每份出厂预设的【她的过往】都带上宏，且不重复', () => {
  for (const preset of shippedPresets()) {
    const entries = presetPrompts(preset);
    const past = entries.filter(entry => (entry.content ?? '').includes('【她的过往】'));
    assert.ok(past.length >= 4, `${preset.id} 的【她的过往】条目太少：${past.length}`);
    for (const entry of past) {
      assert.equal(count(entry.content), 1, `${preset.id} / ${entry.id} 的宏数量不对`);
    }
    for (const entry of entries) {
      assert.ok(
        (entry.content ?? '').split('{{history.events}}').length - 1 <= 1,
        `${preset.id} / ${entry.id} 重复写了 {{history.events}}`,
      );
    }
  }
});

test('v253 预设已经带宏时，正文不再重复注入【你们之前发生过的】', () => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const girl = state.girls[0]!;
  state.events = [
    {
      id: 'e1', girlId: girl.id, title: '雨夜的门口', hook: '', scenes: [], stage: 0, status: 'done',
      day: 3, source: 'llm', badge: false, summary: '她在雨里等了你两个小时。',
    } as CharacterEvent,
    ...state.events,
  ];
  const shipped = shippedPresets().find(preset => preset.id === 'shipped-arc')!;
  assert.equal(eventMemoryBlock(state, girl.id, presetRuntime(shipped)), '', '出厂预设已写宏，正文让位');
  assert.match(eventMemoryBlock(state, girl.id), /雨夜的门口/, '没有预设时照旧补一段');
});
