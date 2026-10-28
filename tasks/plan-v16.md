# v16 魔女化表情页与自定义衣柜包

## 目标

让魔女化形态和普通衣柜一样拥有独立的六种表情差分；自定义登记不再只能带一张立绘，而是可以一次导入多套服装、各套表情差分与魔女化立绘。

## 数据结构

- 沿用 `Girl.importedVariants?: Record<string, string>`，键仍为 `<outfitId>:<expression>`。
- 魔女化使用固定伪服装 id `witchform`；`Girl.witchForm` 仍是唯一来源，不新增存档字段，也不升级 `GameState.version`。
- `GirlDraft` 增加可选 `wardrobe`、`outfitId`、`importedVariants`、`witchForm`，由自定义登记向导填充。
- `createGirl` 最多保留四套服装，校验活动服装，清理属于不存在服装的差分，并规范化魔女化立绘。
- `GirlCard.girl` 保留 `witchForm`；`buildGirlCard`、`parseGirlCard` 与 `girlCardHash` 都覆盖魔女化形态。

## 服装视图

`src/expressions.ts` 增加两个纯函数：

- `expressionOutfits(girl)`：返回普通衣柜，并在存在 `witchForm` 时追加 `{ ...witchForm, id: 'witchform', form: 'witch' }`。
- `currentExpressionOutfitId(girl)`：`witch && witchForm` 时返回 `witchform`，否则返回 `outfitId ?? 'custom'`。

这样表情页、立绘解析和档案计数对「当前服装」使用同一套判断。

## 立绘解析

- `GirlPortrait` 用 `currentExpressionOutfitId` 选择服装，再用 `expressionOutfits` 找到对应 `Outfit`。
- 魔女化时基础立绘、配色与 `witchform:*` 差分都来自魔女形态；普通服装不会串用魔女立绘。
- 差分优先于服装立绘与基础立绘；缺图仍回退基础立绘或程序化表情。
- 属性 `data-expression` / `data-expression-variant` 保留，浏览器可以验证真实换图。
- 战斗札记舞台也传入 `witch` / `witchForm`，与档案、对话共用解析。

## 表情差分弹窗

- 服装标签页现在包含魔女化；魔女化标签使用独立图标记与紫色选中态。
- 默认选中当前形态；点普通服装标签只切换预览，不改变角色当前服装。
- 每套服装独立六张上限，计数为 `n / 6`。
- 魔女化预览显式传 `witch: true`，普通服装预览显式传 `witch: false`。

## 自定义衣柜包

自定义登记第五步新增「衣柜与表情」：

- `readWardrobePackage(raw)` 接受根对象或 `{ girl: ... }`，读取 `wardrobe` 或 `outfits`。
- 最多四套服装；缺少 id 时生成 `import-*`，重复 id 自动加后缀。
- `witchForm` 强制规范为 `id: 'witchform'`、`form: 'witch'`。
- `importedVariants` 只保留属于已导入服装或 `witchform` 的键。
- 活动服装取合法 `outfitId`，否则第一套；预览立绘优先根级 `portrait`，其次活动服装，再退到第一张可用立绘。
- 向导显示服装数量、是否含魔女化、差分数量与服装名，可一键移除。
- 提交时把衣柜、活动服装、差分与魔女化立绘一起交给 `createGirl`。

## 状态行为

- `changeOutfit` 在切到普通服装时设置 `girl.witch = false`，避免「穿着普通服装但仍显示魔女化」。
- 删除或替换服装继续清理孤立差分；`witchform` 始终保留。
- 契约卡导入仍走 `hydrate`，魔女化与差分一起恢复。

## 验收

- 状态测试：衣柜包读取活动服装立绘、过滤孤立差分、规范化魔女化；自定义登记保留两套服装、三张差分与魔女化；契约卡往返与哈希变化。
- 浏览器：魔女化标签页独立选中、档案实际切换到 `witchform` 差分、切回普通服装；自定义登记导入两套服装、三张差分与魔女化后进入候选名册。
- 120 项状态测试、55 组浏览器流程、生产构建通过。

## 边界

- 差分仍是静态图片，不做骨骼或逐帧动画。
- 衣柜包只支持本地 JSON，不新增网络下载或后端存储。
- 魔女化仍只有一个形态槽，不扩展成多套魔女服装。
- 差分与衣柜包都只保存在浏览器 localStorage。
