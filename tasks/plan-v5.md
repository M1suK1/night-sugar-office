# 夜糖事务所 · 第五版方案

版本：v5 草案（2026-10-25）
状态：待确认后实施
基线：`main` @ 76d34e9（存档 version 6，42 项状态测试 / 27 组浏览器流程）
范围：九区域与环境影响、叙事引擎控制台、SillyTavern 对话补全预设、自定义装束占格、衣柜导入、营业时间与跨日、分时段限时委托。

---

## 0. 一句话目标

把「一个晚上」从**一条无限长的 1440 分钟时间轴**，改造成**六个小时、分三段放号、会打烊的一夜**；把 LLM 从**黑箱按钮**变成**可审计的叙事者**（看得见读了什么、想了什么、为什么失败）；把地图从**七个散点**变成**九个有性格、有环境代价的街区**。

设计原则不变：数值只走一条结算管线，模型只提案，规则与存档仍在本地。

---

## 1. 现状盘点（方案依据）

| 关注点 | 现状 | 位置 |
| --- | --- | --- |
| 地图区域 | 只有 3 个装饰性标签，无边界、无数据、无效果 | `src/components/DispatchMap.tsx:39` |
| 委托 | 7 条预置委托一次性全开，无出现时间、无截止、无时段 | `src/content/seed-pack.ts:105` |
| 委托类型字段 | `Mission` 无区域/时限字段；`status` 只有 `open/active/done` | `src/types.ts:138` |
| 时间 | 1440 分钟制，跨 00:00 自动加天，无营业时间概念 | `src/game.ts:584` `advanceClock` |
| 推进 | 一次最多 180 分钟，自动推进 12 秒 / 5 分钟 | `src/game.ts:641`、`src/App.tsx:74` |
| LLM 日志 | 只记 kind/ok/耗时/一句话，打印到 `console.info`，UI 埋在设置页底部 | `src/llm.ts:10-57`、`src/components/UtilityDialogs.tsx:60` |
| LLM 请求 | `chat()` 内部拼 payload，温度硬编码 0.9，无预设、无 stop、无 reasoning 读取 | `src/llm.ts:229` |
| 衣柜 | 容量 3（UI）与 4（卡片导出）不一致；自定义少女 `wardrobe: []`，服装描述游离在衣柜外 | `src/components/CharacterDialog.tsx:208`、`src/game.ts:1137`、`src/cards.ts:58` |
| 立绘 | 只认 `girl.portrait`，衣柜仅换配色与领型 | `src/components/GirlPortrait.tsx:15-27` |
| 存档 | version 6；`loadState` 对旧档做宽松 hydrate | `src/game.ts:1245` |

---

## 2. 需求一：九区域与环境影响

### 2.1 九个区域

地图不按网格切。九个辖区沿 `public/art/city.svg` 的地物勾出：星见川（约 145px 宽的河道）把城市分成两岸，桥头、公园、会堂、教堂、温室、码头各自成区，辖区大小不一、边界随河岸弯曲。坐标采用 1100×780 像素，与底图同尺寸；渲染为 `<svg viewBox="0 0 1100 780" preserveAspectRatio="none">` 叠在 `<img class="city-art">` 之上，`.city-art` 用 `object-fit: fill`，于是多边形、百分比图钉和底图共用一套坐标。

| # | id | 名称 | 位置 | 环境效果（结构化） |
| --- | --- | --- | --- | --- |
| 1 | `candy` | 糖果公园 | 西北，樱树与喷泉 | 调查目标 −6%；奖励 +8%；疲劳 −2 |
| 2 | `station` | 北岸桥头 | 北岸，天文台与铁桥 | 战斗伤害 +10%；疲劳 +4 |
| 3 | `plaza` | 月见台 | 东北，穹顶街区 | 受到伤害 −8%；成功安定度 +2 |
| 4 | `greenhouse` | 玻璃温室 | 东岸中段 | 敌方生命 −10%；奖励 +10%；疲劳 +3 |
| 5 | `cathedral` | 旧教堂 | 东南河岸 | 调查目标 +6%（更难）；战斗伤害 +12% |
| 6 | `crossroad` | 南十字 | 东南远端 | 受到伤害 −10%；调查目标 −3% |
| 7 | `oldtown` | 旧城区 | 西侧，面积最大 | 疲劳 +6；奖励 +15% |
| 8 | `clocktower` | 旧钟楼 | 中西部，会堂与钟塔 | 每小时精神 −2；战斗伤害 +8% |
| 9 | `docks` | 星见川码头 | 西南沿河 | 受到伤害 −8%；调查目标 +4%（盐雾） |

每个辖区含：

- `description`：60–110 字背景，区域面板主文案，同时拼进 LLM 的世界观上下文。
- `terrain` / `subtitle`：一句话地形与位置说明（“草坪、喷泉、樱树林”）。
- `label` / `center`：SVG 文字锚点与最近辖区回退中心。
- `tint`：`"r, g, b"`，用于边界描边、选中光晕、图钉底色与面板左缘。

### 2.2 类型与判定

