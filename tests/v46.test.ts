import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { blueprintIssues, buildGraphFromDraft, sanitizeGraph, validateGraph, type StoryGraphDraft } from '../src/storygraph.ts';
import { generateStoryBlueprint } from '../src/llm.ts';
import { items } from '../src/content/items.ts';
import { getItem } from '../src/content/items.ts';
import { tierOf } from '../src/items.ts';
import type { GameState, StoryGraph } from '../src/types.ts';

const endNode = (id: string, ending: string) => ({ id, kind: 'end' as const, data: { kind: 'end' as const, summary: '到这里收束。', ending } });

/** 走一遍「存蓝图 → 开场」，图会一路跑到停下来的地方。 */
function startWithGraph(graph: StoryGraph): GameState {
  const s = createInitialState();
  const girl = s.girls[0]!;
  girl.bond = 60;
  const saved = act(s, { type: 'setStoryPlan', girlId: girl.id, plan: { title: '一封信', premise: '她带着一封没有地址的信。', tone: '', beats: [], graph } });
  assert.equal(saved.ok, true);
  const ready = structuredClone(saved.state);
  ready.girls[0]!.bond = 60;
  const started = act(ready, { type: 'startStoryline', girlId: girl.id });
  assert.equal(started.ok, true, started.ok ? '' : started.message);
  return started.state;
}

test('v46 读档迁移：旧图里的场景节点就地变成强制弹窗，id、坐标与连线全部保留', () => {
  const raw = {
    entry: 'n1',
    nodes: [
      { id: 'n1', kind: 'start', x: 10, y: 20, title: '开始', data: { kind: 'start' } },
      {
        id: 'n2', kind: 'scene', x: 210, y: 80, title: '雨里',
        data: { kind: 'scene', narration: '门铃响了两下，她站在雨里。', lines: [{ speaker: '月见桃', text: '「我来了。」' }] },
      },
      { id: 'n3', kind: 'end', x: 410, y: 80, title: '门开着', data: { kind: 'end', summary: '她留下了。', ending: '留下' } },
    ],
    edges: [
      { id: 'e1', from: 'n1', fromPort: 'out', to: 'n2' },
      { id: 'e2', from: 'n2', fromPort: 'out', to: 'n3' },
    ],
  };
  const graph = sanitizeGraph(raw);
  assert.ok(graph);
  assert.equal(graph.nodes.length, 3, '节点数不能变');
  assert.equal(graph.nodes.some(node => node.kind === 'scene'), false, '不该再有场景节点');
  const migrated = graph.nodes.find(node => node.id === 'n2');
  assert.ok(migrated);
  assert.equal(migrated.kind, 'incident');
  assert.equal(migrated.title, '雨里');
  assert.equal(migrated.x, 210);
  assert.equal(migrated.y, 80);
  assert.ok(migrated.data.kind === 'incident');
  if (migrated.data.kind !== 'incident') return;
  assert.ok(migrated.data.spec.body.includes('门铃响了两下'), '旁白要留在正文里');
  assert.ok(migrated.data.spec.body.includes('我来了'), '台词也要留在正文里');
  assert.deepEqual(migrated.data.spec.options, [], '迁移出来的弹窗不带选项');
  assert.deepEqual(graph.edges.map(edge => [edge.from, edge.fromPort, edge.to]), [['n1', 'out', 'n2'], ['n2', 'out', 'n3']]);
  assert.ok(graph.nodes.some(node => node.id === 'n2'), '旧的 cursor 仍指向存在的节点');
});

test('v46 奖励清洗：旧 equipmentId 折算成阶级，effect.skill 被剥掉，其余字段保留', () => {
  const item = items.find(entry => entry.slot !== 'consumable' && tierOf(entry) === 3);
  assert.ok(item, '物品表里应该有三阶装备');
  const graph = sanitizeGraph({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      { id: 'n2', kind: 'reward', data: { kind: 'reward', effect: { bond: 2, skill: { id: 'sk-night', name: '夜灯' } }, equipmentId: item.id } },
      { id: 'n3', kind: 'end', data: { kind: 'end', summary: '完', ending: '留下' } },
    ],
    edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }],
  });
  assert.ok(graph);
  const reward = graph.nodes[1];
  assert.ok(reward.data.kind === 'reward');
  if (reward.data.kind !== 'reward') return;
  assert.equal(reward.data.equipmentTier, 3);
  assert.equal(reward.data.effect.skill, undefined, '蓝图奖励不再发技能');
  assert.equal(reward.data.effect.bond, 2);
});

