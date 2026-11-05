# 方案 v91 · 视觉小说模式（VN Stage）

> 状态：待你过一遍再动手。全部结论都在最后一节「待你确认」。

## 一、要做成什么

把现在散在三处的「逐段文字」——分幕剧情的 passage、事件弹窗的 scene、议会的提案者对白——收进同一个**演出舞台**：

- 全屏暗场：背景 → 立绘 → 半透明对话框 → 名牌 → 台词，一次只推进一句。
- 点击 / 空格 / 回车推进，支持自动播放、快进、跳过已读、历史回看。
- 立绘按 `expression` 换表情，按脚本决定站位（左 / 中 / 右）、进场退场、缩放。
- 选项以舞台内的选择卡出现，选完继续演，不再切回弹窗。

**不是**要做的事：不改剧情怎么生成（LLM 契约保持现状）、不改存档里的剧情数据结构、不做语音与 BGM（留接口）。

## 二、现状盘点（能复用什么）

| 能力 | 现在在哪 | 复用方式 |
| --- | --- | --- |
| 立绘 + 表情 + 差分 + 资产解析 | `GirlPortrait`、`expressionOutfits`、`portraitSource()`（v87/v88 刚统一） | 直接用，VN 只控制「用哪张、放哪儿」 |
| 剧情对白数据 | `event.passages[].lines[{speaker,tone,text}]`（`StoryPassage`） | 适配成 beat |
| 事件对白 | `event.scenes[].lines[]`（`EventLine`） | 适配成 beat |
| 议会逐段对白 | `opinion.dialogue: OpinionDialogueLine[]`（已有 speakerId / expression / action） | 适配成 beat |
| 交互剧情的旁白/台词 | `StoryTurn`（`StoryLine[]`，带 speakerId / expression / after） | 二期再进舞台 |
| 模态系统 | `Dialog.tsx` + `App.tsx` 的 `modal` 联合类型 | VN 作为独立 `mode: 'vn'` 的全屏层，不进 `Dialog` 的纸片容器 |
| 程序化背景 | 只有 CSS 渐变与 `RoomFurniture` 线稿，没有背景图资产 | 一期用「渐变 + 网格 + 房间线稿」拼，二期可接导入图 |

## 三、数据模型

新增 `src/vn/types.ts`（纯数据，可测试，不碰 React）：

```ts
export type VnActorSide = 'left' | 'center' | 'right';

export interface VnActor {
  /** 少女 id；'player' 表示玩家；'narrator' 表示旁白。 */
  id: string;
  name: string;
  side: VnActorSide;
  expression?: Expression;
  /** 出场时是否压暗其他人。 */
  focus?: boolean;
}

export type VnBeat =
  | { kind: 'bg'; backdrop: VnBackdrop }            // 换背景：室内/街区/辖区/夜色
  | { kind: 'enter'; actor: VnActor }               // 立绘进场（可带表情）
  | { kind: 'exit'; actorId: string }               // 立绘退场
  | { kind: 'say'; speakerId: string; name: string; text: string; expression?: Expression; action?: string; thought?: boolean }
  | { kind: 'choice'; prompt?: string; options: { id: string; label: string; hint?: string }[] }
  | { kind: 'wait'; ms: number }                    // 留白/换场
  | { kind: 'end'; /** 从这里接回游戏 */ resume: 'close' | 'event' | 'story' };
```

背景：

```ts
export interface VnBackdrop {
  /** 语义名，渲染层自己查表：lounge / clinic / dorm / observatory / street / district:<id> / night / void */
  id: string;
  /** 渐变主色，缺省按 id 查表。 */
  tint?: string;
  /** 可选背景图（data URL 或资产 id），二期支持导入。 */
  image?: string;
}
```

适配器（纯函数，各写 20 行以内）：

- `beatsFromPassages(passage)` — passage 的 `narration` 拆成旁白 say，`lines` 依次 say；`choices` → choice beat。
- `beatsFromScenes(scene)` — 同上，`narration` + `lines`。
- `beatsFromCouncil(dialogue)` — 议会 3–5 句，speakerId 已有，直接 say。

## 四、渲染层

```
VnStage（全屏，role="dialog"）
├─ VnBackdrop        背景层：渐变 + 网格 + 房间线稿 + 暗角
├─ VnCast            立绘层：按 side 定位，最多 3 人；非发言者压暗 0.55
├─ VnTextBox         对话框：名牌 / 台词（Typewriter）/ 动作斜体 / ▶ 指示
├─ VnChoices         选项卡（键盘 1..N）
└─ VnToolbar         自动 / 快进 / 历史 / 跳过 / 关闭（暗紫细描边按钮，与现有 .av-btn 一致）
```

组件文件：`src/vn/VnStage.tsx`、`VnBackdrop.tsx`、`VnCast.tsx`、`VnTextBox.tsx`、`VnChoices.tsx`、`src/vn/useTypewriter.ts`、`src/vn/useVnScript.ts`（推进状态机）。

状态机（`useVnScript`）：

```
beats[i] --点击--> 若正在打字 → 立刻打完
                 → 否则 i++；遇到 choice 停下等选择；遇到 end 调 onFinish
```

只读状态**不进存档**（进度按 `event.passages[].id` / `scene.id` 记在 sessionStorage 的 `vn:seen`），避免存档膨胀；「跳过已读」按这个集合判断。

## 五、演出细节（一期的验收口径）

