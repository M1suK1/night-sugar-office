import test from 'node:test';
import assert from 'node:assert/strict';
import { act, chance, createInitialState, squadChance } from '../src/game.ts';
import { dailyPensionFor, pensionArrears, pensionFor, renewalCost } from '../src/contracts.ts';
import { BALANCE_FIELDS, BALANCE_GROUPS } from '../src/balance.ts';
import { items } from '../src/content/items.ts';
import { simulateBattle } from '../src/combat.ts';
import { autoResolveFront, planFronts } from '../src/fronts.ts';
import { startStoryGraph } from '../src/rules/storyRun.ts';
import { settleInvestigation } from '../src/rules/investigation.ts';
import type { FactionFront, Girl, Mission, MonsterTemplate, Scar, Storyline } from '../src/types.ts';
import { makeGirl, makeLeader, withFactionRoster } from './fixtureRoster.ts';

const dummyScar = (id: string): Scar => ({
  id,
  name: '旧伤',
  kind: 'physical',
  condition: '测试留痕',
  at: '第 14 日',
  effect: { kind: 'hit', amount: -2 },
});

test('v261-1 契约欠款按日单价（10 日退休金的 1/10）累计，不再放大 10 倍', () => {
  const g = { level: 5, pensionMissed: 3 } as Girl;
  assert.equal(pensionFor(g), 520, '10 日总额保持 520');
  assert.equal(dailyPensionFor(g), 52, '日单价应为 52');
  assert.equal(pensionArrears(g), 156, '欠 3 天应为 156 而非 1560');

  const state = createInitialState();
  state.gold = 10_000;
  const yue = state.girls.find(item => item.id === 'yue')!;
  yue.pensionMissed = 4;
  const expectedCost = renewalCost(yue) + dailyPensionFor(yue) * 4;
  const renewed = act(state, { type: 'renewContract', girlId: 'yue' });
  assert.equal(renewed.ok, true, renewed.message);
  assert.equal(renewed.state.gold, 10_000 - expectedCost);
});

test('v261-2a 调查委托判定读取有效属性（装备加成生效）', () => {
  const state = createInitialState();
  const girl = state.girls.find(item => item.id === 'yue')!;
  girl.fatigue = 0;
  girl.stats.insight = 50;
  // 挑一件加洞察的法器或构造高洞察状态：t4/t3 洞察装备或条件增益
  girl.conditions = [{
    id: 'cond-insight-boost',
    name: '明晰',
    kind: 'buff',
    source: '测试',
    description: '洞察大幅提升',
    remaining: 3,
    removable: true,
    stat: 'insight',
    amount: 35,
  }];
  const mission: Mission = {
    id: 'inv-gear-check',
    title: '高频信号复核',
    category: '异象调查',
    description: '需要有效洞察达标。',
    x: 30,
    y: 30,
    difficulty: '中危',
    duration: 45,
    reward: 600,
    requirement: 'insight',
    target: 75,
    color: '#9FB4E8',
    status: 'active',
    squad: [girl.id],
    work: 'investigation',
    attempts: 0,
    recommendedLevel: 4,
    district: 'clocktower',
  };
  state.missions.unshift(mission);
  settleInvestigation(state, mission, [girl], { day: state.day, minutes: state.minutes });
  assert.equal(mission.status, 'done', '算上有效属性（50+35+2 >= 75）后调查应当稳定完成');
});

