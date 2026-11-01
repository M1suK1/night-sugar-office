import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { generateDialogue, generateWhisper, parseDialogueReply } from '../src/llm.ts';
import type { Message, MissionRun, WhisperJob } from '../src/types.ts';

test('v31 解析动作、表情与多条消息', () => {
  const lines = parseDialogueReply(JSON.stringify({
    lines: [
      { text: '「你回来了。」', action: '她把门让开。', expression: 'smile' },
      { text: '「外面很冷吧？」', expression: 'shy' },
      { text: '「先坐。」', action: '她推来一杯热水。', expression: 'calm' },
    ],
  }));
  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.action, '她把门让开。');
  assert.equal(lines[1]?.expression, 'shy');
  assert.equal(lines[2]?.text, '「先坐。」');
  const plain = parseDialogueReply('第一句\n第二句');
  assert.equal(plain.length, 2);
  assert.equal(plain[0]?.expression, 'calm');
  const bad = parseDialogueReply(JSON.stringify({ lines: [{ text: '……', expression: '不存在' }] }));
  assert.equal(bad[0]?.expression, 'calm');
});

test('v31 talk 一次写入多条并共享 burstId，字符串 reply 仍兼容', () => {
  const state = createInitialState();
  const girl = state.girls.find(entry => entry.id === 'yue')!;
  const result = act(state, {
    type: 'talk', girlId: girl.id, text: '今晚怎么样？',
    reply: { lines: [
      { text: '「还好。」', action: '她把外套挂好。', expression: 'calm' },
      { text: '「只是有点累。」', expression: 'sad' },
    ] },
  });
  assert.equal(result.ok, true, result.message);
  const messages = result.state.messages[girl.id] ?? [];
  const girls = messages.filter(message => message.role === 'girl');
  assert.equal(girls.length, 2);
  assert.equal(girls[0]?.action, '她把外套挂好。');
  assert.equal(girls[0]?.burstId, girls[1]?.burstId);
  assert.equal(girls[1]?.expression, 'sad');

  const legacy = act(state, { type: 'talk', girlId: girl.id, text: '在吗？', reply: '模型写下的回答。' });
  assert.equal((legacy.state.messages[girl.id] ?? []).at(-1)?.text, '模型写下的回答。');
});

test('v31 addWhisper 多条只涨一次未读', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const job: WhisperJob = { id: 'v31-job', girlId: girl.id, missionId: 'candy', day: state.day, outcome: 'victory', createdAt: Date.now() };
  state.whisperQueue = [job];
  const added = act(state, {
    type: 'addWhisper', jobId: job.id,
    lines: [
      { text: '所长。', action: '她把手机夹在肩头。', expression: 'calm' },
      { text: '今晚的糖我留了一颗。', expression: 'smile' },
    ],
  });
  assert.equal(added.ok, true, added.message);
  assert.equal(added.state.whisperUnread?.[girl.id], 1);
  const whispers = (added.state.messages[girl.id] ?? []).filter((message: Message) => message.whisper);
  assert.equal(whispers.length, 2);
  assert.equal(whispers[0]?.burstId, job.id);
});

test('v31 最近委托记忆按角色过滤并进入私语提示词', async () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const run: MissionRun = {
    id: 'run-old', missionId: 'old-mission', title: '旧城区的旧委托', work: 'combat', category: '战斗',
    day: state.day - 1, minutes: 1290, girlIds: [girl.id], outcome: 'victory', reward: 300,
  };
  state.missionRuns = [run];
  const job: WhisperJob = { id: 'v31-whisper', girlId: girl.id, missionId: 'candy', day: state.day, outcome: 'victory', createdAt: Date.now() };
  let body = '';
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    body = String(init?.body ?? '');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      lines: [
        { text: '所长，我回来了。', action: '她把门轻轻带上。', expression: 'calm' },
        { text: '今天也顺利。', expression: 'smile' },
      ],
    }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateWhisper({ provider: 'openai', endpoint: 'https://mock.local/v1', apiKey: 'k', model: 'm' }, state, job);
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[0]?.action, '她把门轻轻带上。');
    assert.ok(body.includes('旧城区的旧委托'), '最近委托要进入提示词');
    assert.ok(body.includes('最近参与'));
  } finally {
    globalThis.fetch = original;
  }
});

test('v31 对话 JSON 输出被拆成多条且保留动作', async () => {
  const state = createInitialState();
  const girl = state.girls.find(entry => entry.id === 'yue')!;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    lines: [
      { text: '「坐吧。」', action: '她把椅子拉开。', expression: 'smile' },
      { text: '「今晚想聊什么？」', expression: 'calm' },
    ],
  }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const result = await generateDialogue({ provider: 'openai', endpoint: 'https://mock.local/v1', apiKey: 'k', model: 'm' }, { girl, state, text: '晚上好。' });
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[1]?.text, '「今晚想聊什么？」');
    assert.equal(result.text.includes('坐吧'), true);
  } finally {
    globalThis.fetch = original;
  }
});
