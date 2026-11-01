import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBlankState, createInitialState, loadState } from '../src/game.ts';
import { openingGaps, openingLabel, openingNeed } from '../src/opening.ts';
import { PROLOGUE, prologueFor, prologueFrom } from '../src/prologue.ts';
import { buildGirlCard } from '../src/cards.ts';
import { leaderById } from '../src/factions.ts';
import type { GameState } from '../src/types.ts';

/** 首夜空缺的测试要能自己控制缺口，所以先把种子内容清干净。 */
const fresh = (): GameState => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  state.incidentPool = [];
  return state;
};

test('v26 首夜空缺：议案、事件、委托、候选与魔物都按缺口算', () => {
  const state = fresh();
  const gaps = openingGaps(state);
  assert.equal(gaps.opinions, 3, '一条都没有时差三条议案');
  // 内置模板没冷却时算「够用」，所以这里不急着叫叙事者；openingFill 仍会本地兜底填到三条。
  assert.equal(typeof gaps.incidents, 'number');
  assert.equal(gaps.candidates, state.poolLimits.candidates - state.candidates.length);
  assert.equal(gaps.monsters, state.poolLimits.monsters);
  assert.equal(openingNeed(state), true);
  assert.ok(openingLabel(state).includes('条议题'), openingLabel(state));

  state.opinions = [1, 2, 3].map(index => ({
    ...createInitialState().opinions[0]!, id: `op-fill-${index}`, status: 'pending' as const,
  }));
  assert.equal(openingGaps(state).opinions, 0, '够三条就不再要');
});

test('v26 openingFill 补齐议案与待用事件，并记下当天', () => {
  const state = fresh();
  const result = act(state, { type: 'openingFill' });
  assert.equal(result.ok, true, result.message);
  const next = result.state;
  assert.equal(next.opinions.filter(opinion => opinion.status === 'pending').length, 3);
  const titles = next.opinions.filter(opinion => opinion.status === 'pending').map(opinion => opinion.title);
  assert.equal(new Set(titles).size, titles.length, `三条议题不该重名：${titles.join(' / ')}`);
  const ids = next.opinions.filter(opinion => opinion.status === 'pending').map(opinion => opinion.id);
  assert.equal(new Set(ids).size, ids.length, '议题编号也不能重复');
  assert.ok(next.incidentPool.length >= 3, '待用事件也要凑够三个');
  assert.equal(next.openingFilledAt, next.day);
  assert.ok(next.logs.some(log => log.id === `log-opening-${next.day}`), '要留一条补齐记录');
});

test('v26 openingFill 同一天第二次只是空转，不动状态', () => {
  const once = act(fresh(), { type: 'openingFill' });
  assert.equal(once.ok, true);
  const twice = act(once.state, { type: 'openingFill' });
  assert.equal(twice.ok, true);
  assert.equal(twice.message, '今夜已经补过了。');
  assert.equal(twice.state.opinions.length, once.state.opinions.length);
  assert.equal(twice.state.incidentPool.length, once.state.incidentPool.length);
});

test('v26 openingFill 换一天可以再补一次', () => {
  const once = act(fresh(), { type: 'openingFill' });
  const tomorrow = { ...once.state, day: once.state.day + 1, opinions: [], incidentPool: [] };
  const again = act(tomorrow, { type: 'openingFill' });
  assert.equal(again.ok, true);
  assert.equal(again.state.openingFilledAt, tomorrow.day);
});

test('v26 序章按存档生成：三幕讲名册、三方首领与今夜', () => {
  const state = createInitialState();
  const beats = prologueFor(state);
  assert.deepEqual(beats.map(beat => beat.id), ['ledger', 'roster', 'tonight']);
  const living = state.girls.filter(girl => !girl.dead && !girl.retired).length;
  const roster = beats[1]!.narration.join('');
  assert.ok(roster.includes(`${living} 位少女签了字`), roster);
  assert.ok(roster.includes('三方各自坐定了人'), '要点出三方首领');
  const tonight = beats[2]!.narration.join('');
  assert.ok(tonight.includes(`第 ${state.day} 日的值班`), tonight);
  assert.equal(beats[0]!.lines.length, 3, '第一幕仍是三方各一句');
});

test('v26 序章第二幕：卡库带回来的人数与对外代表都会写进去', () => {
  const state = createInitialState();
  const carded = state.girls.filter(girl => !girl.dead && !girl.retired).slice(0, 2);
  for (const girl of carded) girl.cardId = `hash-${girl.id}`;
  state.assistantId = carded[0]!.id;
  const beats = prologueFor(state);
  assert.ok(beats[1]!.narration.join('').includes('其中 2 位是你从卡库里带回来的'));
  assert.equal(beats[1]!.lines[0]!.speaker, carded[0]!.name, '有对外代表就用她说话');

  const noRep = createInitialState();
  assert.equal(prologueFor(noRep)[1]!.lines[0]!.text, '「名册还空着一行，等你写。」');
});

