# v22：存档搬进 IndexedDB + 立绘原字节存量（不压缩）

> 起因：导入一张 2.1MB 立绘的契约卡时卡库报「放不下」。根因是**立绘原样进 localStorage**。
> 进一步确认：立绘源图是 1024×1024，而现有管线把它降采样到 768×960 再叠一层 WebP 有损——
> 画质是被我们自己砍掉的。
>
> 本版结论：**存档层换 IndexedDB，立绘按原始字节存 Blob、4:5 裁切改到显示时做。**

---

## 1. 目标

1. **大对象搬出 localStorage**：当前进度、三个存档位、契约卡库、立绘二进制进 IndexedDB。
2. **立绘不压缩**：保留源文件原始字节（PNG 还是 PNG、1024 还是 1024），不重编码、不降采样、不预裁切。
3. **存档体积与立绘数量解耦**：`state` 只存引用，加一百张差分自动存档还是几十 KB。
4. 旧数据自动迁移，不丢档、不丢画质。

不做（本版）：把立绘重新编码成多档分辨率的响应式图片（macOS/移动端省内存时才需要）。

---

## 2. 现状

| 数据 | 位置 | 体积 |
| --- | --- | --- |
| 当前进度 | `localStorage['night-sugar-office:v1']`（`src/game.ts:34` `SAVE_KEY`） | 新档 21KB；每张立绘约 150KB |
| 三个存档位 | `localStorage['night-sugar-office:slot:<n>']`（`src/saves.ts:14`） | 单槽硬拦 1.6MB 字符 |
| 契约卡库 | `localStorage['night-sugar:cardbox:v1']`（`src/cardbox.ts:5`） | 单卡 8MB，总配额只有 5MB |
| 立绘 | dataURL 嵌在 `state.girls[].portrait` / `wardrobe[].portrait` / `importedVariants` / `witchForm.portrait` | 一律 768×960 WebP 0.78 |

关键事实：
- `src/App.tsx:87` `readSave()` 同步读，`App.tsx:152` 自动存档同步写。
- `src/saves.ts` 全同步；`slotSummary` 为了摘要要整份 `JSON.parse`。
- `src/cardbox.ts` `loadCardBox/saveCardBox` 同步。
- `src/image.ts` `cropToDataUrl` 写死 768×960、`toDataURL('image/webp', 0.78)`，同时完成裁切+缩放+编码。
- `src/components/CustomGirlDialog.tsx:29-38` 有一份重复的裁剪实现。
- `src/cards.ts:115` 允许卡里立绘到 2,800,000 字符；`src/game.ts:157` 原样塞进 girl。
- 测试侧：node 没有 IndexedDB，`tests/game.test.ts` 用 `withMemoryStorage`。

---

## 3. 存储层：`src/store.ts`（新增）

两个 object store：

| store | 键 | 值 |
| --- | --- | --- |
| `kv` | 字符串 | 小对象（进度、槽位 meta、卡库） |
| `assets` | assetId | `Blob`（立绘/差分的原始字节）+ `meta`（mime、crop、来源） |

```ts
export const DB_NAME = 'night-sugar';
export const DB_VERSION = 1;

export function storeAvailable(): boolean;
export async function kvGet<T>(key: string): Promise<T | undefined>;
export async function kvSet(key: string, value: unknown): Promise<void>;
export async function kvDelete(key: string): Promise<void>;
export async function kvKeys(prefix: string): Promise<string[]>;

export interface AssetMeta { mime: string; bytes: number; width?: number; height?: number; crop?: CropBox; addedAt: number }
export interface CropBox { zoom: number; x: number; y: number }   // 与 CustomGirlDialog 的缩放手感一致
export async function assetPut(blob: Blob, meta: AssetMeta): Promise<string>;   // 返回 content-hash id
export async function assetGet(id: string): Promise<{ blob: Blob; meta: AssetMeta } | undefined>;
export async function assetDelete(id: string): Promise<void>;
export async function assetUrl(id: string): Promise<string | undefined>;        // 带缓存 + revoke 管理
export async function assetSweep(keep: Set<string>): Promise<number>;           // 清理孤儿
```

