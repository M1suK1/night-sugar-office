# 方案 v92 · 视觉小说阅读器（只改两处：角色剧情、战斗札记）

> 上一版（v91）想做全游戏演出层，方向错了。这一版只做**一个可复用的阅读器**，套在两处长文本上：
> **角色剧情**（`StoryPlayerDialog`）与**战斗札记**（`BattleNoteDialog`）。
> 议会演出、事件弹窗、私语聊天、主界面全部不动。

## 一、目标

这两处现在是「一屏文字 + 翻页按钮」。改成视觉小说的看法：

- 一句一句出，点击 / 空格推进，带打字机。
- 立绘常驻：角色剧情用她的立绘；战斗札记用**当前说话的单位**，说话的人亮、其他人压暗。
- 台词下面一行浅色小字放动作 / 神态（现有 `action` 字段已有内容）。
- 剧情里的选项直接出现在舞台下方，不再跳回正文列表。
- 保留「原文」开关：一键退回现有的整段文字视图，方便回看与检索。

**不做**：全屏路由、全局开关、议会 / 事件 / 交互剧情改造、LLM 契约改动、语音与 BGM。

## 二、复用清单

| 能力 | 现成位置 | 用途 |
| --- | --- | --- |
| 立绘 + 表情差分 + 魔女形态 + 资产解析 | `GirlPortrait` / `portraitSource()` | 舞台立绘直接用，不用新写取图逻辑 |
| 角色剧情的段落与选项 | `StoryPassage { narration, lines[{speaker,tone,text}], choices[] }` | 适配成 beat |
| 战斗札记的分场与台词 | `BattleNote.scenes[]` 的 `BattleNoteLine`（已有 speaker / expression / text） | 适配成 beat |
| 战斗单位 → 立绘 | `battleNote.portraitSourceOf(unit, girl)` | 决定每个说话人画谁 |
| 现有版式 | `story-player-*`、`battle-note-*` 的配色与暗紫细描边 | 舞台沿用，不新造视觉语言 |

## 三、数据（`src/vn/types.ts`，纯数据，不碰 React）

```ts
export type VnBeat =
  | { kind: 'say'; speakerId: string; name: string; text: string; expression?: Expression; action?: string; thought?: boolean }
  | { kind: 'choice'; prompt?: string; options: { id: string; label: string; hint?: string }[] }
  | { kind: 'scene'; title?: string }   // 换场标题卡（战斗札记的分场）
  | { kind: 'end' };
```

两个适配器（纯函数，便于测试）：

- `beatsFromPassage(passage, { speakerId, name })`：`narration` 按空行拆段，每段一条旁白 say；
  `lines[]` 依次 say（`expression` 直接透传）；`choices[]` 收尾成一条 choice。
- `beatsFromBattleNote(note, cast)`：每个 `scene` 开头插一条 `scene` beat（带标题），
  然后 `lines[]` 逐条 say；`speakerId → BattleActor` 决定 `name` 与立绘；
  `speaker` 为空的（魔物动作 / 环境描写）按旁白处理，不挂立绘。

## 四、渲染（`src/vn/VnReader.tsx`）

```
VnReader(beats, cast, { variant })
├─ .vn-stage      舞台：暗底 + 暗角 + 程序化背景（见第六节）
├─ .vn-cast       立绘层：说话人居中偏左，非说话人压暗 0.5
├─ .vn-box        对话框：名牌 / 台词（打字机）/ 动作小字 / ▼ 继续指示
├─ .vn-choices    选项：舞台下方卡片，键盘 1..N
└─ .vn-toolbar    自动 / 快进 / 原文 / 关闭（沿用 .av-btn）
```

状态机抽成纯函数 `vnReducer(state, event)`：

- `advance`：正在打字 → 立刻打完；否则前进一条；遇 `choice` 停止推进。
- `choose(id)`：记录选择（用 `chosenId` 锁死，保证只回调一次），继续到 `end` 交回外层。
- `skip`：只跳过 `seen` 里的 say（`seen` 按 beat key 记在 sessionStorage，不进存档）。