test('v46 奖励按阶级发一件成品，同一张图每次跑到的都是同一件', () => {
  const graph = buildGraphFromDraft({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      { id: 'n2', kind: 'reward', title: '信的回声', data: { kind: 'reward', effect: { bond: 2 }, equipmentTier: 3 } },
      endNode('n3', '留下'),
    ],
    edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }],
  });
  const won = () => {
    const before = createInitialState().inventory;
    const state = startWithGraph(graph);
    const added = Object.entries(state.inventory)
      .filter(([id, count]) => (before[id] ?? 0) < count)
      .map(([id]) => id);
    return { state, added };
  };
  const first = won();
  assert.equal(first.added.length, 1, '只该发一件');
  const item = getItem(first.added[0]!);
  assert.ok(item);
  assert.equal(tierOf(item), 3);
  assert.notEqual(item.slot, 'consumable', '奖励不会给消耗品');
  assert.equal(first.state.storylines[0]!.status, 'done');
  assert.ok(first.state.logs.some(log => log.text.includes(item.name) && log.text.includes('阶装备')));

  const second = won();
  assert.deepEqual(second.added, first.added, '同一个种子必须抽到同一件');
});

test('v46 结构校验：没有事件也没有弹窗要报错，弹窗超过两个也要报错', () => {
  const bare = buildGraphFromDraft({
    nodes: [{ id: 'n1', kind: 'start', data: { kind: 'start' } }, endNode('n2', '留下')],
    edges: [{ from: 'n1', to: 'n2' }],
  });
  assert.ok(blueprintIssues(bare).some(issue => issue.message.includes('至少需要一个角色事件或强制弹窗')));

  const popup = (id: string) => ({ id, kind: 'incident' as const, data: { kind: 'incident' as const, spec: { kind: 'girl' as const, title: '叫住她', body: '她在门口停下。', options: [] } } });
  const crowded = buildGraphFromDraft({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      popup('n2'), popup('n3'), popup('n4'),
      endNode('n5', '留下'),
    ],
    edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }, { from: 'n3', to: 'n4' }, { from: 'n4', to: 'n5' }],
  });
  assert.ok(blueprintIssues(crowded).some(issue => issue.message.includes('强制弹窗最多 2 个')));
});

test('v46 端口校验：选择的每个选项必须且只能连一条线，语义化端口名要报错', () => {
  const draft = (): StoryGraphDraft => ({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      {
        id: 'n2', kind: 'choice', title: '门口',
        data: {
          kind: 'choice', prompt: '让她进来？',
          options: [
            { id: 'a', label: '让她进来', intent: '', effect: { bond: 2 } },
            { id: 'b', label: '先关门', intent: '', effect: { bond: -1 } },
          ],
        },
      },
      endNode('n3', '留下'), endNode('n4', '离开'),
    ],
    edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', fromPort: 'a', to: 'n3' }, { from: 'n2', fromPort: 'b', to: 'n4' }],
  });
  const healthy = buildGraphFromDraft(draft());
  assert.deepEqual(validateGraph(healthy).filter(issue => issue.level === 'error'), []);

  const missing = draft();
  missing.edges = missing.edges?.filter(edge => !(edge.from === 'n2' && edge.fromPort === 'a'));
  assert.ok(validateGraph(buildGraphFromDraft(missing)).some(issue => issue.message.includes('必须且只能连一条线')));

  const semantic = draft();
  semantic.edges = semantic.edges?.map(edge => (edge.from === 'n2' && edge.fromPort === 'b' ? { ...edge, fromPort: 'trust_calc' } : edge));
  const semanticIssues = validateGraph(buildGraphFromDraft(semantic)).map(issue => issue.message);
  assert.ok(semanticIssues.some(message => message.includes('无法识别的出口')));
  assert.ok(semanticIssues.some(message => message.includes('真实存在的出口')));
});

