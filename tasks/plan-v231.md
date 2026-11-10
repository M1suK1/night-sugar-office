# plan-v231 · 满羁绊誓约与议会婚礼

## TASK

羁绊满 100 的契约少女可以与所长缔结**誓约**；誓约之后，在议会厅的「组织会议」里新增**婚礼**模式，选她作为新娘举办婚礼。

## APPROACH

1. **誓约是一个即时动作：不占时间，花 1000 星砂买戒指**
   - 条件：羁绊 100、在册、未退役/离职/死亡、尚未誓约、持有 1000 星砂。
   - 角色档案「关系」页的羁绊卡上新增按钮：可誓约时显示「缔结誓约」；点一次进入「确定 / 取消」二段确认；已誓约显示「已誓约 · 第 X 日」。
   - 成功后扣 1000 星砂、写一条日志，不改羁绊（本来已满），只解锁婚礼。
   - 允许多位少女分别誓约；每位少女只誓约一次。

2. **婚礼复用会议系统**
   - `MeetingPlan` 增加 `kind: 'meeting' | 'wedding'` 与 `partnerId`。
   - `startMeeting` 在 `kind === 'wedding'` 时校验：新娘必须在参会名单里、已誓约、未办过婚礼、未退役/离职/死亡。
   - `MeetingPlanDialog` 顶部增加「例会 / 婚礼」切换；只有存在「已誓约未办婚礼且当前空闲」的人时才显示婚礼。
   - 婚礼模式：自动把新娘选进参会者并锁定（不能取消），默认地点会客厅，标题自动填「与 X 的婚礼」，仍可改；费用沿用会议的场地 + 人数单价。
   - 会议事件带 `meeting.kind = 'wedding'`，提示词分支写明「这是一场婚礼」，不要写成普通议程。

3. **婚礼在事件收尾时落账**
   - `settleMeeting` 遇到 wedding：给新娘写 `wedding = { day, at, eventId, placeName }`，会议记录增加 `kind / partnerId / partnerName`，日志写成「婚礼完成」，不再用「散会」。
   - 会议记录列表给婚礼加一个「婚礼」小标；婚礼仍算一次会议，参会者关系照常增长。

4. **存档兼容**
   - `oath` / `wedding` 都是可选字段；旧档没有就按「未誓约 / 未办婚礼」处理，不写迁移。
   - `MeetingRecord` 的 `kind` 缺省为 `meeting`，旧记录照常显示。

## FILES

- `src/types.ts`：`Girl.oath? / wedding?`；`MeetingPlan.kind?` / `partnerId?`；`MeetingRecord.kind?` / `partnerId?` / `partnerName?`；新增 `oath` 动作。
- `src/rules/oathOps.ts`（新建）：誓约资格判断 + `applyOath`。
- `src/rules/act.ts`：分发 `oath`。
- `src/rules/meetingOps.ts`：婚礼校验、参会者锁定、事件 `kind/partnerId`；导出 `weddingCandidatesOf(state)`。
- `src/rules/meetingSettle.ts`：婚礼落账、记录字段、旧记录清洗。
- `src/llm.ts`：`meetingContext` 增加婚礼分支（誓词、交换戒指、不要写成普通会议）。
- `src/components/CharacterDialog.tsx`：关系页誓约按钮 / 状态 / 二段确认。
- `src/components/MeetingPlanDialog.tsx`：例会 / 婚礼切换、新娘选择与锁定。
- `src/components/MeetingRecordsDialog.tsx`：婚礼标记。
- `src/App.tsx`：`onOath` 接线。
- `tests/v231.test.ts`、`package.json`：回归测试。

## EDGE IN

- 羁绊 99 不能誓约；满 100 且星砂够 1000 才能。
- 已誓约再点：按钮变成状态，不可重复。
- 退役/离职/死亡的少女不能誓约。
- 婚礼时新娘忙碌（派遣/治疗/休息/借调）：该候选人置灰并给出原因。
- 新娘未誓约、未在参会名单、已办过婚礼：`startMeeting` 直接拒绝并说明原因。
- 已誓约但未办婚礼的人不止一位：婚礼模式里选一位，其他仍可下次办。
- 婚礼会议中途放弃/没有收尾：不写 wedding 字段，可以重新办。
- 旧档、旧会议记录：字段缺失按默认值处理。

## EDGE OUT

- 不改羁绊上限、关系阶段与战斗数值；誓约不加属性。
- 不做离婚 / 悔婚 / 多配偶惩罚。
- 不做独立婚礼场景与专属立绘；婚礼走现有会议剧情与 LLM 文案。
- 不新增经济平衡项：婚礼费用沿用会议费用。
- 不改角色卡导出/导入格式（誓约字段不出卡）。
- 不处理已退役少女的婚礼（退役后不再列入会议参会者）。

## ASSUME

- 「满好感度」= 羁绊 100；戒指用 1000 星砂计价，不进入物品库存。
- 多位少女可以分别誓约、分别办婚礼；游戏不做独占关系。
- 婚礼必须在事件正常收尾时才算完成；中途关掉不算。
- 婚礼费用与普通会议一致，同样消耗 1 小时（balance 里的 meetingMinutes）。
- 婚礼是一次会议，占用会议时间并结算参会者关系。

## 验收

1. 羁绊 100 才能誓约；重复誓约被拒；誓约日写入档案。
2. 未誓约/已办婚礼/不在名单时，婚礼无法开始。
3. 婚礼事件带 wedding 标记，提示词明确写成婚礼。
4. 收尾后 `girl.wedding` 与会议记录落账，第二次婚礼被拒。
5. 旧档读档不报错，旧会议记录照常显示。
6. `npm test`、`npx tsc -b`、`npm run check:rules` 全绿。
