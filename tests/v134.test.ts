import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollTopForNewTurn } from '../src/storyScroll.ts';

test('v134 新一轮出现时停在它的开头，而不是结尾', () => {
  // 容器顶部在 100，新一轮节点在 1200：要滚到「1200 - 100」附近，而不是滚到底。
  const top = scrollTopForNewTurn({ turnId: 'n-2', lastScrolledId: 'n-1', boxTop: 100, nodeTop: 1200, scrollTop: 0 });
  assert.equal(top, 1088, '1200 - 100 - 12 的余白');
});

test('v134 已经定位过的这一轮不再滚（异步渲染第二次不会把人甩下去）', () => {
  assert.equal(scrollTopForNewTurn({ turnId: 'n-2', lastScrolledId: 'n-2', boxTop: 0, nodeTop: 900, scrollTop: 0 }), null);
});

test('v134 负方向不滚到画面外', () => {
  assert.equal(scrollTopForNewTurn({ turnId: 'n-1', lastScrolledId: '', boxTop: 300, nodeTop: 120, scrollTop: 0 }), 0);
  assert.equal(scrollTopForNewTurn({ turnId: 'n-1', lastScrolledId: '', boxTop: 0, nodeTop: 500, scrollTop: 400 }), 888, '以当前位置为基准累加');
});