```ts
// src/districts.ts —— 地形辖区与结构化环境效果
export type DistrictId = 'candy' | 'station' | 'plaza' | 'greenhouse' | 'cathedral'
  | 'crossroad' | 'oldtown' | 'clocktower' | 'docks';

export interface DistrictEffect {
  targetPct?: number;       // 调查判定目标百分比修正，负数 = 更容易
  rewardPct?: number;       // 报酬修正
  damageDealtPct?: number;  // 我方伤害修正
  damageTakenPct?: number;  // 我方承伤修正
  enemyHpPct?: number;      // 敌方最大生命修正
  fatigueFlat?: number;     // 每次结算的额外疲劳
  spiritPerHour?: number;   // 在该辖区出勤期间每小时精神
  reputationFlat?: number;  // 成功时的安定度加成
}

export interface District {
  id: DistrictId; name: string; subtitle: string; terrain: string;
  description: string;                 // 区域背景，进入面板与 LLM 上下文
  effect: DistrictEffect;
  label: { x: number; y: number };     // SVG 文字锚点
  center: { x: number; y: number };    // 最近辖区回退用
  points: string;                      // 多边形顶点，1100×780 像素
  tint: string;                        // "r, g, b"，用于描边/图钉/面板
}

export function districtAt(xPct: number, yPct: number): DistrictId; // 多边形命中，未命中取最近中心
export function districtOfMission(mission: Mission): District;
export function effectLines(effect: DistrictEffect): { label: string; value: string; tone: 'good' | 'bad' }[];
export function applyPct(base: number, pct?: number): number;        // 四舍五入、最小 1
```

`Mission.district` 由 `annotateMission()` 在生成/迁移时写入；委托的 `target` / `reward` 只应用一次辖区百分比，避免重复结算。旧存档载入时统一补写，无需玩家操作。

所有效果只在这一处合并，禁止各系统各自读表：

| 系统 | 接入点 | 做法 |
| --- | --- | --- |
| 调查 | `src/game.ts:550 settleInvestigation` | `target = mission.target + effect.targetDelta`；成功时 `reputation += effect.reputationOnSuccess` |
| 奖励 | `settleInvestigation` / `settleCombat` | 统一走新函数 `missionReward(mission) = round(mission.reward * (1 + rewardPct/100))` |
| 战斗 | `src/combat.ts:156 simulateBattle` | `BattleSetup` 增加 `environment?: { damageDealt, damageTaken, enemyHpPct }`，伤害与敌方生命计算各乘一次 |
| 疲劳 | `dispatch()` | 结算时 `fatigue += effect.fatigue` |
| 时间流逝 | `advanceClock()` | 按所处区域累计 `spiritPerHour` / `corruptionPerHour`（按所在委托或当前选中区域？——只对**正在该区域出勤**的契约者生效，避免玩家踩图就掉精神） |

> 注：时间型效果只作用于“在该区域的进行中委托”，不作用于挂机玩家。这是有意的：环境是**出勤代价**，不是地图惩罚。

### 2.3 地图与面板

- `DispatchMap` 增加图层开关 `区域`（默认开），渲染 9 个半透明多边形 + 虚线边界 + 编号（Ⅰ–Ⅸ）。
- 三个旧装饰标签（旧城区 / 星见川 / 南十字街区）替换为 9 个可点击区域标签。
- 点击区域 → 右侧滑出 `DistrictPanel`（绝对定位卡片，宽 320；移动端为底部抽屉）：
  - 编号 + 名称 + `tagline`，`story` 全文；
  - 环境影响 chips（好坏分色，来自 `describeDistrictEffect`）；
  - 当前事件数、下一次放号倒计时；
  - “查看该区域委托”按钮 → 地图筛选。
- 委托图钉与列表项显示区域名；`MissionDialog` 顶部增加“区域 / 环境影响 / 时限”一行事实条。
- 选中区域存 `localStorage: night-sugar:district`，刷新恢复。

---

## 3. 需求二：叙事引擎控制台（可折叠悬浮框）

### 3.1 数据模型

`LlmLogEntry` 扩展（`src/llm.ts:10`）：

```ts
export interface ContextSection {
  key: string; label: string; chars: number; included: boolean; note?: string;
}
export interface LlmLogEntry {
  id: string; at: string; kind: '连接测试' | '每日提案' | '角色起草' | '剧情对话';
  ok: boolean; model: string; endpoint: string; status?: number; durationMs: number;
  message: string; detail?: string;
  request?: {
    messages: { role: 'system'|'user'|'assistant'; chars: number; content: string; truncated?: boolean; image?: string }[];
    sections: ContextSection[];         // “读取了哪些内容”清单
    params: Record<string, unknown>;    // 实际发出的采样参数
    totalChars: number; maxContext: number; presetName?: string;
  };
  response?: {
    text: string; reasoning?: string; finishReason?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
}
```

采集方式：`chat()` 接受 `trace` 收集器（`{ request, response }` 可写对象），各生成器把“拼上下文”的过程改为返回 `{ messages, sections }`：

```ts
function buildDailyMessages(prompts, context): { messages: ChatMessage[]; sections: ContextSection[] }
```

`sections` 逐项标注：世界观提示词、本次生成要求、JSON schema、当前局势、对话历史（条数 / 截断条数）、角色档案字段、立绘（尺寸/体积，不存图片本身）、区域与环境。`included: false` 的条目写明被预算裁掉。

思维链读取：`choices[0].message.reasoning_content ?? reasoning ?? reasoning_details[].text`；没有时 UI 明说“该模型未返回思维链”，不伪造。

### 3.2 存储与隐私

- 内存保留最近 60 条完整记录；`localStorage` 只持久化最近 12 条精简版（单条 24 KB，正文每条消息截到 6 000 字，超出标 `truncated`）。
- API Key 永不入日志；图片只记 `[立绘 768×960 · 84 KB]`；endpoint 只存 host。
- 日志写入失败（配额）不影响生成，仅控制台顶部提示“本次日志未落盘”。

