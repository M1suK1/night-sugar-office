# 方案 v207 · 契约卡坏立绘容错

> 状态：已实现（v207，分支 main）。

TASK
  契约卡里的主立绘不可持久化（blob: / http: / 超大 / 未知格式）时，不再整张卡拒绝导入；
  丢掉坏图，优先回退到一张有效差分，导出时也不再把 blob: 写进卡片。

APPROACH
  · 抽一个卡片图片白名单：/art/ 短路径，或 data:image/(png|jpeg|webp|svg+xml);base64
    且 ≤ 2,800,000 字符（保持原大小上限，防 JSON 解析 OOM）。
  · parseGirlCard：主立绘不合法时置空 → 用 importedVariants 里的 calm 差分 / 第一张有效图；
    portraitSpec 只在主图本身合法时保留；坏图不再返回错误。
  · wardrobe / witchForm 的立绘同样走白名单，坏的字段单独丢掉，不拖累整卡。
  · buildGirlCard：主图、差分、衣柜、魔女化立绘全部先过白名单；blob: 一律不写进卡片。
  · 新建 v207 测试，覆盖导入回退、无可用图、calm 去重、导出清洗。

FILES
  改   src/cards.ts               cardPortrait 白名单、导入容错、导出清洗
  新建 tests/v207.test.ts         五条
  改   package.json               test 登记 v207
  新建 tasks/plan-v207.md         本方案
  改   tasks/todo.md              勾选