test('v26 序章空名册与无存档都说得通', () => {
  const empty = prologueFrom({ rosterSize: 0, cardSize: 0, leaderNames: {}, day: 3, narrator: false });
  assert.ok(empty[1]!.narration.join('').includes('名册还是空的。'));
  assert.ok(empty[2]!.narration.join('').includes('今夜先按本地写好的内容开着'));
  assert.deepEqual(prologueFor(null), PROLOGUE, '没有存档时回落到静态三幕');
  assert.equal(PROLOGUE.length, 3);
});

test('v26 新档 version 20 且首夜空缺还没补过', () => {
  const state = createInitialState();
  assert.equal(state.version, 20);
  assert.equal(state.openingFilledAt, 0);
  assert.equal(state.startersPicked, false, '新档要先编成');
  assert.equal(createBlankState().openingFilledAt, 0);
});

test('v26 老档（v18）读进来补上 openingFilledAt = 0', () => {
  const state = createInitialState();
  const raw = { ...state, version: 18, openingFilledAt: undefined };
  const loaded = loadState(JSON.stringify(raw));
  assert.equal(loaded.version, 20);
  assert.equal(loaded.openingFilledAt, 0);
  assert.equal(loaded.startersPicked, state.startersPicked, '其它字段不接受额外改动');
});

test('v26 空白档案没有契约者，编成这一步会被跳过', () => {
  const blank = createBlankState();
  assert.equal(blank.blank, true);
  assert.equal(blank.girls.length, 0);
  assert.equal(blank.startersPicked, false);
  assert.equal(openingGaps(blank).opinions, 3, '空白档案同样要补议案');
});

test('v26 卡库导入按候选上限收，满了就停', () => {
  const state = fresh();
  state.candidates = [];
  const total = state.poolLimits.candidates + 1;
  const cards = Array.from({ length: total }, (_, index) => buildGirlCard({ ...state.girls[0]!, name: `卡库少女${index}` }, state));
  const imported = act(state, { type: 'importCards', cards });
  assert.equal(imported.ok, true, imported.message);
  assert.equal(imported.state.candidates.length, state.poolLimits.candidates, '最多到上限');
  const extra = act(imported.state, { type: 'importCards', cards: [buildGirlCard({ ...state.girls[0]!, name: '再来一位' }, state)] });
  assert.equal(extra.ok, false, '满了要拒绝而不是丢人');
});

test('v26 编成确认后可以把卡库里的候选排进名册', () => {
  const state = fresh();
  const card = buildGirlCard({ ...state.girls[0]!, name: '卡库来的' }, state);
  const imported = act(state, { type: 'importCards', cards: [card] });
  const candidate = imported.state.candidates.find(girl => girl.name === '卡库来的');
  assert.ok(candidate, '导入后应该进候选');
  const picked = [state.girls[0]!.id, state.girls[1]!.id, state.girls[2]!.id, candidate.id];
  const result = act(imported.state, {
    type: 'setStarters', girlIds: picked, roster: imported.state.factionRoster, customLeaders: [], customGirls: [],
  });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.startersPicked, true);
  assert.ok(result.state.girls.some(girl => girl.id === candidate.id), '被选中的候选要进事务所名册');
});

test('v26 编成没被选中的卡留在市场，退役少女留在档案里', () => {
  const state = fresh();
  const cards = ['留下的甲', '留下的乙'].map((name, index) => buildGirlCard({ ...state.girls[index]!, name }, state));
  const imported = act(state, { type: 'importCards', cards });
  assert.equal(imported.ok, true, imported.message);
  const result = act(imported.state, {
    type: 'setStarters', girlIds: ['yue', 'tang', 'ling', 'wu'], roster: imported.state.factionRoster, customLeaders: [], customGirls: [],
  });
  assert.equal(result.ok, true, result.message);
  assert.ok(result.state.candidates.some(girl => girl.name === '留下的甲'), '没被选中的卡还挂在市场');
  assert.ok(result.state.candidates.some(girl => girl.name === '留下的乙'));
  assert.equal(result.state.girls.find(girl => girl.id === 'zhi')?.retired, true, '退役的栀子留在档案里');
});

test('v26 序章换了自定义首领就换名字', () => {
  const state = createInitialState();
  const base = leaderById(state.factionRoster.witch.leaderId);
  assert.ok(base, '默认月蚀庭首领应该在册');
  const custom = { ...base, id: 'custom-leader-v26', name: '新来的庭主' };
  state.customFactionLeaders = [custom];
  state.factionRoster = { ...state.factionRoster, witch: { ...state.factionRoster.witch, leaderId: custom.id } };
  const roster = prologueFor(state)[1]!.narration.join('');
  assert.ok(roster.includes('新来的庭主'), roster);
  assert.equal(roster.includes('蚀医·夜鸮'), false, '换掉的首领不再出现在第二幕');
});

test('v26 卡库优先：原生少女仍在池里兜底，卡库没卡也能开局', () => {
  const state = fresh();
  const born = state.girls.filter(girl => !girl.dead && !girl.retired);
  assert.ok(born.length >= 4, `原生少女至少四位可选，实际 ${born.length}`);
  assert.ok(state.candidates.length >= 1, '候选池里还有透明的 lu');
});
