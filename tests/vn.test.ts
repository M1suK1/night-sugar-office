import test from 'node:test';
import assert from 'node:assert/strict';
import { beatsFromBattleNote, beatsFromPassage, beatsFromTurns, NARRATOR_ID } from '../src/vn/beats.ts';
import { vnInitial, vnRebase, vnReducer, vnAwaitingChoice, vnBeatKey } from '../src/vn/reducer.ts';
import { resolveBackdrop } from '../src/vn/backdrops.ts';
import { speakersBySegment, stageAfter } from '../src/vn/stage.ts';
import { placeLines } from '../src/storyLines.ts';
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
  // v99：台词要插回旁白中间，不能整段塌在结尾
  const sayText = (at: number) => (says[at] as Extract<VnBeat, { kind: 'say' }>).text;
  assert.equal((says[0] as Extract<VnBeat, { kind: 'say' }>).speakerId, NARRATOR_ID);
  assert.equal(sayText(0), '雨停在她肩上。');
  assert.equal((says[1] as Extract<VnBeat, { kind: 'say' }>).name, '月见桃');
  assert.equal((says[1] as Extract<VnBeat, { kind: 'say' }>).speakerId, 'yue');
  assert.equal((says[1] as Extract<VnBeat, { kind: 'say' }>).expression, 'smile');
  assert.equal(sayText(3), '远处有电车经过。', '末段旁白仍然在最后');
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

test('v98 追加新台词后从收束那拍接回：新旁白一定会演，不会一直卡在 end', () => {
  const before: VnBeat[] = [
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '她把窗关上。' },
    { kind: 'end' },
  ];
  // 演到底：done 被置成 true
  let state = vnInitial(before);
  state = vnReducer(state, { type: 'typed' });
  state = vnReducer(state, { type: 'advance' });
  assert.equal(state.done, true, '先演到收束');

  // 交互剧情回了一轮：整张表重建，末尾多了新旁白与新台词
  const after: VnBeat[] = [
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '她把窗关上。' },
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '雨声忽然近了。' },
    { kind: 'say', speakerId: 'yue', name: '月见桃', text: '你听见了吗。' },
    { kind: 'end' },
  ];
  state = vnRebase(state, after, before.length);
  assert.equal(state.index, 1, '指针退回旧表的收束位，也就是第一条新旁白');
  assert.equal(state.done, false, 'done 必须放开，否则 advance 永远早退');
  assert.equal(state.typing, true);
  assert.equal((state.beats[state.index] as Extract<VnBeat, { kind: 'say' }>).text, '雨声忽然近了。');

  // 继续推得动
  state = vnReducer(state, { type: 'typed' });
  state = vnReducer(state, { type: 'advance' });
  assert.equal((state.beats[state.index] as Extract<VnBeat, { kind: 'say' }>).name, '月见桃');
});

test('v98 只是变短或原地不变时不乱跳', () => {
  const beats: VnBeat[] = [
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '一。' },
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '二。' },
    { kind: 'end' },
  ];
  let state = vnInitial(beats);
  state = vnReducer(state, { type: 'typed' });
  state = vnReducer(state, { type: 'advance' });
  assert.equal(state.index, 1);
  const same = vnRebase(state, beats, beats.length);
  assert.equal(same.index, 1, '表没变就停在原处');
  assert.equal(same.done, false);
});

test('v101 换人：开场空场、新人物从右侧入场、不再开口的人淡出', () => {
  // 第 0 段只有旁白 → 舞台空着
  const speakers = speakersBySegment([
    { kind: 'bg', backdrop: { id: 'night' } },
    { kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: '夜很深。', segment: 0 },
    { kind: 'say', speakerId: 'a', name: 'A', text: '……', segment: 1 },
    { kind: 'say', speakerId: 'b', name: 'B', text: '……', segment: 2 },
    { kind: 'say', speakerId: 'a', name: 'A', text: '……', segment: 2 },
    { kind: 'end' },
  ] as VnBeat[]);
  assert.equal(speakers.has(0), false, '只有旁白的段落不该有人上台');
  assert.deepEqual(speakers.get(1), ['a']);
  assert.deepEqual(speakers.get(2), ['b', 'a'], '按第一次开口的顺序');

  // 开场：从空场到 A 登场
  const first = stageAfter([], ['a']);
  assert.deepEqual(first, { ids: ['a'], entering: ['a'], leaving: [] });

  // 第二段 B 加入：只有 B 是新人，A 不动
  const second = stageAfter(first!.ids, ['a', 'b']);
  assert.deepEqual(second, { ids: ['a', 'b'], entering: ['b'], leaving: [] });

  // 第三段 A 不开口：A 淡出，只剩 B
  const third = stageAfter(second!.ids, ['b']);
  assert.deepEqual(third, { ids: ['b'], entering: [], leaving: ['a'] });

  // 同一批人再说一遍：不算换人
  assert.equal(stageAfter(third!.ids, ['b']), null);
});