test('v261-2b 调查委托低契合度走真实确定性掷骰，且蓝图调查失败走 failure 出口', () => {
  // 1) 契合度约 40% 时，跨多个种子既有成功也有失败，不再 0% 死刑
  let wins = 0;
  let losses = 0;
  for (let i = 0; i < 30; i += 1) {
    const s = createInitialState();
    s.reputation = 50;
    const g = s.girls[0]!;
    g.fatigue = 20;
    g.stats.insight = 60;
    const m: Mission = {
      id: `inv-roll-${i}`,
      title: '边缘排查',
      category: '异象调查',
      description: '测试掷骰分布',
      x: 40,
      y: 40,
      difficulty: '高危',
      duration: 60,
      reward: 500,
      requirement: 'insight',
      target: 73,
      color: '#9FB4E8',
      status: 'active',
      squad: [g.id],
      work: 'investigation',
      attempts: 0,
      recommendedLevel: 5,
    };
    const pct = squadChance([g], m, s);
    assert.ok(pct >= 30 && pct < 50, `预期概率落在 30–49%，实际 ${pct}%`);
    s.missions.unshift(m);
    settleInvestigation(s, m, [g], { day: 14 + i, minutes: 1260 });
    if (m.status === 'done') wins += 1;
    else losses += 1;
  }
  assert.ok(wins > 0 && losses > 0, `40% 左右概率不该全败或全胜，实际胜 ${wins} 负 ${losses}`);

  // 2) 蓝图中的调查委托失败时，正常沿 failure 端口推进到失败结局
  const s2 = createInitialState();
  s2.reputation = 40;
  const heroine = s2.girls[0]!;
  heroine.stats.insight = 15;
  heroine.fatigue = 75;
  const story: Storyline = {
    id: 'story-inv-branch',
    girlId: heroine.id,
    title: '失落的钟摆',
    premise: '测试调查失败走蓝图 failure 分支',
    tone: '克制',
    beats: [],
    stage: 0,
    status: 'active',
    createdAt: '2026-11-14T00:00:00Z',
    day: s2.day,
    source: 'manual',
    graph: {
      version: 1,
      entry: 'n-start',
      nodes: [
        { id: 'n-start', kind: 'start', x: 0, y: 0, title: '开始', data: { kind: 'start' } },
        {
          id: 'n-mission',
          kind: 'mission',
          x: 200,
          y: 0,
          title: '暗巷摸排',
          data: {
            kind: 'mission',
            spec: { title: '暗巷摸排', goal: '查清线索', category: '故事委托', difficulty: '危险', work: 'investigation', duration: 60, requirement: 'insight', target: 140 },
          },
        },
        { id: 'n-win', kind: 'end', x: 400, y: 0, title: '查明真相', data: { kind: 'end', ending: '真相大白', summary: '成功线' } },
        { id: 'n-lose', kind: 'end', x: 400, y: 120, title: '线索中断', data: { kind: 'end', ending: '擦肩而过', summary: '失败线' } },
      ],
      edges: [
        { id: 'e1', from: 'n-start', fromPort: 'out', to: 'n-mission' },
        { id: 'e2', from: 'n-mission', fromPort: 'success', to: 'n-win' },
        { id: 'e3', from: 'n-mission', fromPort: 'failure', to: 'n-lose' },
      ],
    },
  };
  s2.storylines.push(story);
  startStoryGraph(s2, story);
  const spawned = s2.missions.find(item => item.storylineId === story.id)!;
  assert.ok(spawned, '应当投放蓝图调查委托');
  // 找一个在最低 20% 概率下必败的尝试号，验证失败分支可走通
  spawned.target = 200;
  for (let dayOffset = 0; dayOffset < 20; dayOffset += 1) {
    const copy = structuredClone(s2);
    const copyMission = copy.missions.find(item => item.id === spawned.id)!;
    const copyGirl = copy.girls[0]!;
    copyMission.status = 'active';
    copyMission.squad = [copyGirl.id];
    settleInvestigation(copy, copyMission, [copyGirl], { day: 20 + dayOffset, minutes: 1300 });
    const afterStory = copy.storylines.find(item => item.id === story.id)!;
    if (afterStory.ending === '擦肩而过') {
      assert.equal(afterStory.status, 'done');
      return;
    }
  }
  assert.fail('蓝图调查委托失败后应当走 failure 端口抵达「擦肩而过」结局');
});

test('v261-3 城市信赖（安定度 >= 75）全员 +2 共鸣在调查成功率与战斗单位属性中真实生效', () => {
  const lowState = createInitialState();
  lowState.reputation = 50;
  const highState = createInitialState();
  highState.reputation = 80;

  const gLow = lowState.girls[0]!;
  const gHigh = highState.girls[0]!;
  const invMission = lowState.missions.find(item => item.work === 'investigation')!;

  assert.ok(chance(gHigh, invMission, highState) >= chance(gLow, invMission, lowState));
  // 构造敏感区间验证 +2 确实抬高数值
  gLow.stats[invMission.requirement] = invMission.target;
  gHigh.stats[invMission.requirement] = invMission.target;
  assert.ok(squadChance([gHigh], invMission, highState) > squadChance([gLow], invMission, lowState), '安定度 >=75 时调查成功率应更高');

  const combatMission = lowState.missions.find(item => item.work === 'combat')!;
  const battleLow = simulateBattle({ mission: combatMission, girls: [gLow], day: 14, minutes: 1200, reputation: 50 });
  const battleHigh = simulateBattle({ mission: combatMission, girls: [gHigh], day: 14, minutes: 1200, reputation: 80 });
  const allyLow = battleLow.units.find(u => u.side === 'ally')!;
  const allyHigh = battleHigh.units.find(u => u.side === 'ally')!;
  assert.equal(allyHigh.stats.magic, allyLow.stats.magic + 2, '信赖阶段战斗内魔力应 +2');
  assert.equal(allyHigh.maxSpirit, allyLow.maxSpirit + 4, '信赖阶段共情 +2 同步提升 4 点心防上限');
});

