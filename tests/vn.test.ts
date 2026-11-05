import test from 'node:test';
import assert from 'node:assert/strict';
import { beatsFromPassage, NARRATOR_ID } from '../src/vn/beats.ts';
import { vnInitial, vnReducer, vnAwaitingChoice, vnBeatKey } from '../src/vn/reducer.ts';
import { resolveBackdrop } from '../src/vn/backdrops.ts';
import type { VnBeat } from '../src/vn/types.ts';

const passage = {
  id: 'p1',
  title: '第一幕',
  narration: '雨停在她肩上。\n\n远处有电车经过。',
  lines: [
    { speaker: '月见桃', tone: 'soft', text: '你回来得很晚。' },
    { speaker: '旁白', text: '她把灯调暗了一格。' },
    { speaker: '月见桃', text: '  ' },
  ],
  choices: [
    { id: 'accept', label: '陪她坐一会儿', intent: 'bond +2' },
    { id: 'refuse', label: '先去写报告' },
  ],
};

test('v93 适配器：旁白拆段、台词顺序、表情透传、选项收尾、空文本丢掉', () => {
  const beats = beatsFromPassage(passage, { speakerId: 'yue', speakerName: '月见桃', expression: 'smile', element: '月影系' });
  assert.equal(beats[0]!.kind, 'bg', '开头先给背景');
  const says = beats.filter(beat => beat.kind === 'say');
  assert.equal(says.length, 4, '两段旁白 + 两句台词（空台词被丢掉）');
  assert.equal((says[0] as Extract<VnBeat, { kind: 'say' }>).speakerId, NARRATOR_ID);
  assert.equal((says[2] as Extract<VnBeat, { kind: 'say' }>).name, '月见桃');
  assert.equal((says[2] as Extract<VnBeat, { kind: 'say' }>).speakerId, 'yue');
  assert.equal((says[2] as Extract<VnBeat, { kind: 'say' }>).expression, 'smile');
  const choice = beats.find(beat => beat.kind === 'choice');
  assert.ok(choice, '选项要收尾一条 choice');
  assert.equal((choice as Extract<VnBeat, { kind: 'choice' }>).options.length, 2);
  assert.equal(beats.at(-1)!.kind, 'end');
});

test('v93 适配器：passage.scene 能覆盖背景（以后模型指定场景的入口）', () => {
  const beats = beatsFromPassage({ ...passage, scene: 'room:lounge' });
  const bg = beats[0] as Extract<VnBeat, { kind: 'bg' }>;
  assert.equal(bg.backdrop.id, 'room:lounge');
});

test('v93 状态机：打字中先打完、再点才前进、选项阻塞推进', () => {
  const beats: VnBeat[] = [
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '一句。' },
    { kind: 'choice', options: [{ id: 'a', label: '接受' }] },
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '两句。' },
    { kind: 'end' },
  ];
  let state = vnInitial(beats);
  assert.equal(state.typing, true, '第一句一进来就在打字');

  state = vnReducer(state, { type: 'advance' });
  assert.equal(state.index, 0, '打字中点击只把字打完');
  assert.equal(state.typing, false);

  state = vnReducer(state, { type: 'advance' });
  assert.equal(state.index, 1);
  assert.equal(vnAwaitingChoice(state), true);

  const blocked = vnReducer(state, { type: 'advance' });
  assert.equal(blocked.index, 1, '选项拍不接受 advance');

  state = vnReducer(state, { type: 'choose', id: 'a' });
  assert.equal(state.index, 2, '选完继续走');
  assert.equal(state.chosenId, 'a');

  // 选完之后进入下一句：先打完字，再点一次才到 end
  state = vnReducer(state, { type: 'advance' });
  assert.equal(state.index, 2);
  assert.equal(state.typing, false);
  state = vnReducer(state, { type: 'advance' });
  assert.equal(state.index, 3);
  assert.equal(state.done, true);
});

test('v93 状态机：同一个选项只会被算一次', () => {
  const beats: VnBeat[] = [
    { kind: 'choice', options: [{ id: 'a', label: '接受' }, { id: 'b', label: '拒绝' }] },
    { kind: 'end' },
  ];
  let state = vnInitial(beats);
  state = vnReducer(state, { type: 'choose', id: 'a' });
  const twice = vnReducer(state, { type: 'choose', id: 'b' });
  assert.equal(twice.chosenId, 'a', '第二次选择被忽略');
});

test('v93 跳过已读：没看过的句子会停住', () => {
  const beats: VnBeat[] = [
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '旧的。' },
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '新的。' },
    { kind: 'end' },
  ];
  const seen = [vnBeatKey(beats[0]!, 0)];
  const state = vnReducer(vnInitial(beats), { type: 'skipSeen', seen });
  assert.equal(state.index, 1, '跳到第一条没看过的');
  assert.equal(state.typing, true);
});

test('v93 背景查表：已知 id 出渐变，未知 id 用 tint，永远没有图', () => {
  const lounge = resolveBackdrop('room:lounge');
  assert.match(lounge.gradient, /gradient/);
  assert.equal(lounge.image, '', '现在不接背景图');
  const custom = resolveBackdrop('district:nowhere', '#123456');
  assert.match(custom.gradient, /#123456/);
});