### 3.3 界面

- 新组件 `src/components/LlmConsole.tsx`，挂在 `App.tsx` 根部、时间条上方：`position: fixed; bottom: 56px; right: 20px; width: min(560px, calc(100vw - 32px))`。
- **折叠态**：一条 36px 高的胶囊，显示最近一次结果（成功绿点 / 失败红点）、kind、耗时、token 数、未读失败数徽标。
- **展开态**：400px 高面板，头部「叙事引擎 · 控制台」+ 清空 / 复制 JSON / 关闭 / 固定在设置中打开；列表按时间倒序，每条手风琴：
  - 第一行：`成功/失败` pill、kind、时间、耗时、HTTP、`prompt→completion tokens`；
  - 四个分段页签：**读取内容**（sections 表 + messages 原文，图片显示尺寸占位）、**思维链**（`<pre>` 等宽、可复制）、**响应**（正文，JSON 美化）、**原始**（完整 JSON）。
  - 失败时自动展开该条并定位到错误详情。
- 自动展开策略：仅失败自动展开（默认开，可在设置关闭）。
- 设置页删除旧 `settings-llm-log` 区块，改为一行“打开叙事引擎控制台”按钮；测试连接 / 生成提案后控制台自动更新（`App` 持有 `consoleSeq` 递增，控制台订阅）。
- 键盘：`Esc` 收起面板（不关闭模态），`Ctrl/Cmd + \`` 切换控制台。

---

## 4. 需求三：SillyTavern 对话补全预设

### 4.1 数据模型

```ts
// src/presets.ts
export interface Sampling {
  temperature: number; top_p: number; top_k?: number; max_tokens: number;
  frequency_penalty: number; presence_penalty: number; repetition_penalty?: number;
  seed?: number; stop?: string[];
}
export interface LlmPreset {
  id: string; name: string;
  source: 'builtin' | 'imported' | 'custom';
  sampling: Sampling;
  jsonMode: boolean;        // 生成类请求强制 JSON
  extraParams: boolean;     // 是否发送 top_k / repetition_penalty（仅本地端点）
  systemSuffix?: string;    // ST 的 jailbreak / post_history_instructions
  note?: string;
  importedFrom?: { name: string; ignored: string[]; warnings: string[] };
}
export interface PresetBinding { daily: string; profile: string; dialogue: string; }
```

内置三个：

| id | 名称 | 温度 / top_p / max_tokens | 用途 |
| --- | --- | --- | --- |
| `night-narrative` | 夜糖·叙事 | 0.90 / 0.95 / 900 | 剧情对话默认 |
| `night-restrained` | 夜糖·克制 | 0.65 / 0.90 / 700 | 短句、少形容词 |
| `night-strict` | 夜糖·严格 JSON | 0.35 / 0.85 / 1400 | 每日提案与角色起草默认，`jsonMode: true` |

### 4.2 导入 SillyTavern 预设

接受 ST「对话补全预设」导出的 JSON（不要求 `.json` 后缀正确）。识别：

| ST 字段 | 处理 |
| --- | --- |
| `temperature` `top_p` `top_k` `frequency_penalty` `presence_penalty` `repetition_penalty` `max_tokens`/`openai_max_tokens` `seed` `stop` | 映射进 `sampling`；温度钳到 0–1.5，越界给 warning |
| `openai_max_context` | 作为“上下文预算”候选值，默认不覆盖夜糖 12k，导入确认框可勾选 |
| `main_prompt` | 询问是否写入「世界观与语气」（默认不覆盖） |
| `jailbreak_prompt` / `post_history_instructions` | 合进 `systemSuffix`，附在 system 末尾 |
| `prompts[]` 中 role=system 的条目 | 可选合并为“叙事风格补充”，按 `prompt_order` 排序后拼接 |
| `world_info` `character_lore` `regex_scripts` `extensions` `quick_replies` `prompt_order` | **不支持**，在导入报告中逐项列出“已忽略”，不静默丢弃 |

导入结果弹预览：识别到的参数表、将被忽略的键、警告（如温度 1.3 会被 JSON 类请求再钳一次）。冲突（重名）时自动加 `（导入 2）`。

### 4.3 原生格式与导出

```json
{ "kind": "night-sugar-preset", "version": 1, "name": "我的叙事", "sampling": { ... },
  "jsonMode": false, "extraParams": false, "systemSuffix": "" }
```

设置页支持导出当前预设、复制 JSON、恢复内置三件套。

### 4.4 接入请求

`chat()` 改为 `chat(config, messages, { preset, kind, jsonMode })`：

- payload 由 `preset.sampling` 生成；`o1/o3/o4/gpt-5` 仍不发送 temperature（保留现有 400 重试逻辑）；
- `jsonMode && kind !== 'dialogue'` → `response_format: { type: 'json_object' }`，温度临时 `min(t, 0.9)`，并在控制台参数里显示“生效值”；
- `stop`、`seed`、`top_k`、`repetition_penalty` 仅在 `extraParams` 或字段存在时发送；
- 调用绑定：设置页三个下拉（每日提案 / 角色起草 / 剧情对话），默认 strict / strict / narrative，存 `localStorage: night-sugar:llm-presets-v1`。
- 上下文预算 `openai_max_context` 进入 `MAX_CONTEXT`（`src/llm.ts:130`）可配置区间 4 000–32 000，默认 12 000；被裁掉的内容在控制台 `sections` 里可见。

