import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState, STORY_SESSION_TURNS } from '../src/game.ts';
import { sanitizeGraph } from '../src/storygraph.ts';
import { generateStoryOpening, generateStoryTurn } from '../src/llm.ts';
import type { CharacterEvent, GameState, StoryTurn } from '../src/types.ts';

const session = (state: GameState, patch: Partial<CharacterEvent> = {}): { state: GameState; id: string; girlId: string } => {
  const girlId = state.girls[0]!.id;
  const event: CharacterEvent = {
    id: 'ev-story-1', girlId, title: '雨里的访客', hook: '她在门口站了很久。',
    scenes: [], stage: 0, status: 'active', day: state.day, source: 'llm', badge: true,
    mode: 'session', cast: [girlId], opening: '她把伞收起来，雨水顺着伞骨滴在地板上。', turns: [],
    ...patch,
  };
  const next: GameState = { ...state, events: [event, ...state.events] };
  return { state: next, id: event.id, girlId };
};

const playerTurn = (id: string, text: string): StoryTurn => ({ id, role: 'player', text });
const narratorTurn = (id: string, text: string): StoryTurn => ({ id, role: 'narrator', text, lines: [], options: ['你坐下'] });
const eventOf = (state: GameState, id: string) => state.events.find(item => item.id === id)!;

test('v34 交互剧情从开场白开始，写入第一轮旁白并标记已读', () => {
  const { state, id, girlId } = session(createInitialState());
  const result = act(state, { type: 'startStorySession', eventId: id, cast: [girlId], opening: '开场白正文', options: ['你坐下', '你问她', '你离开', '多余的一条'] } as never);
  assert.equal(result.ok, true);
  const event = eventOf(result.state, id);
  assert.equal(event.mode, 'session');
  assert.equal(event.status, 'active');
  assert.equal(event.opening, '开场白正文');
  assert.equal(event.turns?.length, 1);
  assert.equal(event.turns?.[0]?.role, 'narrator');
  assert.equal(event.turns?.[0]?.text, '开场白正文');
  assert.deepEqual(event.turns?.[0]?.options, ['你坐下', '你问她', '你离开'], '开场白同样给三条参考行动');
  assert.equal(result.state.girls.find(girl => girl.id === girlId)?.eventBadge, '!');
});

test('v34 追加回合记录玩家与旁白，超过 12 轮就要求先结束', () => {
  const { state, id } = session(createInitialState(), { turns: [narratorTurn('t0', '开场')] });
  const first = act(state, { type: 'appendStoryTurn', eventId: id, turn: playerTurn('t1', '我在。') });
  assert.equal(first.ok, true);
  const second = act(first.state, { type: 'appendStoryTurn', eventId: id, turn: narratorTurn('t2', '她抬眼。') });
  assert.equal(second.ok, true);
  assert.deepEqual(eventOf(second.state, id).turns?.map(turn => turn.id), ['t0', 't1', 't2']);

  const full: StoryTurn[] = [narratorTurn('n0', '开场')];
  for (let index = 0; index < STORY_SESSION_TURNS; index += 1) full.push(playerTurn(`p${index}`, `第 ${index} 轮`));
  const { state: crowded, id: crowdedId } = session(createInitialState(), { turns: full });
  const blocked = act(crowded, { type: 'appendStoryTurn', eventId: crowdedId, turn: playerTurn('extra', '再来一轮') });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message ?? '', /12 轮/);
});

