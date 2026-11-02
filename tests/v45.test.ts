import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { buildGirlCard, parseGirlCard } from '../src/cards.ts';
import { sanitizeCardStorylines } from '../src/cardStory.ts';
import type { GameState } from '../src/types.ts';

/** 开一条真实故事线：yue 羁绊 60 后直接走 startStoryline，拿模板兜底。 */
function withStoryline(): GameState {
  const state = createInitialState();
  const yue = state.girls.find(girl => girl.id === 'yue')!;
  yue.bond = 60;
  const started = act(state, { type: 'startStoryline', girlId: 'yue' });
  assert.equal(started.ok, true, started.message);
  return started.state;
}

const plainCard = (name: string) => JSON.stringify({
  format: 'night-sugar/girl-card', version: 1, exportedAt: '2026-01-01T00:00:00.000Z', sourceDay: 1,
  girl: {
    name, codename: 'S-1', title: '测试卡', element: '星光系', color: '#8fd3c7', level: 3,
    stats: { magic: 60, insight: 60, agility: 60, empathy: 80 },
    skillIds: ['glimmer-spear', 'night-prayer', 'moon-phase'], traitIds: [], factionTag: 'none',
  },
});

test('v45 导出契约卡时把她的故事线一起带走，并且不夹带旧存档的委托 id', () => {
  const state = withStoryline();
  const yue = state.girls.find(girl => girl.id === 'yue')!;
  const card = buildGirlCard(yue, state);

  assert.ok(card.storylines?.length, '卡片里应该有故事线');
  const story = card.storylines![0]!;
  assert.equal(story.girlId, 'yue', '故事线记的是这位少女');
  assert.equal(story.title, state.storylines[0]!.title, '标题原样带过去');
  assert.ok(story.beats.length > 0, '幕要一起带走');
  for (const beat of story.beats) {
    assert.equal(beat.missionId, undefined, '旧存档的委托 id 不能进卡片');
    assert.equal(beat.eventId, undefined, '旧存档的事件 id 也不能进卡片');
  }

  // 另一位少女的卡不该带上别人的故事。
  const other = state.girls.find(girl => girl.id !== 'yue')!;
  assert.equal(buildGirlCard(other, state).storylines, undefined, '没有故事线的少女不带这个字段');
});

test('v45 卡片往返：解析后故事线还在，字段被洗净', () => {
  const state = withStoryline();
  const card = buildGirlCard(state.girls.find(girl => girl.id === 'yue')!, state);
  const parsed = parseGirlCard(JSON.stringify(card));
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message);
  const stories = (parsed as { card: ReturnType<typeof buildGirlCard> }).card.storylines;
  assert.equal(stories?.length, 1);
  assert.equal(stories![0]!.beats.every(beat => beat.missionId === undefined && beat.eventId === undefined), true);
  assert.equal(parsed.ok && parsed.card.girl.name, card.girl.name, '名字照旧');

  // 老卡（没有 storylines 字段）照旧能读。
  const legacy = parseGirlCard(plainCard('老卡'));
  assert.equal(legacy.ok, true, legacy.ok ? '' : legacy.message);
  assert.equal(legacy.ok && legacy.card.storylines, undefined, '老卡不带故事线，也不该伪造一个');
});

test('v45 导入卡：故事线跟着落地，girlId 指向新少女、旧引用全部清掉', () => {
  const source = withStoryline();
  const card = buildGirlCard(source.girls.find(girl => girl.id === 'yue')!, source);
  const parsed = parseGirlCard(JSON.stringify(card));
  assert.equal(parsed.ok, true);

  const target = createInitialState();
  const imported = act(target, { type: 'importCard', card: parsed.card });
  assert.equal(imported.ok, true, imported.message);
  assert.match(imported.message, /段故事线/, '提示里要说清带了几段');

  const girl = imported.state.candidates.find(entry => entry.name === card.girl.name)!;
  assert.ok(girl, '导入后应该在候选名册里');
  const story = imported.state.storylines.find(entry => entry.girlId === girl.id);
  assert.ok(story, '故事线要落到新少女名下');
  assert.ok(story!.id.startsWith('card-story-'), 'id 要重写，避免和原存档撞号');
  assert.equal(story!.beats.every(beat => beat.missionId === undefined), true, '旧委托 id 不能带进来');
});

test('v45 重复导入同一张卡被拦下；故事线有推进时按新版本覆盖', () => {
  const source = withStoryline();
  const card = buildGirlCard(source.girls.find(girl => girl.id === 'yue')!, source);
  const target = createInitialState();
  const once = act(target, { type: 'importCard', card: parseGirlCard(JSON.stringify(card)).ok ? (parseGirlCard(JSON.stringify(card)) as { card: typeof card }).card : card });
  assert.equal(once.ok, true, once.message);

  const again = act(once.state, { type: 'importCard', card: (parseGirlCard(JSON.stringify(card)) as { card: typeof card }).card });
  assert.equal(again.ok, false, '同一张卡不能重复登记');
  assert.match(again.message, /已经导入过/);

  // 故事线往前走了一段后再导出，导入应当识别成「新版本」。
  const moved = { ...card, storylines: card.storylines!.map(story => ({ ...story, stage: Math.min(story.stage + 1, story.beats.length - 1), status: 'done' as const })) };
  const updated = act(once.state, { type: 'importCard', card: (parseGirlCard(JSON.stringify(moved)) as { card: typeof moved }).card });
  assert.equal(updated.ok, true, updated.message);
  assert.match(updated.message, /故事线/);
});

test('v45 卡片里的故事线最多留三段，且只保留一条进行中', () => {
  const beat = { id: 'b1', index: 0, title: '第一幕', summary: '', scene: '', hook: '', choices: [], status: 'open' as const };
  const make = (index: number, status: 'active' | 'done') => ({ id: `s${index}`, girlId: 'x', title: `第${index}段`, premise: '', tone: '', beats: [beat], stage: 0, status, createdAt: '2026-01-01T00:00:00.000Z', day: 1, source: 'template' as const, slot: index });
  const cleaned = sanitizeCardStorylines([make(1, 'active'), make(2, 'active'), make(3, 'done'), make(4, 'done')]);
  assert.equal(cleaned.length, 3, '超过三段的部分要丢掉');
  assert.equal(cleaned.filter(story => story.status === 'active').length, 1, '同时只留一条进行中');
  assert.equal(sanitizeCardStorylines('nonsense').length, 0);
  assert.equal(sanitizeCardStorylines([{ title: '' }]).length, 0, '没有标题的条目直接丢');
});
