import test from 'node:test';
import assert from 'node:assert/strict';
import { composeTaskSystem, loadPresets, presetRuntime, savePresets, type ChatPreset } from '../src/presets.ts';
import { contractPrompts } from '../src/promptContracts.ts';
import { describeVertexCredential } from '../src/vertex.ts';
import { arcEndingContract, arcOpeningContract, arcTurnContract, stripContractBlocks, storylineStartContract } from '../src/promptSections.ts';

/** 契约词条就住在预设的 prompts 里（带 contract: true），这里按同一形状造一个。 */
const preset = (contracts: { id: string; content: string; defaultContent?: string }[]): ChatPreset => ({
  id: 'p1', name: '测试', builtin: false, settings: {}, regex: [],
  prompts: contracts.map(entry => ({
    id: entry.id,
    name: entry.id,
    content: entry.content,
    defaultContent: entry.defaultContent ?? entry.content,
    role: 'system' as const,
    enabled: true,
    contract: true,
    scope: contractPrompts().find(item => item.id === entry.id)?.scope ?? 'shared',
  })),
}) as unknown as ChatPreset;

test('v131 剧情续写与开场的契约都作为词条暴露出来', () => {
  const ids = contractPrompts().map(entry => entry.id);
  assert.ok(ids.includes('arc:turn'), '剧情续写要在预设里能改');
  assert.ok(ids.includes('arc:opening'), '剧情开场要在预设里能改');
  assert.ok(ids.includes('storyline:start'), '故事线起点的 4 幕契约不能再写死在代码里');
  assert.ok(ids.includes('storyline:contract'), '蓝图契约保留');
  const turn = contractPrompts().find(entry => entry.id === 'arc:turn')!;
  assert.equal(turn.content, arcTurnContract());
  assert.equal(turn.scope, 'arc');
});

test('v131 改了剧情续写契约就会盖住代码默认值，没改就用默认', () => {
  const edited = '【我的写法】只输出 JSON，narration 至少 800 字。';
  const runtime = presetRuntime(preset([{ id: 'arc:turn', content: edited, defaultContent: arcTurnContract() }]));
  const custom = composeTaskSystem(arcTurnContract(), runtime, 'arc', {}, {}, 'arc:turn');
  assert.ok(custom.system.includes('【我的写法】'), '玩家的版本要生效');
  assert.ok(!custom.system.includes('before 必填'), '默认契约要被替换掉');

  const untouched = presetRuntime(preset([{ id: 'arc:turn', content: arcTurnContract(), defaultContent: arcTurnContract() }]));
  const fallback = composeTaskSystem(arcTurnContract(), untouched, 'arc', {}, {}, 'arc:turn');
  assert.ok(fallback.system.includes('【JSON 形状】'), '没改过就按代码默认值走');
});

test('v131 三个剧情契约互不串味', () => {
  const runtime = presetRuntime(preset([
    { id: 'arc:opening', content: '【开场特别版】', defaultContent: arcOpeningContract() },
    { id: 'arc:turn', content: '【续写特别版】', defaultContent: arcTurnContract() },
    { id: 'storyline:start', content: '【起点特别版】', defaultContent: storylineStartContract() },
  ]));
  assert.ok(composeTaskSystem(arcOpeningContract(), runtime, 'arc', {}, {}, 'arc:opening').system.includes('【开场特别版】'));
  assert.ok(composeTaskSystem(arcTurnContract(), runtime, 'arc', {}, {}, 'arc:turn').system.includes('【续写特别版】'));
  assert.ok(composeTaskSystem(storylineStartContract(), runtime, 'storyline', {}, {}, 'storyline:start').system.includes('【起点特别版】'));
  const blueprint = composeTaskSystem('【蓝图默认】', runtime, 'storyline', {}, {}, 'storyline:contract');
  assert.ok(blueprint.system.includes('【蓝图默认】'), '蓝图契约没被改过就该用代码默认值');
});

/** 旧预设里的契约丢了 contract 标记：它会退化成正文字段，跟着正文一起拼进提示词。 */
const legacyPreset = (texts: { id: string; content: string }[]): ChatPreset => ({
  id: 'legacy', name: '旧预设', builtin: false, settings: {}, regex: [],
  prompts: texts.map(entry => ({
    id: entry.id, name: entry.id, content: entry.content, role: 'system' as const, enabled: true, scope: 'arc' as const,
  })),
}) as unknown as ChatPreset;

test('v103 一次请求只留一份【JSON 形状】：续写只用续写要求，收尾只用收尾要求', () => {
  const runtime = presetRuntime(legacyPreset([
    { id: 'old-turn', content: arcTurnContract() },
    { id: 'old-ending', content: arcEndingContract() },
  ]));
  const turn = composeTaskSystem(arcTurnContract(), runtime, 'arc', {}, {}, 'arc:turn');
  assert.equal(turn.system.split('【JSON 形状】').length - 1, 1, '正文里的旧契约块要剔掉');
  assert.ok(turn.system.trim().endsWith(arcTurnContract().trim()));
  assert.ok(turn.system.includes('narration 900–3000 字'));
  assert.equal(turn.system.includes('这一轮是**收尾**'), false, '续写不该带收尾契约');

  const ending = composeTaskSystem(arcEndingContract(), runtime, 'arc', {}, {}, 'arc:ending');
  assert.equal(ending.system.split('【JSON 形状】').length - 1, 1);
  assert.ok(ending.system.includes('narration 400–900 字'));
  assert.ok(ending.system.trim().endsWith(arcEndingContract().trim()));
});

test('v104 预设专用凭证不会被 400 字截断（服务账号 JSON 有两千多字）', () => {
  const privateKey = '-----BEGIN PRIVATE KEY-----' + 'A'.repeat(1800) + '-----END PRIVATE KEY-----';
  const serviceAccount = JSON.stringify({
    type: 'service_account',
    project_id: 'gen-lang-client-0452877835',
    client_email: 've-123@gen-lang-client-0452877835.iam.gserviceaccount.com',
    private_key: privateKey,
  });
  assert.ok(serviceAccount.length > 2000, '服务账号 JSON 本来就很长');

  const store = new Map<string, string>();
  const globals = globalThis as { localStorage?: unknown };
  const previous = globals.localStorage;
  globals.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
  };
  try {
    const longPreset: ChatPreset = { ...preset([]), id: 'p-long', api: { provider: 'vertex', apiKey: serviceAccount } };
    savePresets([longPreset]);
    const loaded = loadPresets().find(item => item.id === 'p-long');
    assert.ok(loaded, '预设要能读回来');
    assert.equal(loaded?.api?.apiKey, serviceAccount, '读回来必须逐字等于导入的那份 JSON');
    assert.equal(describeVertexCredential(loaded?.api?.apiKey ?? '').kind, 'service-account');
  } finally {
    globals.localStorage = previous;
  }
});

test('v103 stripContractBlocks 只删契约段，正文原样留着', () => {
  const text = ['【世界观】夜之街。', '【JSON 形状】只输出一个 JSON 对象\n{"a":1}\nnarration 900–3000 字。', '她站在门口。'].join('\n\n');
  const stripped = stripContractBlocks(text);
  assert.ok(stripped.includes('【世界观】夜之街。'));
  assert.ok(stripped.includes('她站在门口。'));
  assert.equal(stripped.includes('【JSON 形状】'), false);
  assert.equal(stripContractBlocks('没有契约的正文'), '没有契约的正文');
});
