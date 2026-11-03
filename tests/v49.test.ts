import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { DEFAULT_PROMPTS, composeTaskSystem, ensurePromptScopes, presetPrompts, presetRuntime, promptHasMechanicBan, promptTokens, type ChatPreset } from '../src/presets.ts';
import { SECTION_PROMPTS, STORY_LIMITS, storylineContract } from '../src/promptSections.ts';
import { MACRO_GROUPS, resolveMacros } from '../src/promptMacros.ts';
import { battleHistoryText, chatHistoryText, dossierOf, missionHistoryText, storylineHistoryText } from '../src/girlDossier.ts';
import { NODE_LABELS } from '../src/storygraph.ts';
import type { GameState, Girl, MissionRun, Storyline } from '../src/types.ts';

const girl = (): Girl => createInitialState().girls[0]!;

function withRuntime(entries = DEFAULT_PROMPTS) {
  return { ...presetRuntime(undefined), entries };
}

test('v49 分区：十三条新词条都在默认词条里，且不会误报「禁止数值」', () => {
  assert.equal(SECTION_PROMPTS.length, 13);
  for (const section of SECTION_PROMPTS) {
    const found = DEFAULT_PROMPTS.find(entry => entry.id === section.id);
    assert.ok(found, `缺少分区 ${section.id}`);
    assert.equal(found?.scope, section.scope);
    assert.equal(promptHasMechanicBan(section.content), false, `${section.id} 被误判成禁止数值`);
  }
  assert.equal(DEFAULT_PROMPTS.length, 27);
});

test('v49 迁移：旧预设补到 schema 5，只补缺、不覆盖同 id 的自定义词条', () => {
  const preset: ChatPreset = {
    id: 'custom', name: '老预设', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', schema: 4,
    settings: {}, prompts: [{ id: 'sl-ports', name: '我改过的连线', content: '只走 out。', role: 'system', enabled: true, scope: 'storyline' }],
  };
  const migrated = ensurePromptScopes(preset);
  assert.equal(migrated.schema, 5);
  assert.equal(migrated.prompts?.find(entry => entry.id === 'sl-ports')?.content, '只走 out。');
  const ids = presetPrompts(migrated).map(entry => entry.id);
  for (const section of SECTION_PROMPTS) assert.ok(ids.includes(section.id), `没补上 ${section.id}`);
  assert.ok(migrated.promptOrder?.some(item => item.identifier === 'sl-structure'), '新补的 id 必须进 promptOrder，否则不会注入');
  const again = ensurePromptScopes(migrated);
  assert.equal(presetPrompts(again).length, presetPrompts(migrated).length, '第二次迁移不该重复添加');
});

test('v49 主角档案：九节齐全，魔女化时用魔女化人格', () => {
  const state = createInitialState();
  const target = { ...state.girls[0]!, corruption: 60, witch: true, witchPersonality: '她把声音压成一条线。' };
  const text = dossierOf(target, state);
  for (const label of ['身份', '外形', '性情', '能力', '此刻', '关系', '心愿', '契约', '随身']) {
    assert.ok(text.includes(label), `档案缺少「${label}」`);
  }
  assert.ok(text.includes('她把声音压成一条线。'), '魔女化要用魔女化人格');
  assert.ok(text.includes('出身') && text.includes('雇主 夜糖事务所'), '出身与雇主必须分开写');
  assert.ok(text.includes('这里没列出的事她不知道'), '末尾要附不编造的边界');
  assert.ok(promptTokens(text) <= 820, `档案超预算：${promptTokens(text)}`);
  const brief = dossierOf(target, state, { brief: true });
  assert.ok(promptTokens(brief) <= 160 && brief.length < text.length, '压缩版要明显更短');
});

test('v49 宏：名册与主角各司其职，枚举直接读代码常量', () => {
  const state = createInitialState();
  const girls = resolveMacros('{{girls}}', { state }).text;
  assert.ok(girls.includes(state.girls[0]!.id) && girls.includes('羁绊'), '名册要带 id 与关系');
  assert.ok(!girls.includes('【'), '名册不该带档案小节');
  const heroine = resolveMacros('{{heroine}}', { state, focus: state.girls[0] }).text;
  assert.ok(heroine.includes('身份') && heroine.includes('心愿'));
  const kinds = resolveMacros('{{kinds}}', { state }).text;
  assert.equal(kinds, Object.keys(NODE_LABELS).join('、'));
  const limits = resolveMacros('{{limits}}', { state }).text;
  assert.ok(limits.includes(`${STORY_LIMITS.minNodes}–${STORY_LIMITS.maxNodes}`));
  assert.equal(resolveMacros('{{heroine}}', {}).text, '（本任务没有指定主角）');
});

test('v49 历史：任务经历取最近几次，旧档从战报派生，空档说清楚', () => {
  const state = createInitialState();
  const target = state.girls[0]!;
  const run = (index: number): MissionRun => ({
    id: `run-${index}`, missionId: `m-${index}`, title: `委托 ${index}`, work: 'investigation', category: '调查',
    day: 10 + index, minutes: 600, girlIds: [target.id], outcome: 'success', reward: 800,
  });
  state.missionRuns = [run(3), run(2), run(1), run(0)];
  const text = missionHistoryText(state, target, 2);
  assert.ok(text.includes('委托 2') && !text.includes('委托 0'), '只取最近两次');
  assert.ok(text.includes('还有 2 次更早'), '要标出省略了多少条');
  assert.equal(missionHistoryText(createInitialState(), target, 4), '最近没有出勤记录。');
});

