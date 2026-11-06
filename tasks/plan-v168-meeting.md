# plan-v168 · 事务所会议

> 用户诉求：① 一个"开会"功能，费用随人数上涨；玩家填会议标题、选地点、点参会者，并决定会议经费买了什么。② 入口放在议会页的助手席下方，按钮「组织一场会议」→ 弹出会议方案 → 确认后进入和角色剧情一样的场景。③ 「查看会议记录」入口放在组织会议按钮下方。④ 每次会议提高所有参加者之间的关系。

按 CLUADE.md 的四阶段：Plan（本文）→ Isolate（`superpowers/meeting-room`）→ Test First → Double Review。

---

## 核心思路：会议 = 一段有账面的交互剧情

不新造一套场景与对话系统。会议复用**已有的交互剧情**（`CharacterEvent.mode === 'session'`）：

- 参会者 = `event.cast`（说话人白名单，也是舞台立绘来源）
- 开场 = 玩家先写的那段（`playerSeed`，v169 已实现）
- 演完点「结束事件」→ 生成收尾与摘要（`finishStorySession`）
- 回看 = 事件仍留在 `state.events`，按 id 重开（只读）

会议只比普通剧情多三样东西：**一笔确定的支出**、**一份采购清单**、**结束时结算的关系**。这三样都记在事件的 `meeting` 字段里，不塞进 `CharacterEvent` 的通用语义。

## 一、数据结构

```ts
// types.ts
export interface MeetingPlan {
  title: string;              // 玩家填的会议标题
  placeId: string;            // 'lounge' | 房间 id | 'roof'（天台）| 'district:<id>'
  placeName: string;
  attendeeIds: string[];      // 至少 2 人（含助手），最多 6 人
  /** v168：玩家自己写的采购，纯剧情设定，不改费用与关系。 */
  buys: string;
  fee: number;                // 合计花费（场地 + 人数 × 单价）
  day: number;
  at: string;                 // 「第 18 日 · 22:30」
}

export interface CharacterEvent {
  // …已有字段
  /** v168：这是一场事务所会议（有支出、有采购、结束时结算关系）。 */
  meeting?: MeetingPlan;
}

export interface MeetingRecord {
  id: string; eventId: string; day: number; at: string;
  title: string; placeName: string; attendees: { id: string; name: string }[];
  buys: string; fee: number;
  summary: string;            // 收尾时写下的摘要（没有就本地拼一段）
  relationshipGain: number;   // 每人之间涨了多少
}
// GameState.meetings?: MeetingRecord[]（只留最近 30 场）
```

## 二、费用与结算（数值都进 `src/balance.ts`）

| 参数 | 默认 | 说明 |
|---|---|---|
| `meetingBaseCost` | 200 | 开会费用：场地与灯油 |
| `meetingPerAttendee` | 120 | 每多一位参会者（费用随人数上涨） |
| `meetingMinAttendees` | 2 | 最少人数（含助手） |
| `meetingMaxAttendees` | 6 | 最多人数 |
| `meetingRelationBase` | 2 | 每次会议两两关系涨幅 |
| `meetingMinutes` | 60 | 开会推进多少游戏时间 |
| `meetingFatigueRelief` | 10 | 参会者各降多少疲劳 |

- 费用 = `meetingBaseCost + 人数 × meetingPerAttendee`；星砂不够就不能确认（按钮置灰并说明还差多少）。
- **采购是剧情设定，不参与结算**：玩家自己写买了什么（自由文本，例如「两盒草莓大福、一壶热可可、一沓便签」），它会进提示词与会议记录，但不改费用、不改关系。
- 确认开会时立刻结算（不等到结束事件）：
  1. 扣星砂、写一条 `council` 日志；
  2. 用现成的 `advance` 动作**推进 60 分钟**（走原来的班次/波次/截止逻辑，不另开一条时间通道）；
  3. 所有参会者 `fatigue = max(0, fatigue - 10)`；
  4. 创建交互剧情事件并打开（玩家先写开场）。
- 结束会议（点「结束事件」）时结算关系：参会者两两 `relationships[peer] += meetingRelationBase`（夹 0–100），每人 `bond += 1`；gain 与采购无关，固定值，方便玩家预判。

## 三、界面

### 1) 议会页 · 助手席下方（`CouncilView`）

```
助手席
[ 助手立绘 ] 名字 / 一句现状
[ 组织一场会议 ]        ← 主按钮
[ 查看会议记录 · 3 ]    ← 次按钮（有记录才显示数量）
```

### 2) 会议方案弹窗（新组件 `MeetingPlanDialog`）

四段，沿用 `.standard-modal` 与暗紫细描边：