- **后端可替换**：`typeof indexedDB === 'undefined'`（node 测试、部分隐私模式）时退化为内存 `Map`，接口形状一致。`tests/game.test.ts` 不装假 IDB。
- 值直接存结构化对象（IDB 原生 `structuredClone`），**不做 `JSON.stringify`**。
- `assetPut` 的 id 用内容哈希（`crypto.subtle.digest('SHA-256')`，取前 16 字节 hex；node 18+ 与 Chromium 都有，缺失时退化为按字节 FNV——同图去重是加分项，不是正确性要求）。

### 键位

| 键 | 值 |
| --- | --- |
| `save/current` | `GameState`（立绘字段已是 assetId 引用） |
| `save/slot/<1\|2\|3>/meta` | `{ schema: 2, savedAt, day, gold, girls, members, blank, startersPicked, headline, bytes, assets: string[] }` |
| `save/slot/<1\|2\|3>/body` | `GameState` |
| `cardbox` | `CardBoxEntry[]`（卡 JSON 原文保留，卡里的立绘仍是 dataURL——它是文件格式，不做二次处理） |
| `meta/migrated` | `2` |

槽位拆 `meta` / `body`：面板列表只要摘要，现在为了摘要得读整份 state；IDB 不支持部分读取，只能拆键。`assets` 记录该槽引用的 assetId，供删除时判断哪些还能回收。

---

## 4. 立绘：原字节（实施时改为「原字节内联进 IDB」）

> **实施偏差（2026-10-30）**：原方案打算把字节拆到 `assets` 表、状态里只留 `portraitAsset` 引用。
> 实际落地时改为**原字节直接内联在存档 JSON 里**：IndexedDB 没有 localStorage 那种 5MB 总配额，
> 结构化克隆一个几 MB 的字符串代价可以接受，省掉引用解析、异步渲染、孤儿回收三块复杂度。
> `store.ts` 的 assets 表与 `portraitAsset` 类型仍然保留（导出/未来拆分可用），当前不写入。
> 代价：三个存档位各存一份立绘（不共享字节）。

### 4.1 类型变化（`src/types.ts`）

```ts
export type AssetId = string;

export interface CropBox { zoom: number; x: number; y: number }

// Girl / Outfit / WitchForm 上新增：
portraitAsset?: AssetId;      // 常规：立绘在 assets 里
portraitCrop?: CropBox;       // 显示时的取景；缺省为居中、zoom 1
portrait?: string;            // 保留：仅用于「导入/导出/迁移」的 dataURL 形态
```

- 运行期（内存里跑游戏的 `state`）**只保留 `portraitAsset`**，`portrait` 在落盘前被剥掉。
- `GirlPortrait` 优先用 `portraitAsset`，取不到再退回 `portrait`（旧档），都没有就渲染 `portraitSpec` 的程序化头像。

### 4.2 渲染（`src/components/GirlPortrait.tsx`）

- 新增 `useAssetUrl(assetId)`：`assetUrl()` + 组件卸载时引用计数减一，归零则 `revokeObjectURL`。
- 图片节点：`<img src={url} style={{ objectFit: 'cover', objectPosition: centerFromCrop(crop) }} loading="lazy" decoding="async" />`。
- 4:5 取景由容器 `aspect-ratio: 4 / 5` + `object-fit: cover` 完成，**存储里永远是完整原图**。
- 现有各处的 `.girl-portrait img` 已经是 `width:100%;height:100%`，只需确保外层容器有确定的宽高比。

### 4.3 上传（`src/image.ts` 收窄职责）

> **实施结果**：新增 `originalImageDataUrl(file)`（FileReader 原样读），`WardrobeDialog` /
> `WitchFormDialog` / `ExpressionVariantDialog` / `CustomGirlDialog` 全部改用它，不再压成
> 768×960 WebP。取景改为 `portraitCrop: { zoom, x, y }` 存进存档，显示时由
> `GirlPortrait` 的 `cropStyle()` 换算成 `object-position` + `scale()`。

- `resizeImageFile()` 从「载入→4:5 裁剪→缩放→WebP」改为 **原样保留**：
  ```ts
  export async function portraitFromFile(file: File): Promise<{ blob: Blob; width: number; height: number }>
  ```
  只做解码取宽高（用于交互），字节不动。`file` 直接就是 `Blob`。
