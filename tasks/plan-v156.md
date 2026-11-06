# 方案 v156 · 值班名册：滚动、瀑布流、代表色描边

## TASK

主页右侧的魔法少女列表：

1. 人数多时列表自己滚动，不再把左侧地图拉高。
2. 增加「列表 / 瀑布流」切换；瀑布流只显示头像。
3. 每个少女栏位加一圈代表色细边框。

## 现状

- `dispatch-layout` 是两列网格（`1fr 292px`，`align-items: stretch`），行高取两列里较高的一边。
- `Roster` 的 `.girl-roster` 是普通 flex 列，没有高度上限；人一多，整列变高，网格行高跟着涨，左侧 `.map-viewport` 被 `flex:1` 拉长。
- 卡片边框是统一的 `#ffffff0c`，只有 hover 时才显示代表色。
- 没有视图切换。

## APPROACH

### 1. 让列表自己滚，不参与行高
只做桌面（≥801px）：
- `App.tsx` 把 `<Roster/>` 包进 `<div className="roster-slot">`。
- `.roster-slot { position: relative; min-height: 0 }`；
  `.roster-slot .roster { position: absolute; inset: 0 }`。
- 绝对定位的列不贡献高度 → 网格行高只由地图（`aspect-ratio`）决定，地图不再被拉长。
- `.roster` 内部：头部固定、`.girl-roster-scroll { flex:1; min-height:0; overflow-y:auto }`、滚动区里才是名单。
- 滚动条：`scrollbar-width: thin` + 深色轨道，宽度 4px，hover 变亮。

窄屏（≤800px）两列变一列，恢复普通文档流，名单用 `max-height: 70vh` 自己滚。

### 2. 列表 / 瀑布流切换
- 头部加一个两格切换：`#roster-view-list` / `#roster-view-grid`（Lucide `Rows3` / `LayoutGrid`）。
- 视图存 `localStorage: night-sugar:roster-view`（`'list' | 'grid'`，读不到按 list）。
- **瀑布流只显示头像**：
  ```
  ┌────┬────┬────┐
  │ 头 │ 头 │ 头 │   ← 3 列，方形，圆角，无文字
  ├────┼────┼────┤
  │ 头 │ 头 │ 头 │
  └────┴────┴────┘
  ```
  - `.girl-roster.is-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px }`
  - 隐藏 `.roster-info`、`.drag-handle`、`.roster-arrow`
  - `.roster-portrait` 变成 1:1，头像 `object-fit:cover`、`object-position:50% 8%`
  - 小徽标（未读 / 加点 / 文职 / 魔女）保留
  - 悬停提示保留，改成在格子上方弹出，避免超出右边界
- 两种视图都保留：点击打开档案、拖拽派遣、空闲限制。

### 3. 代表色细边框
- 卡片：`.girl-roster-main { border-color: color-mix(in srgb, var(--girl-color) 38%, transparent) }`
- 瀑布流格子同样；
- hover / focus 时同色加深到 70%，不再换色；
- 只作用于「在册少女」的栏位，空位招募卡与「离开的人」保持原样。

## FILES

| 文件 | 改动 |
| --- | --- |
| `src/App.tsx` | `Roster` 外包一层 `.roster-slot` |
| `src/components/Roster.tsx` | 视图状态 + 切换按钮 + 滚动容器 + 瀑布流类名 |
| `src/map.css` | 布局、滚动条、瀑布流、代表色边框、窄屏回退 |
| `tests/browser.mjs` | 视图切换与地图不被拉长的断言 |

## EDGE IN

- 0 人 / 1 人 / 10+ 人：列表高度恒定，滚动出现；空位招募卡照常显示。
- 瀑布流里点击、拖拽、悬停提示、未读 / 加点徽标。
- 视图切换后刷新页面仍保持；localStorage 不可用时默认列表。
- 地图高度在 4 人和 12 人时一致。
- 窄屏：切换按钮可用，格子自动 3–4 列。

## EDGE OUT

- 不改角色数据、派遣逻辑、存档。
- 不做名单排序 / 筛选 / 搜索。
- 「离开的人」列表不参与瀑布流（保持一段文字列表）。

## ASSUME

- 「瀑布流」= 只显示头像的方形网格（3 列），不是等高错落的真瀑布流。
- 视图偏好只存本机，不进存档。
- 桌面以地图高度为准，名单不足时下方留空。

## 测试

- 浏览器：`#roster-view-grid` → `.girl-roster.is-grid` 出现、`.roster-info` 隐藏；
  切回列表后恢复；刷新后仍是上次视图。
- 浏览器：写入 12 位少女后，`.map-viewport` 高度与 4 人时一致；`.girl-roster-scroll` 的 `scrollHeight > clientHeight`。
- 浏览器：卡片边框颜色随 `--girl-color` 变化（取 computed style 比对）。
- `npm test` / `check:rules` / `build` 全绿。
