# 第十二版：提示词按用途拆分

## 目标

把散落在代码里的内置叙事提示词搬到对话补全预设的词条里，让「共用世界观 / 角色对话 / 每日提案 / 角色起草 / 故事线 / 私人事件 / 完整剧情 / 突发事件 / 服装词条」可以分别查看、修改、停用和恢复默认，同时保证代码里的 JSON 输出契约永远最后、不能被词条挤掉。

## 结构

- `PromptScope`：`shared | chat | daily | profile | storyline | event | arc | incident | outfit`。
- `PromptEntry.scope` 缺省为 `shared`；旧词条和 ST 导入词条没有用途时也按共用处理。
- 每个请求只注入 `shared + 当前 scope`，顺序固定为「共用词条 → 本任务词条 → 代码契约」。
- 三个内置预设都升级到 `schema: 3`，包含 12 条默认词条；严格 JSON 额外带 `json`，克制夜谈额外带 `restraint`。
- `{{world}}` 继续可用：由共用词条里 id/name 为 world 的词条解析，找不到时回落 `DEFAULT_WORLD`。
- 旧 `night-sugar:llm-prompts` 只迁移一次：world / 自定义 daily 写入一份可编辑的自定义预设「迁移的旧提示词」，旧 key 保留一版。

## 迁移与导入

- 旧预设（schema < 3）加载时补齐缺失的默认词条，并标记为内置默认；已有同 id 词条不覆盖。
- 本作导出的 schema 3 文件往返不增加词条。
- ST 导入（没有 schema 3）补齐任务词条，并在导入报告里写明「导入了 N 条任务默认词条（已标记为默认）」。
- 每条 prompt 导出 `scope`；顶层 `schema: 3`。
- 旧每日要求里的「不要给任何数值、奖励或规则」会被识别为冲突：词条下方显示警告和「移除这一句」，移除后保留同段其余有效要求。

## UI

- 设置 → 故事引擎：删除旧「世界观与语气 / 本次生成要求」文本框，改为九个用途入口；每个入口直接打开预设编辑器的对应筛选。
- 如果入口对应的绑定预设是只读内置预设，先自动复制成可编辑副本并改绑，再打开对应用途，避免用户面对只读词条。
- 预设编辑器：
  - 用途筛选（全部 + 九种用途）。
  - 每条词条可改用途。
  - 按当前用途统计注入条数。
  - 「恢复本用途 / 恢复全部默认」。
  - 新预设、复制预设都带全部默认任务词条。
  - 当前用途的说明会提示：代码契约自动追加在词条之后。

## 代码

- `src/presets.ts`：scope 类型与标签、默认词条、`activePrompts(preset, scope?)`、`composeTaskSystem`、`ensurePromptScopes`、旧提示词迁移、冲突检测/移除。
- `src/llm.ts`：删除 `LlmPrompts` 与全局 world/daily 参数；新增 `composePrompt`；`chatJson` 与所有 `generate*` 接收 scope / preset；每日提案仍以 `buildNightPrompt(state)` 为契约。
- `src/App.tsx`：所有生成调用改为绑定预设；`Modal` 的 presets 分支可带 `initialScope`。
- `src/components/UtilityDialogs.tsx`：九种用途入口，移除旧提示词编辑。
- `src/components/PresetDialog.tsx`：用途筛选/下拉/恢复/冲突提示；`initialScope` 直接落到提示词页。
- `src/styles.css`：任务入口、用途筛选、冲突提示与窄屏布局。

## 验收

- `tsc -b` 通过。
- `npm test`：111 项通过。
- 生产构建通过。
- `node tests/browser.mjs`：52 项通过。
- 浏览器覆盖：任务提示词按用途编辑、旧数值禁令标记与移除、预设导出 schema 3 + scope、旧预设与 ST 导入迁移。

## 已知边界

- 保留「角色对话 / 结构化生成 / 故事」三档绑定，暂不拆成每个任务一套独立预设。
- 词条不能绕过代码契约；枚举、目录 ID、预算、数量等仍由代码校验。