`variant: 'story' | 'note'` 决定字号、是否显示「原文」开关、选项样式。

## 五、接入

### 角色剧情（`StoryPlayerDialog`）

- 右侧正文区换成 `VnReader`：一次只播当前 passage；该段播完且还有下一段时，底部出现「继续」；
  passage 自带 `choices` 时出现选项卡，选完照旧调 `onChoose`（只调一次）。
- 左侧头像 / 羁绊 / 侵蚀 / 段落圆点保留，位置不动。
- `event.mode === 'session'`（你一句我一句）**不进舞台**，仍走原有输入界面。

### 战斗札记（`BattleNoteDialog`）

- 中间逐句阅读区换成 `VnReader`：整篇札记一次装进 beats，`scene` beat 负责换场标题卡。
- 「重新生成 / 关闭」按钮保留；键盘 ←/→ 仍可上一句 / 下一句。
- 立绘：说话人是谁就画谁（`battleActors` + `portraitSourceOf`）；旁白时把上一位说话人压暗。

### 原文模式

两处工具栏各放一个「原文」开关，切回现有实现。默认进舞台，状态记 `localStorage`（两个界面各自记）。

## 六、背景（这一版的取舍）

项目里没有任何背景图资产，所以舞台背景**只做程序化**：

- 角色剧情：按 `event.source` 与 `girl.element` 取同色系渐变 + 稀疏网格 + 暗角。
- 战斗札记：按战斗所在辖区取辖区色渐变（没有辖区就用夜色）。
- 以后要换真图：只需给 `VnReader` 传 `backdrop`，排版不用改。

## 七、分批

### 批 1 · 阅读器内核 + 战斗札记（先做小面）

- 新增 `src/vn/types.ts`、`beats.ts`、`reducer.ts`、`VnReader.tsx`、`vn.css`。
- `BattleNoteDialog` 接入舞台 + 原文开关。
- 验收：任意战斗札记能从第一句演到最后一句；说话人立绘正确；Esc / 关闭回原界面；原文模式与旧版一致。

### 批 2 · 角色剧情

- `StoryPlayerDialog` 接入；选项在舞台内完成且只调一次 `onChoose`；段落圆点与「继续」衔接。
- 验收：三段故事连着演不串段；选项效果与旧版一致；`session` 模式不受影响。

### 批 3 · 打磨

- 自动播放、快进、跳过已读、历史抽屉（限 60 条）；`prefers-reduced-motion` 关动画；
  窄屏竖屏排版（对话框占下方 40%）。
- 键盘：空格 / 回车推进、1..N 选项、←/→ 上一句 / 下一句、Esc 关闭（有未播完的句子时先确认）。

## 八、测试

`tests/vn.test.ts`（纯函数，不测 React）：

- `beatsFromPassage`：narration 拆段数、lines 顺序、expression 透传、choice 在末尾、空文本被跳过。
- `beatsFromBattleNote`：分场标题顺序、旁白不挂立绘、说话人映射到 actor。
- `vnReducer`：打字中点击先打完；再点击前进；`choice` 阻塞推进且只回调一次；`end` 只触发一次；`skip` 只跳 `seen`。

回归：现有剧情 / 战报用例全绿；`check-imports` 通过（`src/vn/**` 单文件 <400 行）。

## 九、风险

1. **战斗札记可能很长**（几十行、跨多场）：一次装进 beats 没问题，但历史抽屉要限条数。
2. **选项重复触发**：reducer 用 `chosenId` 锁死并写测试，避免 `onChoose` 被调用两次。
3. **原文模式**：建议保留；否则回看长文很累。

## 十、待你确认

1. 批 1 直接开工（先做战斗札记），还是两处一起做？
2. 「原文模式」保留吗？（我倾向：默认舞台，可切原文）
3. 打字机默认 28ms/字、标点停顿 120ms，可以吗？
