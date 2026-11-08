import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import type { CharacterEvent, GameState } from '../src/types.ts';

function sessionEvent(state: GameState): CharacterEvent {
  return {
    id: 'ev-lead', girlId: state.girls[0]!.id, title: '雨夜的便利店', hook: '她在门口等你',
    scenes: [], stage: 0, status: 'active', day: 14, source: 'template', badge: true,
    mode: 'session', opening: '雨下得很大。', cast: [state.girls[0]!.id],
    turns: [
      { id: 'turn-n-1', role: 'narrator', text: '她把伞收起来。', lines: [], options: [] },
      { id: 'turn-p-1', role: 'player', text: '我把伞递给她。', at: Date.now() },
    ],
  } as CharacterEvent;
}
const stateWith = (event: CharacterEvent): GameState => ({ ...createInitialState(), events: [event] });
const ending = { narration: '雨停之前谁都没再说话。', lines: [] };

test('v189 点结束时，输入框里那句作为最后一轮玩家发言记在结局之前', () => {
  const event = sessionEvent(createInitialState());
  const result = act(stateWith(event), { type: 'finishStorySession', eventId: event.id, ending, lead: '我把伞留在门口，先不走。' });
  assert.equal(result.ok, true, result.message);
  const turns = result.state.events[0]!.turns ?? [];
  assert.equal(turns.length, 4, '原有两轮 + 引子一轮 + 结局一轮');
  assert.equal(turns[2]!.role, 'player');
  assert.equal(turns[2]!.text, '我把伞留在门口，先不走。');
  assert.equal(turns[3]!.role, 'narrator');
  assert.match(turns[3]!.text, /雨停之前/);
});

test('v189 空输入不写回合，老动作照常收尾', () => {
  for (const lead of [undefined, '', '   ', '\n\t']) {
    const event = sessionEvent(createInitialState());
    const result = act(stateWith(event), { type: 'finishStorySession', eventId: event.id, ending, lead });
    assert.equal(result.ok, true);
    const turns = result.state.events[0]!.turns ?? [];
    assert.equal(turns.length, 3, '只有原有的两轮 + 结局');
    assert.equal(turns.at(-1)!.role, 'narrator');
  }
});

test('v189 引子压成一行、截到 300 字，和输入框上限一致', () => {
  const event = sessionEvent(createInitialState());
  const long = ('我推门进去，\n\n  看见她坐在窗边，' + '字'.repeat(400));
  const result = act(stateWith(event), { type: 'finishStorySession', eventId: event.id, ending, lead: long });
  const turns = result.state.events[0]!.turns ?? [];
  const said = turns[2]!;
  assert.equal(said.role, 'player');
  assert.equal(said.text.length, 300);
  assert.ok(!said.text.includes('\n'), '回合里不该留换行');
  assert.ok(said.text.startsWith('我推门进去， 看见她坐在窗边，'));
});

test('v189 引子只入档，不改变轮数与羁绊结算', () => {
  const plain = sessionEvent(createInitialState());
  const withLead = sessionEvent(createInitialState());
  const a = act(stateWith(plain), { type: 'finishStorySession', eventId: plain.id, ending, summary: '收束。' });
  const b = act(stateWith(withLead), { type: 'finishStorySession', eventId: withLead.id, ending, summary: '收束。', lead: '我先不走。' });
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  const bondA = a.state.girls[0]!.bond;
  const bondB = b.state.girls[0]!.bond;
  assert.equal(bondB, bondA, '同一段对话，多一句引子不该多涨羁绊');
  assert.match(b.state.logs[0]!.text, /走了 1 轮/, '轮数按真正来回的回合算');
});