test('v101 段号：交互剧情按轮、战斗札记按场打标记', () => {
  const turns = beatsFromTurns([
    { id: 't1', role: 'narrator', text: '雨下着。', lines: [{ speakerId: 'a', speakerName: 'A', text: '你来了。' }] },
    { id: 't2', role: 'player', text: '我点了灯。' },
    { id: 't3', role: 'narrator', text: '灯亮了。', lines: [{ speakerId: 'b', speakerName: 'B', text: '好久不见。' }] },
  ]);
  const segments = turns.filter(beat => beat.kind === 'say').map(beat => (beat as Extract<VnBeat, { kind: 'say' }>).segment);
  assert.deepEqual(segments, [0, 0, 1, 2, 2], '三轮各自一段');

  const note = beatsFromBattleNote([
    { id: 's1', title: '第一场', narration: '铁皮在响。', lines: [{ speakerSide: 'ally', speakerId: 'a', text: '别挡路。' }] },
    { id: 's2', title: '第二场', narration: '她退了半步。', lines: [] },
  ], [{ key: 'ally:a', id: 'a', name: 'A' }]);
  const noteSegments = note.filter(beat => beat.kind === 'say').map(beat => (beat as Extract<VnBeat, { kind: 'say' }>).segment);
  assert.deepEqual(noteSegments, [0, 0, 1], '按场号打标记');
});

test('v99 一整段旁白 + 末尾台词：按句子摊开后把台词插进去，不会全堆在最后', () => {
  const beats = beatsFromPassage({
    id: 'p10',
    narration: '夜雨敲在玻璃上。她把灯拧暗了一格。走廊尽头有人在等。门缝里透出一线光。',
    lines: [
      { speaker: '月见桃', text: '你来得比我说的晚。' },
      { speaker: '所长', text: '路上耽搁了。' },
    ],
    choices: [],
  });
  const says = beats.filter(beat => beat.kind === 'say') as Extract<VnBeat, { kind: 'say' }>[];
  const order = says.map(say => (say.speakerId === NARRATOR_ID ? '旁白' : say.name));
  assert.deepEqual(order, ['旁白', '月见桃', '旁白', '所长', '旁白'], '台词被夹在旁白块之间，最后仍落在旁白上');
});

test('v100 落点：只有第一句写了 after 时，其余不能全被挤到末尾', () => {
  // 4 段旁白、4 句台词：模型只给第一句写了 after=1，剩下 3 句没写
  const positions = placeLines([1, undefined, undefined, undefined], 4, 4);
  assert.ok(positions.filter(position => position >= 4).length <= 2, '不能一半以上挤在结尾');
  assert.equal(new Set(positions).size >= 3, true, '至少铺在三个空档里');
  assert.equal(positions[0], 1, '写了 after 的那句照它插');
});

test('v100 落点：after 超出段数（一对一整段旁白）时退回均匀铺开', () => {
  const positions = placeLines([0, 1, 2], 1, 4);
  assert.deepEqual(positions, [1, 2, 3], '一段旁白没有区分度，按均匀位置铺开');
});

test('v100 落点：模型老老实实写全了 after 就照它插', () => {
  assert.deepEqual(placeLines([0, 1, 2, 3], 4, 5), [0, 1, 3, 4]);
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
  // v99：这一轮里唯一的台词插在第一段旁白之后，而不是等旁白全说完
  assert.equal(says[1]!.name, '月见桃');
  assert.equal(says[1]!.expression, 'sad');
  assert.equal(says[2]!.speakerId, NARRATOR_ID);
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
  // v99：两句台词插进两段旁白之间，不是念完旁白再听台词
  assert.equal(says[1]!.name, '月见桃');
  assert.equal(says[1]!.expression, 'angry');
  assert.equal(says[2]!.speakerId, NARRATOR_ID, '找不到的说话人退成旁白');
});

test('v99 交织：after 决定这句台词插在第几段旁白之后', () => {
  const beats = beatsFromPassage({
    id: 'p9',
    narration: '第一段。\n\n第二段。\n\n第三段。',
    lines: [
      { speaker: '所长', text: '插在最前面。', after: 0 },
      { speaker: '月见桃', text: '插在第二段之后。', after: 2 },
    ],
    choices: [],
  });
  const says = beats.filter(beat => beat.kind === 'say') as Extract<VnBeat, { kind: 'say' }>[];
  assert.deepEqual(says.map(say => say.text), [
    '插在最前面。',
    '第一段。',
    '第二段。',
    '插在第二段之后。',
    '第三段。',
  ]);
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
