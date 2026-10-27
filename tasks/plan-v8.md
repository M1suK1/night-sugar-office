# v8 方案：剧情预设的正则与独立接口

> 目标：让「角色剧情」真正按 SillyTavern 的用法工作——预设自带接口、预设带正则、提示词按 ST 的 prompt_order 拼装。
> 现状基线：`presets.ts` 只有采样 + 词条 + main/jailbreak；`PresetDialog` 两个页签；所有 LLM 调用共用 `loadLlmConfig()`；ST 的 `prompt_order`、`wi_format` 等仍在 `IGNORED_SETTING_KEYS` 里被丢弃；没有正则。

---

## 0. 现在的差距

| 需求 | 现状 | 差距 |
| --- | --- | --- |
| 每个预设独立 API | 全局一份 `night-sugar:llm-config` | 预设没有 endpoint / key / model，切换预设不会换接口 |
| 适配 ST 预设 | 采样参数 + 词条 + main/jailbreak | `prompt_order`、`wi_format`、`scenario_format`、`personality_format` 被忽略 |
| 适配 ST 正则 | 无 | 没有正则库、没有导入导出、没有应用点 |
| 角色剧情用独立链路 | 剧情预设已可单独绑定，但接口仍是全局 | 剧情预设换了，接口没换；剧情文本不经过任何正则 |

关键代码位置：

- `src/presets.ts:20` `ChatPreset`、`:33` `PresetRuntime`、`:90` `IGNORED_SETTING_KEYS`、`:314` `presetRuntime`、`:350` `PresetBinding`。
- `src/llm.ts:333` `chat()` 组装 payload；`src/App.tsx:121/143/336/352` 剧情事件、故事线、角色事件仍传 `loadLlmConfig()`。
- `src/components/PresetDialog.tsx:27` 页签只有 `sampling | prompts`。

---

## 1. 预设独立接口

### 1.1 数据

```ts
interface PresetApi {
  mode: 'inherit' | 'custom';   // 默认 inherit
  endpoint: string;
  apiKey: string;
  model: string;
}
interface ChatPreset {
  // 既有字段…
  api?: PresetApi;
}
```

规则：

1. `mode: 'inherit'` 或字段为空 → 回落全局 `loadLlmConfig()`。
2. `mode: 'custom'` 必须三项齐全才生效；缺项时该字段单独回落全局，并在预设页显示「接口不完整，仍使用全局的 X」。
3. 内置预设永远 `inherit`，不允许改接口（避免「内置」名不副实）。
4. **导出预设时剥离 `apiKey` 和 `endpoint`**（`exportPresetJson` 走 `redactPreset()`）；导入时忽略 `api`，统一设为 `inherit`，避免别人的预设把你的请求发到陌生地址。
5. 密钥仍存 localStorage（与全局一致），设置页明确写「仅本机浏览器，不上传」；不做加密，避免假安全。

### 1.2 解析

`src/presets.ts` 新增：

```ts
export function resolvePresetConfig(preset: ChatPreset | undefined, global = loadLlmConfig()): LlmConfig
```

解析顺序：预设 `api` → 全局。返回的 `LlmConfig` 带一个非持久字段 `source: 'preset' | 'global'`（只用于日志与 UI 展示，不写回存储）。

所有调用点改为：

```ts
const preset = boundPreset('story', presets, binding);
const config = resolvePresetConfig(preset);
await generateStoryArc(config, prompts, girl, input, presetRuntime(preset));
```

涉及：`generateDaily`、`generateGirlProfile`、`generateDialogue`、`generateOutfitDescription`、`generateStoryline`、`generateIncident`、`generateEvent`、`generateStoryArc`。

### 1.3 日志

`recordLlmLog` 的 `model`/`endpoint` 已经记录，追加：

- `preset: { id, name, api: 'preset' | 'global' }`
- 叙事引擎面板头部显示「预设：均衡叙事 · 独立接口 api.example.com」。

