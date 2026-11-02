import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { buildNightCatalog, materializeNightProposal, validateNightProposal } from '../src/llm-night.ts';
import { pickEquipmentOfTier, pickMissionTemplate } from '../src/nightPick.ts';
import { storyMissionForBeat } from '../src/rules/storyRun.ts';
import type { Storyline } from '../src/types.ts';

const girl = () => createInitialState().girls[0]!;

/** v47 的新形状：委托只写 title / description / work / difficulty，装备只写阶级。 */
function slimProposal() {
  const state = createInitialState();
  const author = state.girls[0]!;
  return {
    state,
    raw: {
      version: 2,
      mission: { title: '灯塔下的回声', description: '巡检队说灯每到整点就自己转向，海雾里有人在跟着数拍子。', work: 'combat', difficulty: '中危' },
      opinions: [{
        authorId: author.id, authorKind: 'girl', topic: '经费', faction: 'witch',
        title: '多留一盏灯', text: '她想给值夜的人多留一盏灯，代价是这一周的预算要挪一挪。', request: '把本周结余的一半拨给值夜灯油。',
        dialogue: [
          { speakerId: author.id, speaker: author.name, text: '灯灭的那几分钟，谁都不好过。', expression: 'sad' },
          { speakerId: author.id, speaker: author.name, text: '我可以少睡一点，灯不能少。', expression: 'calm' },
          { speakerId: author.id, speaker: author.name, text: '账我算过了，就这一周。', expression: 'angry' },
        ],
        options: [
          { id: 'accept', label: '批准', effect: '多一盏灯，账上少一笔。', changes: [{ kind: 'gold', amount: -600 }, { kind: 'reputation', amount: 1 }], outcomes: [] },
          { id: 'reject', label: '驳回', effect: '灯不添，人也留不住。', changes: [{ kind: 'girl', girlId: author.id, field: 'bond', amount: -2 }, { kind: 'faction', faction: 'witch', amount: -4 }, { kind: 'gold', amount: -300 }], outcomes: [] },
        ],
      }],
      envoy: { faction: 'association', title: '协会的临时借调', description: '协会想借调一个人去替他们清点旧档案，说是清点，其实是认人。', work: 'investigation', difficulty: '中危' },
      loot: [{ tier: 3, slot: 'charm', faction: 'witch' }],
    },
  };
}

test('v47 提案只写难度也能通过，数值由模板补齐', () => {
  const { state, raw } = slimProposal();
  const checked = validateNightProposal(raw, state);
  assert.equal(checked.ok, true, checked.errors.join('；'));
  const mission = checked.proposal!.mission;
  assert.equal(mission.work, 'combat');
  assert.ok(mission.duration >= 45 && mission.duration <= 180, '时长从模板来');
  assert.ok(mission.reward >= 400, '报酬从模板来');
  assert.ok(mission.enemyRefs.length > 0, '战斗委托必须有敌人组合');
});

test('v47 提案只要 accept / reject 两个分支，暂缓由程序补回来', () => {
  const { state, raw } = slimProposal();
  const checked = validateNightProposal(raw, state);
  assert.equal(checked.ok, true, checked.errors.join('；'));
  assert.equal(checked.proposal!.opinions![0]!.options.length, 2, '模型只写两条');

  const built = materializeNightProposal(checked.proposal!, state);
  const options = built.opinions[0]!.options;
  assert.equal(options.length, 3, '落库后仍是三个按钮');
  const defer = options.find(option => option.id === 'defer');
  assert.ok(defer, '暂缓要由程序补');
  const changes = defer!.changes ?? [];
  assert.ok(changes.some(change => change.kind === 'girl' && change.field === 'bond' && change.amount === -1), '越权的羁绊 −1');
  assert.ok(changes.some(change => change.kind === 'faction' && change.amount === -2), '势力态度 −2');
  assert.equal((defer!.outcomes ?? []).length, 0, '暂缓没有结构性后果');
});

test('v47 掉落只给阶级：落库时换成真实成品，不再新造装备', () => {
  const { state, raw } = slimProposal();
  const checked = validateNightProposal(raw, state);
  assert.equal(checked.ok, true, checked.errors.join('；'));
  assert.equal(checked.proposal!.loot[0]!.itemId !== undefined, true, '解析时就已经指向真实物品');

  const built = materializeNightProposal(checked.proposal!, state);
  assert.equal(built.items.length, 0, '不再造 lm_item_* 这种一次性装备');

  const picked = pickEquipmentOfTier({ tier: 3, slot: 'charm', seed: 'fixed' });
  assert.ok(picked, '三阶护符应当能抽到');
  assert.notEqual(picked!.slot, 'consumable', '默认不抽消耗品');
});

test('v47 目录不再塞完整物品表与魔物表，只给装备阶级', () => {
  const state = createInitialState();
  const catalog = buildNightCatalog(state);
  assert.equal('items' in catalog, false);
  assert.equal('monsters' in catalog, false);
  const tiers = catalog.itemTiers;
  assert.ok(tiers.length >= 3, '至少要能列出三个阶级');
  assert.ok(tiers.every(row => row.examples.length <= 3));
  assert.ok(tiers.some(row => row.tier === 1));
});

test('v47 抽委托模板：同种子结果稳定，work 会筛选池子', () => {
  const state = createInitialState();
  const a = pickMissionTemplate({ state, work: 'combat', difficulty: '高危', seed: 'story-1:beat-1' });
  const b = pickMissionTemplate({ state, work: 'combat', difficulty: '高危', seed: 'story-1:beat-1' });
  assert.equal(a?.template.id, b?.template.id, '同一幕每次抽到同一条');
  assert.equal(a?.work, 'combat');
  assert.ok((a?.enemyIds.length ?? 0) > 0, '战斗模板要带魔物组合');

  const other = pickMissionTemplate({ state, work: 'investigation', difficulty: '中危', seed: 'story-1:beat-1' });
  assert.equal(other?.work, 'investigation');
  assert.equal(other?.enemyIds.length, 0, '调查委托没有敌人');
});

test('v47 蓝图阶段委托只写 work 时，战斗模板的魔物组合会被沿用', () => {
  const state = createInitialState();
  const girl0 = state.girls[0]!;
  const story = {
    id: 'story-test', girlId: girl0.id, title: '测试故事', premise: '', tone: '',
    beats: [], stage: 0, status: 'active', createdAt: '2026-01-01T00:00:00.000Z', day: state.day, source: 'manual',
  } as unknown as Storyline;
  const beat = {
    id: 'beat-1', index: 0, title: '第一幕', summary: '旧摘要', scene: '', hook: '', choices: [],
    status: 'open' as const,
    mission: { title: '封港之夜', goal: '在封港之前把这批东西清出去。', category: '故事委托', difficulty: '棘手', work: 'combat' as const, duration: 90 },
  };
  const mission = storyMissionForBeat(state, story, beat);
  assert.equal(mission.work, 'combat');
  assert.ok((mission.enemyIds?.length ?? 0) > 0, '战斗委托必须带上模板的魔物组合');
  assert.equal(mission.description, '在封港之前把这批东西清出去。', '描述用模型写的 goal');
  assert.equal(mission.storylineId, story.id);
});
