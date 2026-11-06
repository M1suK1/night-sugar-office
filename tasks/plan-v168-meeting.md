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
export interface MeetingBuy {
  id: 'tea' | 'wine' | 'flowers' | 'cigarettes' | 'records'; // 采购项（茶点 / 酒 / 花 / 卷烟 / 唱片）
  label: string;
  cost: number;
  /** 关系增幅加成（百分点，叠加）。 */
  bondBonus: number;
  /** 只对这些人额外有效（例如酒对爱喝酒的人）。 */
  favorites?: string[];       // 空 = 对所有人都一样
}

export interface MeetingPlan {
  title: string;              // 玩家填的会议标题
  placeId: string;            // 'lounge' | 房间 id | 'roof'（天台）| 'district:<id>'
  placeName: string;
  attendeeIds: string[];      // 至少 1 人（不含助手时也可以，但助手默认参加）
  buys: MeetingBuy[];         // 采购清单
  fee: number;                // 合计花费（人数部分 + 采购部分）
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
  buys: string[]; fee: number;
  summary: string;            // 收尾时写下的摘要（没有就本地拼一段）
  relationshipGain: number;   // 每人之间涨了多少
}
// GameState.meetings?: MeetingRecord[]（只留最近 30 场）
```

## 二、费用与关系（数值都进 `src/balance.ts`）

| 参数 | 默认 | 说明 |
|---|---|---|
| `meetingBaseCost` | 200 | 开场费：场地与灯油 |
| `meetingPerAttendee` | 120 | 每多一位参会者 |
| `meetingMinAttendees` | 2 | 最少人数（含助手） |
| `meetingMaxAttendees` | 6 | 最多人数 |
| `meetingRelationBase` | 2 | 每次会议两两关系基础涨幅 |
| `meetingRelationPerBuy` | 1 | 每买一样东西 +1（封顶 +3） |
| `meetingRelationCap` | 8 | 单场会议的关系涨幅上限 |

- 费用 = `meetingBaseCost + 人数 × meetingPerAttendee + 采购小计`；星砂不够就不能确认（按钮置灰并说明还差多少）。
- 结算（点「结束事件」时）：所有参会者两两之间 `relationships[peer] += gain`（夹 0–100），每人 `bond += 1`；gain = `min(cap, base + 采购件数 × perBuy)`。
- 采购项各有 1–3 点加成：茶点（全员 +1）、酒（+2，但对「魔女化」的人 +3）、花（+1，对羁绊最高的人 +2）、卷烟（+2，对爱吃的人 +1）、唱片（+1，全员，且让开场更容易写成"听歌"）。具体映射写进 `content/meetingBuys.ts`，带测试。

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
4. **经费买了什么**：采购项卡片，可多选，每张显示价格与它对关系的影响；底部固定一条结算行：`场地 200 + 2 人 ×120 + 采购 450 = 890 星砂`，右侧是「还差 N 星砂」（不够时）。
5. 底部：`取消` / `开会`（不足时禁用并说明）。

### 3) 场景

确认后：
- 扣星砂、写一条 `council` 日志、创建事件（`meeting` 字段 + `mode:'session'` + `cast` = 参会者）
- 打开这个事件的对话框（与角色剧情同一个 `EventDialog`），玩家先写开场（v169 的 `playerSeed` 流程）
- 提示词里多一段【这是一场会议】：标题、地点、参会者与彼此关系、买了什么、谁是主持人（助手）

### 4) 会议记录（新组件 `MeetingRecordsDialog`）

列表：日期 · 标题 · 地点 · 人数 · 花费；点开显示摘要、采购、参会者、每人关系涨了多少，以及「回看这一段」按钮（按 `eventId` 打开只读剧情）。

## 四、文件清单

```dsh-ui
{"gap":12,"items":[{"columns":["文件","改动"],"rows":[["src/types.ts","`MeetingPlan` / `MeetingRecord`；`CharacterEvent.meeting`；`GameState.meetings`；`GameAction.startMeeting`"],["src/balance.ts","会议六项数值（含数值面板条目）"],["src/content/meetingBuys.ts","采购项定义与加成规则（新）"],["src/rules/meetingOps.ts","费用计算、参会校验、`applyStartMeeting`（扣钱 / 建事件 / 写日志）（新）"],["src/rules/storyOps.ts","结束会议时结算两两关系并写 `meetings` 记录（`finishStorySession` 分支）"],["src/components/MeetingPlanDialog.tsx","会议方案弹窗（新）"],["src/components/MeetingRecordsDialog.tsx","会议记录列表（新）"],["src/components/CouncilView.tsx","助手席下加两个入口按钮"],["src/components/EventDialog.tsx","会议事件显示一条「会议 · 地点 · 花费」的横幅"],["src/llm.ts","会议事件的提示词段落（标题/地点/参会者关系/采购/主持人）"],["src/App.tsx","两个弹窗接入、开会后跳转事件、会议记录回看"],["src/styles.css","会议弹窗与记录列表样式（沿用 vn-chip 语汇）"],["tests/meeting.test.ts","费用随人数上涨、人数上下限、星砂不足拒绝、关系两两结算与封顶、会议记录写入"],["tests/meeting-prompt.test.ts","提示词包含标题/地点/参会者/采购，且不含其它事件的引子"]],"type":"table"}],"title":"会议功能的文件清单"}
```

## 五、边界

- 参会人数 < 2 或 > 6：拒绝并说明（助手算在人数里）。
- 有人正在出勤 / 治疗 / 休息中：不可选，灰掉并写原因。
- 星砂不足：确认按钮禁用，实时显示还差多少；点了也不会扣钱。
- 同一天可以开多场，但每场都照价收费（不设每日上限，避免又变成"隐形规则"）。
- 会议期间不推进时间、不消耗疲劳（这是内部会议，不是出勤）。
- 结束事件失败（模型没写出来）：关系与记录都**不结算**，会议仍开着，可重试——和现有剧情一致。
- 事件被存档裁剪掉（只留最近 12 段）时，会议记录仍保留（记录里存摘要副本），只是「回看」按钮变为不可用。
- 旧存档没有 `state.meetings`：读档补空数组，不迁移、不报错。

## 六、不做

- 不做会议里投票/决议（那是议会议题，已有体系）。
- 不做参会者的"心情"新属性，关系涨幅只落在现有 `relationships` 与 `bond`。
- 不做会议语音/动画；不做 NPC 之间的会议（只有玩家事务所内部）。
