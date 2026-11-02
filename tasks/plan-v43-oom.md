# v43 角色卡载入 / 表情差分导入 OOM 根治方案

## 一、 病灶复盘

1. **图片读取不设上限**：`originalImageDataUrl` 用 `FileReader.readAsDataURL` 原样保留原图。
   单张 2048–4096 方图（5–20MB）转成 Base64 后字符串膨胀 1.33 倍，一张即 15–25MB。
2. **批量导入并发读图**：`readBatch` 逐张读、全部塞进同一个字典，6 张差分瞬间 90–150MB 驻留，
   叠加多张图的解码位图，足以击穿 V8 堆上限。
3. **状态树里躺着大字符串**：差分以 Base64 存在 `girl.importedVariants`，每次 `clone(state)`
   都要重分配这些字符串，GC 追不上分配速度，内存阶梯式上涨。
4. **卡片签名全量序列化**：`importCardInto` 的 `signature()` 把立绘与全部差分
   `JSON.stringify` 成一个大字符串做版本比对，几十兆的瞬时分配。

## 二、 四重防护与落地

| 屏障 | 实现 | 位置 |
| --- | --- | --- |
| 入口自动降维 | `safeOptimizedImageDataUrl`：长边 ≤1024、转 WebP(0.82)、已轻量的 WebP 直通、finally 里 revoke + 清零 canvas | `src/image.ts` |
| 批量串行 + 让出 GC | 逐张处理，每张之后 `await yieldToGC(8~16)`，并显示「正在优化第 N 张」 | `ExpressionVariantDialog` / `WardrobeDialog` / `CustomGirlDialog` |
| 存量存档清洗 | `slimGirlImages` / `slimStateImages`：读档后在后台把名册、候选、纪念墙里的超大图降维，有改动才回写状态 | `src/imageSlim.ts`，`App.tsx` 启动与三条读档路径 |
| 卡片导入消毒 + 指纹瘦身 | `optimizeCardImages` 逐张降维；`signature()` 改用「长度 + 首尾 64 字符」的图片指纹 | `src/cards.ts` / `src/rules/cardOps.ts` |

另外：`CustomGirlDialog` 的立绘选择改用 object URL（省一份 33% 放大的长字符串），换图与关窗时 revoke。

## 三、 量化收益

- 6 张高清差分：90–150MB → 约 1MB（降 98%+）。
- 卡片改版指纹：数十 MB 的瞬时字符串 → 数百字符。
- 老存档读入后，超大差分在后台被压到 200KB 上下，刷新后存档体积同比缩小。

## 四、 验证

- `tsc --noEmit` 0 错；`npm run check:rules` 通过；无 UTF-8 BOM。
- 19 个测试文件 413 项全绿，其中新增：
  - 带 2.5MB 立绘的卡片重复导入仍被瞬间判重，且指纹长度 < 4000 字符；
  - `optimizeCardImages` 在合法卡上保持结构不变；
  - 无 Canvas 环境下 `slimStateImages` 原样返回同一引用。
