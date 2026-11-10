import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { DOSSIER_BUDGET, dossierOf } from '../src/girlDossier.ts';
import { promptTokens } from '../src/tokens.ts';
import type { Girl } from '../src/types.ts';

/** v239：全量档案的预算提到 2000，正常的卡不再裁掉特性 / 心愿 / 关系。 */

/** 造一张「正常但很重」的卡：7 条特性、9 位同伴、誓约与婚礼都在。 */
function heavyGirl(): { state: ReturnType<typeof createInitialState>; girl: Girl } {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.traits = Array.from({ length: 7 }, (_, index) => ({
    id: `t${index}`,
    name: `特性${index + 1}`,
    polarity: index % 3 === 0 ? 'positive' : index % 3 === 1 ? 'negative' : 'neutral',
    tags: ['测试'],
    description: '这是一段用来占位的特性解释，写清她在什么情况下会有什么反应，长度按正常卡的篇幅来。',
  }));
  girl.goal = '把事务所的每一盏灯都按同一高度挂好，让整座城市在夜里看起来是对称的。';
  girl.goalKind = '成长';
  girl.bond = 100;
  girl.oath = { day: 20, at: '第 20 日 · 20:00' };
  girl.wedding = { day: 20, at: '第 20 日 · 20:00', eventId: 'meeting-1', placeName: '旧教堂' };
  girl.relationships = Object.fromEntries(state.girls.slice(1, 10).map((peer, index) => [peer.id, 40 + index]));
  return { state, girl };
}

test('v239 全量档案预算提到 2000', () => {
  assert.equal(DOSSIER_BUDGET, 2000);
});

test('v239 正常的重卡整份装入：特性 / 心愿 / 关系都在，不再有省略提示', () => {
  const { state, girl } = heavyGirl();
  const text = dossierOf(girl, state);
  assert.equal(text.includes('细节未列出'), false, '正常卡不该再被裁');
  assert.ok(text.includes('特性：特性1'), text.slice(-200));
  assert.ok(text.includes('心愿：把事务所的每一盏灯'));
  assert.ok(text.includes('关系：对所长 100/100'));
  assert.ok(text.includes('已与所长缔结誓约'));
  assert.ok(promptTokens(text) <= DOSSIER_BUDGET, `${promptTokens(text)} 超出预算`);
});

test('v239 极端卡仍然收在预算内，只是裁掉末尾的非关键条目', () => {
  const { state, girl } = heavyGirl();
  girl.traits = Array.from({ length: 60 }, (_, index) => ({
    id: `x${index}`,
    name: `冗长特性${index + 1}`,
    polarity: 'neutral',
    tags: ['测试'],
    description: '这是一段刻意写长的特性解释，用来模拟从外部导入、篇幅远超正常范围的卡片，确保预算兜底仍然生效。'.repeat(2),
  }));
  const text = dossierOf(girl, state);
  assert.ok(promptTokens(text) <= DOSSIER_BUDGET, `${promptTokens(text)} 超出预算`);
  assert.ok(text.includes('未列出'), '超预算时仍要有省略说明');
});
