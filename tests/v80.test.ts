import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { dossierOf } from '../src/girlDossier.ts';
import { sanitizeVoice, voiceLine, voiceSummary } from '../src/voice.ts';

test('v80 语料收口：长度、条数、去重，全空当作没有语料', () => {
  assert.equal(sanitizeVoice(null), undefined);
  assert.equal(sanitizeVoice({ tone: '  ', habits: [], samples: [] }), undefined);
  const cleaned = sanitizeVoice({
    tone: '短句，先反问再回答'.repeat(5),
    habits: ['自称「我」', '自称「我」', '答不上来就沉默两秒', '第四条该被丢掉', '第五条也该被丢掉'],
    samples: ['这条街我走了十年。', '这条街我走了十年。', '别问了。', '第四句多余', '第五句多余'],
  })!;
  assert.equal(cleaned.tone.length, 45, 'tone 上限 60 字：45 字的原句完整保留');
  const longHabit = sanitizeVoice({ habits: ['习惯先质问对方的站位是否端正对称，极认真时会把手指并起来比划'] })!;
  assert.equal(longHabit.habits[0]!.length, 30, '一条习惯可以是一整句话，不再被 18 字砍断');
  assert.deepEqual(cleaned.habits, ['自称「我」', '答不上来就沉默两秒', '第四条该被丢掉']);
  assert.equal(cleaned.samples.length, 3);
  assert.equal(cleaned.samples[0], '这条街我走了十年。');
});

test('v80 voiceLine：空语料是空串，非空按固定顺序拼', () => {
  assert.equal(voiceLine({}), '');
  assert.equal(voiceLine({ voice: { tone: '', habits: [], samples: [] } }), '');
  const line = voiceLine({ voice: { tone: '短句，先反问', habits: ['自称「我」'], samples: ['别问了。'] } });
  assert.equal(line, '说话方式：短句，先反问；口头习惯：自称「我」；例话：「别问了。」');
});

test('v80 档案与动作：写进语料，简报里能看见', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const tone = act(state, { type: 'setProfileText', girlId: girl.id, field: 'voiceTone', text: '短句，先反问再回答' });
  assert.equal(tone.ok, true, tone.message);
  const habits = act(tone.state, { type: 'setProfileText', girlId: girl.id, field: 'voiceHabits', text: '自称「我」\n答不上来就沉默两秒' });
  const samples = act(habits.state, { type: 'setProfileText', girlId: girl.id, field: 'voiceSamples', text: '别问了。' });
  const saved = samples.state.girls.find(entry => entry.id === girl.id)!;
  assert.deepEqual(saved.voice?.habits, ['自称「我」', '答不上来就沉默两秒']);
  assert.equal(voiceSummary(saved), '短句，先反问再回答');
  const brief = dossierOf(saved, samples.state, { brief: true });
  assert.ok(brief.includes('说话方式：短句，先反问再回答'), brief);
  assert.ok(brief.includes('例话：「别问了。」'), brief);

  const cleared = act(samples.state, { type: 'setProfileText', girlId: girl.id, field: 'voiceSamples', text: '' });
  assert.equal(cleared.state.girls.find(entry => entry.id === girl.id)!.voice?.samples.length, 0);
  assert.equal(voiceLine({ voice: cleared.state.girls.find(entry => entry.id === girl.id)!.voice }), '说话方式：短句，先反问再回答；口头习惯：自称「我」、答不上来就沉默两秒');
});
