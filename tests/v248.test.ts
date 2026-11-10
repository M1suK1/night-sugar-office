import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRandomMacros, randomHexColor, randomInt, randomFromArg } from '../src/randomize.ts';
import { MACRO_GROUPS, resolveMacros } from '../src/promptMacros.ts';

/** v248：预设宏与玩家输入里的随机数 / 随机颜色。 */

test('v248 randomInt 落在闭区间内，反向也能用', () => {
  for (let index = 0; index < 200; index += 1) {
    const value = randomInt(1, 6);
    assert.ok(value >= 1 && value <= 6, String(value));
    assert.ok(Number.isInteger(value));
  }
  for (let index = 0; index < 50; index += 1) {
    const value = randomInt(5, -5);
    assert.ok(value >= -5 && value <= 5);
  }
});

test('v248 randomFromArg：空 / 单个数字 / 区间 / 负数区间', () => {
  assert.ok(randomFromArg(undefined) >= 1 && randomFromArg(undefined) <= 100);
  for (let index = 0; index < 50; index += 1) {
    const dice = randomFromArg('6');
    assert.ok(dice >= 1 && dice <= 6);
    const range = randomFromArg('10-20');
    assert.ok(range >= 10 && range <= 20);
    const negative = randomFromArg('-3-3');
    assert.ok(negative >= -3 && negative <= 3);
  }
});

test('v248 randomHexColor 是合法的 #RRGGBB，tone 不影响格式', () => {
  for (const tone of [undefined, 'pastel', 'neon', 'dark']) {
    for (let index = 0; index < 20; index += 1) {
      assert.match(randomHexColor(tone), /^#[0-9a-f]{6}$/);
    }
  }
});

test('v248 expandRandomMacros 只动随机与颜色，其他宏原样留下', () => {
  const text = '骰子 {{random:6}}，区间 {{random:1-3}}，颜色 {{color}} 与 {{ color:neon }}；别动 {{girls}} 和 {{heroine:brief}}。';
  const output = expandRandomMacros(text);
  assert.doesNotMatch(output, /\{\{\s*(random|color)/);
  assert.match(output, /\{\{girls\}\}/);
  assert.match(output, /\{\{heroine:brief\}\}/);
  assert.match(output, /#[0-9a-f]{6}/);
});

test('v248 预设里的宏解析也认 random / color', () => {
  const dice = resolveMacros('掷 {{random:6}} 点', {}).text;
  assert.match(dice, /^掷 [1-6] 点$/);
  const color = resolveMacros('主色 {{color:pastel}}', {}).text;
  assert.match(color, /^主色 #[0-9a-f]{6}$/);
  const group = MACRO_GROUPS.find(item => item.id === 'random');
  assert.ok(group, '编辑器里要有随机与颜色分组');
  assert.ok(group!.items.some(item => item.key === 'random:6'));
  assert.ok(group!.items.some(item => item.key === 'color'));
});
