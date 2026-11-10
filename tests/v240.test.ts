import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { addCorruption } from '../src/rules/conditions.ts';
import { nextWitchEvent, spawnWitchConfrontation, witchFallbackOpening } from '../src/rules/witchEvent.ts';
import { witchConfrontationContext } from '../src/llm.ts';
import { composeTaskSystem, presetPrompts, presetRuntime, shippedPresets } from '../src/presets.ts';
import { witchConfrontationContract } from '../src/promptSections.ts';
import { witchOutfitFor } from '../src/rules/outfits.ts';
import type { CharacterEvent, GameState, Storyline } from '../src/types.ts';

/** v240：魔女化对峙——跨线时排队、弹窗、按经历算账。 */

const crossed = (): { state: GameState; girl: GameState['girls'][number] } => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const girl = state.girls[0]!;
  girl.corruption = 60;
  addCorruption(state, girl, 15);
  return { state, girl };
};

test('v240 侵蚀跨过魔女线：排一段对峙事件', () => {
  const { state, girl } = crossed();
  assert.equal(girl.witch, true);
  const event = nextWitchEvent(state);
  assert.ok(event, '应当有一段待开场的对峙');
  assert.equal(event!.witch, true);
  assert.equal(event!.mode, 'session');
  assert.equal(event!.girlId, girl.id);
  assert.match(event!.title, /魔女化/);
  assert.equal(event!.opening ?? '', '', '正文交给叙事者，不在规则层写死');
  assert.equal(girl.eventBadge, '新');
});

test('v240 同一个人不会重复排队', () => {
  const { state, girl } = crossed();
  addCorruption(state, girl, 5);
  spawnWitchConfrontation(state, girl);
  const count = state.events.filter(event => event.witch && event.girlId === girl.id).length;
  assert.equal(count, 1);
});

test('v240 手动切换魔女形态不弹对峙', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.corruption = 100;
  const result = act(state, { type: 'setWitchForm', girlId: girl.id, outfit: witchOutfitFor(girl), personality: '' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.girls[0]!.witch, true);
  assert.equal(result.state.events.some(event => event.witch), false);
});

test('v240 两个人同时跨线：各排一段，按先后依次弹', () => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const [first, second] = state.girls;
  first!.corruption = 60;
  second!.corruption = 60;
  addCorruption(state, first!, 15);
  addCorruption(state, second!, 15);
  const pending = state.events.filter(event => event.witch);
  assert.equal(pending.length, 2);
  assert.equal(nextWitchEvent(state)!.girlId, first!.id, '先跨线的人先弹');
});

test('v240 已经写了开场白的对峙不再排进队列', () => {
  const { state } = crossed();
  const event = nextWitchEvent(state)!;
  event.opening = '她把门关上了。';
  assert.equal(nextWitchEvent(state), undefined);
});

test('v240 对峙契约：写清地点、逐条对质、不写数值', () => {
  const text = witchConfrontationContract();
  assert.match(text, /堵在哪里/);
  assert.match(text, /逐条对质/);
  assert.match(text, /不要写数值/);
  assert.match(text, /"narration"/);
});

test('v240 上下文带上故事线结局描述与私人事件回忆', () => {
  const { state, girl } = crossed();
  girl.witchForm = { ...witchOutfitFor(girl), description: '裙摆像被墨水泡过，笑容比平时慢半拍。' };
  girl.witchPersonality = '她把所有承诺都记成欠条，今晚是来收账的。';
  state.storylines = [{
    id: 's1', girlId: girl.id, title: '双针重合之刻', premise: '市役所的清算通牒压到她头上。',
    slot: 1, status: 'done', day: 3, ending: '双正之心', endingSummary: '她最终没有把剑指向你，而是把自己的手交了出来。',
    beats: [], createdAt: '', source: 'manual',
  } as unknown as Storyline];
  state.events.push({
    id: 'ev-1', girlId: girl.id, title: '雨夜的门口', hook: '', scenes: [], stage: 0, status: 'done',
    day: 2, source: 'llm', badge: false, summary: '她在雨里等了你两个小时，最后什么也没问。',
  } as CharacterEvent);

  const event = nextWitchEvent(state)!;
  const context = witchConfrontationContext(state, event);
  assert.match(context, /双针重合之刻/);
  assert.match(context, /双正之心/);
  assert.match(context, /她最终没有把剑指向你/);
  assert.match(context, /雨夜的门口/);
  assert.match(context, /什么都 没问|什么也没问/);
  assert.equal(context.includes('已走过'), false);
  assert.match(context, /魔女化人格/);
  assert.match(context, /堵住/);
});

test('v240 出厂预设都带着这条契约，位置也在注入顺序里', () => {
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'arc:witch');
    assert.ok(entry, `${preset.id} 缺少 arc:witch`);
    assert.equal(entry!.contract, true);
    assert.equal(entry!.name, '魔女化对峙 · 结构契约');
    const ordered = preset.promptOrder?.some(item => item.identifier === 'arc:witch');
    assert.ok(ordered, `${preset.id} 的 prompt_order 里没有 arc:witch`);
  }
});

test('v240 改过的契约会覆盖代码默认值', () => {
  const preset = shippedPresets()[0]!;
  const entries = presetPrompts(preset);
  const edited = { ...preset, prompts: entries.map(entry => entry.id === 'arc:witch' ? { ...entry, content: '【改过的契约】只输出 JSON。' } : entry) };
  const system = composeTaskSystem(witchConfrontationContract(), presetRuntime(edited), 'arc', {}, {}, 'arc:witch').system;
  assert.match(system, /【改过的契约】/);
  assert.equal(system.includes('narration 300–500 字'), false);
});

test('v240 模型写不出来时仍有兜底开场', () => {
  const { girl } = crossed();
  const fallback = witchFallbackOpening(girl);
  assert.ok(fallback.narration.length > 20);
  assert.ok(fallback.lines.length >= 2);
  assert.equal(fallback.options.length, 3);
  assert.ok(fallback.lines.every(line => line.speakerId === girl.id));
});
