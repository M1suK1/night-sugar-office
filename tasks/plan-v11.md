# 夜糖事务所 · v11 方案：夜班提案 v2（模型生成全量内容）

> 目标：让故事引擎生成的不再只是文案，而是**一整套可执行的夜间提案**——魔物数值、候选者四维与特性、委托参数与奖励、议会逐句对白与三个选项、使者委托，以及一次性装备。
> 原则：模型写内容，本地管边界；模型永远不能直接改 `GameState`。

---

## 0. 结论先行

1. `src/llm-night.ts` 独立承担 v2 的 schema、目录快照、提示词、校验与物化；`src/llm.ts` 只负责请求、修复重试和日志。
2. 一次完整 JSON 调用。硬错误时把原始 JSON 与具体错误一起发回模型修复一次；仍失败则中止，不写入任何状态。
3. 软错误（越界数值、过长文本）裁剪后继续，并把警告带进预览、通知和编年史。
4. 手动生成先打开完整预览，点「采纳」才落库；自动补充先做三池容量预检，干净或仅软警告才应用。
5. 允许生成一次性装备，随存档持久化；技能仍只引用现有 id，不生成新技能。

---

## 1. 数据流

```text
设置 / 自动补充
  → canAcceptGeneratedContent(state)        三池容量预检
  → buildNightPrompt(state)                 目录 + 规则 + schema
  → chatJson(maxTokens >= 2600)
  → validateNightProposal(raw, state)       硬错误 / 软警告 / 规范化
  → [硬错误] 带原始 JSON + errors 修复一次
  → 手动：ProposalDialog 预览
  → 采纳 / 自动：materializeNightProposal
  → act(addGeneratedContent)                唯一写状态入口
```

`materializeNightProposal` 只返回运行时对象，不注册物品、不修改 state；物品登记由 `addGeneratedContent` 完成，因此丢弃预览不会污染物品表。

---

## 2. Schema

顶层 `version: 2`，包含：

- `monster`：name / epithet / rank / element / trait / description / habit / weakness / maxHp / maxSpirit / stats / skillIds / rules。
- `candidate`：name / codename / title / element / archetype / level / cost / stats / skillIds / traits / quote / goal / goalKind / appearance / personality / outfit。
- `mission`：title / category / description / work / difficulty / district / window / duration / reward / requirement / target / rounds / recommendedLevel / enemyRefs / rewardItemRef / rewardGirlLevel。
- `opinion`：authorId / topic / faction / district / title / text / request / dialogue / options。
- `envoy`：在 mission 基础上增加 faction，固定为调查委托。
- `loot`：ref / name / faction / slot / description / stats / passive，最多 2 件。

`enemyRefs` 中的 `generated` 指向本次生成的魔物；`rewardItemRef` 指向 `loot[].ref` 或现有物品 id。

---

## 3. 校验与预算

### 3.1 硬错误

- 未知的少女、势力、辖区、物品、技能、魔物引用。
- 非法枚举：阶级、属性、职阶、难度、窗口、工作类型、目标类型、表情。
- 议会不是恰好 `accept / defer / reject` 三个选项。
- 对白少于 3 句或多于 5 句。
- `defer` 不是「提出者羁绊 −1 + 对应势力 −2」，或夹带资源变化 / outcome。
- `reject` 不是「提出者羁绊 −2 + 对应势力 −4 + 至少一项实际资源惩罚」。
- `accept` 缺少成本/风险，或缺少收益/结果。
- 装备 id、槽位、属性结构非法。

### 3.2 软裁剪

- 魔物：maxHp 60–240、maxSpirit 40–140、四维 30–110、rules ≤ 2。
- 候选者：四维 35–95、总和 200–330、等级 1–5、签约金 200–900、技能 1–3。
- 委托：时长 45–180、报酬 400–1800、目标 40–95、轮数 2–6、推荐等级 1–8。
- 议会单次：星砂 ±1200、声望 ±5、势力 ±10、羁绊 ±5、疲劳 ±20、分钟 0–90、物品 ±1。
- 文本长度统一裁到界面可容纳的范围。

裁剪会写入 `warnings`，不静默吞掉。

---

## 4. 物化

- 魔物、候选者、委托、议会、使者的数值直接使用模型值；不再套固定模板。
- 本地只生成 id、颜色、程序化立绘 spec、坐标、头像、`assistantNote` 等运行时字段。
- 候选者 hp / spirit 由四维推导；契约天数、初始羁绊等仍按本地规则。
- 议会 `dialogue` 与 `options` 原样写入，不再用 `defaultOpinionDialogue` / `defaultOpinionOptions` 替换。
- `loot` 物化为 `lm_item_*`，委托奖励和选项物品变化会重映射到这些 id。
- 辖区环境修正仍在 `act` 之后由 `annotateMission` 应用，因此预览显示模型原值，落库后的报酬/目标可能按辖区上调。

---

## 5. 交互

### 手动生成

设置 → 故事引擎 →「生成今晚的提案」→ 完整预览：

- 魔物：阶级、属性、生命/精神、技能、规则、习性/弱点。
- 候选者：职阶、等级、签约金、四维、技能、特性、台词。
- 委托：工作类型、难度、辖区、窗口、时长、报酬、判定、目标、轮数、额外奖励。
- 议会：提出者、议题、正文、请求、逐句对白、三个选项及资源标签/锁定原因。
- 使者与一次性装备。

按钮：`采纳提案` / `重新生成` / `丢弃`。

### 自动补充

- 跨日且配置了密钥才触发。
- 先预检，池满直接跳过，不请求 API。
- 硬错误：通知失败，不写入。
- 有软警告：写入并提示「已按本地规则裁剪」。
- 干净：直接写入。

---

## 6. 持久化

- `GameState.version` 10 → 11。
- 新增 `generatedItems: Equipment[]`；旧存档默认空数组。
- 读档时过滤非法条目（id 必须 `lm_item_` 开头），重新 `registerItem`，上限 40 件。
- 导出/导入沿用同一套 `loadState` 校验。

---

## 7. 测试

### 单元

- 合法完整提案：物化后的魔物 132 血、候选 3 级、委托 75 分钟/1200 星砂/5 轮、对白 3 句、3 个选项。
- 池满拒绝；写入后 `generatedItems` 与委托 `rewardEquipmentId` 正确。
- 议会选项语义：驳回缺实际惩罚被拒绝；暂缓夹带资源被拒绝。
- 越界裁剪：duration 9999 → 180、reward 99999 → 1800，并产生 warning。
- LLM 截断/400 重试与硬错误修复一次。
- 生成装备存档往返后重新登记到物品表。

### 浏览器

- mock LLM 返回完整提案。
- 打开设置 → 生成 → `.proposal-modal` 可见，候选数不变。
- 预览含纸月、纸灯、委托数值、3 句对白、3 个选项、折月灯罩。
- 点采纳后 `generatedItems` 1 件，委托/魔物/候选/议会/使者全部落库。
- 断言辖区修正后的报酬不低于模型原值。

---

## 8. 验收结果

- `tsc -b` 通过。
- `npm test`：108 / 108。
- `npm run build`：通过。
- `node tests/browser.mjs`：50 / 50 PASS。
- 手动预览截图：`artifacts/night-proposal.png`。

---

## 9. 后续

- 第二阶段：把 `generateIncident` / 事件生成器接入同一套机制校验，补齐 item / district / territory / mission 效果。
- 第三阶段：若需要，生成新技能或更多装备槽位；当前技能只引用现有目录。
