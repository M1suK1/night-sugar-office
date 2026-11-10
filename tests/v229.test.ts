import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { opinionSpeakerOf } from '../src/opinions.ts';
import { sanitizeCustomLeader } from '../src/rules/candidate.ts';
import { extractStatePortraits, hydrateStatePortraits, type PortraitStore } from '../src/portraitAssets.ts';
import type { FactionLeader, GameState, Opinion } from '../src/types.ts';

const IMAGE = 'data:image/png;base64,' + 'A'.repeat(1200);
const VARIANT = 'data:image/png;base64,' + 'B'.repeat(1200);

const leader: FactionLeader = {
  id: 'l1', faction: 'witch', name: '白洲梓', title: '静滞之翼', portrait: '', color: '#B98AD9',
  quote: '', note: '', level: 10,
  stats: { magic: 1, insight: 1, agility: 1, empathy: 1 },
  skillIds: [], archetype: '输出', origin: 'witch',
  titles: { association: '', government: '', witch: '静滞之翼' },
  duty: { faction: 'witch', note: '' },
  wardrobe: [{ id: 'custom', name: '夜行', description: '', palette: ['#B98AD9'], layerKey: 'formal', portrait: IMAGE }],
  outfitId: 'custom', expression: 'calm', witch: true,
  importedVariants: { 'custom:smile': VARIANT },
};

const stateWithLeader = (): GameState => {
  const state = createInitialState();
  state.factionRoster = {
    association: { leaderId: '', memberIds: [] },
    government: { leaderId: '', memberIds: [] },
    witch: { leaderId: 'l1', memberIds: [] },
  };
  state.customFactionLeaders = [leader];
  return state;
};

const opinion: Opinion = {
  id: 'op1', day: 1, authorId: 'l1', authorKind: 'leader', authorFaction: 'witch',
  topic: '同伴', title: '议题', text: '正文', request: '诉求', status: 'pending', options: [],
};

function memoryStore(): PortraitStore {
  const ids = new Map<string, string>();
  return {
    available: () => true,
    put: async blob => {
      const key = 'len:' + blob.size;
      if (!ids.has(key)) ids.set(key, 'asset-' + ids.size);
      return ids.get(key)!;
    },
    url: async id => 'blob:' + id,
    dataUrl: async id => 'data:image/webp;base64,' + id,
  };
}

test('v229 首领提案的大立绘带上衣柜、魔女形态与表情差分', () => {
  const speaker = opinionSpeakerOf(stateWithLeader(), opinion);
  assert.ok(speaker);
  assert.equal(speaker!.wardrobe?.[0]?.portrait, IMAGE, '衣柜里的卡面图要跟着提案人进立绘');
  assert.equal(speaker!.importedVariants?.['custom:smile'], VARIANT);
  assert.equal(speaker!.witch, true);
  const line = { speakerId: 'l1', speaker: '白洲梓', text: '……', expression: 'smile' as const };
  assert.equal(opinionSpeakerOf(stateWithLeader(), opinion, line)?.expression, 'smile');
});

test('v229 首领读档不再丢掉表情差分与立绘资产引用', () => {
  const sanitized = sanitizeCustomLeader({
    ...leader, importedVariants: { 'custom:smile': VARIANT }, variantAssets: { 'custom:smile': 'asset-1' }, portraitAsset: 'asset-portrait',
  }, 'witch', 'l1');
  assert.ok(sanitized);
  assert.equal(sanitized!.importedVariants?.['custom:smile'], VARIANT);
  assert.equal(sanitized!.variantAssets?.['custom:smile'], 'asset-1');
  assert.equal(sanitized!.portraitAsset, 'asset-portrait');
});

test('v229 首领的衣柜与差分也会搬进资产库并在读档时还原', async () => {
  const store = memoryStore();
  const flat = await extractStatePortraits(stateWithLeader(), store);
  const saved = flat.state.customFactionLeaders![0]!;
  assert.ok(saved.wardrobe?.[0]?.portraitAsset, '衣柜图应换成资产引用');
  assert.ok(saved.variantAssets?.['custom:smile'], '差分应换成资产引用');
  assert.equal(JSON.stringify(saved).includes('data:image'), false, '存档里不该留内联图');

  const loaded = await hydrateStatePortraits(flat.state, store);
  const back = loaded.customFactionLeaders![0]!;
  assert.ok(back.wardrobe?.[0]?.portrait.startsWith('data:image'));
  assert.ok(back.importedVariants?.['custom:smile']?.startsWith('data:image'));
});

test('v229 编成映射不会在首领身上丢掉差分', async () => {
  const { customLeaderOf, subjectOfLeader } = await import('../src/factions.ts');
  const back = customLeaderOf('witch', subjectOfLeader(leader));
  assert.equal(back.importedVariants?.['custom:smile'], VARIANT);
  assert.equal(back.wardrobe?.[0]?.portrait, IMAGE);
  assert.equal(back.portraitAsset, undefined);
});