---

## 5. 需求四：自定义装束直接占一格衣柜

### 5.1 规则

- **衣柜容量统一为 4 格**（修正 UI 3 / 卡片 4 的不一致，`src/cards.ts:58` 已按 4 截断）。
- 自定义契约者创建时生成第一格：

```ts
{ id: 'custom', name: draft.outfitName ?? '自定装束', description: draft.outfitDescription,
  palette: [draft.color, '#17141c', '#f7e9f1'], layerKey: 'custom',
  portraitRef: 'girl', custom: true }
```

- 其余三格仍是值夜制服 / 私服 / 礼装，合计 4 格；`outfitId` 初始为 `custom`。
- `Outfit` 增加可选字段：

```ts
portrait?: string;                 // data URL，导入的独立立绘
portraitRef?: 'girl';              // 复用角色立绘，避免存档重复存储
custom?: boolean;
source?: 'default' | 'custom' | 'imported';
```

- 立绘优先级：`outfit.portrait` → `portraitRef === 'girl' ? girl.portrait` → 程序化 SVG 剪影。这样自定义少女选中第一格时显示她导入的立绘；选中私服时回到剪影或对应装束立绘。
- `GirlPortrait` 的 data URL 分支从只看 `girl.portrait` 改为看“当前装束解析结果”，`avatar/full/card` 三种尺寸一致。
- 旧档迁移：`custom === true` 且衣柜里没有 `custom` 格时，自动补一格并保持 `outfitId` 指向它；不复制图片字节（只写 `portraitRef: 'girl'`）。
- `CustomGirlDialog` 增加“装束名称”（可选，默认「自定装束」）与提示文案：「这套装束与立绘会占据衣柜第 1 格」；裁剪结果不需要二次存储。

### 5.2 衣柜 UI 调整

- 头部计数 `n / 4`；空位显示“空衣柜格 · 可导入或新建”。
- 每格右上角菜单：重命名 / 编辑描述 / 更换立绘 / 移出衣柜 / 导出这一套。
- 移除当前装束时自动切到第一格；至少保留 1 格。

---

## 6. 需求五：详情页导入衣柜

### 6.1 入口

`CharacterDialog` 外观页第 01 节标题右侧：`导入衣柜` 按钮（`id: dossier-wardrobe-import`）+ `导出衣柜`。打开新组件 `WardrobeDialog`。

### 6.2 三种导入方式

1. **文件**：支持
   - 衣柜包 `{ "kind": "night-sugar-wardrobe", "version": 1, "outfits": Outfit[] }`；
   - 裸数组 `Outfit[]`；
   - 契约卡 JSON（含 `girl.wardrobe`）→ 自动识别并取其中衣柜；
   - 图片（png/jpg/webp，可多选）→ 每张生成一套：canvas 裁成 768×960、webp 0.78，取主色前 3 作为 `palette`，命名「导入装束 N」。
2. **从档案复制**：下拉选择其他契约者（含候选），勾选其中若干套。
3. **手动新建**：名称、描述（≤80 字）、三种配色、领型（uniform/casual/formal/custom）。

### 6.3 校验与上限

- 字段校验：`id/name/description/palette[3]/layerKey`；字符串去控制字符、截断；缺 id 自动生成 `w_<hash>`。
- 单张立绘 ≤ 600 KB（webp 768×960 约 60–120 KB），整套衣柜 ≤ 1.8 MB；超限提示并拒绝，不静默压缩到糊。
- 容量 4；已满时导入弹“替换哪一格 / 放弃”，支持多选批量替换。
- 同名冲突：默认“作为副本导入”（id 后缀 `-2`），可勾选“覆盖同名”。
- 导入前预览网格：每格显示立绘缩略、名称、描述、来源标记，勾选后才写入。

### 6.4 状态动作

```ts
| { type: 'importWardrobe'; girlId: string; outfits: Outfit[]; replace?: string[] }
| { type: 'addOutfit'; girlId: string; outfit: Outfit }
| { type: 'updateOutfit'; girlId: string; outfitId: string; patch: Partial<Outfit> }
| { type: 'removeOutfit'; girlId: string; outfitId: string }
```

`src/wardrobe.ts` 提供 `parseWardrobePack`、`buildWardrobePack`、`outfitFromImage`、`fittingWardrobe(girl, incoming, cap)`（纯函数，便于测试）。`cards.ts` 的导出/导入复用同一套校验，卡片与衣柜包格式互认。

---

## 7. 需求六：营业时间与「前往下一天」

### 7.1 一夜的长度

- **营业时间：18:00 → 次日 24:00，共 360 分钟**（六小时）。24:00–18:00 是白天休整，不参与玩法，由跨日按钮跳过。
- 第 14 夜从 **18:00** 开始（保持不变），开局距打烊 4 小时 20 分。
- 时间条显示：`第 14 夜 · 18:00`、`距打烊 4h20m`、一根 18:00→24:00 的进度条（分段标记 18:00 / 22:00 放号点）。
- 推进按钮保留 `+30` 与自动推进开关；单次上限仍 180 分钟，且不允许跨过打烊。
- 跨过打烊的推进**钳到 24:00**并提示「已到打烊时间」；自动推进到 24:00 时自动暂停并弹出打烊确认。