1. **标题**：输入框，默认「第 18 日的例会」，上限 24 字。
2. **地点**：一排 chip —— 会客厅 / 天台 / 各自辖区（从 `state.rooms` 与 `districts` 里取，选辖区时写明是哪块）。
3. **参会者**：契约者头像多选（助手默认选中、可取消）；顶部实时显示「x / 6 人 · 至少 2 人」。灰掉正在出勤/治疗的人，并说明原因。
4. **经费买了什么**：一块自由文本框（≤120 字），玩家自己写，例如「两盒草莓大福、一壶热可可、一沓便签」。这只是剧情设定，不改费用、不改关系；空着按「什么也没买」写进记录。底部固定一条结算行：`场地 200 + 3 人 ×120 = 560 星砂 · 会后 1 小时 · 每人疲劳 −10`，右侧是「还差 N 星砂」（不够时）。
5. 底部：`取消` / `开会`（不足时禁用并说明）。

### 3) 场景

确认后：
- 扣星砂、写一条 `council` 日志；
- 推进 60 分钟（走现成的 `advance` 动作，波次与截止照常，不另开时间通道）；
- 参会者各 `fatigue − 10`（夹到 0）；
- 创建事件（`meeting` 字段 + `mode:'session'` + `cast` = 参会者）并打开对话框，玩家先写开场（v169 的 `playerSeed` 流程）；
- 提示词里多一段【这是一场会议】：标题、地点、参会者与彼此关系、买了什么、谁是主持人（助手）。

### 4) 会议记录（新组件 `MeetingRecordsDialog`）

列表：日期 · 标题 · 地点 · 人数 · 花费；点开显示摘要、采购、参会者、每人关系涨了多少，以及「回看这一段」按钮（按 `eventId` 打开只读剧情）。

## 四、文件清单

```dsh-ui
{"gap":12,"items":[{"columns":["文件","改动"],"rows":[["src/types.ts","`MeetingPlan` / `MeetingRecord`；`CharacterEvent.meeting`；`GameState.meetings`；`GameAction.startMeeting`"],["src/balance.ts","会议七项数值（费用两项、人数上下限、关系、时长、疲劳）"],["src/content/meetingPlaces.ts","会议地点表（会客厅 / 天台 / 各辖区）（新）"],["src/rules/meetingOps.ts","费用计算、参会校验、`applyStartMeeting`（扣钱 / 建事件 / 写日志）（新）"],["src/rules/storyOps.ts","结束会议时结算两两关系并写 `meetings` 记录（`finishStorySession` 分支）"],["src/components/MeetingPlanDialog.tsx","会议方案弹窗（新）"],["src/components/MeetingRecordsDialog.tsx","会议记录列表（新）"],["src/components/CouncilView.tsx","助手席下加两个入口按钮"],["src/components/EventDialog.tsx","会议事件显示一条「会议 · 地点 · 花费」的横幅"],["src/llm.ts","会议事件的提示词段落（标题/地点/参会者关系/采购/主持人）"],["src/App.tsx","两个弹窗接入、开会后跳转事件、会议记录回看"],["src/styles.css","会议弹窗与记录列表样式（沿用 vn-chip 语汇）"],["tests/meeting.test.ts","费用随人数上涨、人数上下限、星砂不足拒绝、开会推进 60 分钟且疲劳 −10、关系两两结算、会议记录写入"],["tests/meeting-prompt.test.ts","提示词包含标题/地点/参会者/采购，且不含其它事件的引子"]],"type":"table"}],"title":"会议功能的文件清单"}
```

## 五、边界

- 参会人数 < 2 或 > 6：拒绝并说明（助手算在人数里）。
- 有人正在出勤 / 治疗 / 休息中：不可选，灰掉并写原因。
- 星砂不足：确认按钮禁用，实时显示还差多少；点了也不会扣钱。
- 同一天可以开多场，但每场都照价收费（不设每日上限，避免又变成"隐形规则"）。
- 开会推进 60 分钟：若这段时间里派遣队伍到点、或弹出强制事件，按原流程处理（会议对话框不抢占它们）。
- 结束事件失败（模型没写出来）：关系与记录都**不结算**，会议仍开着，可重试——和现有剧情一致。
- 事件被存档裁剪掉（只留最近 12 段）时，会议记录仍保留（记录里存摘要副本），只是「回看」按钮变为不可用。
- 旧存档没有 `state.meetings`：读档补空数组，不迁移、不报错。

## 六、不做

- 不做会议里投票/决议（那是议会议题，已有体系）。
- 不做参会者的"心情"新属性，关系涨幅只落在现有 `relationships` 与 `bond`。
- 不做会议语音/动画；不做 NPC 之间的会议（只有玩家事务所内部）。
