import test from 'node:test';
import assert from 'node:assert/strict';
import { splitInlineStory, storyWithLines } from '../src/storyInline.ts';
import { act, createInitialState } from '../src/game.ts';
import { arcTurnContract, arcOpeningContract, arcEndingContract, witchConfrontationContract } from '../src/promptSections.ts';
import { presetPrompts, shippedPresets } from '../src/presets.ts';
import type { CharacterEvent, GameState, StoryLine } from '../src/types.ts';

/** v258：台词写进正文，用 @名字[表情]： 标记；解析后仍还原成带 after 的 StoryLine。 */

const cast = [
  { id: 'g-a', name: '爱丽丝' },
  { id: 'g-b', name: '砂糖' },
];

test('v258 正文里的台词被拆出来，after 按旁白行数算', () => {
  const narration = [
    '她把伞收在门口，没有进来。',
    '',
    '走廊的灯闪了一下。',
    '',
    '@爱丽丝[calm]：今晚的委托，我不接。',
    '@砂糖：那我替她接。',
    '',
    '雨声盖住了后面的话。',
  ].join('\n');
  const parsed = splitInlineStory(narration, cast);
  assert.equal(parsed.inline, true);
  assert.equal(parsed.lines.length, 2);
  assert.equal(parsed.lines[0]!.speakerId, 'g-a');
  assert.equal(parsed.lines[0]!.expression, 'calm');
  assert.equal(parsed.lines[0]!.after, 2);
  assert.equal(parsed.lines[1]!.speakerId, 'g-b');
  assert.equal(parsed.lines[1]!.expression, 'calm', '表情缺省');
  assert.equal(parsed.lines[1]!.after, 2, '同一位置连续两句');
  assert.equal(parsed.text.includes('@爱丽丝'), false, '标记行从正文移除');
  assert.match(parsed.text, /雨声盖住了后面的话。/);
});

test('v258 表情可以用中文别名，越界回落到 calm', () => {
  const parsed = splitInlineStory('@爱丽丝[生气]：别碰它。\n\n@砂糖[乱写]：嗯。', cast);
  assert.equal(parsed.lines[0]!.expression, 'angry');
  assert.equal(parsed.lines[1]!.expression, 'calm');
});

test('v258 名字认不出时整行留成旁白，不丢字', () => {
  const parsed = splitInlineStory('@路人甲：谁在那里？', cast);
  assert.equal(parsed.inline, false);
  assert.equal(parsed.lines.length, 0);
  assert.match(parsed.text, /@路人甲：谁在那里？/);
});

test('v258 所长不写成台词：避免和玩家行动气泡重复', () => {
  const parsed = splitInlineStory('@所长：先听她说完。', cast);
  assert.equal(parsed.inline, false);
  assert.match(parsed.text, /@所长/);
});

test('v258 没有标记时不动正文，交由 JSON 的 lines 兜底', () => {
  const jsonLines: StoryLine[] = [{ speakerId: 'g-a', speakerName: '爱丽丝', expression: 'smile', text: '嗯。', after: 1 }];
  const merged = storyWithLines('她笑了一下，没有说话。', jsonLines, cast);
  assert.equal(merged.inline, false);
  assert.equal(merged.text, '她笑了一下，没有说话。');
  assert.equal(merged.lines, jsonLines);
});

test('v258 内联台词优先于 JSON 的 lines', () => {
  const jsonLines: StoryLine[] = [{ speakerId: 'g-a', speakerName: '爱丽丝', expression: 'smile', text: '旧台词', after: 0 }];
  const merged = storyWithLines('@砂糖[shy]：新台词。', jsonLines, cast);
  assert.equal(merged.inline, true);
  assert.equal(merged.lines.length, 1);
  assert.equal(merged.lines[0]!.text, '新台词。');
  assert.equal(merged.text, '');
});

test('v258 一轮最多八句，多出来的留成旁白', () => {
  const narration = Array.from({ length: 9 }, (_, index) => `@爱丽丝：第 ${index + 1} 句。`).join('\n');
  const parsed = splitInlineStory(narration, cast);
  assert.equal(parsed.lines.length, 8);
  assert.match(parsed.text, /第 9 句/);
});

