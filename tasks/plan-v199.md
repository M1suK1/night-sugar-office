# 方案 v199 · 读档后立绘在第二次自动存档里丢失

> 状态：已实现（v199，分支 `superpowers/portrait-blob-save`）。

TASK
  读取自动存档（或读档位）之后继续玩，再刷新一次，立绘变成破图/剪影。
  要的是：读档还原出来的图不会被下一次自动存档写坏。

APPROACH（已复现，见下方「根因」）
  1. `extractPortrait`：只要目标已经有 `portraitAsset`，就把 `portrait` 清成 `''`
     （不论它是 data: 还是 blob:）。资产库是唯一真源，内存里那份 URL 不该进存档。
  2. `extractOne`：主立绘的抽取条件从「以 data: 开头」放宽到「有值且不是 asset 引用」，
     让上一条对 blob: 也生效。衣柜、魔女化、首领随从走同一个 `extractPortrait`，一并修好。
  3. `hydrateStatePortraits`：还原条件从「`!portrait`」放宽到「`!portrait` 或 `blob:` 开头」，
     这样已经被写坏的老档再打开时能自愈。
  4. 战报单位不用改：v195 起它们落盘时就只留 `portraitAsset`，且读档不还原。

根因
  `hydrateStatePortraits` 把 `portrait` 填成 `assetUrl()` 生成的 blob: URL（只在当前页面会话有效）；
  下一次 `extractStatePortraits` 只认 data: 开头，blob: 原样留在 state 里被写进存档；
  再启动时 blob 已失效，而 hydrate 因为 `portrait` 非空直接跳过 → 立绘缺失。

FILES
  src/portraitAssets.ts   三条判定收紧（extractPortrait / extractOne / hydrate 的还原条件）
  tests/v199.test.ts      新建：两轮往返、老档自愈、衣柜/魔女化/首领随从
  package.json            挂 v199

EDGE IN
  · 二次落盘后 `portrait === ''`、`portraitAsset` 保留，再读回来是新会话的可用 URL。
  · 已经被写成 blob: 的老档：读档时重新从资产库取图，不需要迁移脚本。
  · 衣柜、魔女化立绘、三方首领/随从同样是 blob: 的场景。
  · 资产库不可用时（`store.available() === false`）行为不变，仍以内联图落盘。

EDGE OUT
  · 不新增存档字段、不改 schema，不做数据迁移。
  · 不处理「资产库里那张图本来就被删了」的情况——那是另一件事（立绘重载已经在 v78 有路径）。
  · 战报单位与导入差分不动：前者不还原、后者走 data URL。

ASSUME
  · blob: 前缀是本项目里唯一的易失图片来源（assetUrl 用 URL.createObjectURL）。
