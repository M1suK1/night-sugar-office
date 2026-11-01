import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState, previewFactionTask } from '../src/game.ts';
import { factionRepresentativeOf } from '../src/factions.ts';
import { applyPresetApi, buildApiUrl, apiHeaders, generateWhisper } from '../src/llm.ts';
import { battleStoryDigest, validateBattleNoteDraft } from '../src/battleNote.ts';
import { buildGirlCard, girlCardHash } from '../src/cards.ts';
import type { GameState, Opinion, WhisperJob } from '../src/types.ts';

function withLeader(state: GameState) {
  const base = state.customFactionLeaders?.[0] ?? {
    id: 'custom-leader-v29', faction: 'witch' as const, name: '玩家指派的首领', title: '夜祷使',
    portrait: '', color: '#B98AD9', level: 10,
    stats: { magic: 80, insight: 70, agility: 60, empathy: 50 }, skillIds: [], archetype: '输出' as const,
    origin: 'witch' as const, titles: { association: '客卿', government: '顾问', witch: '夜祷使' },
    quote: '', note: '',
  };
  state.customFactionLeaders = [base];
  state.factionRoster = { ...state.factionRoster, witch: { ...state.factionRoster.witch, leaderId: base.id } };
  return state;
}

test('v29 会客厅代表跟随开局指派的首领', () => {
  const state = withLeader(createInitialState());
  const rep = factionRepresentativeOf(state, 'witch');
  assert.equal(rep.name, '玩家指派的首领');
  assert.equal(rep.title, '夜祷使');
  assert.equal(rep.kind, 'leader');
});

test('v29 首领委托预览不写状态，标题与描述用首领名字', () => {
  const state = withLeader(createInitialState());
  const snapshot = JSON.stringify({ missions: state.missions.length, candidates: state.candidates.length, gold: state.gold });
  const task = previewFactionTask(state, 'witch');
  assert.equal(task.envoy, true);
  assert.ok(task.description.includes('玩家指派的首领'));
  assert.equal(JSON.stringify({ missions: state.missions.length, candidates: state.candidates.length, gold: state.gold }), snapshot);
});

test('v29 停战会结束战线、压敌意并写入冷却', () => {
  const state = createInitialState();
  state.hostility = { ...state.hostility, 'association-witch': { ...state.hostility['association-witch'], value: 90 } };
  state.fronts = [{
    id: 'front-test', pair: 'association-witch', day: state.day, district: 'oldtown', attacker: 'association', defender: 'witch',
    startsAt: 0, endsAt: 240, attackerPower: 60, defenderPower: 55, status: 'open',
  }];
  const opinion: Opinion = {
    id: 'op-v29', day: state.day, authorId: 'custom-leader-v29', authorKind: 'leader', authorFaction: 'witch',
    topic: '城市', title: '停战试探', text: '', request: '', status: 'pending', faction: 'witch',
    dialogue: [], options: [{
      id: 'accept', label: '批准', effect: '', changes: [{ kind: 'gold', amount: -3000 }],
      outcomes: [{ kind: 'truce', pair: 'association-witch', days: 10 }],
    }],
  };
  state.opinions = [opinion];
  const result = act(state, { type: 'decideOpinion', opinionId: 'op-v29', decision: 'accept' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.fronts[0]?.status, 'resolved');
  assert.ok((result.state.hostility['association-witch']?.value ?? 100) <= 20);
  assert.equal(result.state.truceUntil?.['association-witch'], state.day + 10);
});

test('v29 灯下私语：模型输出写进消息与未读，读过后清零', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const job: WhisperJob = { id: 'job-1', girlId: girl.id, missionId: 'candy', day: state.day, outcome: 'victory', createdAt: Date.now() };
  state.whisperQueue = [job];
  const added = act(state, { type: 'addWhisper', jobId: 'job-1', text: '所长，今天的糖我留了一颗。' });
  assert.equal(added.ok, true);
  assert.equal(added.state.whisperUnread?.[girl.id], 1);
  const last = added.state.messages[girl.id]?.at(-1);
  assert.equal(last?.whisper, true);
  assert.equal(added.state.whisperQueue?.length, 0);
  const read = act(added.state, { type: 'markWhispersRead', girlId: girl.id });
  assert.equal(read.state.whisperUnread?.[girl.id], undefined);
});