### 7.2 派遣与打烊的约束

- 派遣前校验 `now + duration <= close`，否则拒绝并说明「这条委托会跨过 24:00 打烊，明天再来吧」。这样跨日结算永远不需要“加班”特例。
- 治疗 / 休息 / 远行不受打烊限制，跨日继续计时（现有状态机已支持）。

### 7.3 前往下一天

时间条主按钮 `前往下一天`（`id: end-night`）→ `EndNightDialog` 二次确认：

```
第 14 夜 · 打烊前 4h20m
今夜账目：+2,400 / −1,180 星砂    完成委托 3    失败/过期 1
仍在进行：2 人出勤（22:50 归队）
明天 18:00 预计：3 条新委托 · 市场刷新 · 契约到期 1 人
空月仍在场：安定度 −6
[ 取消 ]  [ 结算今夜并前往第 15 夜 ]
```

确认后执行 `endNight` 动作：

1. `advanceTo(shiftClose)`：结算所有在打烊前完成的派遣、治疗、远行 tick（复用 `advance` 的事件循环，抽成内部 `advanceTo`，避免跳时漏结算——现有 `settleExpedition` 只被 `advance` 驱动）。
2. 过期清扫：本夜未接的限时委托标记 `expired`，紧急逾期安定度 −2，长期逾期 0。
3. `advanceClock` 到第 N+1 夜 18:00：跨过的整天走 `processDay`（市场刷新、势力货架、契约、周期 Boss），并写入一条「打烊 / 开门」日志与一条 `chronicle` 摘要。
4. 进入新一夜：生成本夜三段放号内容、重置每日一次计数、保存。

边界：

- 若有旧存档存在“跨打烊进行中”的委托，`endNight` 先推进到其完成（最多 +180 分钟）并在确认框标红说明。
- 空月跨日 tick 照常（每 180 分钟 −1 安定），确认框显式列出，避免“睡一觉城市塌了”的意外。

### 7.4 每日结算不加新经济项

固定房租/水电属于 `completion-plan.md` 的 P1，本版**不引入**，避免同时改平衡。跨日只做既有系统的 tick 与摘要。

---

## 8. 需求七：分时段、限时委托

### 8.1 字段与常量

```ts
export type CommissionWindow = 'urgent' | 'long';
// Mission 追加（全部可选，旧档安全）
district?: DistrictId;      // 仅用于显式指定；默认由 x/y 派生
window?: CommissionWindow;
opensAt?: number;           // 绝对分钟 day*1440+minutes
expiresAt?: number;
wave?: number;              // 0/1/2 段
```

- `urgent`：窗口 **120 分钟**，奖励 ×1.35，图钉红脉冲，逾期安定度 −2。
- `long`：窗口**到本夜 24:00**（最长约 6 小时），奖励 ×1.0，逾期无惩罚，次日打烊后清出。
- 所有奖励读取统一走 `missionReward(mission)`；UI 与结算同源。

### 8.2 三段放号

| 段 | 时间 | 数量 | 构成 |
| --- | --- | --- | --- |
| 0 | 开局（18:00） | 3 | 预置 7 条按 3 + 2 + 2 拆到三段 |
| 1 | 18:00 | 2 | 1 紧急 + 1 长期，按当日难度与区域生成 |
| 2 | 22:00 | 2 | 1 紧急 + 1 长期 |

- 本地生成器 `src/content/commissions.ts`：9 区域 × 2 套事件种子 + 标题/描述模板，坐标落在区域 `bounds` 内（留 6% 边距），难度随 `day` 与 `reputation` 微调，战斗/调查交替。
- 未到时间的委托在**地图**上以 ghost 图钉显示（半透明、虚线、显示「18:00 出现」），列表视图不显示；已过期的显示灰化 24 小时。
- 放号由 `advanceClock` 跨越时间点时触发 `syncShiftContent(state)`：结过期、放新号、写日志「感应地图出现 2 个新的心愿信号」。幂等，重复调用不重复生成（按 `wave` + `opensAt` 去重）。
- LLM 每日提案生成的委托：`materializeDaily` 补 `district/window/opensAt/expiresAt`（当前时段），紧急概率 35%。

### 8.3 界面

- 图钉：新增倒计时 chip（`剩余 1h20m` / `18:00 出现` / `已过期`），紧急用 `--pin-color` 红并保留“优先”角标。
- 列表视图按段分组：`18:00 开局` / `18:00 第二波` / `22:00 深夜` / `长期`。
- `MissionDialog` 增加「时限」区块：类型、出现时间、剩余、过期后果、区域环境影响、能否在打烊前回来。
- 时间条右侧显示「下一波 22:00 · 37 分钟」。
- 设置 → 内容池列表补 `紧急/长期 · 剩余时间`，过期项可一键清理。

### 8.4 LLM 上下文

`worldBrief()`（`src/App.tsx:41`）追加：当前时段（第几段）、距打烊、九区域中“有事件的区域 + 环境效果”，让生成的标题与区域气质一致。

---

## 9. 存档与迁移（version 7）

- `GameState.version: 7`；`loadState` 对 v6 执行：
  - 衣柜容量裁剪到 4、补 `custom` 格（仅 `custom === true`）；
  - `Mission` 缺省 `window: 'long'`、`expiresAt = 当前夜打烊`、`opensAt = 当前时间`；`status` 不含 `expired` 的旧数据不动；
  - 不写 `district`（派生）。
