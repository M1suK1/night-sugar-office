import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeGraph, sanitizeIncidentPayload } from '../src/storygraph.ts';

test('v68 追加弹窗的洗白：标题与正文缺一不可', () => {
  assert.equal(sanitizeIncidentPayload({ body: '只有正文，没有标题的卡不应该进存档。' }), undefined);
  assert.equal(sanitizeIncidentPayload({ title: '只有标题' }), undefined);
  assert.equal(sanitizeIncidentPayload(null), undefined);
  const ok = sanitizeIncidentPayload({ title: '桥头封锁线', body: '市役所把桥头封了半条，检疫官挨个查契约书，队伍排到河堤下。' });
  assert.ok(ok);
  assert.equal(ok!.kind, 'faction');
  assert.equal(ok!.ttlMinutes, 240);
  assert.equal(ok!.blocking, true);
  assert.equal(ok!.trigger, undefined, '不写 trigger 就是立刻上桌');
});

test('v68 追加弹窗也认触发时机与超时，幅度夹住', () => {
  const dayStart = sanitizeIncidentPayload({ title: '晨会通知', body: '协会要求今晚交一份新名录，缺一份就少一份配额。', trigger: 'dayStart', ttlMinutes: 9999, blocking: false });
  assert.deepEqual(dayStart?.trigger, { kind: 'dayStart' });
  assert.equal(dayStart?.ttlMinutes, 480);
  assert.equal(dayStart?.blocking, false);
  const wave = sanitizeIncidentPayload({ title: '夜里敲门', body: '有人在打烊前敲了三次窗，说是有东西要当面交给所长。', trigger: 'wave', wave: 9 });
  assert.deepEqual(wave?.trigger, { kind: 'wave', wave: 2 }, 'wave 夹在 0–2');
  const early = sanitizeIncidentPayload({ title: '太短的超时', body: '这张卡的超时被写成了 5 分钟，应该夹到 30。', ttlMinutes: 5 });
  assert.equal(early?.ttlMinutes, 30);
});

test('v68 追加弹窗的选项最多三条，id 固定 o1–o3', () => {
  const payload = sanitizeIncidentPayload({
    title: '四选一', body: '一张卡给了四个选项，只应该收前三个，剩下的丢掉。',
    options: [{ label: '一' }, { label: '二' }, { label: '三' }, { label: '四' }],
  });
  assert.equal(payload?.options.length, 3);
  assert.deepEqual(payload?.options.map(option => option.id), ['o1', 'o2', 'o3']);
  assert.equal(payload?.options[0]?.label, '一');
});

test('v68 委托节点上的 followUpIncident 会被洗成合法弹窗', () => {
  const graph = sanitizeGraph({
    id: 'g2', title: '追加弹窗蓝图', premise: '前提', tone: '克制',
    nodes: [
      { id: 'n1', kind: 'start', x: 0, y: 0, title: '开场', data: { kind: 'start' } },
      {
        id: 'n2', kind: 'mission', x: 200, y: 0, title: '她的委托',
        data: { kind: 'mission', spec: {
          title: '旧钟楼的未寄信', goal: '把信送回它该去的地方', work: 'investigation', difficulty: '常规',
          followUpIncident: { kind: 'girl', title: '信写给了谁', body: '她读完那封信，发现自己认识收信人，手一直在抖。', trigger: 'immediate', ttlMinutes: 120, blocking: true, options: [{ label: '让她说完', hint: '听下去', effect: { bond: 2 } }] },
        } },
      },
      { id: 'n3', kind: 'end', x: 400, y: 0, title: '收束', data: { kind: 'end', summary: '结束', ending: '收束' } },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', fromPort: 'out' },
      { id: 'e2', from: 'n2', to: 'n3', fromPort: 'success' },
    ],
  });
  assert.ok(graph, '这张图应当能洗干净');
  const mission = graph!.nodes.find(node => node.id === 'n2')!;
  const spec = mission.data.kind === 'mission' ? mission.data.spec : undefined;
  const followUp = spec?.followUpIncident;
  assert.ok(followUp, '追加弹窗应当留下来');
  assert.equal(followUp!.kind, 'girl');
  assert.equal(followUp!.ttlMinutes, 120);
  assert.equal(followUp!.blocking, true);
  assert.equal(followUp!.options[0]?.id, 'o1');
});

test('v68 缺标题的追加弹窗会被整张丢掉，不影响蓝图其它部分', () => {
  const graph = sanitizeGraph({
    id: 'g3', title: '坏弹窗', premise: '前提', tone: '克制',
    nodes: [
      { id: 'n1', kind: 'start', x: 0, y: 0, title: '开场', data: { kind: 'start' } },
      { id: 'n2', kind: 'mission', x: 200, y: 0, title: '委托', data: { kind: 'mission', spec: { title: '没有后续弹窗的委托', goal: '目标', work: 'combat', difficulty: '常规', followUpIncident: { body: '只有正文。' } } } },
      { id: 'n3', kind: 'end', x: 400, y: 0, title: '收束', data: { kind: 'end', summary: '结束', ending: '收束' } },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', fromPort: 'out' },
      { id: 'e2', from: 'n2', to: 'n3', fromPort: 'success' },
    ],
  });
  const mission = graph?.nodes.find(node => node.id === 'n2');
  const spec = mission && mission.data.kind === 'mission' ? mission.data.spec : undefined;
  assert.equal(spec?.followUpIncident, undefined);
  assert.ok(graph, '蓝图本身照旧有效');
});