test('v29 灯下私语提示词会带上战报回合与她的性格', async () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const battle = {
    id: 'battle-v29', missionId: 'candy', missionTitle: '糖果街的委托', seed: 1,
    startedAt: { day: state.day, minutes: state.minutes }, round: 2, rounds: 2,
    units: [
      { uid: `ally-${girl.id}`, side: 'ally' as const, name: girl.name, portrait: '', color: girl.color, hp: 90, maxHp: 100, spirit: 0, maxSpirit: 0, stats: girl.stats, skills: [], cooldown: {}, effects: [], down: false, insightRoll: 50, scarHit: 0, dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0 },
    ],
    initiative: [], outcome: 'victory' as const,
    events: [{ round: 1, at: { day: state.day, minutes: state.minutes }, actor: `ally-${girl.id}`, skillId: 'glimmer-spear', skillName: '碎光枪', targets: ['enemy'], hit: true, amount: 24 }],
    createdAt: new Date().toISOString(),
  };
  state.battles = [battle];
  state.girls = [{ ...girl, personality: '安静，说话很轻。', appearance: '浅紫色长发。' }, ...state.girls.slice(1)];
  const job: WhisperJob = { id: 'job-2', girlId: girl.id, missionId: 'candy', day: state.day, outcome: 'victory', battleId: battle.id, createdAt: Date.now() };
  let body = '';
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    body = String(init?.body ?? '');
    return new Response(JSON.stringify({ choices: [{ message: { content: '所长，最后一枪打偏了一点点。' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateWhisper({ provider: 'openai', endpoint: 'https://mock.local/v1', apiKey: 'k', model: 'm' }, state, job);
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    assert.ok(body.includes('碎光枪') && body.includes('第 1 回合'), '提示词必须带战报回合');
    assert.ok(body.includes('安静，说话很轻。'), '提示词必须带她的性格');
  } finally {
    globalThis.fetch = original;
  }
});

test('v29 反代 URL：子路径、查询串、Azure 与自定义模板', () => {
  assert.equal(buildApiUrl({ endpoint: 'https://host/llm/v1', model: 'm' }), 'https://host/llm/v1/chat/completions');
  assert.equal(buildApiUrl({ endpoint: 'https://host/llm/v1/chat/completions?api-version=2024', model: 'm' }), 'https://host/llm/v1/chat/completions?api-version=2024');
  assert.equal(buildApiUrl({ endpoint: 'https://host/llm/v1', model: 'gpt', pathMode: 'azure' }), 'https://host/llm/v1/openai/deployments/gpt/chat/completions');
  assert.equal(buildApiUrl({ endpoint: 'https://host', model: 'gpt', pathMode: 'custom', customPath: '/p/{model}/chat/completions' }), 'https://host/p/gpt/chat/completions');
  assert.equal(buildApiUrl({ endpoint: 'https://host/v1', model: 'm', authMode: 'query', apiKey: 'sk-1', apiKeyQuery: 'key' }), 'https://host/v1/chat/completions?key=sk-1');
});

test('v29 反代认证头：四种模式与自定义头', () => {
  assert.equal(apiHeaders({ apiKey: 'k' }).Authorization, 'Bearer k');
  assert.equal(apiHeaders({ apiKey: 'k', authMode: 'x-api-key' })['x-api-key'], 'k');
  assert.equal(apiHeaders({ apiKey: 'k', authMode: 'api-key' })['api-key'], 'k');
  assert.equal(apiHeaders({ apiKey: 'k', authMode: 'header', headerName: 'X-Proxy-Token' })['X-Proxy-Token'], 'k');
  const headers = apiHeaders({ apiKey: '', authMode: 'none', extraHeaders: { 'X-Route': 'night', 'Content-Type': 'text/plain' } });
  assert.equal(headers['X-Route'], 'night');
  assert.equal(headers['Content-Type'], 'application/json');
});


test('v29 导出卡片会写入当前表情、衣柜与差分', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const card = buildGirlCard({
    ...girl,
    expression: 'sad',
    outfitId: 'night',
    wardrobe: [{ id: 'night', name: '夜色礼装', description: '深色长裙。', portrait: 'data:image/png;base64,AAAA' }],
    importedVariants: { 'night:sad': 'data:image/png;base64,BBBB' },
  }, state);
  assert.equal(card.girl.expression, 'sad');
  assert.equal(card.girl.outfitId, 'night');
  assert.equal(card.girl.wardrobe?.[0]?.portrait, 'data:image/png;base64,AAAA');
  assert.equal(card.girl.importedVariants?.['night:sad'], 'data:image/png;base64,BBBB');
});

test('v29 同一张卡导出后再导入：更新立绘与表情，不新增第二个候选', () => {
  const base = createInitialState();
  const original = buildGirlCard({ ...base.girls[0]!, id: 'g_card_edit', name: '白洲梓', codename: '白羽' }, base);
  const first = act({ ...base, candidates: [] }, { type: 'importCard', card: original });
  assert.equal(first.ok, true, first.message);
  const count = first.state.candidates.length;
  const editedGirl = { ...first.state.candidates[0]!, expression: 'sad' as const, importedVariants: { 'uniform:sad': 'data:image/png;base64,AAAA' }, wardrobe: [{ id: 'night', name: '夜色礼装', description: '深色长裙。', portrait: 'data:image/png;base64,BBBB' }] };
  const edited = buildGirlCard(editedGirl, first.state);
  const second = act(first.state, { type: 'importCard', card: edited });
  assert.equal(second.ok, true, second.message);
  assert.equal(second.state.candidates.length, count, '更新而不是新增');
  const updated = second.state.candidates[0]!;
  assert.equal(updated.expression, 'sad');
  assert.equal(updated.importedVariants?.['uniform:sad'], 'data:image/png;base64,AAAA');
  assert.equal(updated.wardrobe[0]?.name, '夜色礼装');
  const again = act(second.state, { type: 'importCard', card: edited });
  assert.equal(again.ok, false, '没有变化时仍然算重复');
});

test('v30 战斗摘要不出现技能名与伤害数字，连贯札记要求 6000 字', () => {
  const battle = {
    id: 'b-note', missionId: 'm', missionTitle: '旧城配电井', seed: 1,
    startedAt: { day: 1, minutes: 1200 }, round: 2, rounds: 2,
    units: [{ uid: 'ally-yue', side: 'ally', girlId: 'yue', name: '月见桃', codename: '月', portrait: '/art/yue.svg', color: '#fff', hp: 80, maxHp: 100, spirit: 20, maxSpirit: 40, stats: { magic: 50, insight: 50, agility: 50, empathy: 50 }, skills: [], cooldown: {}, effects: [], down: false, insightRoll: 50, scarHit: 0, dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0 }],
    initiative: ['ally-yue'],
    events: [{ round: 1, at: { day: 1, minutes: 1200 }, actor: 'ally-yue', skillId: 'x', skillName: '星屑穿刺', targets: ['enemy'], hit: true, resource: 'hp', amount: 64 }],
    outcome: 'victory', scars: [], createdAt: 'x',
  } as never;
  const digest = battleStoryDigest(battle);
  assert.equal(digest.includes('星屑穿刺'), false, '摘要不能带技能名');
  assert.equal(/\d+\s*点/.test(digest), false, '摘要不能带伤害数字');
  const lines = Array.from({ length: 4 }, (_, index) => ({ speakerSide: 'ally', speakerId: 'yue', expression: 'calm', text: '别退，呼吸还稳。', after: index }));
  const raw = { format: 'continuous', title: '井底', hook: '灯灭了。', summary: '她最后把门带上。', narration: '夜'.repeat(6000), lines };
  const checked = validateBattleNoteDraft(raw, battle, { createdAt: 'x' });
  assert.equal(checked.ok, true, checked.errors.join('；'));
  assert.equal(checked.note?.format, 'continuous');
  assert.equal(checked.note?.scenes.length, 1);
  assert.deepEqual(checked.note?.scenes[0]?.lines.map(line => line.after), [0, 1, 2, 3]);
  const bad = validateBattleNoteDraft({ ...raw, narration: `${'夜'.repeat(5990)}造成 64 点伤害` }, battle, { createdAt: 'x' });
  assert.equal(bad.ok, false, '数字/伤害必须拦住');
});

test('v30 预设模型覆盖基础模型（战斗札记实际请求用预设里的模型）', () => {
  const base = { provider: 'vertex' as const, endpoint: '', apiKey: 'key', model: 'gemini-3.8-flash', location: 'global' };
  const runtime = { id: 'p', name: '战斗札记', maxContext: 12000, main: '', jailbreak: '', entries: [], wiFormat: '{0}', scenarioFormat: '{{scenario}}', personalityFormat: '{{personality}}', regex: [], api: { provider: 'vertex' as const, model: 'gemini-4-argon' } };
  const cfg = applyPresetApi(runtime, base);
  assert.equal(cfg.model, 'gemini-4-argon');
});