- `importState` 同样走 hydrate；`version > 7` 拒绝并提示。
- 导出存档文件名保持「夜糖事务所-第N日存档.json」，内容含 version 7。
- 测试中 `s.version === 6` 改为 7。

---

## 10. 文件改动清单

### 新增

| 文件 | 内容 |
| --- | --- |
| `src/content/districts.ts` | 9 区域数据、`districtOf`、效果描述、区域事件种子 |
| `src/content/commissions.ts` | 分时段委托模板与生成器 |
| `src/shift.ts` | 营业时间常量、绝对分钟换算、段位判定、`endNight` 纯逻辑辅助 |
| `src/presets.ts` | 预设类型、内置三件套、ST 导入解析、原生导出、绑定读写 |
| `src/wardrobe.ts` | 衣柜包解析/导出、图片转装束、容量与冲突处理纯函数 |
| `src/components/LlmConsole.tsx` | 可折叠控制台（列表 / 读取内容 / 思维链 / 响应） |
| `src/components/WardrobeDialog.tsx` | 导入衣柜（文件 / 复制 / 手建 / 预览 / 替换） |
| `src/components/EndNightDialog.tsx` | 打烊确认与今夜总结 |
| `src/components/DistrictPanel.tsx` | 区域背景与效果面板 |
| `src/console.css` | 控制台样式 |
| `tasks/plan-v5.md` | 本方案 |

### 修改

| 文件 | 改动 |
| --- | --- |
| `src/types.ts` | `Outfit` 扩展、`Mission` 限时字段、`status: 'expired'`、新增 4 个衣柜动作、`version: 7` |
| `src/game.ts` | `hydrate` 衣柜/custom 迁移、`advance` 抽 `advanceTo`、`advanceClock` 放号与过期、`endNight`、`missionReward`、环境效果接入、衣柜动作、`createGirl`/`importCard` 装束 |
| `src/combat.ts` | `BattleSetup.environment`，伤害与敌方生命修正 |
| `src/llm.ts` | 日志结构、`chat` 预设参数、reasoning/usage 解析、上下文 sections、`MAX_CONTEXT` 可配、materialize 区域/时限 |
| `src/cards.ts` | 衣柜 4 格校验、`portraitRef` 透传、与衣柜包互认 |
| `src/components/DispatchMap.tsx` | 区域图层、9 标签、ghost 图钉、倒计时、按段筛选 |
| `src/components/CharacterDialog.tsx` | 4 格衣柜、格位菜单、导入/导出按钮、触屏友好 |
| `src/components/CustomGirlDialog.tsx` | 装束名称、占格提示 |
| `src/components/GirlPortrait.tsx` | 按装束解析立绘（含 `portraitRef`） |
| `src/components/UtilityDialogs.tsx` | 预设管理、日志区改为控制台入口、内容池显示时限 |
| `src/App.tsx` | 时间条（营业进度、+30/60/120、前往下一天）、`endNight`、控制台挂载、`worldBrief` 区域化 |
| `src/components/Shell.tsx` | 顶栏时间显示带“距打烊”，可选控制台入口 |
| `src/map.css` / `src/dialogs.css` / `src/styles.css` | 区域层、面板、衣柜格、时间条、控制台 |
| `tests/game.test.ts` | 新增约 20 项状态测试 |
| `tests/browser.mjs` | 新增 8 组流程 |
| `README.md` / `tasks/todo.md` / `tasks/review.md` | 文档同步 |

---

## 11. 测试计划

### 11.1 状态测试（新增 ~20 项）

区域：
1. `districtOf` 九个格位边界（含 33.33 / 66.67 两侧）。
2. 调查目标按区域修正后结算（糖果街更容易、镜厅更难）。
3. 区域奖励倍率与 `missionReward` 一致。
4. 战斗环境修正确实改变结果（固定种子对比）。
5. 时间型效果只作用于该区域进行中委托，挂机不受影响。

时间与跨日：
6. 推进钳到 24:00；打烊后的推进返回提示而非静默跨日。
7. 派遣校验：剩余时间不足时拒绝跨夜委托。
8. `endNight` 结算完成中的派遣、治疗、远行，且只结算一次。
9. `endNight` 跨日触发 `processDay`（市场刷新、契约到期）。
10. 旧存档（v6）加载后衣柜为 4 格、`custom` 格存在、图片字节未复制。

委托时限：
11. 三段放号时间点幂等（同一夜多次推进不重复生成）。
12. 紧急逾期 → `expired` + 安定度 −2；长期逾期无惩罚。
13. 未到 `opensAt` 的委托不能接取；已过期不能接取。
14. 紧急奖励 ×1.35 与 UI 显示一致。

衣柜：
15. 自定义少女创建后 `wardrobe[0].id === 'custom'`、`outfitId === 'custom'`、描述与输入一致。
16. 容量 4 的导入（3 套→可入 1 套；满格走替换）。
17. 移除当前装束自动切换；不能移除最后一格。
18. 图片导入生成合法 Outfit（palette 3 色、webp 前缀、体积上限）。
19. 立绘解析：`portraitRef: 'girl'` 用角色立绘，独立 `portrait` 优先。

LLM：
20. ST 预设解析（温度/top_p/max_tokens/stop/jailbreak），忽略项报告正确。
21. JSON 类请求生效温度被钳制，`response_format` 只在 JSON 类出现。
22. 日志含 sections / reasoning / usage，且不含密钥与图片字节。

### 11.2 浏览器流程（新增 8 组）

