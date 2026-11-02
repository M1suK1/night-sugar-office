import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE_FIELDS, DEFAULT_BALANCE, resetBalance, sanitizeBalance, saveBalance } from '../src/balance.ts';
import { maybeQueueWhisper, whisperChance } from '../src/rules/whisper.ts';
import { createInitialState } from '../src/game.ts';
import type { GameState, Girl, Storyline } from '../src/types.ts';

afterEach(() => resetBalance());

const calm: Parameters<typeof whisperChance>[0] = {
  success: true, bond: 0, fatigue: 0, corruption: 0, hp: 100, maxHp: 100, storyline: false,
};

test('v44 数值规则新增六个私语字段，缺项回落默认、越界被夹取', () => {
  const keys = ['whisperVictoryPct', 'whisperDefeatPct', 'whisperBondMaxPct', 'whisperStoryPct', 'whisperMaxPct', 'whisperDailyCap'];
  for (const key of keys) {
    assert.ok(BALANCE_FIELDS.some(field => field.key === key), `数值规则里应该有 ${key}`);
    assert.equal(sanitizeBalance({})[key as keyof typeof DEFAULT_BALANCE], DEFAULT_BALANCE[key as keyof typeof DEFAULT_BALANCE], `${key} 缺项时取默认`);
  }
  const legacy = sanitizeBalance({ clinicBase: 200, clinicPerHp: 11 });
  assert.equal(legacy.clinicBase, 200, '老配置照旧生效');
  assert.equal(legacy.whisperVictoryPct, 30, '老配置没有私语字段时补默认值');
  const clamped = sanitizeBalance({ whisperVictoryPct: 999, whisperDailyCap: 0, whisperMaxPct: 5 });
  assert.equal(clamped.whisperVictoryPct, 100);
  assert.equal(clamped.whisperDailyCap, 1);
  assert.equal(clamped.whisperMaxPct, 10);
});

test('v44 whisperChance：胜利/失败基准、羁绊加成与封顶都跟着数值规则走', () => {
  assert.equal(whisperChance(calm), 0.3, '默认胜利基准 30%');
  assert.equal(whisperChance({ ...calm, bond: 100 }), 0.5, '羁绊拉满 +20%');
  assert.equal(whisperChance({ ...calm, success: false, bond: 0 }), 0.55, '失败基准 45%，低羁绊再 +10%');
  assert.equal(whisperChance({ ...calm, success: false, bond: 100 }), 0.45, '失败时高羁绊不再加成');

  saveBalance({ ...DEFAULT_BALANCE, whisperVictoryPct: 100 });
  assert.equal(whisperChance({ ...calm, bond: 100, fatigue: 90, corruption: 80 }), 0.85, '无论如何不超过封顶 85%');

  saveBalance({ ...DEFAULT_BALANCE, whisperVictoryPct: 0, whisperBondMaxPct: 0 });
  assert.equal(whisperChance(calm), 0, '把基准调到 0 就完全不发');
});

test('v44 whisperChance：故事线角色取专用档，不吃疲劳与侵蚀修正', () => {
  const hurt = { ...calm, fatigue: 100, corruption: 100, hp: 1 };
  assert.equal(whisperChance({ ...hurt, storyline: true }), 1, '默认 100%：只要出勤就必发');
  saveBalance({ ...DEFAULT_BALANCE, whisperStoryPct: 60 });
  assert.equal(whisperChance({ ...hurt, storyline: true }), 0.6, '故事线档位也能改');
  assert.equal(whisperChance(hurt), 0.55, '普通角色仍然是 30% 基准 + 疲劳 10% + 侵蚀 15%');
});

function board(girls: Girl[], storylines: Storyline[]): GameState {
  const base = createInitialState();
  return {
    ...base,
    girls,
    storylines,
    whisperQueue: [],
    whisperUnread: {},
    lastWhisperDay: {},
  } as GameState;
}

const storylineFor = (girlId: string): Storyline => ({ id: `sl-${girlId}`, girlId, status: 'active' } as unknown as Storyline);

test('v44 故事线角色优先占位：普通角色概率为 0 时，只有故事线角色会收到私语', () => {
  const state = createInitialState();
  const [a, b] = state.girls;
  const girls = [{ ...a!, bond: 10 }, { ...b!, bond: 10 }];
  saveBalance({ ...DEFAULT_BALANCE, whisperVictoryPct: 0, whisperDefeatPct: 0, whisperBondMaxPct: 0, whisperStoryPct: 100 });

  const next = board(girls, [storylineFor(girls[1]!.id)]);
  maybeQueueWhisper(next, next.missions[0]!, next.girls, 'victory');

  assert.equal(next.whisperQueue?.length, 1, '只该有一条');
  assert.equal(next.whisperQueue?.[0]?.girlId, girls[1]!.id, '入队的是正在走故事线的那位');
  assert.equal(next.lastWhisperDay?.[girls[1]!.id], next.day, '记下当天已抽过');
});

test('v44 每晚上限可调：设成 1 时三名故事线角色也只入队一条', () => {
  const state = createInitialState();
  const girls = state.girls.slice(0, 3).map(girl => ({ ...girl, bond: 10 }));
  saveBalance({ ...DEFAULT_BALANCE, whisperStoryPct: 100, whisperDailyCap: 1 });

  const next = board(girls, girls.map(girl => storylineFor(girl.id)));
  maybeQueueWhisper(next, next.missions[0]!, next.girls, 'victory');
  assert.equal(next.whisperQueue?.length, 1, '上限 1 就只排一条');
  assert.equal(next.whisperQueue?.[0]?.girlId, girls[0]!.id, '故事线角色内部保持原顺序');
});

test('v44 已经在队列里的角色不会被重复入队', () => {
  const state = createInitialState();
  const girls = state.girls.slice(0, 2).map(girl => ({ ...girl, bond: 10 }));
  saveBalance({ ...DEFAULT_BALANCE, whisperStoryPct: 100, whisperDailyCap: 6 });
  const next = board(girls, girls.map(girl => storylineFor(girl.id)));

  maybeQueueWhisper(next, next.missions[0]!, next.girls, 'victory');
  const first = next.whisperQueue?.length ?? 0;
  assert.equal(first, 2);
  maybeQueueWhisper(next, next.missions[0]!, next.girls, 'victory');
  assert.equal(next.whisperQueue?.length, first, '同一天同一角色不重复抽');
});