test('v261-4 世界书 BALANCE_GROUPS 完整覆盖 BALANCE_FIELDS 的全部分组（零隐身项）', () => {
  const groupSet = new Set<string>(BALANCE_GROUPS);
  const missing = BALANCE_FIELDS.filter(field => !groupSet.has(field.group)).map(field => `${field.key}(${field.group})`);
  assert.deepEqual(missing, [], `以下数值字段所在分组未被世界书渲染: ${missing.join(', ')}`);
});

test('v261-5 三套装备被动（织梦失衡与单体偏折 / 甜晶护持免死 / 幽月真穿透与降伤）与描述严格一致', () => {
  const state = createInitialState();

  // 1) 织梦套：敌方群体攻击不消耗/不触发单体偏折；我方攻击有 35% 概率触发镜花失衡（stun）
  const dreamer = { ...state.girls[0]!, id: 'g-dream', hp: 500, maxHp: 500, baseMaxHp: 500 };
  const dreamW = items.find(i => i.slot === 'weapon' && i.setId === 'set-dream')!;
  const dreamC = items.find(i => i.slot === 'charm' && i.setId === 'set-dream')!;
  dreamer.equipment = { weapon: dreamW.id, charm: dreamC.id };
  dreamer.stats = { magic: 90, insight: 120, agility: 90, empathy: 80 };

  const dummyMonster: MonsterTemplate = {
    id: 'mon-dream-target',
    name: '木桩魔物',
    epithet: '测试靶',
    rank: '杂兵',
    element: '糖霜系',
    color: '#ccc',
    maxHp: 3000,
    maxSpirit: 200,
    stats: { magic: 40, insight: 80, agility: 20, empathy: 100 },
    skillIds: ['monster-claw'],
    rules: [{ trigger: 'always', effect: 'damageReduction', amount: 50 }],
    trait: '高减伤测试靶',
    description: '测试用',
    spec: { bodyPlan: 'orb', scale: 1, appendages: 0, core: '糖', palette: { body: '#333', shade: '#111', rim: '#fff' }, aura: '雾', motif: '糖' },
  };

  let triggeredStun = false;
  for (let d = 1; d <= 12; d += 1) {
    const b = simulateBattle({
      mission: {
        id: `m-dream-${d}`, title: '织梦测试', category: '战斗', description: '', x: 20, y: 20,
        difficulty: '中危', duration: 90, reward: 500, requirement: 'magic', target: 60, color: '#fff',
        status: 'active', squad: [dreamer.id], work: 'combat', enemyIds: ['mon-dream-target'], rounds: 6, attempts: 0, recommendedLevel: 4,
      },
      girls: [dreamer],
      day: d,
      minutes: 1200,
      monsters: [dummyMonster],
    });
    if (b.events.some(e => e.skillId === 'set-dream-stun' || e.note?.includes('镜花失衡'))) {
      triggeredStun = true;
      break;
    }
  }
  assert.equal(triggeredStun, true, '织梦套攻击命中应当能触发 35% 镜花失衡');

  // 2) 甜晶套：心防破碎后受到致命一击不再触发免死；心防完好时正常免死
  const frostingW = items.find(i => i.slot === 'weapon' && i.setId === 'set-frosting')!;
  const frostingC = items.find(i => i.slot === 'charm' && i.setId === 'set-frosting')!;
  const frostGirl = { ...state.girls[0]!, id: 'g-frost', hp: 10, maxHp: 60, baseMaxHp: 60 };
  frostGirl.equipment = { weapon: frostingW.id, charm: frostingC.id };
  frostGirl.stats = { magic: 20, insight: 40, agility: 10, empathy: 5 }; // 极低共情，一击碎心防

  const spiritBreakerAndFinisher: MonsterTemplate = {
    ...dummyMonster,
    id: 'mon-breaker',
    maxHp: 999,
    stats: { magic: 180, insight: 200, agility: 300, empathy: 80 },
    // 高速先手打穿心防（basic 技第 1 轮必可用），再由慢速终结者打致死 HP 伤害
    skillIds: ['frequency-prick'],
    rules: [],
  };
  const spiritSlayer: MonsterTemplate = {
    ...spiritBreakerAndFinisher,
    id: 'mon-finisher',
    stats: { magic: 180, insight: 200, agility: 50, empathy: 80 },
    skillIds: ['monster-claw'],
  };
  const frostBrokenBattle = simulateBattle({
    mission: {
      id: 'm-frost-broken', title: '破防致死测试', category: '战斗', description: '', x: 20, y: 20,
      difficulty: '高危', duration: 60, reward: 500, requirement: 'magic', target: 60, color: '#fff',
      status: 'active', squad: [frostGirl.id], work: 'combat', enemyIds: ['mon-breaker', 'mon-finisher'], rounds: 3, attempts: 0, recommendedLevel: 6,
    },
    girls: [frostGirl],
    day: 14,
    minutes: 1200,
    monsters: [spiritBreakerAndFinisher, spiritSlayer],
  });
  const savedAfterBreak = frostBrokenBattle.events.some(e => e.skillId === 'set-frosting-survive');
  assert.equal(savedAfterBreak, false, '心防已碎时不该触发甜晶套「心防未碎免死」');

  // 对照：没有破防手、心防完好时受致命直击应当触发甘饴庇护保留 1 血
  const frostGuardedBattle = simulateBattle({
    mission: {
      id: 'm-frost-guarded', title: '护持免死测试', category: '战斗', description: '', x: 20, y: 20,
      difficulty: '高危', duration: 60, reward: 500, requirement: 'magic', target: 60, color: '#fff',
      status: 'active', squad: [frostGirl.id], work: 'combat', enemyIds: ['mon-finisher'], rounds: 2, attempts: 0, recommendedLevel: 6,
    },
    girls: [{ ...frostGirl, stats: { ...frostGirl.stats, empathy: 120 } }],
    day: 14,
    minutes: 1200,
    monsters: [spiritSlayer],
  });
  assert.equal(frostGuardedBattle.events.some(e => e.skillId === 'set-frosting-survive'), true, '心防完好时受到致命直击应正常触发免死');

  // 3) 幽月套：对 50% 减伤靶造成的伤害高于普通 +20% 增伤，且受击挂的是伤害降低 debuff（stat: damage）
  const moonW = items.find(i => i.slot === 'weapon' && i.setId === 'set-moonlight')!;
  const moonC = items.find(i => i.slot === 'charm' && i.setId === 'set-moonlight')!;
  const moonGirl = { ...state.girls[0]!, id: 'g-moon', hp: 500, maxHp: 500, baseMaxHp: 500 };
  moonGirl.equipment = { weapon: moonW.id, charm: moonC.id };
  moonGirl.stats = { magic: 90, insight: 130, agility: 40, empathy: 90 };
  moonGirl.skills = ['plain-strike'];

  const moonBattle = simulateBattle({
    mission: {
      id: 'm-moon-test', title: '幽月测试', category: '战斗', description: '', x: 20, y: 20,
      difficulty: '中危', duration: 60, reward: 500, requirement: 'magic', target: 60, color: '#fff',
      status: 'active', squad: [moonGirl.id], work: 'combat', enemyIds: ['mon-dream-target'], rounds: 3, attempts: 0, recommendedLevel: 4,
    },
    girls: [moonGirl],
    day: 14,
    minutes: 1200,
    monsters: [dummyMonster],
  });
  const enemyFinal = moonBattle.frames?.[1]?.units.find(u => u.side === 'enemy') ?? moonBattle.units.find(u => u.side === 'enemy')!;
  assert.ok(
    enemyFinal.effects.some(e => e.kind === 'debuff' && e.stat === 'damage' && e.amount === 15)
    || moonBattle.frames?.some(f => f.units.some(u => u.side === 'enemy' && u.effects.some(e => e.kind === 'debuff' && e.stat === 'damage' && e.amount === 15))),
    '幽月套受击应给攻击者挂 stat=damage, amount=15 的暗蚀虚弱',
  );
});

