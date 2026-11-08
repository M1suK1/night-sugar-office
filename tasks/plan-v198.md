# 方案 v198 · 把最后 6 处提示词搬进预设

> 状态：已实现（v198，分支 `superpowers/prompt-contract-closeout`）。
> 实施偏差见文末。

TASK
  v63 的收尾：把还硬写在生成器里的 6 段提示词搬进预设体系，让「设置 → 预设」能看到、
  能逐条改；顺带修掉「单条突发事件」误用「突发事件批量」契约的串台。
  另发现 v180–v183 的四个测试文件没挂进 `npm test`，一并补挂。

APPROACH
  1. 照 `generateStoryline` 已经跑通的模式改调用点：
     `body` 只放契约文本（代码默认值），动态局势（第几日 / 名册 / 既定事件）走
     `context` / appendix，`extra.contractId` 指定用哪条契约。
     这样预设覆盖契约时只替换契约，不会把这一场的动态内容一起换掉。
  2. `promptSections.ts` 新增四个契约函数，并把 `dailyContract()` 从 `llm-night.ts` 搬过来。
     `promptSections` 本来就 import `nightSpec`，不会成环；`llm-night` 那层
     `registerContractDefault` 间接注册随之删掉。
  3. `promptContracts.ts` 补四条 SPEC：
     `incident:single`（单条突发事件）、`event:contract`（私人事件）、
     `profile:schema`（角色起草字段清单）、`profile:witch`（魔女化形态）。
     `daily:contract` 改为直接引用 `promptSections`。
  4. `PRESET_SCHEMA` 7 → 8。`ensurePromptScopes` 只在 schema 落后时才补词条，
     不升版的话，已经迁到 7 的老预设看不到这四条新契约。
     补词条是幂等的（按 id 去重），不影响玩家已有改动。
  5. `JSON_RETRY_MESSAGE` 不搬：它是「输出被截断后重试」的系统话术，不是任务契约，
     玩家改它只会把重试弄坏。改为收窄 lint 的匹配模式——删掉过宽的
     `不要 Markdown 代码块`（这条正是误伤它的原因），只保留 `只输出一个 JSON 对象`。
     搬完后 `BUDGET` 从 6 归零。

FILES
  src/promptSections.ts   新增 singleIncidentContract / eventContract / witchFormContract /
                          profileSchemaContract(skillList)；迁入 dailyContract
  src/promptContracts.ts  补 4 条 SPECS，daily 直接引用 promptSections
  src/llm.ts              generateIncident / generateEvent / generateWitchFormProfile /
                          generateGirlProfileCore 四处拆 body + context，补 contractId
  src/llm-night.ts        删 dailyContract 与 registerContractDefault 调用，改从 promptSections 取
  src/presets.ts          PRESET_SCHEMA 7 → 8（一行）
  tests/prompt-lint.test.ts  收窄 PATTERNS，BUDGET 6 → 0
  tests/v198.test.ts      新建，覆盖下面每个边界
  package.json            test 脚本挂 v198，并补挂漏掉的 v180–v183

EDGE IN
  · 单条突发事件有自己的契约 id，不再和批量生成共用 `incident:contract`；
    批量那一侧行为完全不变。
  · 老预设（schema 7）升到 8 时自动补上四条新契约词条，玩家的既有改动与顺序保持原样。
  · 预设里覆盖了新契约：动态局势（第几日、名册、所属故事线）仍然照常注入。
  · 角色起草的 `skillIds` 允许列表是动态的（跟着技能表走），函数带参数，
    契约默认值里保留占位，预设覆盖文本原样使用。

EDGE OUT
  · 不改这六段提示词的内容——只搬家，逐字照搬，diff 里应该只有位置变化。
  · 不动 daily 契约的语义，只是换文件。
  · 「提示词全量视图一屏平铺 / 分组折叠」不做：现在 `view === 'all'` 已经是平铺，
    todo 里那条描述过时了，本次只把它划掉。

ASSUME
  · 四个新 id 用 `incident:single` / `event:contract` / `profile:schema` / `profile:witch`。
  · `event` 用途此前没有契约词条，界面「私人事件」页签下会多出一条，位置在词条列表末尾。

---

## 实施偏差（v198 落地时）

1. `profileSchemaContract` 不带参数：可用主动技能是运行时数据，放进正文附录注入，
   玩家改契约不会把允许列表改没。角色起草因此继续沿用 `profile:contract` 这个 id，
   字段清单并入那条词条（不再新增 `profile:schema`），老预设里对语料契约的改动仍然生效。
2. 新契约文本统一加 `【JSON 形状】` 前缀，与 `battleContract` / `newsContract` 一致。
3. 顺手发现 `tests/v180`–`v183` 没挂进 `npm test`，一并补上（全量 860 → 886）。