test('v49 历史：故事线写出走过的幕与当时的选择', () => {
  const state = createInitialState();
  const target = state.girls[0]!;
  const story: Storyline = {
    id: 's-1', girlId: target.id, title: '雨里的信', premise: '她有一封没寄出的信', tone: '', stage: 1, status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z', day: 12, source: 'llm', slot: 1,
    beats: [
      { id: 'b1', index: 0, title: '门口', summary: '', scene: '', hook: '', status: 'done', choices: [{ id: 'c1', label: '让她进来', intent: '', effect: {} }], resolvedChoiceId: 'c1' },
      { id: 'b2', index: 1, title: '热水', summary: '', scene: '', hook: '', status: 'open', choices: [] },
    ],
  };
  state.storylines = [story];
  const text = storylineHistoryText(state, target, 3);
  assert.ok(text.includes('第 1 段「雨里的信」'), '要写段号与标题');
  assert.ok(text.includes('门口（选了「让她进来」）'), '要写当时的选择');
  assert.ok(text.includes('现在停在：热水'), '要标出当前停在哪一幕');
});

test('v49 历史：聊天记录跳过旁白，按预算留最近的并标注省略', () => {
  const state = createInitialState();
  const target = state.girls[0]!;
  state.messages[target.id] = Array.from({ length: 40 }, (_, index) => ({
    role: index % 3 === 2 ? 'system' as const : index % 2 ? 'girl' as const : 'player' as const,
    text: `第 ${index + 1} 句`,
    action: index % 2 ? '她把杯子放下' : undefined,
  }));
  const text = chatHistoryText(state, target, 10);
  assert.ok(!text.includes('第 39 句') || text.includes('第 40 句'), '只保留最近几条');
  assert.ok(text.includes('第 40 句'), '最新一句必须在');
  assert.ok(text.includes('（她把杯子放下）'), '动作要跟着台词');
  assert.ok(promptTokens(text) <= 440, `聊天记录超预算：${promptTokens(text)}`);
  state.messages[target.id] = [{ role: 'system', text: '旁白不算' }];
  assert.equal(chatHistoryText(state, target, 10), '还没有聊过。', '旁白不算聊天');
});

test('v49 历史：战斗记录按 ally-<id> 找得到本人', () => {
  const state = createInitialState();
  const target = state.girls[0]!;
  state.battles = [{
    id: 'b-1', missionId: 'm-1', missionTitle: '糖街的雨', round: 3, rounds: 5, startedAt: { day: 12, minutes: 600 },
    outcome: 'victory', scars: [{ id: 'sc-1' }],
    units: [{ uid: `ally-${target.id}`, side: 'ally', dealt: 120, taken: 40, healed: 10 }],
  } as never];
  const text = battleHistoryText(state, target, 4);
  assert.ok(text.includes('糖街的雨') && text.includes('胜利') && text.includes('留下 1 道疤'));
  assert.equal(battleHistoryText(state, createInitialState().girls[1]!, 4), '还没有参加过战斗。', '别人的战报不该混进来');
});

test('v49 拼装：分区在前、契约在最后，删掉一段就真的消失', () => {
  const state = createInitialState();
  const focus = state.girls[0];
  const full = composeTaskSystem(storylineContract(), withRuntime(), 'storyline', {}, { state, focus });
  assert.ok(full.system.includes('【连线总则'), '默认分区要注入');
  assert.ok(full.system.trimEnd().endsWith('不要给 x、y、边 id、颜色或 note。'), `契约必须在最后：${full.system.slice(-80)}`);
  const trimmed = composeTaskSystem(storylineContract(), withRuntime([DEFAULT_PROMPTS.find(entry => entry.id === 'sl-structure')!]), 'storyline', {}, { state, focus });
  assert.equal(trimmed.system.includes('【连线总则'), false, '删掉的分区不该被补回来');
  assert.ok(trimmed.system.trimEnd().endsWith('不要给 x、y、边 id、颜色或 note。'), '契约不受词条增删影响');
});

test('v49 可覆盖：把提案目录改成自定义文本后，默认目录不再出现', () => {
  const state = createInitialState();
  const custom = DEFAULT_PROMPTS.filter(entry => entry.scope === 'daily').map(entry => entry.id === 'dy-catalog'
    ? { ...entry, content: '【今晚的目录】只写你看见的东西。' }
    : entry);
  const composed = composeTaskSystem('{"version":2}', withRuntime(custom), 'daily', {}, { state });
  assert.ok(composed.system.includes('只写你看见的东西'));
  assert.equal(composed.system.includes('【今晚的机制目录】'), false, '默认目录必须让位给玩家写的');
});

test('v49 宏面板：分组键名与文档一致，点一下能插进词条', () => {
  const keys = MACRO_GROUPS.flatMap(group => group.items.map(item => item.key));
  for (const key of ['heroine', 'heroine:brief', 'history.missions:6', 'history.storylines', 'history.chat:20', 'history.battles:4', 'girls', 'factions', 'leaders', 'districts', 'items:3', 'missions', 'kinds', 'limits']) {
    assert.ok(keys.includes(key), `宏面板缺少 ${key}`);
  }
  assert.equal(resolveMacros('{{history.chat:20}}', { state: createInitialState(), focus: girl() }).missing.length, 0);
});