test('v104 手动改文本：只动文本、不动轮次；玩家那一轮的台词一起改', () => {
  const turns: StoryTurn[] = [
    narratorTurn('t0', '开场'),
    { id: 't1', role: 'player', text: '我在。', lines: [{ speakerId: 'player', speakerName: '所长', expression: 'calm', text: '我在。' }] },
    narratorTurn('t2', '她抬眼。'),
  ];
  const { state, id } = session(createInitialState(), { turns });

  const editedPlayer = act(state, { type: 'editStoryTurn', eventId: id, turnId: 't1', text: '我把伞靠在门边。' });
  assert.equal(editedPlayer.ok, true);
  const player = eventOf(editedPlayer.state, id).turns?.find(item => item.id === 't1');
  assert.equal(player?.text, '我把伞靠在门边。');
  assert.equal(player?.lines?.[0]?.text, '我把伞靠在门边。', '台词与正文是同一句，一起改掉');
  assert.equal(player?.edited, 1);
  assert.equal(eventOf(editedPlayer.state, id).turns?.length, 3, '改文本不会新增回合');

  const editedNarration = act(editedPlayer.state, { type: 'editStoryTurn', eventId: id, turnId: 't2', text: '她抬眼，先看伞柄。' });
  assert.equal(editedNarration.ok, true);
  assert.equal(eventOf(editedNarration.state, id).turns?.find(item => item.id === 't2')?.text, '她抬眼，先看伞柄。');

  const empty = act(state, { type: 'editStoryTurn', eventId: id, turnId: 't1', text: '   ' });
  assert.equal(empty.ok, false, '空文本要被挡住，删就用删的');
  assert.match(empty.message ?? '', /空/);
});

test('v104 删掉自己说的话：只能删 player 轮，旁白不能删', () => {
  const turns: StoryTurn[] = [narratorTurn('t0', '开场'), playerTurn('t1', '我在。'), narratorTurn('t2', '她抬眼。')];
  const { state, id } = session(createInitialState(), { turns });
  const deleted = act(state, { type: 'deleteStoryTurn', eventId: id, turnId: 't1' });
  assert.equal(deleted.ok, true);
  assert.deepEqual(eventOf(deleted.state, id).turns?.map(turn => turn.id), ['t0', 't2']);

  const rejected = act(state, { type: 'deleteStoryTurn', eventId: id, turnId: 't2' });
  assert.equal(rejected.ok, false);
  assert.match(rejected.message ?? '', /自己/);
});

test('v108 轮次上限只拦新的一句，叙事者对最后一句的回应不会被丢掉', () => {
  const full: StoryTurn[] = [narratorTurn('n0', '开场')];
  for (let index = 0; index < STORY_SESSION_TURNS; index += 1) full.push(playerTurn(`p${index}`, `第 ${index} 轮`));
  const { state, id } = session(createInitialState(), { turns: full });

  // 已经满 12 轮：新的玩家回合仍然被挡住
  const blocked = act(state, { type: 'appendStoryTurn', eventId: id, turn: playerTurn('extra', '再来一轮') });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message ?? '', /12 轮/);

  // 但叙事者对已有那些回合的回应必须能写进去（以前这里被同一条守卫吞掉，
  // 表现就是引擎显示生成成功、界面里却什么都不出现）
  const reply = act(state, { type: 'appendStoryTurn', eventId: id, turn: narratorTurn('n-last', '她抬眼看你。') });
  assert.equal(reply.ok, true, '旁白不受轮次上限限制');
  assert.equal(eventOf(reply.state, id).turns?.at(-1)?.id, 'n-last');
});

test('v34 单段重写只换旁白，并累加重写次数', () => {
  const turns: StoryTurn[] = [narratorTurn('t0', '开场'), playerTurn('t1', '我在。'), narratorTurn('t2', '她抬眼。')];
  const { state, id } = session(createInitialState(), { turns });
  const rewritten = act(state, { type: 'replaceStoryTurn', eventId: id, turnId: 't2', turn: { ...narratorTurn('t2', '她慢慢抬起眼，先看伞柄，再看你。'), } });
  assert.equal(rewritten.ok, true);
  const turn = eventOf(rewritten.state, id).turns?.find(item => item.id === 't2');
  assert.equal(turn?.text, '她慢慢抬起眼，先看伞柄，再看你。');
  assert.equal(turn?.rewrites, 1);
  assert.equal(eventOf(rewritten.state, id).turns?.length, 3, '重写不会新增回合');

  const rejected = act(rewritten.state, { type: 'replaceStoryTurn', eventId: id, turnId: 't1', turn: narratorTurn('t1', '不该改玩家') });
  assert.equal(rejected.ok, false);
  assert.match(rejected.message ?? '', /旁白/);
});