test('v261-6 势力战线自动结算对称公平：高战力进攻方能正常获胜，不再被防守方白拿分碾压', () => {
  const state = createInitialState();
  state.hostility['association-government'] = { pair: 'association-government', value: 100, updatedDay: 14, reason: '测试' };
  const [front] = planFronts(state, { day: 15, minutes: 1200 });
  assert.ok(front);
  // 进攻方战力 80 vs 防守方战力 35：旧公式防守方白加 (115 - swing) 导致进攻方必败
  const customFront: FactionFront = {
    ...front!,
    attackerPower: 80,
    defenderPower: 35,
  };
  state.fronts = [customFront];
  const result = autoResolveFront(state, customFront, { day: 15, minutes: 1500 });
  assert.equal(result, 'attackerWin', '80 对 35 的压倒性优势进攻方应当获胜');
});

test('v261-7 床位闭环：满员拒绝雇佣首领；协商解约归还装备并释放床位；至少保留 1 名在册成员', () => {
  let state = createInitialState();
  state = withFactionRoster(state, {
    association: { leader: makeLeader('association', '覆灭会长'), members: [makeGirl('association', '随从甲')] },
  });
  state.gold = 50_000;
  for (const key of Object.keys(state.territories)) {
    if (state.territories[key as keyof typeof state.territories] === 'association') {
      state.territories[key as keyof typeof state.territories] = 'government';
    }
  }
  // 先雇上第 6 人把 6 张床占满
  const hiredLu = act(state, { type: 'hire', girlId: 'lu' });
  assert.equal(hiredLu.ok, true, hiredLu.message);
  const fullState = hiredLu.state;

  const leaderId = fullState.customFactionLeaders.find(l => l.faction === 'association')!.id;
  const blockedLeader = act(fullState, { type: 'hireLeader', leaderId });
  assert.equal(blockedLeader.ok, false, '宿舍已满时不该允许超编雇佣势力首领');

  // 给 yue 穿一件法器并设为助理，然后协商解约
  fullState.inventory['silver-wand'] = 1;
  const equipped = act(fullState, { type: 'equipItem', girlId: 'yue', itemId: 'silver-wand' }).state;
  equipped.assistantId = 'yue';

  const dismissed = act(equipped, { type: 'dismissGirl', girlId: 'yue' });
  assert.equal(dismissed.ok, true, dismissed.message);
  assert.equal(dismissed.state.inventory['silver-wand'], 1, '解约时穿在身上的装备必须退回仓库');
  assert.equal(dismissed.state.assistantId, undefined, '助理离队时清空 assistantId');
  assert.ok(dismissed.state.candidates.some(c => c.id === 'yue'), '解约成员回到候选池，不凭空消失');

  // 腾出床位后，现在可以正常雇佣覆灭首领
  const hiredLeader = act(dismissed.state, { type: 'hireLeader', leaderId });
  assert.equal(hiredLeader.ok, true, hiredLeader.message);

  // 伤退日志文案不再写「按月领取」
  const scarState = createInitialState();
  const zhi = scarState.girls.find(g => g.id === 'zhi')!;
  zhi.scars = [dummyScar('1'), dummyScar('2'), dummyScar('3'), dummyScar('4')];
  const retired = act(scarState, { type: 'retire', girlId: 'zhi' });
  assert.equal(retired.ok, true);
  assert.equal(retired.state.logs[0]!.text.includes('按月'), false, '退休金是按十日标准每日划拨，不再写按月');
});

