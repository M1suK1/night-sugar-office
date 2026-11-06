import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import type { FactionRoster, GameState } from '../src/types.ts';
import { customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { buildMeetEvent } from '../src/rules/summon.ts';
import { focusGirlOf, focusRoleOf } from '../src/storyFocus.ts';
import { storyPersonOf } from '../src/storySubject.ts';
import { dossierOf } from '../src/girlDossier.ts';
import { factionSnapshotText } from '../src/factionSnapshot.ts';
import { resolveMacros } from '../src/promptMacros.ts';

/** 一份从卡库编进月蚀庭的首领，配上她的座位。 */
const leader = customLeaderOf('witch', subjectOfCustom({
  id: 'card-leader-1', name: '青灯', factionTag: 'witch', level: 10, color: '#8a7bd6',
  portrait: '', stats: { magic: 70, insight: 62, agility: 55, empathy: 66 },
  skillIds: [], title: '蚀月祭司', quote: '这一夜归我管。',
  codename: '青灯',
}));

function stateWithLeader(): GameState {
  const state = createInitialState();
  const roster: FactionRoster = { leaderId: '', memberIds: [] };
  return {
    ...state,
    customFactionLeaders: [leader],
    factionRoster: {
      ...(state.factionRoster ?? { association: roster, government: roster, witch: roster }),
      witch: { leaderId: leader.id, memberIds: [] },
    },
  };
}

test('v121 首领约谈：主角认得出名册里的首领，提示词不再是「没有指定主角」', () => {
  const state = stateWithLeader();
  const event = buildMeetEvent(state, 'witch', leader.name, leader.id);
  assert.equal(event.girlId, leader.id);

  const focus = focusGirlOf(state, event);
  assert.ok(focus, '主角必须能找到 — 找不到时提示词会写「（本任务没有指定主角）」');
  assert.equal(focus!.name, '青灯');
  assert.equal(focusRoleOf(state, event), '月蚀庭首领');

  const { text, missing } = resolveMacros('【她是谁】\n{{heroine}}', { state, focus: focus!, focusRole: '月蚀庭首领' });
  assert.deepEqual(missing, [], '没有未解析的宏');
  assert.ok(!text.includes('本任务没有指定主角'), text);
  assert.ok(text.includes('青灯'));
  assert.ok(text.includes('月蚀庭首领'), '提示词要说明她是哪一方的首领');
  assert.ok(!text.includes('雇主 夜糖事务所'), '她是首领，不是事务所的契约者');
});

test('v121 首领约谈：App 那边能找到 target，所以续写不会静默中断', () => {
  const state = stateWithLeader();
  const event = buildMeetEvent(state, 'witch', leader.name, leader.id);
  // App.submitStoryTurn 的门槛：拿不到 target 就直接 return，叙事者永远不会回。
  const target = storyPersonOf(state, event.girlId);
  assert.ok(target, '这一条以前返回 undefined，玩家写完一句就断线');
  assert.equal(target!.role, '月蚀庭首领');
  assert.equal(target!.girl.name, '青灯');
});

test('v121 首领档案：带上她的位置，也仍然保留卡面信息', () => {
  const state = stateWithLeader();
  const person = storyPersonOf(state, leader.id)!;
  const text = dossierOf(person.girl, state, { role: person.role });
  assert.ok(text.includes('月蚀庭首领'), text);
  assert.ok(text.includes('蚀月祭司'), '头衔要留着');
  assert.ok(text.includes('这一夜归我管。'), '出场白要留着');
  assert.ok(!text.includes('契约：第'), '她不是契约者，不该有契约行');
  assert.ok(!text.includes('关系：对所长'), '她与所长没有好感度');
});

test('v121 随从与候选照样认得，契约者仍然走原路', () => {
  const state = stateWithLeader();
  const girl = state.girls[0]!;
  assert.equal(storyPersonOf(state, girl.id)?.role, undefined);
  assert.equal(storyPersonOf(state, girl.id)?.girl.name, girl.name);
  assert.equal(storyPersonOf(state, 'nobody-at-all'), undefined);
});

test('v122 首领档案带上卡面的外貌与性情，不再是「外形：不详」', () => {
  const dressed = customLeaderOf('witch', subjectOfCustom({
    id: 'card-leader-2', name: '白露', factionTag: 'witch', level: 10, color: '#8a7bd6',
    portrait: '', stats: { magic: 60, insight: 60, agility: 60, empathy: 60 }, skillIds: [],
    title: '蚀月祭司', quote: '别点灯。', appearance: '银白长发垂到腰，左眼下有一道旧疤。',
    personality: '说话很轻，笑起来才露出尖牙。',
  }));
  const state = stateWithLeader();
  const withDressed: GameState = {
    ...state,
    customFactionLeaders: [dressed],
    factionRoster: { ...state.factionRoster!, witch: { leaderId: dressed.id, memberIds: [] } },
  };
  const person = storyPersonOf(withDressed, dressed.id)!;
  assert.equal(person.girl.appearance, '银白长发垂到腰，左眼下有一道旧疤。');
  const text = dossierOf(person.girl, withDressed, { role: person.role });
  assert.ok(text.includes('银白长发垂到腰'), text);
  assert.ok(!text.includes('外形：不详'), '外貌要真的写进提示词');
});

test('v122 局面：三方火气与该方对事务所的态度都进得了提示词', () => {
  const state = stateWithLeader();
  const text = factionSnapshotText(state, 'witch');
  assert.ok(text.includes('【今夜的三方局面】'), text);
  assert.ok(text.includes('火气'), text);
  assert.ok(text.includes('星灯协会'), '三条火气线都要在');
  assert.ok(text.includes('樱雾市役所'));
  assert.ok(text.includes('对你的态度'), text);
  assert.ok(text.includes('声望'), text);
});