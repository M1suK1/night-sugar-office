import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import type { GameState, Girl } from '../src/types.ts';
import { newsCastPool, newsSpeakerBrief } from '../src/cityNews.ts';
import { newsContract, SECTION_PROMPTS } from '../src/promptSections.ts';
import { requestSnapshot } from '../src/llm.ts';
import { builtinPresets, presetPrompts, upgradeStaleNewsPrompt } from '../src/presets.ts';

function stateWithGirl(): GameState {
  const base = createInitialState();
  const girl: Girl = {
    ...base.girls[0]!,
    id: 'g_test',
    name: '玛丽',
    title: '候选契约者',
    personality: '嘴上不饶人，遇到真事却先挡在前面。',
    appearance: '银发、洗旧的军绿外套',
    voice: { tone: '短句，先刺一句再解释', habits: ['啧'], samples: ['这不算什么。'] },
    bond: 32,
    corruption: 18,
  };
  return { ...base, girls: [girl], candidates: [girl], newsHostId: girl.id };
}

test('v177 新闻：台上的人带性格、说话方式与外形，不再只有 id 和头衔', () => {
  const state = stateWithGirl();
  const host = newsCastPool(state).find(person => person.id === 'g_test')!;
  const brief = newsSpeakerBrief(state, host);
  assert.match(brief, /性格：嘴上不饶人/);
  assert.match(brief, /说话方式：短句/);
  assert.match(brief, /外形：银发/);
  assert.match(brief, /对所长 32\/100/);
});

test('v177 新闻契约：要求按性格说话，禁止三个人一个腔调', () => {
  const contract = newsContract();
  assert.match(contract, /说话必须像她本人/);
  assert.match(contract, /不要写成汇报或通报/);
});

test('v177 新闻词条：默认提示词是访谈写法，不是电台短讯', () => {
  const entry = SECTION_PROMPTS.find(item => item.id === 'nw-brief')!;
  assert.match(entry.content, /深夜访谈节目/);
  assert.doesNotMatch(entry.content, /1–3 条，一条只讲一件事/);
});

test('v177 日志快照：记下这一次用的是哪份预设', () => {
  const snapshot = requestSnapshot(
    [{ role: 'system', content: '系统' }, { role: 'user', content: '用户' }],
    { temperature: 0.8 },
    ['系统', '用户'],
    undefined,
    '夜糖 · 访谈预设',
  );
  assert.equal(snapshot.preset, '夜糖 · 访谈预设');
});

test('v177 旧预设：只把【写法】那一段换成访谈，前面改过的字留着', () => {
  const base = builtinPresets()[0]!;
  const oldWriting = [
    '【写法】',
    '- 这是本地电台的播报，用第三人称：不要用「你」称呼所长。',
    '- 1–3 条，一条只讲一件事：势力动向、辖区污染、城市安定度、街头小事各挑着写。',
  ].join('\n');
  const prompts = presetPrompts(base).map(entry => entry.id === 'nw-brief'
    ? { ...entry, content: `【今晚的城市】\n{{night}}\n\n【写法】\n我自己的开场白\n${oldWriting}` }
    : entry);
  const [patched] = upgradeStaleNewsPrompt([{ ...base, id: 'preset-custom', builtin: false, prompts }]);
  const entry = presetPrompts(patched).find(item => item.id === 'nw-brief')!;
  assert.match(entry.content, /深夜访谈节目/);
  assert.doesNotMatch(entry.content, /这是本地电台的播报/);
  assert.match(entry.content, /【今晚的城市】/);
});