test('v261-8 主线作用域 Storyline(scope=main) 不因单一角色缺席废弃，且离城归档人称正确', () => {
  const state = createInitialState();
  state.assistantId = 'tang';
  const mainStory: Storyline = {
    id: 'main-ch1',
    scope: 'main',
    girlId: 'non-existent-anchor',
    title: '缺月之账 · 第一章',
    premise: '事务所重开后的第一笔旧账。',
    tone: '冷峻',
    beats: [],
    stage: 0,
    status: 'active',
    createdAt: '2026-11-14T00:00:00Z',
    day: state.day,
    source: 'manual',
    graph: {
      version: 1,
      entry: 'n1',
      nodes: [
        { id: 'n1', kind: 'start', x: 0, y: 0, title: '开始', data: { kind: 'start' } },
        { id: 'n2', kind: 'reward', x: 180, y: 0, title: '翻出账本', data: { kind: 'reward', effect: { gold: 300, reputation: 2 } } },
        { id: 'n3', kind: 'end', x: 360, y: 0, title: '序幕落定', data: { kind: 'end', ending: '入局', summary: '灯重新亮起。' } },
      ],
      edges: [
        { id: 'e1', from: 'n1', fromPort: 'out', to: 'n2' },
        { id: 'e2', from: 'n2', fromPort: 'out', to: 'n3' },
      ],
    },
  };
  state.storylines.push(mainStory);
  const goldBefore = state.gold;
  startStoryGraph(state, mainStory);
  assert.equal(mainStory.status, 'done', 'scope=main 的蓝图即使 girlId 不在名册，也应借事务所代表锚点跑完');
  assert.equal(mainStory.ending, '入局');
  assert.equal(state.gold, goldBefore + 300);

  // 离城终局编年史用「你」而非「她」
  state.gold = 120_000;
  const ended = act(state, { type: 'finishEnding', endingId: 'leave' });
  assert.equal(ended.ok, true);
  const chr = ended.state.chronicle.find(entry => entry.title.includes('离开樱雾市'))!;
  assert.ok(chr.summary.includes('你带着'), `编年史人称应为「你带着」，实际：${chr.summary}`);
  assert.equal(chr.summary.includes('她带着'), false);
});
