import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { storyOpeningContextForTest } from '../src/llm.ts';

test('v168 会议提示词：标题、地点、参会者、采购、主持人都在，且不写成约谈', () => {
  const state = createInitialState();
  state.gold = 5000;
  const attendees = state.girls.slice(0, 3).map(girl => girl.id);
  const started = act(state, {
    type: 'startMeeting',
    plan: { title: '本周排班', placeId: 'roof', placeName: '事务所天台', attendeeIds: attendees, buys: '两盒草莓大福' },
  }).state;
  const event = started.events.find(item => item.meeting)!;

  const context = storyOpeningContextForTest(started, event, '我把排班表压在桌上。');
  assert.ok(context.includes('【这是一场事务所会议】'), context);
  assert.ok(context.includes('本周排班'));
  assert.ok(context.includes('事务所天台'));
  assert.ok(context.includes('两盒草莓大福'));
  for (const id of attendees) {
    const name = started.girls.find(girl => girl.id === id)!.name;
    assert.ok(context.includes(name), `参会者 ${name} 要在名单里`);
  }
  assert.ok(context.includes('彼此关系'), '要给出参会者之间的关系');
  assert.ok(!context.includes('引子：'), '会议不该带上约谈的引子');
  assert.ok(!context.includes('这一夜是怎么开始'), '不要写死开场');
});