- 裁切/缩放交回 UI：`CustomGirlDialog` 的拖动与缩放只产出 `CropBox`，写入 `portraitCrop`。
- 删除 `CustomGirlDialog.tsx:29-38` 的重复裁剪实现。
- 保留 `cropToDataUrl`（导出/旧档迁移仍要它），但不再用于入库。

---

## 5. 启动与迁移

`src/App.tsx`：

1. `state` 初值 `null` + `booting`，渲染 `#boot-splash`（「正在读取档案…」）。
2. `await migrateLegacyStorage()` → `kvGet('save/current')` → `loadState` → `setBooting(false)`。
3. 删除同步 `readSave()`。

`migrateLegacyStorage()`（`src/store.ts`）：

- `meta/migrated === 2` 直接返回。
- 搬大对象（**只在 IDB 没有该键时搬**，避免覆盖新数据）：
  - `save/current` ← `localStorage[SAVE_KEY]`
  - `save/slot/<n>` ← `localStorage[slotKey(n)]`（解析后拆 meta/body）
  - `cardbox` ← `localStorage[CARD_BOX_KEY]`
- **立绘抽取**（关键一步）：把 state 里所有 dataURL 解码成 Blob 存进 `assets`，字段替换为 `portraitAsset`；原 dataURL 在迁移结果里剥掉。
  覆盖位置：`girls[].portrait`、`girls[].witchForm.portrait`、`girls[].wardrobe[].portrait`、`girls[].importedVariants[key]`、`candidates[].portrait`、`customSkills`/`customMonsters` 之外的立绘字段（若有）。
- 全部成功后写 `meta/migrated = 2` 并删 localStorage 里那三类键。
- 任一步抛错：不写标记、不删旧键，下次重试。

---

## 6. 自动存档

```ts
useEffect(() => {
  const timer = setTimeout(() => { void persist(state); }, 400);
  return () => clearTimeout(timer);
}, [state]);
```

- `persist()` 串行化（`savingRef`），上一笔没写完只记「再写一次」。
- 落盘前 `stripPortraits(state)`：剥掉遗留 dataURL 字段，保证存档里只有引用。state 体积回到几十 KB，写入是毫秒级。
- 失败 → toast（带体积）+ `setSaved(false)`。
- 设置页显示占用：`navigator.storage.estimate()` → 「存档 1.2MB · 立绘 28.4MB」。

---

## 7. 存档位 / 卡库异步化

`src/saves.ts`：

```ts
export async function slotSummaries(): Promise<(SaveSlotSummary | null)[]>;
export async function readSlot(id: SaveSlotId): Promise<GameState | null>;
export async function writeSlot(id, state): Promise<{ ok: boolean; message: string; summary?: SaveSlotSummary }>;
export async function clearSlot(id: SaveSlotId): Promise<boolean>;
export async function slotsUsedBytes(): Promise<number>;
```

- 摘要只读 `meta`；`writeSlot` 同时记录 `assets`（该局引用的立绘）。
- `SLOT_BYTES_LIMIT`（1.6MB 硬拦）→ `SLOT_SOFT_LIMIT = 32MB` 软提示。
- `clearSlot` 删 meta/body，再 `assetSweep(还活着的引用)` 回收只有该槽用到的立绘。
- `SaveSlotsDialog` 全 `await`。

`src/cardbox.ts`：`loadCardBox/saveCardBox` 异步化；纯函数（`cardboxAdd/Remove/Filter/Cards`）不动，`cardboxRemove` 去掉默认参数。`CARD_BOX_MAX_BYTES` 8MB → **24MB**（卡里立绘仍是 dataURL，1024 PNG 约 1–2MB，24MB 足够且能拦下明显不是卡的文件）。**导入时不再重编码立绘。**

---

## 8. 导出 / 导入契约卡与存档

存储换成引用后，导出必须能把立绘带出去，否则文件就只剩空引用。

- **存档导出**：`exportState()` 在序列化前把每个 `portraitAsset` 还原成 dataURL（`assetGet` → base64）。文件格式与现在完全一致，老版本也能读。
- **存档导入**：反方向——把 dataURL 抽成 asset，再写引用。导入的仍是「旧格式文件」，所以 `loadState` 的校验路径不用改。
- **契约卡导出/导入**：`cards.ts` 的 `GirlCard.girl.portrait` 本来就是 dataURL，保持不变；导入时抽成 asset。
- 已知代价：导出文件体积等于原图总和（30 张 1024 PNG ≈ 30–50MB）。这是「不压缩」的必然结果，导出时在按钮旁标明预估体积。