test('v46 弹窗端口：每个选项各一条同名边，没选项就必须一条 out', () => {
  const twoOptions = (edges: StoryGraphDraft['edges']): StoryGraph => buildGraphFromDraft({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      {
        id: 'n2', kind: 'incident', title: '门口的车',
        data: {
          kind: 'incident',
          spec: {
            kind: 'faction', title: '门口的车', body: '协会的车停在巷口，等一个答复。', faction: 'association',
            options: [
              { label: '答应', hint: '欠下人情', effect: { reputation: -2 } },
              { label: '拒绝', hint: '撕破脸', effect: { reputation: 2 } },
            ],
          },
        },
      },
      endNode('n3', '留下'), endNode('n4', '离开'), endNode('n5', '跟着走'),
    ],
    edges,
  });
  const ok = twoOptions([{ from: 'n1', to: 'n2' }, { from: 'n2', fromPort: 'o1', to: 'n3' }, { from: 'n2', fromPort: 'o2', to: 'n4' }]);
  assert.equal(blueprintIssues(ok).filter(issue => issue.level === 'error' && issue.message.includes('强制弹窗')).length, 0);

  const missing = twoOptions([{ from: 'n1', to: 'n2' }, { from: 'n2', fromPort: 'o1', to: 'n3' }]);
  assert.ok(blueprintIssues(missing).some(issue => issue.message.includes('必须且只能连一条线（fromPort="o2"）')));

  const bare = buildGraphFromDraft({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      { id: 'n2', kind: 'incident', data: { kind: 'incident', spec: { kind: 'girl', title: '知道了', body: '她点点头就走了。', options: [] } } },
      endNode('n3', '留下'),
    ],
    edges: [{ from: 'n1', to: 'n3' }],
  });
  assert.ok(blueprintIssues(bare).some(issue => issue.message.includes('只能有一条 fromPort="out" 的线')));
});

test('v46 提案端口：accept 与 reject 各一条，写 defer 就算错', () => {
  const opinionDraft = (edges: StoryGraphDraft['edges']): StoryGraphDraft => ({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      {
        id: 'n2', kind: 'opinion', title: '多留一盏灯',
        data: {
          kind: 'opinion',
          spec: {
            topic: '经费', title: '多留一盏灯', text: '她想给值夜的人多留一盏灯。', request: '把结余拨给灯油。',
            options: [
              { id: 'accept', label: '批准', effect: '灯亮着。' },
              { id: 'reject', label: '驳回', effect: '灯灭了。' },
            ],
          },
        },
      },
      endNode('n3', '留下'), endNode('n4', '离开'),
    ],
    edges,
  });
  const ok = buildGraphFromDraft(opinionDraft([{ from: 'n1', to: 'n2' }, { from: 'n2', fromPort: 'accept', to: 'n3' }, { from: 'n2', fromPort: 'reject', to: 'n4' }]));
  assert.equal(blueprintIssues(ok).filter(issue => issue.level === 'error' && issue.message.includes('议会提案')).length, 0);

  const missing = buildGraphFromDraft(opinionDraft([{ from: 'n1', to: 'n2' }, { from: 'n2', fromPort: 'accept', to: 'n3' }]));
  assert.ok(blueprintIssues(missing).some(issue => issue.message.includes('fromPort="reject"')));

  const deferred = buildGraphFromDraft(opinionDraft([
    { from: 'n1', to: 'n2' }, { from: 'n2', fromPort: 'accept', to: 'n3' },
    { from: 'n2', fromPort: 'reject', to: 'n4' }, { from: 'n2', fromPort: 'defer', to: 'n4' },
  ]));
  assert.ok(blueprintIssues(deferred).some(issue => issue.message.includes('出口只能是 accept 或 reject')));
});

