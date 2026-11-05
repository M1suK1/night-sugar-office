import test from 'node:test';
import assert from 'node:assert/strict';
import { beatsFromBattleNote, beatsFromPassage, beatsFromTurns, NARRATOR_ID } from '../src/vn/beats.ts';
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

test('v93 背景查表：渐变永远有，已画好的场景带图，未知 id 用 tint', () => {
  const lounge = resolveBackdrop('room:lounge');
  assert.match(lounge.gradient, /gradient/);
  assert.equal(lounge.image, '/art/council-lounge.jpg', '会客厅已经有真背景图');
  const night = resolveBackdrop('night');
  assert.equal(night.image, '', '没图的场景只用渐变');
  const custom = resolveBackdrop('district:nowhere', '#123456');
  assert.match(custom.gradient, /#123456/);
});

test('v93 交互剧情适配器：旁白/玩家/台词都折成 say，路上先给背景', () => {
  const beats = beatsFromTurns([
    { id: 't1', role: 'narrator', text: '雨下到现在。\n\n她把窗关上了。', lines: [{ speakerId: 'yue', speakerName: '月见桃', expression: 'sad', text: '你来了。' }] },
    { id: 't2', role: 'player', text: '我点了灯。' },
  ], { playerName: '所长' });
  assert.equal(beats[0]!.kind, 'bg');
  const says = beats.filter(beat => beat.kind === 'say') as Extract<typeof beats[number], { kind: 'say' }>[];
  assert.equal(says.length, 4, '两段旁白 + 一句台词 + 玩家一说');
  assert.equal(says[0]!.speakerId, NARRATOR_ID);
  assert.equal(says[2]!.name, '月见桃');
  assert.equal(says[2]!.expression, 'sad');
  assert.equal(says[3]!.name, '所长');
  assert.equal(beats.at(-1)!.kind, 'end');
});

test('v95 战斗札记适配器：先标题卡、再旁白、再台词；找不到说话人时按旁白', () => {
  const beats = beatsFromBattleNote([
    { id: 's1', title: '第一场', narration: '雨打在铁皮上。\n\n她先动了。', lines: [
      { speakerSide: 'ally', speakerId: 'yue', expression: 'angry', text: '别挡路。' },
      { speakerSide: 'enemy', speakerId: 'ghost', text: '……' },
    ] },
  ], [{ key: 'ally:yue', id: 'yue', name: '月见桃' }]);
  assert.equal(beats[0]!.kind, 'bg');
  assert.equal(beats[1]!.kind, 'scene');
  const says = beats.filter(beat => beat.kind === 'say') as Extract<typeof beats[number], { kind: 'say' }>[];
  assert.equal(says.length, 4, '两段旁白 + 一句台词 + 一句无名台词');
  assert.equal(says[2]!.name, '月见桃');
  assert.equal(says[2]!.expression, 'angry');
  assert.equal(says[3]!.speakerId, NARRATOR_ID, '找不到的说话人退成旁白');
});

test('v95 视觉小说开关会同步两条内置词条', async () => {
  const { syncVnPrompts, VN_PROMPT_ENTRIES, presetPrompts } = await import('../src/presets.ts');
  const preset = { id: 'p', name: '测试', settings: {}, createdAt: '', updatedAt: '' } as never;
  const on = syncVnPrompts([preset], true)[0]!;
  const entries = presetPrompts(on);
  for (const spec of VN_PROMPT_ENTRIES) {
    const entry = entries.find(item => item.id === spec.id);
    assert.ok(entry, `开着时应该有 ${spec.id}`);
    assert.equal(entry!.enabled, true);
    assert.equal(entry!.scope, spec.scope);
  }
  assert.ok(on.promptOrder?.some(item => item.identifier === 'vn-battle' && item.enabled), '顺序表也要带上');
  const off = syncVnPrompts([on], false)[0]!;
  for (const spec of VN_PROMPT_ENTRIES) {
    assert.equal(presetPrompts(off).find(item => item.id === spec.id)!.enabled, false, '关掉只停用不删');
  }
});