test('v34 只有结束按钮才收束事件，并按轮数结算羁绊', () => {
  const turns: StoryTurn[] = [narratorTurn('t0', '开场')];
  for (let index = 1; index <= 5; index += 1) { turns.push(playerTurn(`p${index}`, '你说话')); turns.push(narratorTurn(`n${index}`, '她应答')); }
  const { state, id, girlId } = session(createInitialState(), { turns });
  const before = state.girls.find(girl => girl.id === girlId)!.bond;
  const result = act(state, { type: 'finishStorySession', eventId: id });
  assert.equal(result.ok, true);
  const event = eventOf(result.state, id);
  assert.equal(event.status, 'done');
  assert.equal(event.sessionDone, true);
  const after = result.state.girls.find(girl => girl.id === girlId)!.bond;
  assert.equal(after, Math.min(100, before + 4), '5 轮 × 0.8 = 4 点羁绊');
  assert.equal(result.state.logs[0]?.text.includes('雨里的访客'), true);
  const again = act(result.state, { type: 'finishStorySession', eventId: id });
  assert.equal(again.ok, false, '重复结束会被拒');
});

test('v34 蓝图事件节点保留参与角色与开场白，超限会截断', () => {
  const graph = sanitizeGraph({
    entry: 'n1',
    nodes: [
      { id: 'n1', kind: 'start', x: 0, y: 0, data: { kind: 'start', title: '开始' } },
      {
        id: 'n2', kind: 'event', x: 200, y: 0,
        data: { kind: 'event', title: '雨里的访客', hook: '她在门口站了很久。', cast: ['g1', 'g2', 'g3', 'g4'], opening: '雨'.repeat(900) },
      },
    ],
    edges: [{ from: 'n1', fromPort: 'out', to: 'n2' }],
  });
  assert.ok(graph);
  const node = graph!.nodes.find(item => item.id === 'n2')!;
  assert.equal(node.data.kind, 'event');
  const data = node.data as Extract<typeof node.data, { kind: 'event' }>;
  assert.deepEqual(data.cast, ['g1', 'g2', 'g3'], '最多 3 位参与角色');
  assert.equal(data.opening.length, 600, '开场白上限 600 字');
});

test('v34 开场白自己也给参考行动，并拦掉不在场的人', async () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const { state: withEvent, id } = session(state, { cast: [girl.id], turns: [] });
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      narration: '雨'.repeat(320),
      lines: [{ speakerId: 'nobody', text: '不该出现' }, { speakerId: girl.id, expression: 'calm', text: '你来了。' }],
      options: ['你把伞放下', '你问她等了多久', '你先开口道歉', '第四条'],
    }) } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const result = await generateStoryOpening({ endpoint: 'https://mock.test/v1/chat/completions', apiKey: 'k', model: 'mock' }, withEvent, eventOf(withEvent, id));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.lines.map(line => line.speakerId), [girl.id]);
    assert.deepEqual(result.options, ['你把伞放下', '你问她等了多久', '你先开口道歉']);
    assert.equal(result.narration.length, 320);
  } finally {
    globalThis.fetch = original;
  }
});

test('v34 续写只让在场的人说话，旁白截到 3000 字，选项最多 3 条', async () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const { state: withEvent, id } = session(state, { cast: [girl.id], turns: [narratorTurn('t0', '开场')] });
  const event = eventOf(withEvent, id);
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      narration: '她'.repeat(3200),
      lines: [
        { speakerId: girl.id, expression: 'shy', text: '你回来了。', mode: 'speech' },
        { speakerId: 'ghost', expression: 'angry', text: '不该出现的人' },
        { speakerId: 'player', expression: 'calm', text: '我回来了。' },
      ],
      options: ['你坐下', '你问她今天怎么样', '你转身离开', '第四条不该留下'],
      bond: 5,
    }) } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const result = await generateStoryTurn({ endpoint: 'https://mock.test/v1/chat/completions', apiKey: 'k', model: 'mock' }, withEvent, event, '我推门进去。');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // v106：正文上限只是防存档爆掉（12000 字），3200 字的旁白不再被切。
    assert.equal(result.turn.narration.length, 3200);
    assert.deepEqual(result.turn.lines.map(line => line.speakerId), [girl.id], 'player 的台词会被丢掉，避免与行动气泡重复');
    assert.equal(result.turn.lines[0]?.expression, 'shy');
    assert.equal(result.turn.options.length, 3);
    assert.equal(result.turn.bond, 2, '羁绊只取 -2..2');
  } finally {
    globalThis.fetch = original;
  }
});