---

## 9. 回收与一致性

- `assetSweep(keep)`：启动后与删除角色/换装/清空槽位后各跑一次；`keep` 由当前 state + 三个槽位的 `meta.assets` 并集算出。
- 孤儿判定要有宽限期（`meta.addedAt` 在 24 小时内不回收），避免「刚导入还没落盘就被扫掉」。
- 内容哈希去重：同一张图被多个角色/差分引用时只存一份，sweep 只在无人引用时删。

---

## 10. 测试与验收

### 状态测试（233 → 255，实际）

- 新增 `tests/store.test.ts`（node 下走内存后端，9 条）：kv 写入/读取/删除/前缀列举、写故障时不落半条、`assetPut` 内容哈希去重、`assetBytes`、`assetSweep` 的宽限期与保留集、`dataUrl` 往返、迁移幂等（`meta/migrated` 只打一次）、没有旧档也打标记、内联模式不产生 asset 副本、引用模式才抽 asset。
- `tests/game.test.ts` 及既有用例：`withMemoryStorage` 同时重置 store；`writeSave` / `readSave` / `writeSlot` / `cardboxAdd` 等改异步后全部 `await`。

### 浏览器流程（80 → 83，实际）

- `stored()` 通过 `page.evaluate` 读 IDB；`resetAll()` 只清 `kv` / `assets` 与 `localStorage`，保留 `sessionStorage` 的开场与「已开始」旗标。
- 新增 3 条：
  1. **存储迁移**：预置只有 `localStorage` 的旧档并抹掉 `meta/migrated` → 重载 → 进度、金币与旧档一致，旧键被清掉，迁移标记落在 IDB 里。
  2. **原图保真**：1024×1024 的原图从「只导入立绘」走到登记完成 → 候选的 `portrait` 解码后 `naturalWidth/Height` 均为 1024，且 base64 解出的字节数与源文件**完全相等**。
  3. **大卡**（既有流程扩展）：2.3MB 立绘的契约卡能收进卡库、导入名册，并原图字节带到存档位。

### 手工验收

桌面 1440 + 移动 390：旧档迁移后能玩；立绘比现在明显清晰（1024 原生）；自动存档指示器不再报空间不足；导出存档再导入，画质不变。

---

## 11. 风险

| 风险 | 处理 |
| --- | --- |
| 隐私模式 / Safari 私密窗口没有可用 IDB | `storeAvailable()` 失败 → 内存后端 + 顶部提示「本次进度不会被保存」 |
| 迁移把立绘抽出来后落盘失败 | 先抽再写、写成功才删旧键；旧 localStorage 留到最后 |
| 对象 URL 泄漏 | `useAssetUrl` 引用计数 + 卸载 revoke；sweep 兜底 |
| 多标签页并发写 | 后写覆盖，`meta.savedAt` 记时间；本版不做合并 |
| 导出文件过大 | 导出按钮旁标注预估体积；不提供「去掉立绘导出」开关（会丢数据） |
| 旧代码仍读 `girl.portrait` | 用 `grep -rn "\.portrait" src/` 作为验收步骤，逐处确认已改走 `portraitAsset` 或明确的导出/迁移路径 |

---

## 12. 落地顺序

1. `src/store.ts` + `tests/store.test.ts`（后端与迁移先独立可测）
2. `src/types.ts` 加 `portraitAsset/portraitCrop`，`src/game.ts` 读写与 hydrate 兼容两种形态
3. 迁移：dataURL → asset，本次先跑状态测试验完
4. `App.tsx` 启动异步 + `#boot-splash` + 自动存档切 IDB
5. `saves.ts` / `cardbox.ts` 异步化 + 各自对话框
6. `GirlPortrait` + `useAssetUrl` + `cropToObjectPosition`；`image.ts` 收窄为「原样保留」
7. `CustomGirlDialog` 改为只产出 `CropBox`，删重复裁剪
8. 导出/导入的 dataURL 往返
9. `tests/browser.mjs` `stored()` 改造 + 5 条新流程
10. `tsc` / `npm test` / `vite build` / 浏览器全量
11. `README.md`、`tasks/todo.md`、本文件补实施记录