1. 地图切区域层 → 点击「旧教堂镜厅」→ 面板显示背景与效果 → 关闭后刷新仍选中。
2. 初始地图只有第一段委托，18:00 后第二段出现（ghost → 实心）。
3. 紧急委托倒计时归零 → 变灰「已过期」，池计数减少。
4. 时间条「前往下一天」→ 确认框列出账目与警告 → 确认后第 15 夜 18:00、日志出现打烊摘要。
5. 自定义少女详情：第一格衣柜为「自定装束」，切到私服再切回，立绘随之切换。
6. 导入衣柜包：预览 3 套 → 勾选 2 套 → 满格替换提示 → 保存后可换装。
7. 打开叙事控制台 → 触发生成 → 读取内容清单可见世界观/局势/历史条数，失败条目自动展开并显示错误。
8. 设置导入 ST 预设 → 显示识别参数与忽略项 → 绑定到剧情对话 → 请求参数生效（控制台可核对）。

断言沿用 `tests/browser.mjs` 的 id 约定：新按钮一律给稳定 id（`map-district-layer`、`district-*`、`end-night`、`wardrobe-import-*`、`llm-console-*`、`preset-*`）。

---

## 12. 实施顺序

| 里程碑 | 内容 | 验收 |
| --- | --- | --- |
| M1 基础 | `shift.ts`、`districts.ts`、`types.ts` v7、hydrate 迁移、`missionReward` | 测试 1/6/10 通过，构建绿 |
| M2 区域 | 九区域数据与效果接入结算、地图图层、区域面板 | 测试 1–5 通过，地图可视 |
| M3 时间与委托 | `advanceTo`、`endNight`、三段放号、过期、时间条与确认框 | 测试 6–14、浏览器 2–4 通过 |
| M4 衣柜 | 4 格、custom 占格、立绘解析、导入对话框 | 测试 15–19、浏览器 5–6 通过 |
| M5 控制台 | 日志模型、sections/reasoning、悬浮框、设置瘦身 | 测试 22、浏览器 7 通过 |
| M6 预设 | ST 导入、三内置、绑定、采样接入 | 测试 20–21、浏览器 8 通过 |
| M7 收尾 | 文档、README、全量回归、`tsc -b && vite build`、浏览器全流程 | 构建 + 42+20 状态测试 + 35 组流程 |

每一里程碑单独提交，提交信息沿用现有风格（`feat: ...` / `fix: ...`），不混提交。

---

## 13. 风险与取舍

| 风险 | 处理 |
| --- | --- |
| 存档体积：每人 4 套独立立绘 × 6 人 | 默认共享 `portraitRef: 'girl'`；独立立绘 webp ≤120 KB，整套 ≤1.8 MB；写盘失败沿用现有 toast 提示 |
| 区域效果破坏平衡 | 全部为 ±3~15% 小值，只走 `districtEffectOf` 单一管线；固定种子测试锁结果 |
| 跳日漏结算（远行/治疗/Boss） | 抽 `advanceTo` 复用事件循环，禁止直接改 `state.day`；新增测试 8/9 |
| 打烊前无法接长委托 | 这是设计意图（时间规划），MissionDialog 明确显示“能否赶上打烊”；紧急委托窗口 120 分钟已在三段内 |
| ST 预设字段漂移 | 只认白名单字段，未知键进“已忽略”清单；温度/top_p 钳制并告警 |
| reasoning 内容因供应商而异 | 缺失时明确显示“未返回”，不生成假思维链 |
| 控制台日志含隐私 | 不存 key，图片转描述，正文截断；提供一键清空 |
| 3×3 网格与城市美术不完全对齐 | 区域按功能划分而非街道边界；保留全景美术，用叠加层与标签建立认知，不重绘 `city.svg` |

---

## 14. 本版不做

- 不做后端代理、账号、支付（沿用非目标）。
- 不重绘城市底图，不做区域独立场景图。
- 不引入固定房租/水电等新经济项，不改现有战斗公式主体。
- 不做完整 ST 世界书 / 正则脚本 / 角色卡前端，只做“对话补全预设 → 采样参数与系统提示”的映射子集。
- 不做多存档槽位与云同步。

---

## 15. 实施结果（v5 已落地）

原方案中的 3×3 网格被否决，区域改为按 `city.svg` 地形切分的 9 片辖区（用户要求：不横平竖直、大小不一）。以下为最终与方案的差异：

| 项 | 方案 | 实施 |
| --- | --- | --- |
| 区域 | 3×3 = 9 格 | `src/districts.ts` 9 个不规则多边形，贴合星见川两岸、公园、会堂、教堂与远端街区；`districtAt` 用射线法 + 最近中心兜底 |
| 区域 id | `arcade` 等 | 最终 ids：`candy` `station` `plaza` `greenhouse` `cathedral` `crossroad` `oldtown` `clocktower` `docks` |
| 营业时间 | 20:00–02:00 | 18:00–24:00（360 分钟），午夜归日逻辑不变；`SHIFT_START=1080`、`SHIFT_END=1440` |
| 放号 | 18:00 / 22:30 / 00:30 | 18:00 / 20:00 / 22:00（`WAVE_AT=[0,120,240]`），紧急 120 分钟正好在 20:00 / 22:00 / 24:00 截止 |
| 环境效果 | 8 个字段 | `targetPct/rewardPct/damageDealtPct/damageTakenPct/enemyHpPct/fatigueFlat/spiritPerHour/reputationFlat`，战斗侧读 `enemyHpPct/damageDealtPct/damageTakenPct`，结算侧读其余 |
| ST 预设 | 引入技能模板全套 | 只保留「对话补全预设」子集：`src/presets.ts` 复用 ST 字段名与导入/导出格式，不引入 Dexie、世界书、聊天 UI |
| 衣柜 | 4 格 | `WARDROBE_LIMIT=4`；自定义登记的「契约礼装」固定占第 1 格，`GirlPortrait` 优先取该格立绘 |
| 叙事日志 | 悬浮框 | 右下角固定可折叠面板 `LlmConsole`，记录请求分段、采样参数、思维链、usage；40 条环形缓存 + `CustomEvent` 实时刷新 |

