# 方案 v208 · 蓝图节点标题回退

> 状态：已实现（v208，分支 main）。

TASK
  LLM 生成 / 导入的蓝图里，结束节点省略 title 时节点卡标题为空；其他节点空标题也显示空白。
  要让空标题回退到结局名或节点种类名，并让老存档里的空标题也能正常显示。

APPROACH
  · storygraph.ts 新增 nodeTitle(value, kind, data)：
    先取 trim 后的 title；空则用结束节点的 data.ending；再空则用 NODE_LABELS[kind]。
  · buildGraphFromDraft 与 sanitizeGraph 统一走 nodeTitle；不再把空字符串当有效标题。
  · StoryGraphDialog 的节点卡显示也兜一层，老存档里已经空掉的标题不用先保存就能看见。
  · 不改 LLM 提示词、不改蓝图数据结构。

FILES
  改   src/storygraph.ts              nodeTitle + 两处清洗
  改   src/components/StoryGraphDialog.tsx  节点卡标题兜底
  新建 tests/v208.test.ts             四条
  改   package.json                   test 登记 v208
  新建 tasks/plan-v208.md             本方案
  改   tasks/todo.md                  勾选