永不记录 apiKey（包括快照）。

### 1.4 UI（`PresetDialog` 新页签「接口」）

- 单选：`使用全局接口` / `这个预设用自己的接口`（`#preset-api-inherit`、`#preset-api-custom`）。
- 字段：`#preset-api-endpoint`、`#preset-api-key`（密码框 + 显示/隐藏）、`#preset-api-model`。
- `#preset-api-test`：用该预设的实际解析结果调 `testLlmConnection`。
- 说明行：`key 只存本机；导出预设时会自动移除。`

---

## 2. ST 预设补全

### 2.1 prompt_order

ST 预设的 `prompt_order` 是一个有序数组，每项带 `identifier` 与 `enabled`。实现：

```ts
interface PresetPromptOrderItem { identifier: string; enabled: boolean }
ChatPreset.promptOrder?: PresetPromptOrderItem[];
```

内置槽位与我们的变量映射：

| identifier | 内容来源 | 变量 |
| --- | --- | --- |
| `main` | 预设 main | — |
| `worldInfoBefore` | 世界观 | `{{world}}` |
| `worldInfoAfter` | 世界书命中词条 | `{{worldbook}}` |
| `charDescription` | 角色卡 + 外观 | `{{char}}` |
| `charPersonality` | 性格 | `{{char}}` 的性格段 |
| `scenario` | 故事线前提 / 当前幕 | `{{story}}` |
| `personaDescription` | 玩家档案 | `{{player}}` |
| `dialogueExamples` | 示例对话（预设词条） | — |
| `chatHistory` | 最近对话 / 已播剧情 | `{{history}}` |

规则：

1. 有 `promptOrder` 时，按顺序、按 `enabled` 拼装；没有对应变量的槽位跳过。
2. 预设自带的 `prompts` 里 `identifier` 命中的条目使用其内容；未命中的条目追加在 `chatHistory` 之前。
3. 没有 `promptOrder` 的旧预设，沿用「按数组顺序拼装」的现状，保证不回归。

### 2.2 格式串

`wi_format`、`scenario_format`、`personality_format` 按 ST 的 `{0}` 占位替换后套在对应段外；默认值分别为 `"{0}"`、`"{0}"`、`"{0}"`。同时停止在 `IGNORED_SETTING_KEYS` 里丢弃这三项，导入报告里也不再列为「已忽略」。

### 2.3 ST 宏与注释

导入的预设词条里会出现这些写法，必须在拼装前处理：

| 写法 | 处理 |
| --- | --- |
| `{{// 注释 }}` | 整段删除（ST 的注释块，可能跨行） |
| `{{user}}` | 替换为玩家档案的名字 |
| `{{char}}` | 替换为当前契约者的名字 |
| `{{scenario}}` / `{{personality}}` | 仅作为 `*_format` 的占位符处理，不参与正文替换 |
| `<{{char}}>` 这类标签 | 原样替换名字，不去掉尖括号（部分预设用它做格式标记） |

### 2.4 采样键名双轨

ST 预设有两种导出风格：官方预设导出用 `temp_openai` / `top_p_openai` / `pres_pen_openai`；直接导出的 settings 用 `temperature` / `top_p` / `presence_penalty` / `frequency_penalty`。两者都要认，优先级：`*_openai` → 平铺键 → 默认值。

上限放宽：`openai_max_tokens` 上限从 4096 提到 32768，`openai_max_context` 上限从 128000 提到 400000；仍保留下限与非法值回落。`chatJson` 的截断重试上限同步从 4096 提到 32768，避免长剧情被硬切。

### 2.5 仍不做的

`world_info_*` 深度注入、`group_nudge`、`new_chat_prompt`、`impersonation_prompt` 继续忽略并在导入报告说明——本作没有 ST 的聊天流，硬套会得到半套行为。

