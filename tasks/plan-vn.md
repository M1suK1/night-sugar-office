# 方案 v93 · 视觉小说阅读器（默认原文，可全局开启；先做角色剧情）

> 这一版按你的四条改：①默认保持现在的原文，视觉小说是**全局开关**；②先做**角色剧情**；
> ③开启时要**顺带改提示词**，让模型多写对白少写旁白，并用预设里的条目随开关自动切换；
> ④**不做背景**。战斗札记本次不动（留作后续，见第九节）。

## 一、范围

| 做 | 不做 |
| --- | --- |
| 一个舞台阅读器，套在**角色剧情**（`StoryPlayerDialog`）的正文区 | 战斗札记、议会演出、事件弹窗、私语聊天、主界面 |
| 设置里的全局开关「剧情演出：原文 / 视觉小说」，默认**原文** | 全屏路由、把整个游戏做成 VN |
| 预设里新增一个内置条目，随开关自动启停（让模型多写对白） | 改生成契约结构、改存档里的剧情数据 |
| 打字机、点击/空格推进、舞台内选项、原文一键切回 | 背景图、BGM、语音 |

## 二、开关

- 位置：设置里「显示 / 演出」分组，单选：**原文**（默认）／**视觉小说**。
- 存 `localStorage`（`nso.prefs.vnStory = 'off' | 'on'`），不进 `GameState`，不进存档；
  读不到就当 `off`。切换立刻生效（不用重开弹窗）。
- 关闭时完全不挂舞台组件，行为与现在一模一样（这也是回归基线）。

## 三、舞台（`src/vn/*`，纯数据 + 一个组件）

```ts
// types.ts
export type VnBeat =
  | { kind: 'say'; speakerId: string; name: string; text: string; expression?: Expression; action?: string; thought?: boolean }
  | { kind: 'choice'; prompt?: string; options: { id: string; label: string; hint?: string }[] }
  | { kind: 'end' };
```

- 适配器 `beatsFromPassage(passage, { speakerId, name })`：`narration` 按空行拆段 → 旁白 say；
  `lines[]` 依次 say（`expression` 透传）；`choices[]` 收尾成 choice。
- 状态机 `vnReducer`（纯函数，可测）：`advance`（打字中先打完 → 再前进，`choice` 阻塞）、
  `choose(id)`（`chosenId` 锁死，只回调一次）、`skipSeen`。
- 组件 `VnReader`：`.vn-stage`（暗底 + 暗角，**无背景图**）→ `.vn-cast`（她的立绘，`GirlPortrait` full）
  → `.vn-box`（名牌 / 打字机台词 / `action` 小字 / ▼ 继续）→ `.vn-choices` → `.vn-toolbar`（自动 / 快进 / 原文 / 关闭）。
- 每句时长：默认 28ms/字，句读 +120ms；`prefers-reduced-motion` 或快进时整句直出。

## 四、角色剧情接入（`StoryPlayerDialog`）

- 开关为「视觉小说」时：右侧正文区换成 `VnReader`，一次只播当前 passage；
  该段播完且还有下一段 → 底部「继续」；段落自带 `choices` → 舞台内选项卡，选完照旧 `onChoose`（只调一次）。
- 左侧头像 / 羁绊 / 侵蚀 / 段落圆点保留。
- `event.mode === 'session'`（你一句我一句）**不进舞台**，仍走原有输入界面。
- 没有「原文/舞台」二级切换：开关管全局，避免两个开关打架。

## 五、提示词联动（关键的一条）

问题：角色剧情默认一段旁白 + 少量台词，进舞台后会变成「一直在读旁白」。所以开关打开时要同步改提示词。

### 新增内置词条

- 名称：`视觉小说演出`
- 作用域：`arc`（完整剧情，角色剧情的正文就是这里生成的）
- 内容（草稿）：

```
■ 演出格式（视觉小说）
· 旁白只写必要的一两句，用来交代时间、地点与动作；不要把对话内容写成旁白。
· 每段 passage 的 lines 至少 4 句、最多 8 句，每句 ≤ 40 字，一句一个说话人。
· 对白要能独立读懂：不靠旁白解释情绪，情绪写进 action（动作 / 神态）里。
· 每个人说话有自己的口癖与节奏；同一段里说话人要交替，不要一个人念完。
· 结尾用一句留白收束，给玩家留下「继续」的期待。
```

### 启停逻辑

- 新增 `syncVnPrompt(preset, enabled)`：开关变化时，找到作用域 `arc` 的这条内置词条，
  把它的 `enabled` 设成 `enabled`；条目不存在就创建（`builtin: true`，记出厂内容）。
- 只同步一次、不覆盖玩家编辑：词条内容用 `defaultContent` 机制（和现有契约词条一致），
  玩家改过就不再覆盖，只切开关。
- 副作用要透明：设置项下面写一行小字「开启后会启用预设里的『视觉小说演出』条目（可在预设里改）」。
- 关掉开关时只 `enabled: false`，不删条目，方便再次开启。

## 六、分批

### 批 1 · 开关 + 舞台 + 角色剧情

- `src/vn/{types,beats,reducer,VnReader,vn.css}`；设置项与读取；`StoryPlayerDialog` 接入。
- 验收：默认（原文）行为与现在完全一致；打开开关后同一段剧情一句句演完、选项生效且只结算一次；
  舞台内「原文」按钮可临时切回文字视图。

### 批 2 · 提示词联动

- `syncVnPrompt` + 内置词条 + 设置项联动；预设界面里能看到并编辑这条词条。
- 验收：开关打开 → 该词条启用；关掉 → 停用；已手改的内容不被覆盖；
  生成一次角色剧情，`lines` 明显变多、旁白变短（用 `data/llm-logs` 的样本对比）。

### 批 3 · 打磨

- 自动播放、快进、跳过已读（sessionStorage）、历史抽屉（限 60 条）；
  键盘 空格/回车、1..N 选项、←/→ 上下句、Esc 关闭；窄屏竖排（对话框占下方 40%）。

## 七、测试

- `tests/vn.test.ts`（纯函数）：
  - `beatsFromPassage`：narration 拆段数、lines 顺序与 expression、choice 在末尾、空文本跳过。
  - `vnReducer`：打字中点击先打完；`choice` 阻塞且只回调一次；`end` 只触发一次；`skipSeen` 只跳已读。
  - `syncVnPrompt`：条目不存在时创建并启用；存在时只改 `enabled`；玩家改过的 `content` 不被覆盖。
- 回归：现有剧情用例全绿；`check-imports` 通过（`src/vn/**` 单文件 <400 行）。

## 八、风险

1. **两套 UI 并存**：开关默认关闭，所以旧路径必须保持零改动可用；舞台代码只在开启时才挂载（可 `React.lazy`）。
2. **选项重复结算**：reducer 用 `chosenId` 锁死，单测覆盖。
3. **提示词被玩家改过**：只切 `enabled`，不覆盖内容；设置项里说明清楚。
4. **旁白仍然多**：词条只能引导，不能强制；批 2 验收时用真实日志对比 `lines.length` 与旁白字数。

## 九、后续（不在本次）

- 战斗札记进舞台（同样一个 `VnReader`，适配器换成 `beatsFromBattleNote`）。
- 议会提案者对白进舞台。
- 背景图：等你给素材再谈，接口预留 `backdrop`。
