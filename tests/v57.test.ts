import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { resolveOpinionDialogue, opinionSpeakerOf } from '../src/opinions.ts';
import { factionRepresentativeOf } from '../src/factions.ts';
import type { Opinion } from '../src/types.ts';

function fixture() {
  const state = createInitialState();
  const author = state.girls[0]!;
  const assistant = state.girls[1]!;
  state.assistantId = assistant.id;
  author.expression = 'calm';
  assistant.expression = 'shy';
  const opinion: Opinion = {
    id: 'op_test', day: state.day, authorId: author.id, topic: '设施',
    title: '星轨推演法阵架设', text: '会客厅连变量测算仪轨都没有。', request: '批款布阵。',
    status: 'pending', options: [],
    dialogue: [
      { speakerId: author.id, speaker: author.name, text: '尽早立阵。', expression: 'calm' },
      { speakerId: assistant.id, speaker: assistant.name, text: '保洁阿姨要追杀我啦～', expression: 'smile' },
      { speakerId: author.id, speaker: author.name, text: '休要油腔滑调。', expression: 'angry' },
    ],
  };
  return { state, opinion, author, assistant };
}

test('v57 助手接话时，大立绘换成助手本人，用她那句的表情', () => {
  const { state, opinion, author, assistant } = fixture();
  const lines = resolveOpinionDialogue(state, opinion);
  const assistantLine = opinionSpeakerOf(state, opinion, lines[1]);
  assert.equal(assistantLine?.id, assistant.id, '这一句是助手说的');
  assert.equal(assistantLine?.name, assistant.name);
  assert.equal(assistantLine?.expression, 'smile', '用的必须是助手那句的 smile');
  // 旧行为：固定画提案人 + 这一句的表情 → 笑眯眯的符玄。
  assert.notEqual(assistantLine?.id, author.id, '不能把助手表情贴在提案人脸上');
});

test('v57 提案人自己那句用她自己的表情；没写表情就退回她本人的表情', () => {
  const { state, opinion, author } = fixture();
  const lines = resolveOpinionDialogue(state, opinion);
  assert.equal(opinionSpeakerOf(state, opinion, lines[0])?.expression, 'calm');
  assert.equal(opinionSpeakerOf(state, opinion, lines[2])?.expression, 'angry');
  const bare = { ...opinion, dialogue: [{ speakerId: author.id, speaker: author.name, text: '没有表情。' }] };
  const line = resolveOpinionDialogue(state, bare)[0];
  assert.equal(opinionSpeakerOf(state, bare, line)?.id, author.id);
  assert.equal(opinionSpeakerOf(state, bare, line)?.expression, 'calm', '缺表情时用她自己的 calm');
});

test('v57 解析不到的说话人：仍画提案人，但不借用别人的表情', () => {
  const { state, opinion, author } = fixture();
  const line = { speakerId: 'g_card_missing', speaker: '路人', text: '……', expression: 'angry' as const };
  const subject = opinionSpeakerOf(state, opinion, line);
  assert.equal(subject?.id, author.id);
  assert.equal(subject?.expression, 'calm', 'unknown 说话人的 angry 不能画到提案人脸上');
});

test('v57 对白讲完或没有对白时，画提案人，用她自己的表情', () => {
  const { state, opinion, author } = fixture();
  const subject = opinionSpeakerOf(state, opinion, undefined);
  assert.equal(subject?.id, author.id);
  assert.equal(subject?.expression, 'calm');
  const silent = { ...opinion, dialogue: undefined };
  assert.equal(opinionSpeakerOf(state, silent)?.id, author.id);
});

test('v57 代表提案：立绘退到该方代表，不再空着', () => {
  const state = createInitialState();
  const rep = factionRepresentativeOf(state, 'association');
  const opinion: Opinion = {
    id: 'op_leader', day: state.day, authorId: rep.id, authorKind: 'leader', authorFaction: 'association',
    topic: '城市', title: '协会通告', text: '名录需要重新登记。', request: '今晚交名单。', status: 'pending', options: [],
    dialogue: [{ speakerId: rep.id, speaker: rep.name, text: '按程序来。', expression: 'calm' }],
  };
  const subject = opinionSpeakerOf(state, opinion, resolveOpinionDialogue(state, opinion)[0]);
  assert.equal(subject?.id, rep.id);
  assert.equal(subject?.name, rep.name);
  assert.ok(subject?.color, '代表也要有颜色，立绘不至于全灰');
});
