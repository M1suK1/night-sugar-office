import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, act, loadState, capacity, chance, squadChance, squadLimit, inWithdrawal } from '../src/game.ts';
import { effectiveStats } from '../src/economy.ts';
import { battleExp, expNeeded, grantExp } from '../src/progression.ts';
import { REMOTE_CALL_COST, pensionFor } from '../src/contracts.ts';
import type { Opinion, Scar } from '../src/types.ts';

const oldScar = (id: string): Scar => ({
  id: `scar-${id}-old`, name: '陈旧伤', kind: 'physical', condition: '旧伤在阴雨天发作',
  description: '她不太提起这件事。', effect: { kind: 'stat', stat: 'agility', amount: -1 },
  maxHpLoss: 8, gainedAt: '第 13 日 · 02:10', missionId: 'mirror',
});

test('初始数据包含六位契约者（含退役）、战斗与调查委托、基地容量', () => {
  const s = createInitialState();
  assert.equal(s.version, 6);
  assert.equal(s.girls.length, 5);
  assert.equal(s.girls.filter(g => g.retired).length, 1);
  assert.equal(s.candidates.length, 1);
  assert.equal(s.missions.length, 7);
  assert.equal(capacity(s), 6);
  assert.ok(s.missions.some(m => m.work === 'combat') && s.missions.some(m => m.work === 'investigation'));
  assert.ok(s.girls.every(g => g.name && g.skill && g.portrait && g.skills.length === 3));
  assert.deepEqual(s.battles, []);
  assert.ok(s.packHash);
});
test('派遣不修改原状态；多人和单人编队均受上限约束', () => {
  const s = createInitialState();
  const r = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'mirror' });
  assert.equal(r.ok, true);
  assert.equal(s.girls[0].status, 'idle');
  assert.equal(r.state.girls[0].status, 'mission');
  assert.deepEqual(r.state.missions.find(m => m.id === 'mirror')?.squad, ['yue', 'tang', 'ling']);
  assert.equal(r.state.missions.find(m => m.id === 'mirror')?.status, 'active');
  assert.equal(squadLimit(r.state.missions.find(m => m.id === 'mirror')!), 3);
  assert.equal(squadLimit(s.missions.find(m => m.id === 'candy')!), 2);
  assert.equal(act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling', 'wu'], missionId: 'mirror' }).ok, false);
  assert.equal(act(r.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
});
test('重复派遣、低血量与过劳被阻止', () => {
  const s = createInitialState(); s.girls[0].fatigue = 85;
  assert.equal(act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
  s.girls[0].fatigue = 10; s.girls[0].hp = 10;
  assert.equal(act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
  s.girls[0].hp = 100; const r = act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' });
  assert.equal(act(r.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'station' }).ok, false);
});
test('调查委托推进完成后只结算一次收入与日志', () => {
  const s = createInitialState();
  const r = act(s, { type: 'dispatch', girlIds: ['yue', 'tang'], missionId: 'candy' });
  const done = act(r.state, { type: 'advance', minutes: 120 });
  assert.equal(done.ok, true);
  assert.equal(done.state.girls.find(g => g.id === 'yue')!.status, 'idle');
  assert.equal(done.state.gold, s.gold + 680);
  assert.ok(done.state.completed.includes('candy'));
  assert.equal(done.state.missions.find(m => m.id === 'candy')!.status, 'done');
  const gold = done.state.gold;
  assert.equal(act(done.state, { type: 'advance', minutes: 15 }).state.gold, gold);
});
test('跨午夜推进按调查实际完成时刻记录收入', () => {
  const initial = createInitialState(); initial.minutes = 23 * 60 + 10;
  const dispatched = act(initial, { type: 'dispatch', girlIds: ['yue', 'tang'], missionId: 'candy' }).state;
  const result = act(dispatched, { type: 'advance', minutes: 60 }).state;
  assert.equal(result.day, 15); assert.equal(result.minutes, 10);
  assert.equal(result.samples.find(x => x.day === 14)!.income, initial.samples.at(-1)!.income + 680);
  assert.equal(result.samples.find(x => x.day === 15)?.income ?? 0, 0);
  assert.equal(result.logs.find(l => l.delta === 680)!.time, '第 14 日 · 23:55');
});
test('战斗胜利移除事件、发放全额收益并提升关系与经验', () => {
  const s = createInitialState();
  const before = s.girls.find(g => g.id === 'yue')!;
  const dispatched = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'mirror' }).state;
  const goldBefore = dispatched.gold;
  const result = act(dispatched, { type: 'advance', minutes: 180 }).state;
  const battle = result.battles[0];
  assert.equal(battle.outcome, 'victory');
  assert.ok(battle.events.length > 0);
  assert.ok((battle.frames?.length ?? 0) >= battle.round);
  assert.equal(battle.startedAt.day, 14);
  assert.equal(result.gold, goldBefore + 1240 - 88); // 跨日支付退役栀子的退休金
  assert.equal(result.missions.find(m => m.id === 'mirror')!.status, 'done');
  assert.ok(result.completed.includes('mirror'));
  const yue = result.girls.find(g => g.id === 'yue')!;
  assert.equal(yue.bond, Math.min(100, before.bond + 3));
  assert.equal(yue.relationships.tang, (before.relationships.tang ?? 40) + 2);
  assert.equal(yue.exp, battleExp(result.missions.find(m => m.id === 'mirror')!.recommendedLevel));
  assert.equal(yue.scars.length, 0);
  assert.equal(result.logs.find(l => l.kind === 'battle')?.delta, 1240);
});
test('战斗击退只发放八成收益，魔物带伤回到事件池', () => {
  const s = createInitialState();
  const dispatched = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'station' }).state;
  const goldBefore = dispatched.gold;
  const result = act(dispatched, { type: 'advance', minutes: 180 }).state;
  const battle = result.battles[0];
  const mission = result.missions.find(m => m.id === 'station')!;
  assert.equal(battle.outcome, 'repelled');
  assert.equal(result.gold, goldBefore + Math.round(920 * 0.8) - 88);
  assert.equal(mission.status, 'open');
  assert.equal(mission.worsened, true);
  assert.equal(mission.attempts, 1);
  assert.deepEqual(mission.squad, []);
  assert.ok(battle.rewards && battle.rewards.gold === 736);
});
test('战斗失败保留事件、施加疤痕并降低血量上限', () => {
  const s = createInitialState();
  const dispatched = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'arcade' }).state;
  const goldBefore = dispatched.gold;
  const result = act(dispatched, { type: 'advance', minutes: 180 }).state;
  const battle = result.battles[0];
  assert.equal(battle.outcome, 'defeat');
  assert.equal(result.gold, goldBefore - 88);
  assert.equal(result.missions.find(m => m.id === 'arcade')!.status, 'open');
  for (const id of ['yue', 'tang', 'ling']) {
    const girl = result.girls.find(g => g.id === id)!;
    assert.equal(girl.scars.length, 1);
    assert.ok(girl.maxHp < girl.baseMaxHp);
    assert.ok(girl.hp >= 0);
    assert.equal(result.memorial.length, 0);
  }
  assert.equal(battle.scars?.length, 3);
  assert.ok(result.logs.some(l => l.kind === 'memorial' && l.text.includes('疤痕')));
});
test('第五道疤痕导致死亡，释放席位并进入纪念墙', () => {
  const s = createInitialState();
  for (const id of ['yue', 'tang', 'ling']) {
    const girl = s.girls.find(g => g.id === id)!;
    girl.scars = [oldScar(id), oldScar(id), oldScar(id), oldScar(id)];
    girl.baseMaxHp = girl.maxHp = 50;
    girl.scars = girl.scars.map((scar, index) => ({ ...scar, id: `scar-${id}-${index}` }));
  }
  const dispatched = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'arcade' }).state;
  const result = act(dispatched, { type: 'advance', minutes: 180 }).state;
  assert.equal(result.battles[0].outcome, 'defeat');
  assert.equal(result.memorial.length, 3);
  assert.deepEqual(result.girls.map(g => g.id), ['wu', 'zhi']);
  assert.equal(result.reputation, 58);
  assert.deepEqual(result.missions.find(m => m.id === 'arcade')!.squad, []);
  assert.ok(result.memorial.every(m => m.girl.dead && m.girl.scars.length === 5 && m.lastBattleId === result.battles[0].id));
});
test('满四道疤痕可以退役，退役后无法再派遣', () => {
  const s = createInitialState();
  const yue = s.girls.find(g => g.id === 'yue')!;
  yue.scars = [oldScar('yue'), oldScar('yue'), oldScar('yue'), oldScar('yue')];
  yue.scars = yue.scars.map((scar, index) => ({ ...scar, id: `scar-yue-${index}` }));
  const retired = act(s, { type: 'retire', girlId: 'yue' });
  assert.equal(retired.ok, true);
  assert.equal(retired.state.girls.find(g => g.id === 'yue')!.retired, true);
  assert.equal(act(retired.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
  assert.equal(act(createInitialState(), { type: 'retire', girlId: 'yue' }).ok, false);
});
test('治疗与休息按实际时间恢复，不足条件时拒绝', () => {
  const s = createInitialState(); s.girls[0].hp = 30;
  const h = act(s, { type: 'care', girlId: 'yue', mode: 'healing' });
  assert.equal(h.ok, true); assert.equal(h.state.gold, s.gold - 180);
  const healed = act(h.state, { type: 'advance', minutes: 60 }).state;
  assert.equal(healed.girls[0].hp, s.girls[0].maxHp);
  s.girls[0].fatigue = 75;
  const rest = act(s, { type: 'care', girlId: 'yue', mode: 'resting' });
  assert.equal(act(rest.state, { type: 'advance', minutes: 90 }).state.girls[0].fatigue, 15);
  s.gold = 0; s.girls[0].hp = 10;
  assert.equal(act(s, { type: 'care', girlId: 'yue', mode: 'healing' }).ok, false);
});
test('雇佣扣款、去重并遵守基地容量', () => {
  const s = createInitialState(); s.gold = 20000;
  const candidate = s.candidates[0];
  const r = act(s, { type: 'hire', girlId: candidate.id }); assert.equal(r.ok, true); assert.equal(r.state.girls.length, 6);
  assert.equal(act(r.state, { type: 'hire', girlId: candidate.id }).ok, false);
  r.state.rooms.find(room => room.type === 'dorm')!.capacity = 5;
  assert.equal(act(r.state, { type: 'hire', girlId: 'lu' }).ok, false);
});
test('资金不足不建造，成功扩建后容量增加', () => {
  const s = createInitialState(); const n = capacity(s); s.gold = 0;
  assert.equal(act(s, { type: 'build' }).ok, false); s.gold = 10000;
  const r = act(s, { type: 'build' }); assert.equal(r.ok, true); assert.equal(capacity(r.state), n + 2);
  assert.equal(act(s, { type: 'build', roomId: 'lounge' }).ok, true);
});
test('本地剧情拒绝空输入，保存玩家与角色消息并限制长度', () => {
  const s = createInitialState(); assert.equal(act(s, { type: 'talk', girlId: 'yue', text: '  ' }).ok, false);
  const r = act(s, { type: 'talk', girlId: 'yue', text: '你今天还好吗？' });
  assert.equal(r.ok, true); assert.equal(r.state.messages.yue.at(-2)?.role, 'player');
  assert.equal(r.state.messages.yue.at(-1)?.role, 'girl'); assert.ok(r.state.girls[0].bond > s.girls[0].bond);
  assert.equal(act(s, { type: 'talk', girlId: 'yue', text: '字'.repeat(201) }).ok, false);
});
test('跨日推进记录新日期，拒绝负数、过小及过大推进量', () => {
  const s = createInitialState(); s.minutes = 23 * 60 + 45;
  const r = act(s, { type: 'advance', minutes: 30 }); assert.equal(r.state.day, s.day + 1); assert.equal(r.state.minutes, 15);
  assert.equal(act(s, { type: 'advance', minutes: -5 }).ok, false);
  assert.equal(act(s, { type: 'advance', minutes: NaN }).ok, false);
  assert.equal(act(s, { type: 'advance', minutes: 0.5 }).ok, false);
  assert.equal(act(s, { type: 'advance', minutes: 181 }).ok, false);
});
test('坏存档安全回退，v1 存档迁移，合法 v6 存档恢复', () => {
  assert.equal(loadState('not json').girls.length, 5);
  const migrated = loadState('{"version":1,"gold":777,"girls":[]}');
  assert.equal(migrated.girls.length, 5);
  assert.equal(migrated.gold, 777);
  const s = createInitialState(); s.gold = 999;
  assert.equal(loadState(JSON.stringify(s)).gold, 999);
  const malformed = structuredClone(s); malformed.girls[0].stats = null as never;
  assert.equal(loadState(JSON.stringify(malformed)).gold, 12840);
});
test('存档拒绝孤立委托、错配编队与危险角色标识', () => {
  const orphan = createInitialState(); orphan.gold = 456; orphan.missions[0].status = 'active';
  assert.equal(loadState(JSON.stringify(orphan)).gold, 12840);
  const mismatched = createInitialState(); mismatched.gold = 456; mismatched.missions[0].status = 'active'; mismatched.missions[0].squad = ['yue'];
  assert.equal(loadState(JSON.stringify(mismatched)).gold, 12840);
  const dangerous = createInitialState(); dangerous.gold = 456; dangerous.girls[0].id = 'constructor';
  assert.equal(loadState(JSON.stringify(dangerous)).gold, 12840);
  const active = act(createInitialState(), { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).state; active.gold = 456;
  assert.equal(loadState(JSON.stringify(active)).gold, 456);
});
test('雾眠保留专属猫咪对白，日羁绊增长有上限', () => {
  let s = createInitialState(); const initial = s.girls.find(g => g.id === 'wu')!.bond;
  for (let i = 0; i < 6; i++) s = act(s, { type: 'talk', girlId: 'wu', text: '帽子里的猫还好吗？' }).state;
  assert.match(s.messages.wu.at(-1)!.text, /帽子里的猫/);
  assert.equal(s.girls.find(g => g.id === 'wu')!.bond, initial + 6);
  assert.equal(s.messages.wu.length, 12);
});
test('单人匹配率与小队契合度保持在合理区间', () => {
  const s = createInitialState(); const g = s.girls[0], m = s.missions.find(x => x.id === 'candy')!;
  const low = chance(g, m); g.stats[m.requirement] = 100;
  assert.ok(chance(g, m) >= low); assert.ok(chance(g, m) <= 99); assert.ok(low >= 35);
  const squad = s.girls.slice(0, 2);
  assert.ok(squadChance(squad, m) >= 20 && squadChance(squad, m) <= 99);
});
test('经验达到阈值后升级并提升主副属性', () => {
  const s = createInitialState(); const g = s.girls[0]; const level = g.level;
  g.exp = 0; g.retired = false;
  const need = expNeeded(level);
  assert.equal(grantExp(g, need - 1), false);
  assert.equal(g.exp, need - 1);
  assert.equal(grantExp(g, 2), true);
  assert.equal(g.level, level + 1);
  assert.equal(g.exp, 1);
  assert.ok(g.maxHp > s.girls[1].baseMaxHp || g.maxHp >= 120);
});
test('退休金按日划拨，欠约累积到契约状态', () => {
  const s = createInitialState(); const yue = s.girls.find(g => g.id === 'yue')!;
  yue.scars = [oldScar('1'), oldScar('2'), oldScar('3'), oldScar('4')];
  const retired = act(s, { type: 'retire', girlId: 'yue' });
  assert.equal(retired.ok, true);
  assert.equal(retired.state.girls.find(g => g.id === 'yue')!.retired, true);
  const before = retired.state.gold; let current = retired.state;
  for (let i = 0; i < 100; i++) current = act(current, { type: 'advance', minutes: 180 }).state;
  assert.ok(current.gold < before, '退役金应该造成持续支出');
  assert.ok(current.logs.some(log => log.text.includes('退休金')));
  assert.ok(current.gold < before - Math.round(pensionFor(yue) / 10) * 8);
});
test('远程联络只对退役成员开放，按次计费且每日首次提升羁绊', () => {
  const s = createInitialState(); const yue = s.girls.find(g => g.id === 'yue')!;
  yue.retired = true; yue.retiredReason = 'contract'; yue.status = 'retired'; s.gold = 1000;
  const first = act(s, { type: 'talk', girlId: 'yue', text: '最近睡得好吗？', remote: true });
  assert.equal(first.ok, true);
  assert.equal(first.state.gold, 1000 - REMOTE_CALL_COST);
  assert.equal(first.state.girls.find(g => g.id === 'yue')!.bond, yue.bond + 1);
  const second = act(first.state, { type: 'talk', girlId: 'yue', text: '明天再聊。', remote: true });
  assert.equal(second.state.gold, 1000 - REMOTE_CALL_COST * 2);
  assert.equal(second.state.girls.find(g => g.id === 'yue')!.bond, yue.bond + 1);
  assert.equal(act(s, { type: 'talk', girlId: 'tang', text: '在吗', remote: true }).ok, false);
});
test('续签与复制契约会消耗星砂并写入新契约', () => {
  const s = createInitialState(); s.gold = 30000; s.girls[0].contractEndDay = 12; s.girls[0].pensionMissed = 2;
  const renewed = act(s, { type: 'renewContract', girlId: 'yue' });
  assert.equal(renewed.ok, true);
  assert.equal(renewed.state.girls[0].pensionMissed, 0);
  assert.ok(renewed.state.girls[0].contractEndDay >= renewed.state.day + 10);
  const cloned = act(renewed.state, { type: 'clinic', girlId: 'yue', mode: 'clone' });
  assert.equal(cloned.ok, true);
  assert.equal(cloned.state.girls.length, s.girls.length + 1);
  const copy = cloned.state.girls.at(-1)!;
  assert.equal(copy.cloneOf, 'yue');
  assert.equal(copy.level, 1);
  assert.match(copy.id, /^g_/);
  assert.equal(act(cloned.state, { type: 'clinic', girlId: 'yue', mode: 'clone' }).ok, false);
});
test('星象台远行按小时结算并可以召回', () => {
  const s = createInitialState();
  const started = act(s, { type: 'startExpedition', memberIds: ['yue', 'tang'] });
  assert.equal(started.ok, true);
  const expedition = started.state.expeditions[0];
  assert.deepEqual(expedition.memberIds, ['yue', 'tang']);
  assert.equal(started.state.girls.find(g => g.id === 'yue')!.status, 'expedition');
  const advanced = act(started.state, { type: 'advance', minutes: 60 });
  assert.equal(advanced.state.expeditions[0].cyclesDone, 1);
  assert.ok(advanced.state.gold > started.state.gold);
  const recalled = act(advanced.state, { type: 'recallExpedition', expeditionId: expedition.id });
  assert.equal(recalled.state.expeditions.length, 0);
  assert.equal(recalled.state.girls.find(g => g.id === 'yue')!.status, 'idle');
});
test('会客厅议题可以批准、驳回或暂缓', () => {
  const s = createInitialState(); const opinion: Opinion = { id: 'op-test', day: 14, authorId: 'yue', topic: '经费', title: '换一盏暖灯', text: '白光太像诊所。', request: '申请 600 星砂。', status: 'pending', options: [] };
  s.opinions = [opinion];
  const accepted = act(s, { type: 'decideOpinion', opinionId: 'op-test', decision: 'accept' });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.gold, s.gold - 600);
  assert.equal(accepted.state.opinions[0].status, 'accepted');
  assert.equal(act(accepted.state, { type: 'decideOpinion', opinionId: 'op-test', decision: 'reject' }).ok, false);
  const rejected = act(s, { type: 'decideOpinion', opinionId: 'op-test', decision: 'reject' });
  assert.equal(rejected.state.opinions[0].status, 'rejected');
  assert.equal(rejected.state.girls.find(g => g.id === 'yue')!.bond, s.girls.find(g => g.id === 'yue')!.bond - 2);
});


test('市场升级与高级招募消耗资金和安定度，并扩充候选', () => {
  const s = createInitialState(); s.gold = 50000;
  const up = act(s, { type: 'upgradeMarket' });
  assert.equal(up.ok, true);
  assert.equal(up.state.marketLevel, 2);
  assert.equal(up.state.gold, 44000);
  const before = up.state.candidates.length;
  const adv = act(up.state, { type: 'advancedRecruit', level: 3 });
  assert.equal(adv.ok, true);
  assert.equal(adv.state.candidates.length, before + 1);
  assert.ok(adv.state.gold < up.state.gold);
  assert.ok(adv.state.reputation < up.state.reputation);
  assert.equal(act(adv.state, { type: 'advancedRecruit', level: 3 }).ok, false);
});
test('势力装备可从仓库穿戴，并计入有效属性', () => {
  const s = createInitialState(); s.gold = 10000; s.factions.witch.standing = 60;
  const bought = act(s, { type: 'buyItem', itemId: 'moon-weapon' });
  assert.equal(bought.ok, true);
  assert.equal(bought.state.inventory['moon-weapon'], 1);
  const before = effectiveStats(bought.state.girls.find(g => g.id === 'yue')!, bought.state);
  const equipped = act(bought.state, { type: 'equipItem', girlId: 'yue', itemId: 'moon-weapon', slot: 'weapon' });
  assert.equal(equipped.ok, true);
  const after = effectiveStats(equipped.state.girls.find(g => g.id === 'yue')!, equipped.state);
  assert.ok(after.magic > before.magic);
  assert.equal(equipped.state.inventory['moon-weapon'], 0);
});
test('断药期禁止派遣，抑制剂立即解除', () => {
  const s = createInitialState();
  const yue = s.girls.find(g => g.id === 'yue')!;
  yue.corruption = 75; yue.witch = true; yue.withdrawalDays = 2; yue.drugUntilDay = 0;
  assert.equal(inWithdrawal(yue), true);
  const blocked = act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'cat' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /断药/);
  s.inventory['moon-drug'] = 1;
  const cured = act(s, { type: 'useItem', girlId: 'yue', itemId: 'moon-drug' });
  assert.equal(cured.ok, true);
  const curedYue = cured.state.girls.find(g => g.id === 'yue')!;
  assert.equal(curedYue.withdrawalDays, 0);
  assert.ok((curedYue.drugUntilDay ?? 0) > cured.state.day);
  assert.equal(act(cured.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'cat' }).ok, true);
});
test('自定义契约者登记为一级并进入候选名册', () => {
  const s = createInitialState();
  const before = s.candidates.length;
  const draft = { name: '夜见灯', codename: '宵灯', title: '新登记契约者', element: '星光系' as const, archetype: '输出' as const, color: '#f49abd', quote: '请多指教。', goal: '完成第一次委托', appearance: '短发', personality: '认真', outfitDescription: '夜色制服', stats: { magic: 75, insight: 65, agility: 60, empathy: 60 }, skillIds: ['glimmer-spear', 'peach-ward', 'starlight-fall'], traits: ['cat-sense', 'protective', 'silent'], portrait: '' };
  const r = act(s, { type: 'createGirl', draft });
  assert.equal(r.ok, true);
  assert.equal(r.state.candidates.length, before + 1);
  assert.equal(r.state.candidates.at(-1)?.level, 1);
  assert.equal(s.candidates.length, before);
});
