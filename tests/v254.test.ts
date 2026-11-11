import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { resolveMacros } from '../src/promptMacros.ts';
import { renderPresetSystem } from '../src/presets.ts';
import { promptTokens } from '../src/tokens.ts';
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

test('v254 cast 可以传每人条数：{{history.events:cast:3}}', () => {
  const { state, focus, peer, cast } = setup();
  for (let index = 0; index < 3; index += 1) {
    state.events.unshift({
      id: 'peer-extra-' + index, girlId: peer.id, title: '第 ' + (index + 1) + ' 件旧事', hook: '', scenes: [],
      stage: 0, status: 'done', day: 2, source: 'llm', badge: false, summary: '这是第 ' + (index + 1) + ' 件旧事的摘要。',
    } as CharacterEvent);
  }
  const text = resolveMacros('{{history.events:cast:3}}', { state, focus, cast }).text;
  const peerSection = text.split('\n\n').find(section => section.includes('【' + peer.name + '的往事】'))!;
  assert.ok(peerSection, text);
  assert.equal(peerSection.split('\n').filter(line => line.startsWith('· ')).length, 3, '每人 3 条');
  const two = resolveMacros('{{history.events:cast}}', { state, focus, cast }).text;
  const peerTwo = two.split('\n\n').find(section => section.includes('【' + peer.name + '的往事】'))!;
  assert.equal(peerTwo.split('\n').filter(line => line.startsWith('· ')).length, 2, '默认仍是 2 条');
});

test('v254 总预算 2400：人多事多时整段丢弃并写明还有几人', () => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const girls = state.girls.slice(0, 6);
  state.events = [];
  for (const girl of girls) {
    for (let index = 0; index < 6; index += 1) {
      state.events.push({
        id: girl.id + '-e' + index, girlId: girl.id, title: girl.name + '的第 ' + (index + 1) + ' 件旧事',
        hook: '', scenes: [], stage: 0, status: 'done', day: 2, source: 'llm', badge: false,
        summary: '那天的细节很长，写到她把外套挂在门后、把灯调暗、又坐回窗边为止，整整一段八十来字的摘要。'.repeat(3),
      } as CharacterEvent);
    }
  }
  const cast = girls.map(girl => ({ id: girl.id, name: girl.name }));
  const text = resolveMacros('{{history.events:cast:6}}', { state, focus: girls[0]!, cast }).text;
  assert.ok(promptTokens(text) <= 2400 + 80, `${promptTokens(text)} 超出预算`);
  assert.match(text, /还有 \d+ 人的往事未列出/);
});

test('v254 没有 cast 信息时退回主角自己，没有往事时展开为空', () => {
  const { state, focus, peer } = setup();
  const single = resolveMacros('{{history.events:cast}}', { state, focus }).text;
  assert.match(single, new RegExp('【' + focus.name + '的往事】'));
  assert.equal(single.includes('旧教堂的约定'), false, '没有 cast 就不列别人');

  state.events = state.events.map(event => ({ ...event, girlId: peer.id, cast: [], meeting: undefined, summary: '' }));
  assert.equal(resolveMacros('{{history.events:cast}}', { state, focus }).text, '');
});
