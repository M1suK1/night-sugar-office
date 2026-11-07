# 方案 v197 · 读档失败不再毁档

TASK
  自动存档一旦被判定「读不出来」，旧逻辑会静默换成新开局，随后自动存档把原件盖掉——
  一次误判就等于删档。要的是：读不出来也要把原件留住，并且给玩家取回的入口。

APPROACH
  1. `persistence.ts` 拆成三层：
     `normalizeState()` 只做校验与迁移，失败返回 null；
     `loadState()` 保留旧行为（失败给新开局），不动既有调用方；
     `loadStateStrict()` 失败返回 null，给启动流程用。
     （只从 `rules/persistence.ts` 导出，不扩大 `game.ts` 的对外面。）
  2. `bootState()`：有存档但严格读不出来时，把**原始对象**原样写进
     `save/recovered`（最多留 3 份，带时间戳），返回 `recovered: true`，
     这一局按新开局打开，但原件不再被覆盖掉。
  3. 启动时给一条明确提示：读不出来、原件已保留、可以去读档界面导出。
  4. 读档界面（标题页那一屏）新增「有一份读不出来的自动存档（原件已保留）」，
     每个时间点一个导出按钮，导出的就是原始 JSON，能再导入或用别的工具排查。

FILES
  · src/rules/persistence.ts            normalizeState / loadState / loadStateStrict
  · src/migrate.ts                      RECOVERED_SAVE_KEY、loadRecoveredSaves、bootState 备份
  · src/App.tsx                         启动提示
  · src/components/SaveSlotsDialog.tsx  保留档列表与导出
  · tests/v197.test.ts                  2 条
  · package.json / tasks/plan-v197.md / tasks/todo.md

EDGE IN
  · 好档：行为不变；没有存档：行为不变
  · 坏档：原件进 recovered，最多 3 份，按时间倒序
  · 坏档不参与读档，也不显示成「可继续」
  · 旧调用方仍拿到兜底新开局，不受影响

EDGE OUT
  · 不阻止后续自动存档写 `save/current`（原件已在 recovered 里）
  · 不做坏档的自动修复或字段级迁移
  · 不改三个手动存档位的读写逻辑

ASSUME
  「保护」= 原件不丢 + 玩家能把它导出来；能不能修好是下一步的事。