test('v46 提案运行时：批准与驳回各走一条剧情线，暂缓原地不动', () => {
  const graph = buildGraphFromDraft({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      {
        id: 'n2', kind: 'opinion', title: '多留一盏灯',
        data: {
          kind: 'opinion',
          spec: {
            topic: '经费', title: '多留一盏灯', text: '她想给值夜的人多留一盏灯。', request: '把结余拨给灯油。',
            options: [
              { id: 'accept', label: '批准', effect: '灯亮着。' },
              { id: 'reject', label: '驳回', effect: '灯灭了。' },
            ],
          },
        },
      },
      endNode('n3', '留下'), endNode('n4', '离开'),
    ],
    edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', fromPort: 'accept', to: 'n3' }, { from: 'n2', fromPort: 'reject', to: 'n4' }],
  });

  const opened = startWithGraph(graph);
  const storyId = opened.storylines[0]!.id;
  const opinion = opened.opinions[0]!;
  assert.ok(opinion, '提案应摆到会客厅');
  assert.deepEqual(opinion.options.map(option => option.id), ['accept', 'defer', 'reject'], '暂缓由程序补在中间');
  assert.equal(opened.storylines[0]!.run?.waiting?.kind, 'opinion');

  const accepted = act(opened, { type: 'decideOpinion', opinionId: opinion.id, decision: 'accept' });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.storylines.find(story => story.id === storyId)?.ending, '留下');
  assert.equal(accepted.state.storylines.find(story => story.id === storyId)?.status, 'done');

  const rejected = act(opened, { type: 'decideOpinion', opinionId: opinion.id, decision: 'reject' });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.state.storylines.find(story => story.id === storyId)?.ending, '离开');

  const deferred = act(opened, { type: 'decideOpinion', opinionId: opinion.id, decision: 'defer' });
  assert.equal(deferred.ok, true);
  const stillOpen = deferred.state.storylines.find(story => story.id === storyId);
  assert.equal(stillOpen?.status, 'active', '暂缓不推进剧情');
  assert.equal(stillOpen?.run?.waiting?.kind, 'opinion');
  const held = deferred.state.opinions.find(item => item.id === opinion.id);
  assert.equal(held?.status, 'deferred');
  assert.equal(held?.revisitDay, deferred.state.day + 1);
});

test('v46 生成：模型写 scene 时静默转成弹窗，提示词里写明端口规则与自检', async () => {
  const girl = createInitialState().girls[0]!;
  const calls: Record<string, any>[] = [];
  const original = globalThis.fetch;
  const raw = {
    title: '雨里的蓝图', premise: '她带着一封没有地址的信。', tone: '克制',
    entry: 'n1',
    nodes: [
      { id: 'n1', kind: 'start', title: '开始', data: { kind: 'start' } },
      { id: 'n2', kind: 'scene', title: '门口', data: { kind: 'scene', narration: '门铃响了两下，她站在雨里。' } },
      { id: 'n8', kind: 'wait', title: '等一会', data: { kind: 'wait', days: 0, minutes: 30 } },
      {
        id: 'n3', kind: 'choice', title: '门口',
        data: {
          kind: 'choice', prompt: '让她进来？',
          options: [
            { id: 'a', label: '让她进来', intent: '', effect: { bond: 2 } },
            { id: 'b', label: '先关门', intent: '', effect: { bond: -1 } },
          ],
        },
      },
      {
        id: 'n4', kind: 'mission', title: '旧城区',
        data: { kind: 'mission', spec: { title: '送信', goal: '陪她把信送到旧城区。', work: 'investigation', difficulty: '常规' } },
      },
      { id: 'n5', kind: 'reward', title: '信的回声', data: { kind: 'reward', effect: { bond: 2 }, equipmentTier: 2 } },
      endNode('n6', '留下'), endNode('n7', '离开'),
    ],
    edges: [
      { from: 'n1', fromPort: 'out', to: 'n2' },
      { from: 'n2', fromPort: 'out', to: 'n8' },
      { from: 'n8', fromPort: 'out', to: 'n3' },
      { from: 'n3', fromPort: 'a', to: 'n4' },
      { from: 'n3', fromPort: 'b', to: 'n5' },
      { from: 'n4', fromPort: 'success', to: 'n6' },
      { from: 'n4', fromPort: 'failure', to: 'n7' },
      { from: 'n5', fromPort: 'out', to: 'n7' },
    ],
  };
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body ?? '{}')));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(raw) }, finish_reason: 'stop' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateStoryBlueprint({ endpoint: 'https://mock.test/v1', apiKey: 'k', model: 'mock' }, girl);
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    if (!result.ok) return;
    assert.equal(result.data.graph.nodes.some(node => node.kind === 'scene'), false);
    const converted = result.data.graph.nodes.find(node => node.id === 'n2');
    assert.equal(converted?.kind, 'incident');
    const text = JSON.stringify(calls[0]?.messages ?? []);
    assert.ok(text.includes('没有 scene 节点'));
    assert.ok(text.includes('提交前自检'));
    assert.ok(text.includes('trust_calc'), '反例端口名要写进初始提示词');
    assert.ok(text.includes('equipmentTier'));
    assert.ok(text.includes('accept') && text.includes('reject'));
  } finally { globalThis.fetch = original; }
});
