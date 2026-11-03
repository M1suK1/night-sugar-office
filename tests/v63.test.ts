import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { absoluteMinutes, dayOf, minutesOf, SHIFT_START, SHIFT_END } from '../src/shift.ts';
import { advanceClock, endNight } from '../src/rules/time.ts';
import { deployDueIncident, mergeIncidentPool, sanitizeGeneratedIncident, takeFromPool } from '../src/incidents.ts';

const at = (day: number, minutes: number) => ({ day, minutes });

test('v63 营业日只在 20:00 翻：00:00–02:00 仍算同一夜', () => {
  assert.equal(dayOf(absoluteMinutes(14, SHIFT_START)), 14);
  assert.equal(dayOf(absoluteMinutes(14, 1439)), 14, '23:59');
  assert.equal(dayOf(absoluteMinutes(14, 1440)), 14, '00:00 不翻日');
  assert.equal(dayOf(absoluteMinutes(14, 1470)), 14, '00:30');
  assert.equal(dayOf(absoluteMinutes(14, SHIFT_END)), 14, '02:00 打烊');
  assert.equal(dayOf(absoluteMinutes(15, SHIFT_START)), 15, '次日 20:00 才翻');
  assert.equal(minutesOf(absoluteMinutes(14, 1470)), 1470);
});

test('v63 跨过午夜：日号、市场、提案都不动', () => {
  const state = createInitialState();
  state.day = 14;
  state.minutes = 23 * 60 + 50;
  const marketDay = state.marketDay;
  const councilDay = state.councilDay;
  const opinions = state.opinions.map(opinion => opinion.status).join(',');
  advanceClock(state, absoluteMinutes(14, 23 * 60 + 50) + 20);
  assert.equal(state.day, 14, '00:10 还是第 14 日');
  assert.equal(state.minutes, 1450);
  assert.equal(state.marketDay, marketDay, '市场不在 0 点刷新');
  assert.equal(state.councilDay, councilDay, '议会日不在 0 点推进');
  assert.equal(state.opinions.map(opinion => opinion.status).join(','), opinions, '议题状态不变');
});

test('v63 次日开门才刷新：20:00 推一把，市场跟上', () => {
  const state = createInitialState();
  state.day = 14;
  state.minutes = 23 * 60 + 30;
  const before = state.marketDay;
  advanceClock(state, absoluteMinutes(15, SHIFT_START) + 1);
  assert.equal(state.day, 15);
  assert.ok(state.marketDay >= 15 || state.marketDay > before, '开门时市场刷新');
});

test('v63 午夜后打烊必须进下一天（旧写法会原地重开）', () => {
  const state = createInitialState();
  state.day = 14;
  state.minutes = 1470; // 00:30
  state.incidents = [];
  const result = endNight(state);
  assert.equal(result.ok, true, result.ok ? '' : result.message);
  assert.equal(result.state.day, 15, '打烊后应当进第 15 日，而不是停在第 14 日');
  assert.equal(result.state.minutes, SHIFT_START);
  assert.equal(result.state.shift.day, 15, '时段计数按新的一夜重置');
  assert.ok(result.state.shift.wave >= 1, '开门后第一批已经投出去了');
});

test('v63 模型写的弹窗能被真的投出来：池子条目按 trigger 命中', () => {
  const state = createInitialState();
  state.incidents = [];
  state.incidentPool = [];
  mergeIncidentPool(state, [{
    category: 'decision', kind: 'faction', title: '桥头的封锁线',
    body: '市役所把桥头封了半条，检疫官正挨个查契约书，队伍已经排到河堤下面。',
    trigger: { kind: 'wave', wave: 1 }, faction: 'government',
    options: [{ label: '配合检查', hint: '安分守己', effect: { reputation: 2 } }],
  }], at(14, SHIFT_START));
  assert.equal(state.incidentPool.length, 1, '条目先进待用池');
  const wrongCause = takeFromPool(state, 'dayStart', at(14, SHIFT_START + 5), { wave: 0 });
  assert.equal(wrongCause, undefined, 'wave 1 的条目不该在开门时投放');
  const hit = takeFromPool(state, 'wave', at(14, SHIFT_START + 125), { wave: 1 });
  assert.ok(hit, '到了那个时段就该被取出来');
  assert.equal(hit!.title, '桥头的封锁线');
  assert.equal(hit!.status, 'pending');
  assert.equal(state.incidentPool.length, 0, '取出来之后池子里不再留一份');
});

test('v63 内置模板优先：内置有货时不消耗模型写的池子', () => {
  const state = createInitialState();
  state.incidents = [];
  state.incidentPool = [];
  mergeIncidentPool(state, [{
    category: 'report', kind: 'environment', title: '雾里有铁锈味',
    body: '南十字的雾今晚带铁锈味，巡夜队说旧钟楼的排水口又堵了，水漫到街面上。',
    trigger: { kind: 'dayStart' },
  }], at(20, SHIFT_START));
  const deployed = deployDueIncident(state, 'dayStart', at(20, SHIFT_START), { wave: 0 });
  assert.ok(deployed, '开门前总该投出一条');
  if (deployed!.source !== 'llm') assert.equal(state.incidentPool.length, 1, '内置优先，池子留着下次用');
});

test('v63 触发器缺省与校验：按类别兜底，kind 与 girlId 不一致就降级', () => {
  const state = createInitialState();
  const base = { title: '一条事件', body: '这里是一段足够长的正文，用来通过长度校验，描述具体的人、地点与时间压力。' };
  const report = sanitizeGeneratedIncident(state, { ...base, category: 'report' }, at(14, SHIFT_START));
  assert.deepEqual(report?.trigger, { kind: 'dayStart' });
  const decision = sanitizeGeneratedIncident(state, { ...base, category: 'decision' }, at(14, SHIFT_START));
  assert.deepEqual(decision?.trigger, { kind: 'wave', wave: 1 });
  const scene = sanitizeGeneratedIncident(state, { ...base, category: 'scene' }, at(14, SHIFT_START));
  assert.deepEqual(scene?.trigger, { kind: 'missionDone' });
  const explicit = sanitizeGeneratedIncident(state, { ...base, category: 'decision', trigger: { kind: 'wave', wave: 2 } }, at(14, SHIFT_START));
  assert.deepEqual(explicit?.trigger, { kind: 'wave', wave: 2 }, '模型写了就用模型的');
  const girl = sanitizeGeneratedIncident(state, { ...base, category: 'decision', kind: 'girl', girlId: 'not-in-roster' }, at(14, SHIFT_START));
  assert.equal(girl?.kind, 'environment', '名册外的 girlId 降级成环境事件');
  assert.equal(girl?.girlId, undefined);
  const ttl = sanitizeGeneratedIncident(state, { ...base, category: 'report', ttlMinutes: 9999 }, at(14, SHIFT_START));
  assert.equal(ttl?.ttlMinutes, 480, '存活时长夹住上限');
});
