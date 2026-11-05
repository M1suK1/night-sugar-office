import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitSource, portraitString } from '../src/portrait.ts';
import { witchAwarePortrait } from '../src/factions.ts';
import { portraitSourceOf } from '../src/battleNote.ts';
import { customGirlOf, subjectOfCustom } from '../src/factions.ts';
import type { Outfit } from '../src/types.ts';

const DATA_A = 'data:image/png;base64,AAAA';
const DATA_B = 'data:image/png;base64,BBBB';

const outfit = (patch: Partial<Outfit>): Outfit => ({
  id: 'custom', name: '常服', description: '', palette: ['#b98ad9'], layerKey: 'uniform', ...patch,
});

test('v149 卡面图只在衣柜里（girl.portrait 为空）也能取到', () => {
  const girl = { portrait: '', wardrobe: [outfit({ portrait: DATA_A })], outfitId: 'custom', expression: 'calm' as const };
  assert.equal(portraitSource(girl).portrait, DATA_A);
});

test('v149 魔女形态优先于普通礼装', () => {
  const girl = {
    portrait: '', witch: true,
    wardrobe: [outfit({ portrait: DATA_A })],
    witchForm: outfit({ id: 'witchform', form: 'witch', portrait: DATA_B }),
    outfitId: 'custom', expression: 'calm' as const,
  };
  assert.equal(portraitSource(girl).portrait, DATA_B);
  // 没变魔女时还是普通礼装
  assert.equal(portraitSource({ ...girl, witch: false }).portrait, DATA_A);
});

test('v149 表情差分优先于礼装原图', () => {
  const girl = {
    wardrobe: [outfit({ portrait: DATA_A })], outfitId: 'custom', expression: 'smile' as const,
    importedVariants: { 'custom:smile': DATA_B },
  };
  assert.equal(portraitSource(girl).portrait, DATA_B);
  assert.equal(portraitSource({ ...girl, expression: 'calm' as const }).portrait, DATA_A, '别的表情仍用原图');
});

test('v149 礼装只有资产 id 时返回 asset', () => {
  const girl = { portrait: '', wardrobe: [outfit({ portraitAsset: 'asset-1' })], outfitId: 'custom' };
  const source = portraitSource(girl);
  assert.equal(source.portrait, '');
  assert.equal(source.asset, 'asset-1');
});

test('v149 没有衣柜时退回本体立绘，什么都没有就回空', () => {
  assert.equal(portraitSource({ portrait: DATA_A }).portrait, DATA_A);
  assert.equal(portraitSource({}).portrait, '');
});

test('v149 势力人物（无衣柜）走同一条规则：魔女形态 > 本体', () => {
  const leader = { portrait: DATA_A, witch: true, witchForm: outfit({ id: 'witchform', form: 'witch', portrait: DATA_B }) };
  assert.equal(witchAwarePortrait(leader), DATA_B);
  assert.equal(witchAwarePortrait({ portrait: DATA_A }), DATA_A);
  assert.equal(portraitString({ portrait: '', witch: true, witchForm: outfit({ id: 'witchform', form: 'witch' }) }), '', '只有资产时字符串为空');
});

test('v149 三方名册的人也带衣柜：卡面图存进名册后仍能画出来', () => {
  const subject = subjectOfCustom({
    id: 'seat-1', name: '安可', factionTag: 'witch', level: 8, color: '#b98ad9',
    portrait: '', stats: { magic: 40, insight: 40, agility: 40, empathy: 40 },
    skillIds: ['moon-slash'], wardrobe: [outfit({ portrait: DATA_A })], outfitId: 'custom', expression: 'calm',
  });
  const member = customGirlOf('witch', subject);
  assert.equal(member.wardrobe?.[0]?.portrait, DATA_A);
  assert.equal(portraitSource(member).portrait, DATA_A, '名册成员也能取到衣柜里的图');
});

test('v149 战报：快照只有空 portrait 时按衣柜回查', () => {
  const girl = { portrait: '', wardrobe: [outfit({ portrait: DATA_A })], outfitId: 'custom' };
  const source = portraitSourceOf({ portrait: '', girlId: 'g1' }, girl);
  assert.equal(source.portrait, DATA_A);
  // 快照里有图就以快照为准
  assert.equal(portraitSourceOf({ portrait: DATA_B, girlId: 'g1' }, girl).portrait, DATA_B);
  // 快照只有资产 id 时也优先用它
  assert.equal(portraitSourceOf({ portrait: '', portraitAsset: 'asset-9' }, girl).portraitAsset, 'asset-9');
});
