import test from 'node:test';
import assert from 'node:assert/strict';
import { battleStoryDigest } from '../src/battleNote.ts';

const unit = (uid: string, side: 'ally' | 'enemy', name: string) => ({
  uid, side, girlId: side === 'ally' ? uid.replace('ally-', '') : undefined, name, codename: name, portrait: '/art/x.svg', color: '#fff',
  hp: 80, maxHp: 100, spirit: 0, maxSpirit: 40, stats: { magic: 50, insight: 50, agility: 50, empathy: 50 },
  skills: [], cooldown: {}, effects: [], down: false, insightRoll: 50, scarHit: 0, dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0,
});

function battleWith(events: unknown[]) {
  return {
    id: 'b-stun', missionId: 'm', missionTitle: '末班车', seed: 1,
    startedAt: { day: 1, minutes: 1200 }, round: 2, rounds: 2,
    units: [unit('ally-es', 'ally', 'Es'), unit('ally-liu', 'ally', '琉音'), unit('enemy-last', 'enemy', '末班车')],
    initiative: ['enemy-last', 'ally-es', 'ally-liu'],
    events, outcome: 'defeat', scars: [], createdAt: 'x',
  } as never;
}

test('v70 心防归零的眩晕写成状态，不写成「对自己使用眩晕」', () => {
  const battle = battleWith([
    { round: 1, at: { day: 1, minutes: 1200 }, actor: 'enemy-last', skillId: 'whistle', skillName: '汽笛啸叫', targets: ['ally-es'], hit: true, resource: 'spirit' },
    { round: 2, at: { day: 1, minutes: 1200 }, actor: 'enemy-last', skillId: 'whistle', skillName: '汽笛啸叫', targets: ['ally-liu', 'ally-es'], hit: true, resource: 'spirit' },
    { round: 2, at: { day: 1, minutes: 1200 }, actor: 'ally-es', skillId: 'stunned', skillName: '眩晕', targets: ['ally-es'], hit: true, note: '眩晕中，本轮无法行动' },
  ]);
  const digest = battleStoryDigest(battle);
  assert.match(digest, /Es的心防被打穿，陷入眩晕/);
  assert.doesNotMatch(digest, /对Es使用「眩晕」|使用「眩晕」（支援）|Es对Es/, '绝不能渲染成她自己施放眩晕');
  assert.match(digest, /削去对方的心防/, '被削心防的攻击仍然按原样描述');
  assert.match(digest, /击中琉音、Es/);
});

test('v70 真正的支援技能仍然标成支援，别把这条规则扩大到治疗', () => {
  const battle = battleWith([
    { round: 1, at: { day: 1, minutes: 1200 }, actor: 'ally-liu', skillId: 'peach-ward', skillName: '桃符护持', targets: ['ally-es'], hit: true, note: '心防恢复 6', resource: 'spirit' },
  ]);
  const digest = battleStoryDigest(battle);
  assert.match(digest, /琉音对Es使用「桃符护持」（护持）|琉音对Es使用「[^」]+」（(回复|护持|支援)）/, '真支援还是走支援句式');
});
