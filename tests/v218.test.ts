import test from 'node:test';
import assert from 'node:assert/strict';
import { eliteBuffs } from '../src/content/eliteBuffs.ts';
import { eliteRuleText, eliteSkillText } from '../src/eliteFacts.ts';

test('v218 精英图鉴把附带技能写成技能名和说明', () => {
  const expected: Record<string, string> = {
    'monster-static': '轨道静电',
    'monster-mirror': '镜面祷词',
    'monster-sweet-decree': '甜腻诏令',
    'monster-scream': '汽笛啸叫',
    'monster-mosaic': '万花筒',
    'monster-dissolve': '溶解',
  };
  for (const buff of eliteBuffs) {
    for (const id of buff.skillIds) {
      const text = eliteSkillText(id);
      assert.ok(text.startsWith(expected[id]!), `${id} 应显示技能名，实际：${text}`);
      assert.ok(text.includes('：'), '技能名后要带一句说明');
    }
  }
});

test('v218 精英图鉴补上每条规则', () => {
  const texts = eliteBuffs.flatMap(buff => (buff.rules ?? []).map(eliteRuleText));
  assert.ok(texts.some(text => text.includes('第 2 轮起每轮 +3 敏捷')), '过载');
  assert.ok(texts.some(text => text.includes('受到的伤害降低 10%')), '镜面');
  assert.ok(texts.some(text => text.includes('回复 8 点生命')), '嗜甜');
  assert.ok(texts.some(text => text.includes('敏捷 +6')), '夜行');
  assert.ok(texts.some(text => text.includes('命中 −4') && text.includes('持续 2 轮')), '群聚');
  assert.ok(texts.some(text => text.includes('持续伤害 3') || text.includes('3 点持续伤害')), '结症');
  assert.equal(texts.length, 6, '六条精英各有一条规则');
});