const inlineState = (): { state: GameState; event: CharacterEvent } => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const girl = state.girls[0]!;
  const event = {
    id: 'ev-1', girlId: girl.id, title: '雨夜', hook: '她在门口。', scenes: [], stage: 0,
    status: 'active', day: state.day, source: 'template', badge: true, mode: 'session',
    cast: state.girls.slice(0, 2).map(item => item.id), opening: '', turns: [], sessionDone: false,
  } as CharacterEvent;
  state.events = [event, ...state.events];
  return { state, event };
};

test('v258 编辑内联轮次：写了标记就重新解析，只改旁白则保留台词', () => {
  const { state, event } = inlineState();
  const [a, b] = state.girls;
  const turnId = 'turn-n-1';
  const appended = act(state, {
    type: 'appendStoryTurn', eventId: event.id,
    turn: { id: turnId, role: 'narrator', text: '她站着没动。', lines: [], inline: true, at: 1 },
  });
  assert.equal(appended.ok, true, appended.message);

  const edited = act(appended.state, {
    type: 'editStoryTurn', eventId: event.id, turnId,
    text: `她终于抬头。\n\n@${a!.name}[sad]：你迟到了。`,
  });
  assert.equal(edited.ok, true, edited.message);
  const narrator = edited.state.events.find(item => item.id === event.id)!.turns![0]!;
  assert.equal(narrator.text, '她终于抬头。');
  assert.equal(narrator.lines!.length, 1);
  assert.equal(narrator.lines![0]!.speakerId, a!.id);
  assert.equal(narrator.lines![0]!.after, 1);

  const plain = act(edited.state, { type: 'editStoryTurn', eventId: event.id, turnId, text: '她终于抬起头，又低下去。' });
  assert.equal(plain.ok, true, plain.message);
  const kept = plain.state.events.find(item => item.id === event.id)!.turns![0]!;
  assert.equal(kept.lines!.length, 1, '只改旁白时台词保留');
  assert.equal(kept.text, '她终于抬起头，又低下去。');
  assert.equal(b!.name.length > 0, true);
});

test('v258 心声写法：（心想）标记成 thought', () => {
  const parsed = splitInlineStory('@爱丽丝[calm]（心想）：我不敢看她。\n\n@砂糖（心想）：她怕黑。', cast);
  assert.equal(parsed.lines.length, 2);
  assert.equal(parsed.lines[0]!.mode, 'thought');
  assert.equal(parsed.lines[0]!.expression, 'calm');
  assert.equal(parsed.lines[0]!.text, '我不敢看她。');
  assert.equal(parsed.lines[1]!.mode, 'thought', '不带表情也认');
  assert.equal(parsed.lines[1]!.expression, 'calm');
  assert.equal(parsed.text.includes('心想'), false, '标记行从正文移除');
});

test('v258 普通台词不会被误判成心声', () => {
  const parsed = splitInlineStory('@爱丽丝[sad]：我不想去。', cast);
  assert.equal(parsed.lines[0]!.mode, 'speech');
});

test('v258 四个契约都改成内联写法，不再教 after', () => {
  for (const contract of [arcTurnContract(), arcOpeningContract(), arcEndingContract(), witchConfrontationContract()]) {
    assert.match(contract, /@[^\s「]{1,12}\[表情\]/);
    assert.equal(contract.includes('after 必填'), false);
    assert.equal(contract.includes('"lines"'), false, 'JSON 形状不再出现 lines');
    assert.match(contract, /（心想）/, '要教心声写法');
  }
});

test('v258 出厂预设的四个契约与代码默认一致', () => {
  const map: Record<string, string> = {
    'arc:opening': arcOpeningContract(),
    'arc:turn': arcTurnContract(),
    'arc:ending': arcEndingContract(),
    'arc:witch': witchConfrontationContract(),
  };
  for (const preset of shippedPresets()) {
    const entries = presetPrompts(preset);
    for (const [id, expected] of Object.entries(map)) {
      const entry = entries.find(item => item.id === id);
      assert.ok(entry, `${preset.id} 缺少 ${id}`);
      assert.equal(entry!.content.trim(), expected.trim(), `${preset.id} 的 ${id} 没同步`);
    }
  }
});
