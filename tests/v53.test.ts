import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { battleGirlText, battleMonsterText, battlePlaceText, battleStoryDigest, battleTimeText } from '../src/battleNote.ts';
import { battleContract } from '../src/promptSections.ts';
import { DEFAULT_PROMPTS, composeTaskSystem, presetRuntime } from '../src/presets.ts';
import { districts } from '../src/districts.ts';
import { monsters } from '../src/content/monsters.ts';
import type { BattleState, GameState } from '../src/types.ts';

function sampleBattle(state: GameState): BattleState {
  const girl = state.girls[0]!;
  const monster = monsters[0]!;
  state.missions.unshift({
    ...state.missions[0]!,
    id: 'm-test', title: '糖街的雨', work: 'combat', category: '战斗委托', district: 'candy',
    status: 'done', pollutionAtSpawn: 42,
  });
  return {
    id: 'b-test', missionId: 'm-test', missionTitle: '糖街的雨', seed: 1,
    startedAt: { day: 20, minutes: 22 * 60 + 15 }, round: 4, rounds: 6,
    units: [
      { uid: `ally-${girl.id}`, side: 'ally', girlId: girl.id, name: girl.name, codename: girl.codename, portrait: 'data:', color: girl.color, expression: 'calm', down: false, downRound: null },
      { uid: `enemy-${monster.id}`, side: 'enemy', name: monster.name, portrait: '', color: monster.color, expression: 'calm', down: true, downRound: 4, monster },
    ],
    initiative: [], events: [], outcome: 'victory', createdAt: '2026-01-01T00:00:00.000Z', pollution: 42,
  };
}

test('v53 札记上下文：场地与时间写清辖区、污染与开打时刻', () => {
  const state = createInitialState();
  const battle = sampleBattle(state);
  const place = battlePlaceText(battle, state);
  assert.ok(place.includes(districts.candy.name), '要写辖区名');
  assert.ok(place.includes('candy'), '要带辖区 id');
  assert.ok(place.includes('42'), '要写这一战的污染读数');
  assert.ok(place.includes('战斗'), '要写委托类型');
  const time = battleTimeText(battle);
  assert.ok(time.includes('第 20 日'));
  assert.ok(time.includes('22:15'));
  assert.ok(time.includes('4/6'), '要写打到第几回合');
});

test('v53 札记上下文：我方少女带上元素、职阶、技能与此刻状态', () => {
  const state = createInitialState();
  const battle = sampleBattle(state);
  const girl = state.girls[0]!;
  const text = battleGirlText(battle, state);
  assert.ok(text.includes(girl.name) && text.includes(girl.id));
  assert.ok(text.includes(girl.element) && text.includes(girl.archetype ?? ''));
  assert.ok(text.includes('技能：') && text.includes('此刻：'));
  assert.ok(text.includes(`生命 ${girl.hp}/${girl.maxHp}`), '要写此刻的血量');
});

test('v53 札记上下文：敌方魔物带上阶级、习性、弱点与招式', () => {
  const state = createInitialState();
  const battle = sampleBattle(state);
  const monster = monsters[0]!;
  const text = battleMonsterText(battle);
  assert.ok(text.includes(monster.name) && text.includes(monster.rank));
  assert.ok(text.includes(monster.codex.habit), '要写习性');
  assert.ok(text.includes(monster.codex.weakness), '要写弱点');
  assert.ok(text.includes('第 4 回合被击倒'), '要写倒下时机');
});

test('v53 契约与分区：数值禁令留在代码里，场地与时间由分区带上', () => {
  const contract = battleContract();
  assert.ok(contract.includes('"format":"continuous"'));
  assert.ok(contract.includes('6000–10000'));
  assert.ok(contract.includes('不要写伤害数字'));
  assert.ok(contract.includes('calm / smile / surprise / sad / angry / shy'));
  const section = DEFAULT_PROMPTS.find(entry => entry.id === 'bt-brief');
  assert.ok(section, '预设里要有「札记·这一战的现场」这一条');
  assert.equal(section?.scope, 'battle');
  for (const macro of ['{{battlePlace}}', '{{battleTime}}', '{{battleGirls}}', '{{battleMonsters}}', '{{battleCast}}', '{{battleReport}}']) {
    assert.ok(section?.content.includes(macro), `分区里要带 ${macro}`);
  }
});

test('v53 拼装：分区渲染出真实数据，契约仍然在最后', () => {
  const state = createInitialState();
  const battle = sampleBattle(state);
  const vars = {
    battlePlace: battlePlaceText(battle, state),
    battleTime: battleTimeText(battle),
    battleGirls: battleGirlText(battle, state),
    battleMonsters: battleMonsterText(battle),
    battleCast: `我方 ${state.girls[0]!.name}｜speakerId=${state.girls[0]!.id}`,
    battleReport: battleStoryDigest(battle),
  };
  const runtime = { ...presetRuntime(undefined), entries: DEFAULT_PROMPTS };
  const composed = composeTaskSystem(battleContract(), runtime, 'battle', vars, { state });
  assert.ok(composed.system.includes(districts.candy.name), '场地渲染进提示词');
  assert.ok(composed.system.includes(monsters[0]!.codex.weakness), '魔物弱点渲染进提示词');
  assert.ok(composed.system.includes('第 20 日'), '时间渲染进提示词');
  assert.ok(composed.system.includes('不要写伤害数字'), '契约仍在');
  const lastContractLine = battleContract().trim().split('\n').pop() ?? '';
  assert.ok(lastContractLine.length > 0);
  assert.ok(composed.system.trimEnd().endsWith(lastContractLine), '契约必须排在最后');
});