依赖工具调用（`<output_method>`、`game_content` 函数）或 SPreset/agent 扩展的预设，本作无法执行：导入后给出醒目警告，列出相关词条名，建议手动停用；不把 `<output_method>` 之类的指令悄悄注入系统提示。

---

## 3. ST 正则适配

### 3.1 数据与存储

```ts
interface RegexScript {
  id: string;
  name: string;
  find: string;          // 支持 "/pattern/gi" 字面量或裸模式
  replace: string;       // 支持 $1
  trim?: string[];       // 命中后要去掉的字符串
  enabled: boolean;
  destination: { prompt: boolean; display: boolean };  // 对应 ST 的两条目的地
  source: { userInput: boolean; aiOutput: boolean };    // 对应 ST 的来源
  minDepth?: number;     // 可选，沿用 ST 语义，缺省不限制
  maxDepth?: number;
  rawOnly?: boolean;     // ST 的 markdownOnly=false 且 promptOnly=false
  builtin?: boolean;
}
```

ST 的正则是「来源 × 目的地」而不是单一 placement：`source` 决定它作用在玩家输入还是 AI 输出，`destination` 决定它作用在发送给模型的提示词还是显示层。参考 [Tavern regex contract](https://raw.githubusercontent.com/LiarMTTT/TavernWeave/main/skills/sillytavern-render-regex-pipeline/references/tavern-regex-contract.md) 与 [SillyTavern regex engine](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/extensions/regex/engine.js)。

- 存储键 `night-sugar:regex-scripts`，全局一份库。
- 预设通过 `ChatPreset.regexIds?: string[]` 选择启用哪些；`undefined` = 全部启用，`[]` = 全部禁用。这样既能「一套预设一套正则」，又不必复制脚本。
- 导出预设时把 `regexIds` 写成 ST 的正则数组（`exportPresetJson` 附带 `regex_scripts` 字段），导入时若检测到该字段则并入全局库并回填 id。

### 3.2 ST 导入字段映射

ST 正则脚本字段：`scriptName`、`findRegex`、`replaceString`、`trimStrings`、`placement`、`disabled`、`markdownOnly`、`promptOnly`、`runOnEdit`、`substituteRegex`。

映射：

| ST | 本作 |
| --- | --- |
| `scriptName` | `name` |
| `findRegex` | `find`（支持 `/pattern/flags` 字面量或裸模式，保留 flags） |
| `replaceString` | `replace`（支持 `$1`） |
| `trimStrings` | `trim` |
| `disabled` | `!enabled` |
| `promptOnly` | `destination.display=false, prompt=true` |
| `markdownOnly` | `destination.prompt=false, display=true` |
| 两者皆真 | 两条都开 |
| 两者皆假/缺省 | `rawOnly=true`（本作按「提示词 + 显示」都过一遍，并在导入报告注明） |
| `placement` 数值 | 仅在缺少 `source` 布尔时使用，映射表逐值对照当前 ST 版本；未知值保留并报告 |
| `minDepth` / `maxDepth` | 原样保存；超出范围时跳过 |
| `substituteRegex` | `0`（不替换）与 `1`（替换）都支持；`2` 暂不支持并报告 |

**placement 数值**：不同版本含义有出入。这个预设里 `placement` 是数组（`[2]`、`[1,2]`），按元素并集处理：1 = 玩家输入、2 = AI 输出，其余值进导入报告。实现时以 ST 当前源码为准逐值对照，未知值不静默丢弃。缺 `source` 时默认按「玩家输入 + AI 输出」处理。

### 3.3 应用点

新增 `src/regex.ts`：

```ts
export function applyRegex(text: string, scripts: RegexScript[], phase: 'prompt' | 'output' | 'display', preset?: ChatPreset): string
```

- 编译：接受 `/pattern/flags` 与裸模式；`new RegExp(...)` 用 `try/catch` 包裹，失败则跳过该条并计入导入/运行报告（不弹窗）。
- 判定顺序与 ST 对齐：启用 → 来源（userInput / aiOutput）→ 目的地（prompt / display）→ depth 范围 → 编译 → 替换。
- 顺序：按库顺序依次 replace（后一条看到前一条的结果），与 ST 一致。
- `trim`：replace 后逐项 `split(join(''))` 去掉。
- 只有 `enabled`、被预设 `regexIds` 选中、来源与目的地都匹配的脚本参与。
- 安全阀：模式长度 > 500 或文本 > 200_000 时跳过该条；单条 `try/catch`；不做超时线程。

应用位置（`applyRegex(text, scripts, stage, preset)`，`stage` 为 `'prompt' | 'display'`，来源另由调用方声明）：

| 阶段 | 位置 |
| --- | --- |
| prompt / userInput | 发送前：玩家输入、追加提示、历史摘要 |
| prompt / aiOutput | 发送前：把此前的模型输出放回上下文时的整理 |
| display / userInput | 对话气泡里玩家那句话的渲染 |
| display / aiOutput | 对话气泡、分幕剧情、事件、编年史的渲染前 |

JSON 链路（每日提案、故事线、事件、起草、服装描述）不把正则作用在整段 JSON 上，只对解析后的字符串字段应用 `display` 规则，避免正则改坏引号或括号。

### 3.4 UI

`PresetDialog` 新页签「正则」：

- 左：全局脚本列表（`#regex-item-<id>`、启用开关、`#regex-new`、`#regex-import`、`#regex-export`）。
- 右：`#regex-name`、`#regex-find`、`#regex-replace`、`#regex-trim`、来源复选 `#regex-src-user` / `#regex-src-ai`、目的地复选 `#regex-dest-prompt` / `#regex-dest-display`、depth 上下限、`#regex-delete`。
- 下：`#regex-sample` 文本域 + `.regex-preview` 实时结果（错误时显示「正则无效：…」）。
- 预设范围：`#regex-scope-all` / `#regex-scope-selected` + 勾选列表。

---

## 4. 角色剧情链路的完整适配

`startStory` / `startEvent` / `generateIncident` 三步统一：

1. 取绑定预设 `boundPreset('story')`。
2. `resolvePresetConfig(preset)` 得到接口。
3. `promptVars` 增 `history`（最近 10 轮对白或已播段落的摘要）与 `worldbook`（已有）。
4. 发送前 `applyRegex(text, scripts, 'prompt', 'userInput', preset)`；返回后对展示字段用 `applyRegex(text, scripts, 'display', 'aiOutput', preset)`。
5. 日志记录预设名、接口来源、命中的正则条数。

`StoryPlayerDialog` 渲染 `passage.narration` 与 `line.text` 时统一走 `applyRegex(..., 'display', 'aiOutput', preset)`；事件与对话同理。

---

## 5. 迁移与兼容

- `presets` 存储升到 `schema: 2`：缺 `api` 的补 `inherit`，缺 `promptOrder` 的保持 undefined。
- 旧正则：无。
- 存档 `GameState` 不变（仍 v10），因为预设/正则/接口都在 localStorage。
- 导出预设：加 `schema: 2`、`regex_scripts`（若有）、剥离密钥；导入兼容 v1（无 api / 无 promptOrder）。

---

## 6. 文件清单

| 文件 | 改动 |
| --- | --- |
| `src/presets.ts` | `PresetApi`、`resolvePresetConfig`、`promptOrder`、格式串、`redactPreset`、schema 2、导出带 regex |
| `src/regex.ts` | 新建：类型、导入导出、`applyRegex`、`compile`、示例脚本 |
| `src/llm.ts` | `chat` 接受 `stop`（可选）、日志带预设与接口来源、JSON 链路的展示字段后处理 |
| `src/components/PresetDialog.tsx` | 两个新页签（接口 / 正则）、测试连接、正则编辑器与预览 |
| `src/components/Conversation.tsx`、`StoryPlayerDialog.tsx`、`EventDialog.tsx`、`views/AuxViews.tsx` | display 正则 |
| `src/App.tsx` | 所有调用改用 `resolvePresetConfig`；日志带上预设名 |
| `tests/game.test.ts`、`tests/browser.mjs` | 规则与 UI 验收 |

---

## 7. 里程碑

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| M0 | 导入保真：采样双轨键名、上限放宽、ST 宏与注释、prompt_order 读取、兼容性警告、正则数组 placement | 用 `Reborn2.4.2` 导入后 temp=1.08 / top_p=0.98、顺序与启用项一致、无 `{{//}}` 残留 |
| M1 | `regex.ts` + 单测（导入映射、flags、trim、无效正则、顺序、上限） | ≥ 6 条状态测试 |
| M2 | 预设接口：数据、解析、导出剥离密钥、日志、接口页签 + 测试连接 | 状态测试 + 浏览器里拦截请求断言 Authorization/model |
| M3 | 完整拼装：`prompt_order` + 格式串 + 剧情链路改用预设接口与正则 | 剧情请求的快照可看到槽位顺序 |
| M4 | 正则页签、预览、预设范围、浏览器流程、文档 | 浏览器 ≥ 45 组 |

目标回归：状态测试 ≥ 84、浏览器 ≥ 45。

---

## 8. 风险

| 风险 | 处理 |
| --- | --- |
| 预设里存密钥 → 导出泄露 | 导出强制剥离；导入忽略 api；UI 明示 |
| 正则 ReDoS | 单条 try/catch、长度上限、不提供超时线程；文档提示别贴来源不明的正则 |
| ST placement 数值语义不稳 | 实现时对照 ST 源码；未知值保留并报告，不静默处理 |
| 正则改坏 JSON | JSON 链路只对解析后的展示字段应用 |
| 每预设独立接口导致「以为在用 A，其实打 B」 | 叙事引擎面板与设置页都显示「当前实际接口」；测试按钮用解析后的配置 |
| token 预算 | 正则主要在发送前缩短文本，不增加预算；prompt_order 不新增内容 |

---

## 9. 实测：Reborn2.4.2

拿真实预设 `Reborn2.4.2改.json`（449 KB，ST 直接导出的 settings 平铺格式）跑了现有导入器与拼装器，结论如下。

### 10.1 已经能用的

| 项 | 结果 |
| --- | --- |
| 结构识别 | 平铺 settings 正确识别，名称 `Reborn2.4.2` |
| 词条导入 | 70 条全部导入；31 条 `enabled:false` 正确保持停用 |
| 词条字数 | 启用词条约 3831 tokens |
| prompt_order 解析 | 两个 block（`character_id` 100000 / 100001），聊天用后者，55 项、36 项启用、11 个 marker、25 条正文词条，全部能解析到 id |
| 正则 | `extensions.regex_scripts` 14 条、9 条启用，`placement` 为数组（`[2]`、`[1,2]`）；JS 正则可直接编译，`思维链标签转义` 在样例上能正确把 `<think_nya>` 转义 |

### 10.2 这次实测暴露的四个问题

1. **采样参数全部回落默认**：该文件用 `temperature: 1.08` / `top_p: 0.98`，我们只认 `temp_openai` / `top_p_openai`，于是实际用了 0.85 / 0.95。`maxTokens` 也从 65535 被夹到 4096。
2. **prompt_order 被忽略**：现在按 70 条数组顺序拼，而不是按 55 项的顺序与启停；15 条未进入 order 的词条仍可能被拼进去。
3. **ST 宏没处理**：`{{// 注释}}` 整段原样进入系统提示（这个预设里有近 1 KB 的作者声明与注释）；`{{user}}` 留空，出现「可加入  的语言」这种断句；`{{char}}` 被塞进 `<...>` 变成标签。
4. **工具调用预设会打架**：该预设末尾要求「所有输出必须调用 game_content 函数」，本作没有函数调用通道。若原样注入，模型会被要求输出工具调用，JSON 链路直接失败——必须检测并警告，而不是照单全收。

### 10.3 因此方案新增

- M0：导入保真修复（采样双轨键名、上限放宽、ST 宏/注释、prompt_order 读取、兼容性警告、正则数组 placement），先让这个预设「导入后行为可预期」，再谈接口与正则应用。
- 导入结果增加 `warnings: string[]` 与 `unsupported: { id, name, reason }[]`，在预设页展示，不再只报「忽略 15 个字段」。

---

## 10. 非目标

- 不实现 ST 的聊天流、世界书激活策略、群聊。
- 不做密钥加密或云同步。
- 不做正则的可视化构造器。
- 不改战斗 / 诊所 / 议会逻辑。

---

## 11. M0 实施记录（导入保真）

- `ChatPreset.promptOrder` + `presetPrompts` 顺序注入；`activePrompts()` 只取 `prompt_order` 内且启用的词条，未列入顺序的标「不在顺序」。
- 采样字段兼容 SillyTavern 平铺键名（`temperature`/`top_p`/`max_tokens`/`presence_penalty`/`frequency_penalty`/`max_context`），本作键名优先；`openai_max_tokens` 上限 32768、`openai_max_context` 上限 400000。
- `expandPresetMacros`：去 `{{// }}` 注释、替换 `{{user}}`/`{{char}}`、移除 `{{setvar/getvar}}` 变量宏；`{{user}}` 默认取玩家档案名字。
- 导入结果新增 `warnings` / `unsupported`：SPreset、Tavern Helper、变量宏、多模型轮段、工具调用词条、缺 `prompt_order`、输出额度超限；界面在导入区用黄色清单与红色「需要手动处理」块展示。
- 导出写回 `prompts[]` 与 `prompt_order: [{ character_id: 100001, order }]`，可被 SillyTavern 直接读回。
- 真实预设验收（`Reborn2.4.2改.json`，70 条词条）：温度 1.08 / Top P 0.98 / 最大输出 32768 / 上下文 400000；按顺序注入 25 条正文；拼装 4447 字、约 3248 tokens；无 `{{//` 与 `setvar` 残留；4 条兼容性警告 + 1 条工具调用词条。
- 回归：77 项状态测试、41 组浏览器流程（含导入警告 UI 与「不在顺序」标记）。
- 尚未做（M1）：ST 正则（`extensions.regex_scripts`，prompt/display 两个 destination）、每个预设的独立 API、`wi_format` / `scenario_format` 等格式串。
### M1 正则、独立接口与格式串（2026-10-26）

- `src/presets.ts`：新增 `PresetApi`（endpoint / apiKey / model）、`RegexScript`、`parseFindRegex`（`/pattern/flags` 或裸模式）、`parseRegexScript`（ST `placement` 1=input、2=output，`disabled` 反转）、`pickRegexScripts`、`applyRegexScripts`（prompt 跳过 markdownOnly，display 跳过 promptOnly）、`applyRegexToMessages`、`applyFormat`（`{0}` / 前缀换行）、`resolvePresetConfig`（三项齐全才用预设接口；远程缺 key 回退全局；localhost 免 key）。
- `src/llm.ts`：对话与 `chatJson` 统一用 `resolvePresetConfig` 解析出的接口；输入消息先跑 prompt 正则；`{{worldbook}}` 按 `wi_format` 包装；返回文本按 display 正则处理后再截断。
- `PresetDialog` 新增「接口与正则」页签：三个 API 字段与正则列表（启停、输入/输出、仅提示词/仅显示、查找/替换、删除），内置预设只读。
- 导出会把正则写回 `extensions.regex_scripts` 并剥离 `apiKey`；导入时无法解析的正则会给出警告。
- 验收：`tsc` 0、`npm test` 78/78、`node node_modules/vite/bin/vite.js build` 成功（index 523.14 kB / gzip 175.61 kB）、browser 41/41（新增预设接口与正则持久化流程）；截图 `artifacts/preset-advanced.png`。
### M2 剧情链路的格式串与真实预设端到端（2026-10-26）

- `src/llm.ts`：`chatJson` 增 `extra` 变量；各剧情生成器（故事线、事件、分幕剧情、强制事件）传入 `char` / `personality` / `scenario` / `story`；`scenario` 与 `personality` 按预设的 `scenario_format`、`personality_format` 包装后，才参与 `{{…}}` 替换。
- 预设词条没有引用 `{{scenario}}` / `{{personality}}` 时，系统提示会自动补「【场景】」「【角色性格】」两段，避免这两种格式串在真实预设下被静默丢弃。
- `applyFormat` 修正：ST 默认格式串 `{{scenario}}` / `{{personality}}` 表示「原样放入」，不再被当成外层模板再拼一次。
- `chat()` 与生成器的密钥检查改为 `hasCredentials()`：`localhost` / `127.0.0.1` 允许空密钥，远程仍要求；同时解决了「预设自带密钥但全局密钥为空」被提前拦截的问题。
- 真实预设 `Reborn2.4.2改.json` 端到端（本地 mock `127.0.0.1:18081`）：请求使用预设接口与模型，`temperature 1.08` / `top_p 0.98` / `max_tokens 32768`，系统提示 5989 字，包含【预设词条】【场景】【角色性格】，无 `{{setvar}}` / `{{user}}` 残留；返回的 4 段、1140 字剧情通过校验。
- 验收：`tsc` 0、`npm test` 79/79、构建成功（index 524.17 kB / gzip 175.93 kB）、browser 41/41。
### M3 格式串输入框与槽位快照（2026-10-26）

- 预设编辑器「接口与正则」页新增「格式串」区块：`#preset-format-scenario`、`#preset-format-personality`（双行文本域）与 `#preset-format-wi`；单 `{{…}}` 视为原样放入，`{0}` 视为包装。`scenario_format` 直接决定 `【场景】` 段的形状，`personality_format` 决定角色性格段，`wi_format` 决定世界书段。
- 叙事引擎面板：日志请求快照新增 `slots`（`index/name/role/tokens/enabled/marker`），在「本次请求参数」下按 `prompt_order` 渲染「预设槽位 · 启用数/总数」，停用条半透明、分隔条虚线；截图 `artifacts/llm-slots.png`。
- `slotList(runtime)` 用 `promptTokens` 估算每条词条的 token，`chatJson` 与对话两处都会写入快照。
- 验收：`tsc -b` 0、`npm test` 79/79、browser 42/42（新增「叙事引擎快照能按 prompt_order 显示预设槽位」）、构建 index 526.61 kB。截图 `artifacts/preset-format.png`。
### M4 收尾：schema 2、导出剥离与正则预览（2026-10-26）

- `ChatPreset.schema` 固定写 2，`sanitizePreset` / `exportPresetJson` 都带上；导出根节点带 `schema: 2`。
- 导入时把预设自带的 `api` 从 `settings` 拆出，只保留 `endpoint` / `model`，密钥一律不落盘、不导出；旧版预设（只有 `main` / `jailbreak`）继续按词条迁移。
- 预设编辑器「接口与正则」新增正则预览：`#preset-regex-sample` 样例文本 + `#preset-regex-preview-prompt` / `#preset-regex-preview-display` 双栏结果，实时走 `applyRegexScripts`（prompt 跳过 markdownOnly、display 跳过 promptOnly）。
- 验收：`tsc -b` 0、`npm test` 84/84（新增 schema/剥离、prompt_order 顺序、applyFormat、接口回退、坏正则统计）、browser 45/45（新增旧版预设迁移、正则双端预览、导出剥离三条）、构建 index 527.80 kB。