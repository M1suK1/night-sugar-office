import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { councilCapacity, openingGaps } from '../src/opening.ts';
import { buildNightPrompt } from '../src/llm-night.ts';


test('v143 会客厅等级决定每天能摆几条议题', () => {
  const base = createInitialState();
  const level = (value: number) => ({ ...base, rooms: base.rooms.map(room => room.type === 'lounge' ? { ...room, level: value } : room) });
  assert.equal(councilCapacity(level(1)), 3);
  assert.equal(councilCapacity(level(2)), 3);
  assert.equal(councilCapacity(level(3)), 4);
  assert.equal(councilCapacity(level(4)), 5);
  // 开局补缺也跟着这个上限走
  const opening = openingGaps(level(4));
  assert.equal(opening.opinions <= 5 && opening.opinions >= 0, true);
});

test('v143 提案接收上限跟着会客厅等级（2 级 3 条 … 4 级 5 条）', async () => {
  const base = createInitialState();
  const level = (value: number) => ({ ...base, rooms: base.rooms.map(room => room.type === 'lounge' ? { ...room, level: value } : room) });
  const { opinionCapFor } = await import('../src/llm-night.ts');
  assert.equal(opinionCapFor(level(1)), 3);
  assert.equal(opinionCapFor(level(2)), 3);
  assert.equal(opinionCapFor(level(3)), 4);
  assert.equal(opinionCapFor(level(4)), 5);
});

test('v143 提案提示词里的条数按会客厅上限与缺口说话', () => {
  const base = createInitialState();
  const state = { ...base, rooms: base.rooms.map(room => room.type === 'lounge' ? { ...room, level: 4 } : room) };
  const prompt = buildNightPrompt(state);
  assert.match(prompt, /条议题/);
  assert.match(prompt, /本次需要 \d+ 条议题/);
});
