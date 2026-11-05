import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';
import { currentExpressionOutfitId } from '../src/expressions.ts';
import { outfitBrief, outfitLine } from '../src/outfitBrief.ts';
import { buildNightPrompt } from '../src/llm-night.ts';

test('v94 终端：witch 让指定少女立刻魔女化（补侵蚀、补立绘、写日志）', () => {
  const s = createInitialState();
  const girl = s.girls[0]!;
  girl.corruption = 0;
  const result = act(s, { type: 'debugGirl', girlId: girl.id, mode: 'witch' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(item => item.id === girl.id)!;
  assert.equal(after.witch, true);
  assert.ok((after.corruption ?? 0) >= DEFAULT_BALANCE.corruptionThreshold, '侵蚀至少抬到阈值');
  assert.ok(after.witchForm, '没有立绘时自动补一个程序化魔女形态');
  assert.ok(after.witchPersonality?.trim(), '负面人格也一并写上');
  assert.match(result.state.logs[0]!.text, /调试/);
});

test('v94 终端：reset 把少女送回初始状态', () => {
  const s = createInitialState();
  const girl = s.girls[0]!;
  girl.level = 6;
  girl.exp = 999;
  girl.fatigue = 80;
  girl.corruption = 45;
  girl.witch = true;
  girl.scars = [{ id: 'scar-1', name: '旧疤', kind: 'wound', condition: '体力恢复变慢', gainedAt: '第 3 日', effect: { kind: 'fatigueRecovery', amount: -4 } } as never];
  girl.equipment = { weapon: 'moon-weapon' } as never;
  girl.status = 'resting';
  girl.remaining = 40;

  const result = act(s, { type: 'debugGirl', girlId: girl.id, mode: 'reset' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(item => item.id === girl.id)!;
  assert.equal(after.level, 1);
  assert.equal(after.exp, 0);
  assert.equal(after.fatigue, 0);
  assert.equal(after.corruption, 0);
  assert.equal(after.witch, false);
  assert.deepEqual(after.scars, []);
  assert.deepEqual(after.equipment, {});
  assert.equal(after.status, 'idle');
  assert.equal(after.remaining, 0);
  assert.equal(after.hp, after.maxHp);
  assert.equal(after.maxHp, after.baseMaxHp);
  assert.deepEqual(after.stats, after.baseStats);
});

test('v94 终端：找不到人时不改状态', () => {
  const s = createInitialState();
  const result = act(s, { type: 'debugGirl', girlId: 'nobody', mode: 'witch' });
  assert.equal(result.ok, false);
  assert.equal(result.state, s);
});

test('v94 换装后服装描述跟着当前礼装，魔女形态写的是形态描述', () => {
  const s = createInitialState();
  const girl = s.girls[0]!;
  const first = girl.wardrobe[0]!;
  // 1) 普通形态：写进当前礼装，并同步「此刻的装扮」
  const edited = act(s, { type: 'setOutfitDescription', girlId: girl.id, outfitId: first.id, description: '换成深紫色的短外套。' });
  assert.equal(edited.ok, true, edited.message);
  const after = edited.state.girls.find(item => item.id === girl.id)!;
  assert.equal(after.wardrobe[0]!.description, '换成深紫色的短外套。');
  if (currentExpressionOutfitId(after) === first.id) assert.equal(after.outfitDescription, '换成深紫色的短外套。');

  // 2) 不是当前这套时，不动「此刻的装扮」
  girl.wardrobe.push({ ...first, id: 'outfit-other', name: '另一套', description: '' });
  const second = act(s, { type: 'setOutfitDescription', girlId: girl.id, outfitId: 'outfit-other', description: '备用的那套。' });
  assert.equal(second.ok, true, second.message);
  const untouched = second.state.girls.find(item => item.id === girl.id)!;
  assert.equal(untouched.wardrobe.find(item => item.id === 'outfit-other')!.description, '备用的那套。');

  // 3) 魔女形态：描述写进 witchForm
  const witchedState = act(s, { type: 'debugGirl', girlId: girl.id, mode: 'witch' }).state;
  const witched = witchedState.girls.find(item => item.id === girl.id)!;
  assert.ok(witched.witchForm);
  const withDescription = act(witchedState, {
    type: 'setWitchForm', girlId: girl.id,
    outfit: { ...witched.witchForm!, description: '影子长出了第二种颜色。' },
    personality: witched.witchPersonality,
  });
  assert.equal(withDescription.ok, true, withDescription.message);
  assert.equal(withDescription.state.girls.find(item => item.id === girl.id)!.witchForm!.description, '影子长出了第二种颜色。');
});

test('v95 服装/魔女形态描述进提示词', () => {
  const plain = { outfitDescription: '深紫色短外套，袖口磨白了。' };
  assert.equal(outfitBrief(plain as never), '深紫色短外套，袖口磨白了。');
  assert.equal(outfitLine(plain as never), '装扮：深紫色短外套，袖口磨白了。');

  const witch = { witch: true, outfitDescription: '深紫色短外套。', witchForm: { description: '影子长出了第二种颜色。' } };
  assert.equal(outfitBrief(witch as never), '影子长出了第二种颜色。', '魔女形态优先用形态描述');
  assert.equal(outfitLine(witch as never), '魔女形态：影子长出了第二种颜色。');
  // 只有普通服装描述时也要有话说
  assert.equal(outfitBrief({ witch: true, outfitDescription: '深紫色短外套。' } as never), '深紫色短外套。');

  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = true;
  girl.witchForm = { id: 'witchform', form: 'witch', name: '夜之形', description: '影子长出了第二种颜色。', palette: ['#2a1524'], layerKey: 'witch' };
  const prompt = buildNightPrompt(state);
  assert.ok(prompt.includes('影子长出了第二种颜色'), '每日提案的提示词里要看得到形态描述');
});
