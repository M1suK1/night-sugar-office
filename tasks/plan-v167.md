# plan-v167 · 代表委托预览 / 失败惩罚 / 访谈式城市新闻

> 用户诉求：① 势力代表的任务信息太少，点开要有预览；② 任务失败现在没惩罚；③ 世界新闻太平淡，要像访谈节目，能分配主持人，每天选一位在场人物，结合势力状态、污染度、事务所现状互相点评。

按 Superpowers：Plan（本文）→ Isolate（`superpowers/envoy-preview-and-news`）→ Test First → Double Review。
分两批提交：**A 预览 + 惩罚**（规则为主，先验证手感），**B 访谈新闻**（模型 + UI）。

---

## A. 势力代表委托：点击给预览

现状：会客厅卡片直接摊开一行摘要，点哪儿都是「接下」，看不出污染现状、会不会被拦截、失败代价。

新增 `src/components/EnvoyPreviewDialog.tsx`，卡片整块可点 → 打开预览，分四段：

| 段 | 内容 | 来源 |
|---|---|---|
| 委托书 | 标题、战斗/调查、难度、时长、推荐等级、目标数、辖区当主 | `offer.mission` |
| 现场 | 辖区污染值与档位、当主对你的态度、能否被拦截（红色预警） | `pollution` / `factionAttitude` / `canIntercept` |
| 收益 | 报酬、势力好感变化、额外净化、双方火气变化（raid） | `offer` + `envoy*` 平衡项 |
| 代价 | 失败违约金、声望与好感损失 | `src/missionPenalty.ts` |

借调（人选/小时）与协调费（金额）的参数搬进预览；确认按钮只在预览里，卡片上只留「查看委托」。

## B. 任务失败：加惩罚

现状：只有安定度 −3、该势力好感 −3，星砂不赔，委托还放回池子 —— 等于没代价。

新增参数（`src/balance.ts`）：

- `missionFailurePenaltyPct = 20` —— 违约金 = 报酬的 20%
- `missionFailurePenaltyMin = 50` —— 最低 50 星砂
- `envoyFailureExtraStandingLoss = 2` —— 势力委托失败额外好感损失

规则（`src/missionPenalty.ts`，结算与预览共用）：

- 违约金 = `min(手头星砂, max(最低额, 报酬 × 20%))`，扣到 0 为止，绝不为负；
- 势力委托（`envoyKind`）失败：额外 −2 好感，且当天不再出单；
- 结算日志与通知写明「赔了多少、给谁、为什么失败」；
- 失败后委托仍留在池中可重试 —— 每次失败都收违约金。

## C. 城市新闻：改成访谈节目

数据结构（`src/types.ts`）：

```
CityNews {
  day, generatedAt, source: 'llm' | 'rule',
  headline,
  host?:  { id, name, title },
  guests?: [{ id, name, title, faction? }],
  lines?: [{ speakerId, speakerName, text }],
  items:  [{ text, tone }]   // 今日要闻，保留给旧档与无模型兜底
}
```

- 主持人：`state.newsHostId` + 动作 `setNewsHost`；缺省按 `hashText('news-host:'+day)` 从在场人物里定一位（契约者 + 候选 + 三方名册代表），玩家可在新闻栏点「换主持人」改当天。
- 嘉宾：火气最高那一对里的另一方代表 + 污染最重辖区相关势力的代表；人不齐退回契约者；一个都解析不到就主持人独白。
- 提示词（`newsContract`）：一档夜间访谈 —— 主持人开场、两位嘉宾各 2–3 句、互相接话或反驳、主持人收束；每句 ≤ 60 字；必须点到火气/污染/事务所现状里的具体数字。
- 本地兜底 `localCityNews` 同样输出问答体，无模型也有对话感。
- UI：`#dispatch-news` 由 `<ul>` 换成对话列表，说话人标「名字 · 身份」，主持人固定在顶部；保留刷新与来源标记。

---

## 边界

- 手头星砂为 0 时失败：扣到 0，日志写「一分也赔不出来」。
- 旧存档 `cityNews` 只有 `items`：照旧渲染，不迁移。
- `newsHostId` 指向的人已离职/退役：当日自动换人并提示一次。
- 席位空缺：嘉宾只用能解析到的人，不编人。
- 预览里的「接下」与原按钮走同一个动作，不出现两套结算。

## 不做

- 访谈的语音/字幕动画；主持人好感；拦截战与 Boss 规则调整；失败统计面板。

## 验证

`tsc --noEmit` · `node tools/check-imports.mjs` · 全量测试（基线 855，新增三个测试文件）。
