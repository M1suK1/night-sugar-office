# 方案 v153 · 表情差分搬进资产库

> 触发：存档 22MB，其中 19.79MB 是候选人的 `importedVariants`（表情差分 data URL）。
> 本地 /api/kv 的请求上限是 24MB，导入一张卡就写不进去。
> 本版把差分也走立绘同一条资产管线：存档里只留资产 id，读档时再取回。

## 做

1. `Girl` 新增 `variantAssets?: Record<string, AssetId>`。
2. `portraitAssets.ts` 的落盘 / 读档两条管线同时处理差分：
   - 落盘：每个 `importedVariants[key]` 的 data URL → `assetPut` → `variantAssets[key] = id`，内联值清掉；非 data URL 原样保留。
   - 读档：按 `variantAssets` 把图取回 `importedVariants`（已有内联值的键不覆盖）。
   - 单张图失败只跳过那一张（保留内联），不影响整次存档。
3. 内容指纹缓存：同一张差分第二次落盘不再 `assetPut`（避免每次自动存档都重写 20MB）。
4. 旧档兼容：没有 `variantAssets` 的存档照常读；下次保存时自然完成迁移。

## 不做

- 不改 UI 渲染层（内存里仍然是 data URL，组件一行不用动）。
- 不搬衣柜 / 魔女化立绘（另有 `portraitAsset`，体积小，留到以后）。
- 不动 24MB 上限（差分搬走后存档应降到 1MB 内）。

## 文件

| 文件 | 改动 |
| --- | --- |
| `src/types.ts` | `Girl.variantAssets` |
| `src/portraitAssets.ts` | 差分抽取 / 回填 + 指纹缓存 |
| `tests/v153.test.ts` | 抽取、回填、失败兜底、缓存 |
| `package.json` | 加测试 |

## 验收

- 抽取后存档 JSON 不含差分 data URL，`variantAssets` 有对应 id；
- 读档后 `importedVariants` 原样恢复；
- 资产库不可用 / put 抛错时，状态保持不变且不阻断保存；
- 同一张图第二次抽取不再调用 `put`；
- `npm test` / `check:rules` / `build` 全绿。