1. **打字机**：默认 28ms/字，句读标点 +120ms；`prefers-reduced-motion` 或设置里关掉时直接整句出现。
2. **推进**：点击舞台任意处 / 空格 / 回车；**选择出现时**推进键失效（避免误跳）。
3. **自动播放**：读完停 900ms 再推进；遇到 choice 自动暂停。
4. **快进**：按住 Ctrl 或点「快进」= 立即读完当前句并 120ms 推进下一句。
5. **跳过已读**：工具栏按钮，跳过所有 `seen` 的 say，遇到没看过的自动停。
6. **历史**：抽屉列出本次演出所有已播 say（说话人 + 文本），可滚回；不写存档。
7. **表情**：`say.expression` 有值就切该说话人的表情；缺省保留当前表情。
8. **站位**：`enter.actor.side` 决定列；同侧多人时按进场顺序堆叠，最多 3 人（超出把最旧的先压暗再挤出）。
9. **无障碍**：`role="dialog"`、`aria-live="polite"` 的台词区、焦点陷阱、Esc 关闭（关闭前确认「本次演出未结束」）、Tab 焦点顺序 对话框 → 选项 → 工具栏。

## 六、接入范围（分批）

### 批 1 · 舞台骨架 + 分幕剧情（独立可用）

- `src/vn/*` 全部新文件；`App.tsx` 增加 `mode: 'vn'` 全屏层。
- `StoryPlayerDialog` 保留旧版作为兜底；新增设置项 **「剧情演出：弹窗 / 视觉小说」**（默认视觉小说，旧档跟随默认、可随时切回）。
- 适配器 `beatsFromPassages` + 打字机 + 选项 + 工具栏（自动/快进/关闭）。
- 验收：分幕剧情在 VN 舞台里能从头演到尾、选项生效、结束回到时间线；关掉开关立刻回到旧弹窗。

### 批 2 · 事件与议会

- `EventDialog` / `IncidentDialog` 的 scene 走 `beatsFromScenes`；议会 `CouncilView` 的提案者对白走 `beatsFromCouncil`（保留原来的「继续 / 空格 / 跳过」语义）。
- 立绘进场退场、发言者聚光、背景按所在辖区/房间切换。
- 验收：三处入口行为一致；议会原有 105 项状态测试不回归。

### 批 3 · 体验补齐

- 历史抽屉、跳过已读、自动播放记忆、移动端竖屏（对话框占下方 38%、立绘 `anchor='face'`）。
- 舞台内 `expression` 切换走表情差分（`importedVariants`）；魔女形态的少女用 `witchForm` 立绘。
- 验收：键盘全流程可玩；触屏可推进/选择；prefers-reduced-motion 下无动画。

### 批 4 · 生成侧（可选）

- 事件/剧情契约增加**可选**字段：`scene.backdrop`、`lines[].side`、`lines[].action`；缺省时走本地推断（说话人 → 站位；辖区 → 背景）。
- 本地模板兜底同步补上这三个字段，保证没有 key 也有完整演出。
- 验收：旧数据不报错（全部 optional），新生成的数据能指定背景与站位。

## 七、性能与边界

- 立绘只用 `GirlPortrait`（内部已按资产 id 异步取图），不进 base64 复制；最多同时挂 3 张 `variant="full"`。
- 打字机用 `requestAnimationFrame` + 字符串切片，不用 `setInterval` 改 state。
- 跳过/自动/历史都在组件内部状态，不写 `GameState`；只有「演出已看完」这种进度写 sessionStorage。
- 关闭舞台时若还有未播完的 say，只记「看过」，不自动把剧情标成完成（完成仍由原有 action 决定）。

## 八、测试计划

- `tests/vn.test.ts`：
  - 适配器：passage / scene / council 三种输入 → beat 序列（旁白在前、say 顺序、choice 落在末尾、空文本被跳过）。
  - 状态机：`useVnScript` 的纯 reducer 抽成 `vnReducer(state, action)`，测「点击 → 打字中先打完 → 再点击才前进」「choice 阻塞推进」「end 触发 resume」。
  - 跳过已读：`seen` 集合命中即跳过，未命中停住。
  - 背景/站位推断：同侧第三人进场时最旧的被标记 `dimmed`。
- 回归：`game.test.ts` 里剧情/事件/议会相关用例全绿；`check-imports` 的 450 行上限对 `src/vn/**` 同样生效（`src/rules/**` 才受硬限，`src/vn` 自觉保持 <400 行/文件）。

## 九、风险

1. **背景素材**：现在没有任何背景图资产。一期只能用渐变 + 线稿，观感会和「全屏 VN」有落差。要么接受程序化背景，要么你给 3–4 张背景图（会客厅 / 街区 / 辖区夜景 / 诊所），走资产库。
2. **旧弹窗并存**：两套演出同时存在会增加维护面；建议默认切到 VN，但保留开关至少一个大版本。
3. **移动端**：立绘 + 对话框在窄屏容易挤，需要专门排版（批 3）。
4. **议会演出时序**：现在议会有「对白结束前选项锁定」的规则，搬进舞台要保证同一语义，否则会重复算一次决议。

## 十、待你确认

1. **背景**：接受一期程序化背景（渐变 + 线稿），还是你给我 3–4 张背景图接进资产库？
2. **默认行为**：新档默认进视觉小说演出、旧档保持原样，还是全局默认 VN + 设置里可切？
3. **范围**：批 1（分幕剧情）先做，还是批 1+2（含事件与议会）一起做？
4. **交互剧情（session 模式）**：这次要不要一起进舞台？它是「你一句我一句」，舞台化要额外做输入框，我建议放到批 5。
