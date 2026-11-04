import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { contractCost } from '../src/rules/roster.ts';

const draft = {
  name: '美宁娜', codename: '独幕剧', title: '虚饰水冠', element: '月影系' as const, archetype: '输出' as const,
  color: '#7f9bff', quote: '请看着我的舞台。', goal: '把剧团重新开起来',
  appearance: '白蓝渐变的卷齐肩短发', personality: '优雅而克制', outfitDescription: '深蓝礼服',
  stats: { magic: 78, insight: 88, agility: 48, empathy: 46 },
  skillIds: ['glimmer-spear', 'peach-ward', 'starlight-fall'],
  traits: [
    { name: '戏精', description: '随时在演。', polarity: 'neutral' as const },
    { name: '记仇', description: '记得每一次失礼。', polarity: 'bad' as const },
    { name: '护短', description: '护着自己人。', polarity: 'good' as const },
  ],
  portrait: '',
};

test('v115 自定义导入的价格只跟等级与四维走，不再被技能稀有度抬到两千', () => {
  const state = createInitialState();
  const result = act(state, { type: 'createGirl', draft });
  assert.equal(result.ok, true, result.message);
  const girl = result.state.candidates.find(item => item.name === '美宁娜')!;
  const sum = 78 + 88 + 48 + 46;
  assert.equal(girl.cost, contractCost(1, sum), '价格就是 contractCost(1, 四维和)');
  assert.ok(girl.cost <= 1200, `一级卡的契约费应该在千元附近，实际 ${girl.cost}`);
});