验证结果：

- `npx tsc -b` 无输出；`npm test` **49 项状态测试全过**（v5 新增 7 项：辖区落点、环境修正、批次/过期、衣柜上限、导入合并/替换/删除、ST 预设导入与钳制、请求快照）。
- `npm run build` 通过（1619 modules，JS 376.80 kB / CSS 207.97 kB）。
- `node tests/browser.mjs` **31 组流程全过**，新增 4 组：九辖区面板、打烊交接、叙事引擎控制台 + ST 预设、详情页衣柜导入。
- 已知环境限制：本机沙箱会拦截 esbuild 与 Chromium 的子进程管道（`spawn EPERM`），构建与 Playwright 各需要一次放宽权限；浏览器回归用 `.tmp/serve.mjs` 静态托管 `dist/`，避免 Vite preview 在沙箱内启动失败。

存档版本从 6 升到 7：`version`、`shift{day,wave}`、`Mission.status` 增加 `expired`、`Mission` 增加 `district/window/wave/spawnedAt/deadlineAt`。旧存档导入时会补齐区域、批次与截止时间，并把营业时间外的时刻重置到 18:00。
---

## 12. v6 增补（用户 m01214）：20:00–02:00 营业与 CMD 终端

> 本节覆盖第 7 节中 18:00–24:00 的时间安排。其余章节（辖区、控制台、预设、衣柜）不受影响。

### 12.1 时间模型：营业夜 = 业务日

- 营业时间改为 **20:00 开门、次日 02:00 打烊**，仍为 360 分钟，但跨过 00:00。
- `state.day` 仍表示「第 N 夜」（业务日）；`state.minutes` 在营业期内取值 **1200–1560**，00:00–02:00 用 1440–1560 表示，显示时由 `clockLabel` 取模成 00:00–02:00。
- `advanceClock(state, to)` 以 `nextDay = floor((to - SHIFT_START) / 1440)` 换算，营业夜内不换日；只有打烊交接跳到 `(day + 1) * 1440 + 1200` 时才推进业务日。
- 日结（退休金、药效、势力货架、市场刷新、契约到期、周期 Boss）**只在业务日推进时发生**，午夜不再触发 `processDay`。
- 阶段：`open`（20:00–22:00）、`deep`（22:00–00:00）、`midnight`（00:00–01:00，文案「跨午夜」）、`closing`（01:00–02:00）、`closed`。
- 放号点随之为 **20:00 / 22:00 / 00:00**（`WAVE_AT=[0,120,240]`），紧急委托 120 分钟窗口正好在 22:00 / 00:00 / 02:00 截止。

### 12.2 CMD 终端

- 目标：给原型一个键盘入口，而不是另做 CLI——保留「CONTRACT // DISPATCH TERMINAL」的观感。
- 入口：顶栏 `CMD` 按钮（`#open-command`）、`Ctrl/Cmd + K`；`Esc` 关闭。
- 组件：`src/components/CommandConsole.tsx`，底部悬浮面板，输出区 `#cmd-output`、输入 `#cmd-input`、↑↓ 历史、快捷 chip。
- 命令（`runCommand`，App.tsx）：

| 命令 | 行为 |
| --- | --- |
| `help` / `?` | 命令速查 |
| `status` | 日期、时钟、阶段、距打烊、金币、声望、待命/在岗、待处理委托、批次 |
| `advance [n]` | 推进 n 分钟（默认 30，1–180），复用 `act`，战斗结算照常弹报告 |
| `end` | 打开打烊二次确认（不直接结算） |
| `page <dispatch/base/market/records>` | 切页 |
| `generate` | 调用叙事引擎生成当晚内容 |
| `preset [list/use/chat] <名称>` | 查看或绑定生成/对话预设 |
| `district <id/名称>` | 打印辖区介绍与环境影响 |
| `mission <关键词>` / `girl <名字>` | 直接打开委托 / 角色详情 |
| `clear` | 清屏 |

- 终端只做入口与查询，所有状态变更仍走既有 reducer；打烊必须二次确认。

### 12.3 兼容与验证

- 存档版本 7 → **8**：v7 及更早的存档若时间落在 `[1200, 1560)` 之外，迁移时归位到当晚 20:00，并写入一条迁移日志；`importState` 接受 1/3/4/5/6/7/8。
- `tests/game.test.ts` 新增「营业时间跨午夜」「旧存档迁移」两组；总数 **51**。
- `tests/browser.mjs` 新增「事务所终端：CMD 按钮可查询状态、辖区并推进时间」；总数 **32**，全部通过。
- 构建：`npm run build` 通过（index 384.46 kB / CSS 210.67 kB）；截图 `artifacts/command-console.png`。
