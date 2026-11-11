import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { resolveMacros } from '../src/promptMacros.ts';
import { renderPresetSystem } from '../src/presets.ts';
import type { CharacterEvent, GameState } from '../src/types.ts';

/** v254：{{history.events:cast}} 按在场的人分组，且与 {{history.events}} 不重复。 */

function setup(): { state: GameState; focus: GameState['girls'][number]; peer: GameState['girls'][number]; cast: { id: string; name: string }[] } {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const [focus, peer] = state.girls;
  const make = (id: string, girlId: string, title: string, summary: string, extra: Partial<CharacterEvent> = {}): CharacterEvent => ({
    id, girlId, title, hook: '', scenes: [], stage: 0, status: 'done', day: 3, source: 'llm', badge: false, summary, ...extra,
  } as CharacterEvent);
  state.events = [
    make('e-focus', focus!.id, '雨夜的门口', '她一个人在雨里等了两个小时。'),
    make('e-peer', peer!.id, '旧教堂的约定', '她把戒指收进手套，说等下次再谈。'),
    make('e-both', focus!.id, '两个人的会议', '她们在会客厅为预算吵了一架。', { meeting: { attendeeIds: [focus!.id, peer!.id] } as CharacterEvent['meeting'] }),
    ...state.events,
  ];
  return { state, focus: focus!, peer: peer!, cast: [{ id: focus!.id, name: focus!.name }, { id: peer!.id, name: peer!.name }] };
}

test('v254 cast 版按人分组，每人最多两条', () => {
  const { state, focus, cast } = setup();
  const text = resolveMacros('{{history.events:cast}}', { state, focus, cast }).text;
  assert.match(text, /【.+的往事】/);
  assert.match(text, /雨夜的门口/);
  assert.match(text, /旧教堂的约定/);
  const sections = text.split('\n\n').filter(Boolean);
  assert.equal(sections.length, 2, '两个人都各有一段');
  for (const section of sections) {
    assert.ok(section.split('\n').filter(line => line.startsWith('· ')).length <= 2);
  }
});

test('v254 同一件事挂在两个人名下时只写一次', () => {
  const { state, focus, cast } = setup();
  const text = resolveMacros('{{history.events:cast}}', { state, focus, cast }).text;
  assert.equal((text.match(/两个人的会议/g) ?? []).length, 1, '共同经历不重复');
});

test('v254 与 {{history.events}} 同时用时，cast 跳过主角与主角列过的事', () => {
  const { state, focus, cast } = setup();
  const text = resolveMacros('{{history.events}}\n\n{{history.events:cast}}', { state, focus, cast }).text;
  assert.equal((text.match(/雨夜的门口/g) ?? []).length, 1, '主角的独有往事只说一遍');
  assert.equal((text.match(/两个人的会议/g) ?? []).length, 1, '共同经历只说一遍');
  assert.match(text, /旧教堂的约定/, '别人的往事照常给');
});

test('v254 顺序无关：cast 写在前面也不重复', () => {
  const { state, focus, cast } = setup();
  const text = resolveMacros('{{history.events:cast}}\n\n{{history.events}}', { state, focus, cast }).text;
  assert.equal((text.match(/雨夜的门口/g) ?? []).length, 1);
  assert.equal((text.match(/两个人的会议/g) ?? []).length, 1);
  assert.match(text, /旧教堂的约定/);
});

test('v254 两个宏分在两条分区里也不会重复', () => {
  const { state, focus, cast } = setup();
  const entries = [
    { id: 'a', name: 'A', content: '{{history.events}}', role: 'system', enabled: true, scope: 'arc' },
    { id: 'b', name: 'B', content: '{{history.events:cast}}', role: 'system', enabled: true, scope: 'arc' },
  ] as never;
  const system = renderPresetSystem(entries, {}, { state, focus, cast }).system;
  assert.equal((system.match(/雨夜的门口/g) ?? []).length, 1);
  assert.equal((system.match(/两个人的会议/g) ?? []).length, 1);
  assert.match(system, /旧教堂的约定/);
});

test('v254 没有 cast 信息时退回主角自己，没有往事时展开为空', () => {
  const { state, focus, peer } = setup();
  const single = resolveMacros('{{history.events:cast}}', { state, focus }).text;
  assert.match(single, new RegExp('【' + focus.name + '的往事】'));
  assert.equal(single.includes('旧教堂的约定'), false, '没有 cast 就不列别人');

  state.events = state.events.map(event => ({ ...event, girlId: peer.id, cast: [], meeting: undefined, summary: '' }));
  assert.equal(resolveMacros('{{history.events:cast}}', { state, focus }).text, '');
});
