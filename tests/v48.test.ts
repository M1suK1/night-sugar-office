import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { factionRepresentativeOf, factionSeatsMissing, representativeNameOf, representativeTitleOf } from '../src/factions.ts';
import { factionInfo } from '../src/content/items.ts';
import { FACTION_ORDER } from '../src/territories.ts';
import { prologueFor } from '../src/prologue.ts';
import { blueprintFactionLine } from '../src/llm.ts';
import type { GameState } from '../src/types.ts';

/** 把三方首领换成自定义卡面首领，模拟「开局指派了别人」。 */
function withCustomLeaders(): GameState {
  const state = createInitialState();
  state.customFactionLeaders = [
    { id: 'lead-a', name: '雾岛澪', codename: 'MIO', title: '代理会长', faction: 'association', element: '星光系', color: '#8fd3c7', level: 10, archetype: '输出', appearance: '', personality: '', outfitDescription: '', quote: '灯要有人守。' },
    { id: 'lead-g', name: '黑川悟', codename: 'SAT', title: '夜勤课长', faction: 'government', element: '月影系', color: '#c9b36a', level: 10, archetype: '守护', appearance: '', personality: '', outfitDescription: '', quote: '按编号来。' },
    { id: 'lead-w', name: '白夜', codename: 'NOX', title: '净血派领袖', faction: 'witch', element: '梦境系', color: '#9b6bc4', level: 10, archetype: '控制', appearance: '', personality: '', outfitDescription: '', quote: '我们自己写定义。' },
  ] as never;
  state.factionRoster = {
    association: { leaderId: 'lead-a', memberIds: [] },
    government: { leaderId: 'lead-g', memberIds: [] },
    witch: { leaderId: 'lead-w', memberIds: [] },
  } as never;
  return state;
}

test('v48 默认状态下三方代表都是空缺占位，不再指向内置首领', () => {
  const state = createInitialState();
  for (const faction of FACTION_ORDER) {
    const rep = factionRepresentativeOf(state, faction);
    assert.equal(rep.vacant, true, `${faction} 的代表该是空缺`);
    assert.equal(rep.name, '席位空缺');
    assert.equal(rep.id, `vacant-${faction}`);
    assert.equal(representativeNameOf(state, faction), '席位空缺', '界面提示「契约卡不足，需要导入」');
  }
  assert.equal(factionSeatsMissing(state), 3);
  // 没有存档时只退回界面兜底文案，不写死任何内置首领的名字。
  assert.equal(representativeNameOf(undefined, 'association'), factionInfo.association.envoy);
  assert.equal(representativeTitleOf(undefined, 'association'), factionInfo.association.title);
});

test('v48 换掉首领后，代表名与头衔跟着换', () => {
  const state = withCustomLeaders();
  assert.equal(representativeNameOf(state, 'association'), '雾岛澪');
  assert.equal(representativeNameOf(state, 'government'), '黑川悟');
  assert.equal(representativeNameOf(state, 'witch'), '白夜');
  assert.equal(representativeTitleOf(state, 'association'), '代理会长');
  // 缺 state 时退回内置名字，不炸也不留空。
  assert.equal(representativeNameOf(undefined, 'association'), '白鹭千秋');
  assert.equal(representativeTitleOf(undefined, 'association'), '协会监察官');
});

test('v48 开场三幕的领袖台词用当前首领的名字', () => {
  const state = withCustomLeaders();
  const beats = prologueFor(state);
  const speakers = beats.flatMap(beat => beat.lines.map(line => line.speaker));
  assert.ok(speakers.includes('雾岛澪'), '协会首领要换成卡面首领');
  assert.ok(speakers.includes('黑川悟'), '市役所首领要换成卡面首领');
  assert.ok(speakers.includes('白夜'), '月蚀庭首领要换成卡面首领');
  assert.equal(speakers.includes('白鹭千秋'), false, '不能再出现内置首领');
  assert.equal(speakers.includes('雨宫澄'), false);
});

test('v48 蓝图提示词里的城市态势不再写死老首领', () => {
  const custom = blueprintFactionLine(withCustomLeaders());
  assert.ok(custom.includes('雾岛澪'));
  assert.ok(custom.includes('黑川悟'));
  assert.ok(custom.includes('白夜'));
  assert.equal(custom.includes('白鹭千秋'), false, '提示词里不能残留内置首领');
  assert.equal(custom.includes('雨宫澄'), false);
  assert.equal(custom.includes('夜枭'), false);

  // 没有 state 时也不能写死名字，只说势力。
  const anonymous = blueprintFactionLine(undefined);
  assert.equal(anonymous.includes('白鹭千秋'), false);
  assert.equal(anonymous.includes('雨宫澄'), false);
});
