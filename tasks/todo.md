# 执行清单

- [x] 检查工作区，无本项目既有代码，保护其他项目。
- [x] 方案获得用户确认，初始化独立 Git 分支。
- [x] 状态模型测试先行，验证错误边界。
- [x] 实现地图派遣、人物详情、剧情对话。
- [x] 实现基地、市场、记录。
- [x] 完成高品质响应式视觉与本地 SVG 资产。
- [x] 构建与浏览器验证。
- [x] 正确性及代码质量双重审查，修复发现的问题。
- [x] 战斗与调查分类、多人编队、自动战斗引擎与 15 分钟轮次。
- [x] 战斗剧场、完整战报、魔物几何剪影与图鉴。
- [x] 七阶关系、疤痕与永久代价、死亡纪念墙、退役。
- [x] v3 存档迁移、19 项状态回归、13 组浏览器验收。
- [x] README、方案实施记录与战斗审查记录。
- [x] 提交并推送扩展版本。

## v5 九辖区 / 面板 / 预设 / 衣柜 / 夜班 / 限时委托

- [x] 按 city.svg 地形切 9 片辖区，环境修正接入调查与战斗结算。
- [x] 地图辖区图层、区域面板、截止时间与过期信号。
- [x] 18:00–24:00 时段、三批放号、打烊交接与二次确认。
- [x] 四格衣柜 + 自定义契约礼装占格 + 立绘按服装解析。
- [x] 人物详情导入衣柜（JSON / 图片 / 复制他人）。
- [x] 叙事引擎可折叠面板：请求分段、采样参数、思维链、usage。
- [x] SillyTavern 对话补全预设导入/导出/绑定/内置三套。
- [x] 存档 v7 迁移、49 项状态测试、31 组浏览器流程、README 与方案记录。
## v6 20:00–02:00 跨午夜夜班与 CMD 终端

- [x] 营业时间改为 20:00 开门、次日 02:00 打烊；00:00–02:00 仍算同一业务日，日结只在打烊发生。
- [x] 放号点改为 20:00 / 22:00 / 00:00；阶段新增「跨午夜」，打烊文案与确认框同步。
- [x] 顶栏 CMD 按钮 + Ctrl/Cmd+K 终端：status / advance / end / page / generate / preset / district / mission / girl / clear，↑↓ 历史，Esc 关闭。
- [x] 存档版本 8：白天时段的旧存档迁移回当晚 20:00。
- [x] 51 项状态测试、32 组浏览器流程、构建与截图验证。

## v6 长期委托 / 空白档案 / 第九夜功能包

- [x] 长期委托改为 2–7 天，`deadlineAt` 用业务日计算，未过期时可跨夜保留。
- [x] 空白档案开局（6000 星砂 / 安定度 0 / 只有会客厅）+ `start.cmd`、`start-prod.cmd`、`scripts/serve.mjs`。
- [x] 衣柜第五格魔女化立绘：侵蚀 40 解锁，独立保存，可撤下。
- [x] 角色故事线：四幕、每幕 2–3 选项、羁绊门槛、六类触发（委托 / 决议 / 对话 / 事件 / 弹窗 / 辖区）。
- [x] 议会独立页：左状态 / 中提案者 / 右助理 / 会客厅背景，1/2/3 快捷键与议员切换演出。
- [x] 强制事件弹窗：规则触发 + LLM 每日生成，未处理时阻塞推进与打烊。
- [x] 势力辖区：3/3/3 随机分配、单方上限 5、议会条款 / 阵营委托 / 事件 / 故事线四类易主，地图着色与图例。
- [x] 角色事件：详情页进入、头像角标、逐场推进与选择结算。
- [x] 自定义特性手写 + 立绘一句话要求 + 边缘去背景（容差可调、可撤销）。
- [x] 存档 v9 迁移、61 项状态测试、33 组浏览器流程、README 与方案记录。

## v10 内容工坊 / 人工设计内容

- [x] M0 内容库地基：独立 `night-sugar:content:v1`、`custom-` 前缀、启动注册、删除前引用检查。
- [x] M1 技能 / 装备与消耗品编辑器：效果行、槽位与价格、商店货架补给、战斗与图鉴即时生效。
- [x] M2 魔物编辑器：程序化立绘参数、习性 / 弱点、MonsterRule 结构化战斗特性并接入结算。
- [x] M3 委托编辑器：判定属性与目标值、敌人 1–3 只、辖区 / 窗口、投放测试、进入夜间轮转池与蓝图模板。
- [x] M4 弹窗事件编辑器：2–3 个选项、势力 / 辖区 / 契约者效果、投放测试并快照进存档、删除引用检查。
- [x] 99 项状态测试、49 组浏览器流程、README 与方案实施记录。
- [x] M5 内容包导出 / 导入：JSON 内容包、三种冲突策略、引用重映射、导出后清空再导入恢复。
- [x] 内容引用严格化：`findSkill` / `findMonster` / `findItem`，未知 id 不再静默替换为内置首项。
- [x] 装备伤害与先手加成接线，工坊表单可填并随刷新保留。
- [x] 弹窗随机池：每日开门按权重抽取，池越大越容易触发，每日一次与待处理上限生效。
- [x] 蓝图强制弹窗从内容工坊事件库导入，运行时按卡结算并在删除时拦截。
- [x] 委托拆成调查与战斗两个独立页签/模板：调查保留目标值，战斗保留敌人与轮数，互不混用。
- [x] 委托额外报酬：完成时发放指定装备或指定等级的免费契约者；宿舍满员时留在候选名册、签约金 0。
- [x] 委托奖励装备纳入冲突改名与删除引用检查；100 项状态测试、49 组浏览器流程。
- [x] 技能效果模板库：20 个命名 buff/debuff，按进攻/防护/速度/精神/控制/续航六类分组，可手调数值并保留模板名。
- [x] 技能编辑器改为「种类筛选 + 下拉」选择效果模板，魔物技能按阶级、委托敌人按等级用同一套筛选下拉选择。
- [x] 战斗日志与效果 chip 显示模板名，先手减益真实降低出手顺序；101 项状态测试、49 组浏览器流程。
- [x] 议会主立绘去掉背景框并等比放大，助手席保留窄框。
- [x] 议会选项结构化：资源标签与严格预览，星砂/时间/装备/势力/安定度/契约者任一不足即锁定。
- [x] 暂缓只扣羁绊与势力态度并保证下个议事日回归；驳回叠加主题资源惩罚；104 项状态测试、49 组浏览器流程。
- [x] 议会议题进入时播放提出者 3–4 句逐段对白：继续 / 空格 / 跳过，对白结束前选项锁定；对白行保留表情字段供后续立绘变化；105 项状态测试、49 组浏览器流程。

## v11 夜班提案 v2 / 模型生成全量内容

- [x] `NightProposalV2` schema：魔物、候选者、委托、议会、使者、一次性装备全部由模型填写。
- [x] 目录快照与结构化提示词：现有少女/势力/辖区/物品/技能/魔物 id 白名单，预算与议会选项硬规则。
- [x] 全量校验：枚举/引用/预算/选项语义；硬错误一次修复，软错误裁剪并输出警告。
- [x] 确定性物化：模型数值直接进入运行时对象，本地只补 id、颜色、立绘 spec、坐标等。
- [x] 手动生成完整预览：魔物/候选/委托/议会对白与资源标签/使者/装备，采纳后才落库。
- [x] 自动补充先做三池容量预检；硬错误不写入，软裁剪附带通知。
- [x] 存档 v11：`generatedItems` 持久化，读档重新登记物品表，旧存档默认空数组。
- [x] 108 项状态测试、50 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v11.md` 实施记录。

## v12 提示词按用途拆分 / 预设词条

- [x] `PromptScope` 九种用途：共用、角色对话、每日提案、角色起草、故事线、私人事件、完整剧情、突发事件、服装词条。
- [x] 12 条默认词条：4 条共用 + 8 条任务；三个内置预设升级 schema 3 并全部包含。
- [x] 拼装顺序固定为「共用 → 本任务 → 代码契约」，契约始终最后。
- [x] 所有生成器去掉全局 `LlmPrompts`，改用绑定预设与 scope；`{{world}}` 继续兼容。
- [x] 设置页删除旧世界观/每日要求文本框，改为九种用途入口；入口遇只读内置预设时自动复制并改绑。
- [x] 预设编辑器：用途筛选、逐条改用途、按用途统计、恢复本用途/全部默认、冲突句提示与一键移除。
- [x] 旧 `night-sugar:llm-prompts` 一次性迁移为可编辑预设；旧 key 保留。
- [x] ST 导入缺少任务词条时补齐并标记；本作 schema 3 导出往返不增条目；导出保留 scope。
- [x] 111 项状态测试、52 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v12.md` 实施记录。

## v13 每个生成任务独立绑定预设 / 任务标签页

- [x] `PresetBinding` 从 `chat / generate / story` 三档改为八个任务键；`daily / profile / outfit` 拆开，`storyline / event / arc / incident` 拆开。
- [x] 旧版三档绑定自动迁移：`generate` 拆给每日提案、角色起草、服装词条，`story` 拆给故事线、私人事件、完整剧情、突发事件。
- [x] 设置页任务入口只改绑当前任务；共用词条入口复制内置预设时，只改绑原本使用该内置预设的任务。
- [x] 预设编辑器顶部改为十个任务标签页：共用、八个生成任务、全部词条；任务页聚焦并只改绑当前任务。
- [x] 首次升级按任务拆出八份可编辑默认预设并改成任务名；旧「… 副本」默认副本原地接管，保留接口、正则与词条编辑。
- [x] 115 项状态测试、52 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v13.md` 实施记录。

## v14 战斗札记 / 敌方立绘通道

- [x] `BattleNote` 数据结构、`battleNotes` 存档、`saveBattleNote` / `deleteBattleNote`、旧存档读取与 20 条淘汰。
- [x] `battle` 预设用途：schema 4、13 条默认词条、9 个任务绑定、11 个预设标签页、10 个设置入口。
- [x] `generateBattleNote`：battle scope、3600 token floor、一次语义修复；无 Key/失败写本地简报。
- [x] 回合覆盖、说话阵营、倒下轮次、表情白名单与字数校验；本地简报覆盖全部回合且不编造台词。
- [x] 全屏 `BattleNoteDialog`：中间正文、左右立绘、当前说话者高亮、表情切换、场景键盘切换、移动端头像条。
- [x] 三处入口：战报顶部、战报底部、记录页书签；关闭回到战报，不嵌套弹窗。
- [x] 敌方魔法少女通过 `girlId + portrait + expression` 进入右侧舞台；魔物只做旁白。
- [x] 117 项状态测试、52 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v14.md` 实施记录。

## v15 表情差分导入

- [x] `src/expressions.ts`：六种表情标签/别名、`<outfitId>:<expression>` 键、图片数据清洗、六张上限与文件名识别。
- [x] `setVariants` / `deleteVariant`：批量、覆盖、删除、候补名册、旧 `setVariant` 兼容；删服装清理孤立差分。
- [x] 换装不再因缺少当前表情差分而阻塞；缺图回退基础立绘。
- [x] `GirlPortrait` 优先解析当前服装的表情差分，档案/对话/衣柜/战斗舞台共用。
- [x] 角色档案「管理表情差分」入口；按衣柜服装分页、六格预览、单张上传/替换/移除、批量文件名识别。
- [x] 契约卡导出/导入保留差分，哈希纳入差分内容。
- [x] 118 项状态测试、53 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v15.md` 实施记录。

## v16 魔女化表情页与自定义衣柜包

- [x] `expressionOutfits` / `currentExpressionOutfitId`：普通衣柜与 `witchform` 统一成表情页可遍历的服装列表。
- [x] `GirlPortrait` 在魔女化时使用魔女形态立绘、配色与 `witchform:*` 差分；切回普通服装会退出魔女化。
- [x] 表情差分弹窗增加魔女化标签页；普通服装预览强制 `witch:false`，不会串用魔女立绘。
- [x] `GirlDraft` 与 `createGirl` 支持多套服装、活动服装、差分与魔女化立绘；删服装时清理孤立差分。
- [x] `readWardrobePackage` 读取自定义登记衣柜包：最多四套、嵌套 `girl` 兼容、孤立差分过滤、魔女化规范化。
- [x] 自定义登记第五步「衣柜与表情」导入/移除、摘要与错误提示。
- [x] 契约卡保留 `witchForm`，哈希计入魔女化名称与立绘。
- [x] 120 项状态测试、55 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v16.md` 实施记录。

## v17 魔女化第五格、服装锁定与负面人格

- [x] `Girl.witchPersonality` 独立保存魔女化人格；旧魔女化存档在 hydrate 时补默认负面人格。
- [x] `setPersonality`、`setWitchForm.activate` 与 `clearWitchForm`：人格可编辑，第五格可提前保存/移除，退出魔女化保留形态。
- [x] 侵蚀达到阈值才能切换；魔女化期间普通服装锁定并提示从第五格退出。
- [x] 衣柜第五格始终显示；新增 `WitchFormDialog` 导入/替换立绘、名称与描述，不挤占四格礼装。
- [x] 档案状态概览的人格面板：显示当前人格、魔女化负面提示、编辑/保存/取消。
- [x] 默认负面人格保留原人格首句，并加入偏执、多疑、控制欲等特质；对话与剧情使用当前生效人格。
- [x] 契约卡保留 `witchPersonality`，哈希计入该字段。
- [x] 121 项状态测试、56 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v17.md` 实施记录。

## v18 叙事者直出故事蓝图 / 蓝图资料编辑

- [x] `StoryPlan.graph` 成为可玩蓝图的唯一来源；图为空时才回退旧 `beats`，只有图的计划允许 `beats: []`。
- [x] `generateStoryBlueprint`：故事线预设、5200 token 起步、8–16 节点 JSON 契约、一次结构修复、`角色蓝图` 日志。
- [x] `buildGraphFromDraft` / `layoutStoryGraph` / `blueprintIssues`：本地补 id 与连线、BFS 布局、DAG / 可达性 / 端口完整性严格校验。
- [x] 无 Key 或两次失败时 `fallbackStoryPlan` 用本地四幕模板编译成蓝图，不覆盖已有可用计划。
- [x] 详情页改为「生成故事蓝图 / 手动画蓝图 / 按蓝图开场 / 重新生成」；移除「自己写一条」与 `StorylineEditorDialog` 入口。
- [x] 蓝图弹窗新增「资料」面板，可编辑标题、前提、基调并随图保存；保存后随契约卡往返。
- [x] 蓝图只定义下一次开场，不热替换正在进行的剧情；结构不完整的草稿可保存，但开场前会拦下。
- [x] 126 项状态测试、56 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v18.md` 实施记录。

## v19 辖区污染 / 三方势力档案 / 出身标签 / 拦截战 / 事务所世界书

- [x] `src/pollution.ts`：五档分级、自然上升、敌我数值修正、冻结快照、净化预估与地图色层。
- [x] 九区初始污染写进存档；委托生成时冻结 `pollutionAtSpawn` / `ownerAtSpawn`，事后易主或净化不回写。
- [x] `src/factions.ts`：三势力档案、首领、所属少女、态度分档、净化减免与 `canIntercept`。
- [x] 势力卡改为打开档案（不再跳回基地），档案含理念 / 成员 / 城市 / 魔女 / 关系五页与「前往会客厅」。
- [x] `GirlFaction` 出身标签：确定性分配、旧存档与 `'office'` 值重算、名册 / 档案 / 市场 / 自定义登记分开展示雇主与出身。
- [x] 戒备辖区拦截：覆盖原委托为拦截图，胜负分别 −4 / −2 声望，Boss / 使者 / 故事线豁免。
- [x] `src/office.ts` + 事务所档案：背景 / 理念 / 目标 / 对外代表，保存后派生只读世界书条目并迁移「月蚀教团」。
- [x] 世界书页面识别生成条目为只读，并提供「打开事务所档案」入口与跨页刷新。
- [x] 叙事提示词注入事务所档案、代表台词与出身语义；契约卡保留并清洗 `factionTag`。
- [x] 存档版本 12；旧存档保留势力声望、补齐污染与档案。
- [x] 154 项状态测试、65 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v19.md` 实施记录。

## v20 技能池 / 弹窗事件 / 敌意值与战线 / 任务面板 / 离职 / 多结局

- [x] `src/skills.ts` 扩到 50 条：`SkillTier` 四档、`selfCost` / `selfEffects` / `accuracy` / `tier` 字段，少女与魔物共用一套池子（魔物可用全部，Boss 另走专属组）。
- [x] `src/content/bossSkills.ts`：8 条 Boss 专属技能与五个阶段的换组规则，Boss 技能不进少女池。
- [x] 命中公式与逐级下降（基础命中 − 目标闪避 − 疲劳），战斗回放与委托详情显示「基础命中」。
- [x] 技能筛选：`skillPool` 按流派 / 阶级 / 适用对象过滤，工坊与自定义登记共用筛选器。
- [x] `src/incidents.ts` + `content/incidents.ts`：10 条基础弹窗、按辖区/时段/敌意/战线投放、过期与「今天没读」标记。
- [x] LLM 每晚最多补 3 条弹窗（含 3 条战争预兆），结构不合格退回本地池，事件不覆盖已有 id。
- [x] `src/hostility.ts`：三对敌意值 0–100、四档阈值、涨跌来源（弹窗事件 / 委托 / 拦截 / 站边 / 调停），满 100 触发战线、同一对 10 天冷却。
- [x] `src/fronts.ts`：战线生成（双方战力 / 时限 / 奖励）、参战与不参战结算、战时与战后污染、编年史 `《辖区的夜战》`。
- [x] 战线期间该街不再触发拦截；战线标记与 `FrontDialog`（起因 / 战力 / 帮谁 / 派谁）；势力档案两条敌意线带档位与起因；临战时会客厅挂角标。
- [x] `src/tasks.ts` + `TaskPanel.tsx`：首页左上任务面板，按紧急度排序，点击直达对应界面（委托 / 弹窗 / 档案 / 战线 / 名册）。
- [x] 离职系统：五条理由、`strain` 累计、挽留花 600 星砂六成概率、破产暂缓、名册分区与编年史记录。
- [x] 故事线多结局：蓝图至少两个不同结局才能开场，走到结局写进档案与编年史；一人最多三段并按顺序解锁，档案显示三段槽位。
- [x] 叙事提示词补故事边界：只写她自己的故事、其他少女不得替她推进亲密与告白。
- [x] 存档版本 14；旧存档补齐弹窗池、敌意值、战线、任务面板与故事段位字段。
- [x] 218 项状态测试、75 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v20.md` 实施记录。

## v21（开场与开局编成）

- [x] 开场三幕：灯光 / 指名 / 开门，逐字上屏、可跳过、写进 `prologueSeen`，帧率无关的错峰浮现。
- [x] 世界书：新增「空月」常驻词条（priority 96 / order 0），势力词条补齐三方与新规矩，总量压进预算。
- [x] 契约卡库：按编号去重、重复卡拦下并给出「同编号已有登记」、结算星砂，设置页与市场双入口。
- [x] 开局编成：4–6 人、只留选中的人、首领可三方换位（现属头衔随势力走）、势力覆灭后才能雇佣首领（12,000 星砂）。
- [x] 属性波动：`rollStats` 总额仍 260、单值 40–90，市场候选按编号稳定 ±10。
- [x] LLM 自定义少女带代表色回填。
- [x] 空白档案提示卡：卡库与现场登记两条入口；设置页可随时重开编成。
- [x] 存档版本 16；旧存档补齐阵容与编成标记。
- [x] 219 项状态测试、77 组浏览器流程、生产构建通过。
- [x] README 与 `tasks/plan-v21.md` 实施记录。
- [x] 三个独立存档位：`src/saves.ts` 管读写与摘要，面板显示日期 / 星砂 / 契约者 / 时间 / 体积，支持覆盖、读取、删除。
- [x] 重新开始：设置页按钮改名「重新开始」，存档位面板内也有一处（带二次确认，不影响三个档位）。
- [x] 开局编成改成头像网格：`.starter-sheet` 居中面板、四个页签、点卡片选人、星标指派首领、来源筛选（全部 / 原属 / 自定义）与按名字找人。
- [x] 三方首领与随从不再限定系统 12 人：`src/roster.ts` 把首领、`factionGirls`、已编入的自定义少女、契约卡库的卡、名册与候选池里登记过的少女折成同一种 `RosterSubject`，编成只存 id、确认时把自定义的拍成快照。
- [x] 契约卡库单卡上限从 256KB（按字符算）改成 8MB（按 UTF-8 字节算）：带立绘的卡不再被误杀；localStorage 配额写不进去时整批回滚并提示改用「导入角色卡」。
- [x] 233 项状态测试、80 组浏览器流程。

## v22 存储搬到 IndexedDB / 立绘按原字节保存

- [x] `src/store.ts`：IndexedDB 两表（`kv` 放对象、`assets` 放字节），没有 IndexedDB 时退化为进程内 Map，状态测试无需装假 IDB。
- [x] `src/migrate.ts`：首次启动把 localStorage 里的当前进度、三个存档位、卡库、世界书、预设搬进 IDB，搬完打标记，旧键保留不删。
- [x] 自动存档改走 IDB 并即时落盘；`pagehide` / `visibilitychange` 时兜底 flush。
- [x] 启动期渲染 `#boot-splash`，读完档案再进主界面，避免闪一下初始演示档。
- [x] `saves.ts` / `cardbox.ts` 全异步化，对话框改成 effect 里刷新；单槽上限从 1.6MB 放到 8MB。
- [x] 立绘不再压缩：新增 `originalImageDataUrl()`（FileReader 原读），上传、礼装、魔女化、表情差分、自定义登记都用它；取景存 `portraitCrop`，由 `GirlPortrait` 在显示层换算 `object-position` + `scale`。
- [x] 表情差分单张上限 1.6MB → 8MB，浏览器流程里 `data:image/webp` 的断言改成 `data:image/`（不再强制转码）。
- [x] 235 项状态测试、81 组浏览器流程（新增「2.3MB 立绘的卡收得进来、原图字节带到存档位」）。
- [ ] `stores/assets` 表暂未启用：立绘字节内联在存档 JSON 里，三个档位各存一份（见 `tasks/plan-v22.md` §4 的实施偏差说明）。

## v22（存储迁移 IndexedDB + 立绘原字节）

- [x] `src/store.ts`：IndexedDB `kv` / `assets` 双库，node 下退化为内存后端，`assetSweep` 按内容哈希回收孤儿。
- [x] `src/migrate.ts`：`night-sugar-office:v1` → `save/current`，写 `meta/migrated` 记一次，重复启动不再搬。
- [x] `src/saves.ts` / `src/cardbox.ts` 全面异步化，`writeSave` 立即落库 + 串行刷新，切页不再丢进度。
- [x] 自定义立绘、衣柜、魔女化、表情差分统一走 `originalImageDataUrl`，不再压成 768×960。
- [x] `GirlPortrait` 显示层按 4:5 裁剪（`objectFit: cover` + `portraitCrop`），存档保留原始字节。
- [x] 存储上限放宽到 24MB / 32MB，配额不足时给出明确提示；不可用时顶部横幅告警。
- [x] `tests/store.test.ts` 9 条：kv 读写删、写故障、asset 去重与回收、迁移幂等、内联/引用两种抽取。
- [x] 255 项状态测试、83 组浏览器流程（新增「旧档迁移」「1024 原图保真」）。

## 显示与文案微调

- [x] 立绘取景整体下移 12（`cropStyle` 与 `cropToDataUrl` 同向），默认不再切到头顶。
- [x] 自定义少女的「外貌描述」上限 80 → 200 字，LLM 补全链路同步放宽。
- [x] 市场候选卡的立绘取景单独按「脸」锚定（横幅 2.5:1，只露出一条），不再裁在胸口。
- [x] 弹窗事件在有对话框/开场演出打开时排队，不再盖住玩家正在操作的界面。

## v25 共情值改成「心防」条

- [x] `src/spirit.ts`：心防 = 面板共情 × 2（`GUARD_PER_EMPATHY`），有心防时血量伤害 ×0.7，破防转精神伤害 ×0.7 并吃护盾，破防后挨打 ×1.4。
- [x] 打穿不是死亡：加一回合眩晕、本场不再恢复；全队都在眩晕/倒地才判负，且判负只在轮末检查、本轮刚被打穿的人豁免一次。
- [x] 死后疤痕分流：眩晕判负只留精神疤痕，诊所「记忆清除」1,200 星砂只清精神疤痕、不动等级。
- [x] 六处创建点不再写死 `80 + 等级 × 2`，改由 `hydrate()` 按共情算；战后再统一回满。
- [x] 装备的心防加成改成百分比（`spiritBonusPct`，0–60，`black-sugar` 10% / `association-badge` 15%）；旧档按 ×1.5 折算迁移，`version` 16 → 17。
- [x] UI：战报心防条与「护持 / 心防破碎」标记、档案页心防读数与规则说明、诊所记忆清除按钮、工坊百分比输入与魔物只读心防。
- [x] 277 项状态测试（+22）、86 组浏览器流程（+3：战报心防、档案心防与记忆清除、工坊百分比）。

## v24 内容池扩容（装备 5 阶 / 精英特征 / 委托 16 条 / Boss 池）

- [x] 装备 80 条，分五阶：`src/content/equipment/tier1..5.ts`（28/24/16/9/3），`src/items.ts` 提供 `tierOf` / `TIER_LABEL` / `TIER_STANDING`（0/20/35/50/80）；存量 12 条保 id 补 tier，价格与门槛对齐价格带。
- [x] 商店改成「先按阶级加权、再按声望过滤」：marketLevel 五档权重、同日三件不重复、`marketLevel ≥ 3` 连五个商店日没出四阶就保底一件；货架卡片挂阶级标，势力标题写「可见至 X 阶」。
- [x] 魔物池补到 20 只普通（`monsters-extra.ts` 15 只）；`hollow-moon` 标 `storyOnly`，「糖霜王座」作为 Boss 本体标 `bossOnly`，两者都不进随机池。
- [x] 精英不进数据层：`src/content/eliteBuffs.ts` 六条特征（过载 / 镜面 / 嗜甜 / 夜行 / 群聚 / 结症），`applyEliteBuff` 覆在普通怪身上，血量与属性按倍率放大、追加技能与规则。
- [x] 委托模板 10 战斗 + 6 调查（`missions-extra.ts` 9 条），只写「几只敌人」不写死辖区；`rollEnemies` 派生敌人，`pickDifficulty` 按辖区自身污染抽档，再反向缩放时长 / 报酬 / 目标 / 敌人数量。
- [x] Boss 池：`src/content/bosses.ts` 首只「糖霜王座」（2400 血、三阶段、第 10 天首现、击败后隔 10 天）；血量跨战斗继承、在场时每晚九区各 +3 污染并持续扣声望、击败后九区清零且循环重算。
- [x] 污染变成十天一循环：地板 `min(30, 本轮天数 × 3)`，自然上升照旧，净化擦不到地板以下；击败 Boss 时地板回到 3。
- [x] 工坊加 Boss 编辑器（`#workshop-kind-boss` 一路到三阶段），装备编辑器加阶级下拉，魔物编辑器的心防只读；内容库带 `bosses`，导入导出与 sanitize 同步，schema 1 → 2。
- [x] 图鉴加「精英特征」分段，六条都有正文、倍率与对策。
- [x] `GameState.version` 17 → 18，迁移补 `tier` / `cycleStartDay` / `customBosses` / Boss 血量。
- [x] 302 项状态测试（+25）、91 组浏览器流程（+5）。

## 默认本地路径（存档与契约卡落在项目里）

- [x] 新增 `scripts/local-files.mjs` 本地文件通道：`data/saves/` 与 `data/cards/`，只收 JSON、单文件 ≤ 8MB、文件名只留最后一段；`/api/paths`、`/api/files`（读 / 写 / 列）、`/api/cards`（扫描）四个路由。
- [x] `vite.config.ts` 与 `scripts/serve.mjs` 都挂上这套接口（dev / preview / 静态预览三种起法一致），扫描逻辑复用 `scripts/cards-api.mjs`。
- [x] 前端 `src/localfiles.ts`：`localPaths` / `writeLocalFile` / `readLocalFile` / `listLocalFiles` / `downloadFile` 退路；接口不可用时自动回落浏览器下载与「选择文件夹」。
- [x] 导出存档与导出契约卡改为先写项目目录，成功时提示落点、失败才走下载；存档位弹窗多一节「项目目录里的存档」，点一下就能读回来。
- [x] 契约卡库默认把路径填成 `data/cards` 并直接可扫；`data/` 目录自身进版本库，里面的 `.json` 由 `.gitignore` 排除。
- [x] 302 项状态测试、92 组浏览器流程（+1：本地路径导出与两处默认指向）。

## v26 开局流程重做（三选项 → 卡库读卡 → 势力分配 → 序章 → 首夜空缺补齐）

- [x] `src/types.ts`：`GameState.openingFilledAt`、`version` 18 → 19、`GameAction.openingFill`。
- [x] `src/game.ts`：两个初始状态写字段、`openingFill` 处理器（本地补三条议案 + 三个待用事件、记当天、幂等）、读档迁移 `??= 0`、白名单加 19。
- [x] `src/opening.ts`：`openingGaps` / `openingNeed` / `openingLabel` 与两个常量；委托/候选/魔物只参与「值不值得请叙事者」的判断。
- [x] `generateOpinions(state, variant)`：同一个时段也能补出不同议题；同标题的待议不再重复提出（顺带修掉同 id 重复）。
- [x] `src/prologue.ts`：`prologueFor(state)` / `prologueFrom(options)`，第二幕点名名册人数、卡库来源与三方现任首领，第三幕交代第几日与七条委托；`PROLOGUE` 留作静态兜底。
- [x] `src/components/PrologueDialog.tsx`：收 `beats`，记录页重播也传当前名册。
- [x] `src/components/TitleDialog.tsx`：三选项 + 空白档案次级链接 + `#start-hint`（卡库张数 / 上次停在第几日）。`StartDialog` 删除。
- [x] `src/App.tsx`：`phase` 状态机、`startNewGame`（卡库最近导入优先、最多补满候选上限）、`fillOpening`（先本地后叙事者、函数式落地）、`#opening-fill` 生成中徽标、名册守卫、读档 `afterLoad`、标题页设置/存档位接线。
- [x] `src/components/StarterDialog.tsx`：`forced`（开场必经、无关闭）+ `initialPicked`（卡库少女先选，默认阵容补满 4–6）。
- [x] `src/components/SaveSlotsDialog.tsx`：`boot` 模式（`#slot-current` / 隐藏保存、删除、重开）；`UtilityDialogs.tsx` 的 `boot` 只留「一般 / 故事引擎」与卡库。
- [x] `src/components/Shell.tsx` + `src/styles.css`：顶栏首夜补稿徽标（900px / 560px 两档收窄，reduced-motion 下不动画）。
- [x] `setStarters`：编成后保留退役/已故少女，候选池不再整池清空；`tests/v21` 两条断言同步。
- [x] `tests/v26.test.ts` 15 条；`tests/browser.mjs` 改 6 处旧流程 + 新增 5 条（标题页、卡库优先、势力分配→序章、读档接着上一夜、首夜空缺）。
- [x] 322 项状态测试、97 组浏览器流程（新增 15 + 5）。

## 卡库扫描的 256KB 误杀（跟进）

- [x] `scripts/cards-api.mjs`：扫描上限 256KB → 24MB；≤256KB 内联内容，大卡只报 `name`/`bytes`。
- [x] 新增 `readCardFile` 与 `GET /api/cards?dir=&name=`，只读目录内单个 `.json`，越界名字 400、超限 413、读不到 404。
- [x] `src/components/CardLibraryDialog.tsx`：扫描后逐张补读大卡，带「已读 x / n」进度，失败只记一条。
- [x] `scripts/local-files.mjs`：写入上限 8MB → 24MB，10MB+ 的卡也能导出到 `data/cards`。
- [x] `tests/cards-api.test.ts` 5 条；浏览器「本地路径」流程补一张 400KB 的卡验大卡按需读取。
- [x] 322 项状态测试、97 组浏览器流程。

## v27 卡库成为唯一人事来源（开局 20 张 / 市场补货 / 瀑布流）

- [x] `GameState.version` 19 → 20；`poolLimits.candidates` 6 → 20；v19 老档迁移到 `max(现值, 20)`。
- [x] `OPENING_CARDS = 20`；`startNewGame` 有卡时先清掉内置候选 `lu`，再按最近导入导 20 张。
- [x] `src/cardMarket.ts`：`usedCardIds` / `marketCardGap` / `unusedCards` / `cardBoxExhausted` / `marketNeedsCards`。
- [x] `GameAction.refillMarket`：从卡库补候选，逐张走 `importCard` 的去重与上限；补货写一条日志。
- [x] `refreshMarket` 只做过期清理，不再造原生候选；叙事者提案去掉 candidate（schema 可选、提示词删段、预览删块）。
- [x] `rosterPool(..., { cardsOnly, limit })`：卡 ≥20 只给卡与自定义；不足 20 用内置补位；同一张卡按 `cardId` 去重。
- [x] `cardFactionRoster` + `starterPicks`：卡够 20 时默认三方用卡预填（3 首领 + 3 随从），开局勾选卡库前 6 张。
- [x] `FactionLeader` / `FactionGirl` 增加 `cardId`，编进三方后也不会被市场重复补进来。
- [x] 市场：候选 ≤2 且卡库空时提示一次；空市场显示 `#market-card-hint` 与 `#market-open-cardbox`。
- [x] 卡库瀑布流：`columns` 3/2/1 + `break-inside: avoid`，保留全部 `#cardbox-row-*` / `#cardbox-check-*` id。
- [x] 测试：`tests/v27.test.ts` 10 条；浏览器新增 3 条（瀑布流 / 20 张开局 / 用完提示），改旧流程 2 处。
- [x] 332 项状态测试、100 组浏览器流程。

## 角色起草的联网考据（同人角色）

- [x] `src/research.ts`：`researchCharacter` 走 Vertex `generateContent` + `tools: [{ googleSearch: {} }]`，摘要 ≤2400 字、来源 ≤6 条、按查询缓存 30 分钟；非 Vertex 直接说明不支持。
- [x] `src/vertex.ts`：`VertexParams.tools` 透传，解析 `groundingMetadata` 的 `webSearchQueries` / `groundingChunks`。
- [x] `src/llm.ts`：`GirlResearch` 参数把资料写成【联网资料（只作考据，可能不准确）】，排在 JSON 契约之前；`logResearchEvent` 进叙事引擎面板。
- [x] `src/App.tsx`：`draftGirlProfile` 在开关打开且填了出处时先考据，失败只提示不阻塞。
- [x] `CustomGirlDialog`：立绘页与向导第一步各加「同人角色 / 出处」输入框（`#custom-portrait-research` / `#custom-research`）。
- [x] 设置 → 故事引擎新增「角色起草联网考据」开关（`#settings-research`），默认关，仅 Vertex 生效。
- [x] 测试：`tests/research.test.ts` 5 条（查询归一 / 非 Vertex 拒绝 / 资料与来源与缓存 / 空正文 / 注入提示词）；`tests/vertex.test.ts` 补 `tools` 与 grounding 断言；浏览器新增 1 组端到端。
- [x] 337 项状态测试、101 组浏览器流程。

## 开局编成确认不了（修复）

- [x] 页脚不再只写一句总规则：逐条列出「名册还差 N 人 / 某方还没有首领 / 某方还缺随从 / 有人占了两个位置 / 有人同时在名册与阵营 / 座位已不在可选池」。
- [x] 座位里的失效 id（卡库变动、少女退役）自动摘掉；与名册重叠的座位也会被清理，避免界面看着配好、实际卡在隐藏项上。
- [x] 页脚新增「补齐空位」：只补空着的首领 / 随从，不动已有指派；补完即可确认。
- [x] 阵营标签页里已在事务所名册的少女变暗 + 「已在名册」标签，避免误点重复占位。
- [x] 浏览器新增 1 组：调走某方唯一随从 → 点名「月蚀庭还缺随从」→ 补齐 → 确认通过；名册成员在阵营页有 `in-crew`。
- [x] 337 项状态测试、102 组浏览器流程。

## 开局 2 位契约者 + 市场每日挂牌窗口

- [x] 开局默认勾选从 6 位降到 2 位（`STARTER_COUNT`），编成校验改为 2–6 人；卡库优先时不再一次占满名册。
- [x] 没选中的卡留在 `candidates` 市场池，不再整批铺在界面上。
- [x] `marketWindow` 快照存进存档：每天只摆 `marketSize(marketLevel)` 位（1–4 级依次 2 / 3 / 4 / 5），换日才重新开窗。
- [x] 换日轮换：`refreshMarket` 把当日窗口挪到队尾，同一天内稳定、次日换一批，池子不被消耗。
- [x] 雇走一位当天就少一位，不回补；次日 `refreshMarket` 重新开满窗口。进口卡与高级招聘当天顶到最前。
- [x] 市场页显示「每日挂牌 X 位 · 池中 Y 位」，空池才提示去卡库加卡。
- [x] 测试：`tests/market-window.test.ts` 6 条；`v27` 预选数、`v21` 编成下限与浏览器流程同步改为 2 位。
- [x] 346 项状态测试、102 组浏览器流程。

## 带卡存档读不回来（修复）

- [x] `safeId` 只认 `g_<hash>`，把契约卡的 `g_card_<hash>` 判成坏 id：带卡的存档刷新后整档被 `loadState` 退回初始状态，编成弹窗又出现且座位对不上。
- [x] 放宽为 `g_[a-z0-9_]{6,}`，并补一条「带契约卡的存档能读回来」回归。
- [x] `loadState` 里的候选截断从 `slice(0, 6)` 改回按 `poolLimits.candidates`（20），不再一读档就把市场池砍半。
- [x] 编成守卫等 `loaded` 之后再判断，避免用默认空档把刚存好的进度踢回编成。
- [x] 346 项状态测试、102 组浏览器流程。

## 议会提案读不到契约卡（修复）

- [x] 首夜补内容会赶在存档读完之前跑：`fillOpening` / 市场补货 / 每日自动生成都加上 `loaded` 守卫，不再拿默认名册去写提案。
- [x] `buildNightCatalog` 的 girls 补上 `title` / `personality` / `appearance` / `quote`（各自截断），契约卡的卡面真正进了提示词。
- [x] `buildNightPrompt` 新增【值夜名册】纯文本块（id｜名字｜称号｜元素/职阶｜等级｜羁绊｜出身｜性格/外貌/语气），并把规则改成「只能取名册里的 id」。
- [x] 校验报错列出现在能用的 id 与名字（authorId / speakerId / girlId），修复请求能照着改，不会一直编内置角色。
- [x] 测试：提案提示词只含名册（含卡片性格外貌、不含内置角色）、写错作者时列出可用 id。
- [x] 346 项状态测试、102 组浏览器流程。

## v29 首领代表 / 关系议会 / 模型私语 / 反向代理

- [x] `content/factionLeaders.ts` 三个首领等级 7/7/8 → 10；雇佣血量与编成卡面同步，测试断言更新。
- [x] `factions.ts` 新增 `factionRepresentativeOf(state, faction)`：会客厅、议会、代表委托统一读开局指派的首领（含自定义首领），`factionInfo.envoy` 只作旧档兜底。
- [x] 会客厅代表卡改成首领卡：身份、态度、与其他势力的敌意、委托标题/类型/辖区/时长/目标/报酬/完成效果；`previewFactionTask` 纯预览不写状态。
- [x] `Opinion.authorKind/authorFaction`：代表提案由首领提出；议会卡显示「某某首领」标签；LLM 目录新增 `representatives`，报错与提示词都指向首领 id。
- [x] `OpinionChange.hostility`（±20）与 `OpinionOutcome.truce/war`：停战清战线并写 `truceUntil` 冷却；换辖区复用 `territory`；驳回开战走 `startWar`，确认弹窗/选项预览会列出关系变化。
- [x] 灯下私语新增 `whisper` 生成任务（10 个任务/11 种用途）：结算只入队，App 逐条调模型读 `battle.events` 战报与性格；成功才 `addWhisper` 写未读与角标，失败丢弃不造假。
- [x] 名册与会客厅头像显示未读角标；打开对话或远程联络清零。
- [x] 接口反向代理：`buildApiUrl` 保留子路径/查询串，支持 Azure 与自定义 `{model}` 模板；`apiHeaders` 支持 bearer / x-api-key / api-key / header / query / none + 自定义头；设置页新增折叠的代理配置。
- [x] 测试：`tests/v29.test.ts` 7 条 + 预设/预算计数更新；浏览器新增 2 组（首领代表卡、私语角标）。
- [x] 357 项状态测试、105 组浏览器流程。

## 完成的委托点不开（修复）

- [x] 完成后的按钮在「派遣中 / 紧急优先」筛选下带上 `.filtered`，旧 CSS 把 `pointer-events` 一起关掉，点击就落到下面的辖区多边形上，表现为「只能点到地区说明」。
- [x] `.mission-pin.filtered.done` 保留 `pointer-events:auto` 并抬高一点不透明度：委托完成后仍能点开战报，筛选只影响视觉。
- [x] 浏览器新增一条：完成糖果街委托 → 切到「派遣中」→ 点完成 pin → 打开战报。
- [x] 357 项状态测试、105 组浏览器流程。

## 议会立绘放大 1.5 倍

- [x] `.council-figure` 桌面实际生效规则 480×630 → 720×945（受舞台高度与 90vh 限制），1080 以下 570×630、720 以下 450×450。
- [x] 只改尺寸，不动立绘裁切、层级与选项布局；105 组浏览器验收通过。

## 契约卡导出不带走详情页的立绘与表情（修复）

- [x] `exportCard` 改成按 girlId 从最新状态取人（`latestState.current`），不再用上一次渲染的 `selectedGirl`。
- [x] 导出后同步卡库里同一张卡的 `raw/name/level/element/factionTag`，从卡库再导入不会还是旧图。
- [x] `importCard` 遇到同一张卡的新版本（卡号相同，或自定义卡同名同代号）时更新原角色的立绘、表情差分、衣柜、魔女化与外观文案，不再拒收、也不再新增一个候选。
- [x] 新增 `Girl.cardRevision` 记录导入时的视觉签名；完全相同的卡仍然按重复处理。
- [x] 测试：导出卡片写入当前表情/衣柜/差分；同卡改版后再导入更新且候选数不变，无变化仍判重复。
- [x] 357 项状态测试、105 组浏览器流程。

## v30 战斗札记连贯叙事 / 立绘 / 模型 / 截断

- [x] 札记改成 `format: 'continuous'`：一次写完，单篇 `narration` 6000–10000 字，`scenes` 只留一个容器给 UI；不再要求回合、场景与连续覆盖。
- [x] `battleStoryDigest`：技能名与数值全部去掉，每 3 条事件合成一句动作摘要，首尾保留、中间标注压缩量。
- [x] 校验拒绝正文/台词里的 `64 点`、`第 2 回合`、技能名；不足 6000 字或超过 12000 字也拒绝；修复一次仍不合格不保存。
- [x] 输出预算：`battle` 默认 3000 → 16000，生成时 tokenFloor 14000，避免 6000 字被截断。
- [x] 战斗札记 UI：连续正文不显示 SCENE/回合，隐藏上一场/下一场；立绘侧栏 20vw → 36vw、`max-width` 330 → 660（1024 以下 28vw / 240+）。
- [x] 预设导入 `content.slice(0, 8000)` → 64000，长写作指南不再半句话；旧预设需要重新导入原始文件。
- [x] 战斗札记请求与日志统一用 `cfg.model`（预设覆盖后的模型），并补「基础 flash + 预设 argon」测试。
- [x] 357 项状态测试、105 组浏览器流程。

## 战斗札记立绘与文字抢宽度（修复）

- [x] 侧栏 28vw → 18vw（160px 起），中间正文列保底 520px；1722 宽下正文约 700px。
- [x] 立绘 `max-width` 660 → 560（dense 460）；`.battle-note-portrait-art` 改成 **1:4** 竖幅，名字条 `width:100%` 跟随立绘宽度，不再横跨整列。
- [x] 同侧立绘改**左右排布**：所有立绘统一 `47%` 宽（三个时 31%），左右两侧大小一致；立绘边框直接取角色卡颜色 `--note-color`，名字条上沿同色。
- [x] 整体压缩：外壳/正文内边距、正文行高 2.05→1.9、场景与台词间距、名字条高度同步收紧；1024 以下 18vw / 160px + 正文 480px。

## 市场每日刷新 / 售罄占位（修复）

- [x] `marketSlots` 保留当日窗口槽位；`marketSold` 记录已签约 id，买走后显示「今日已签约」空卡。
- [x] `hire` 不再把窗口裁到只剩未售出的人，售罄 id 留到次日；`refreshMarket` 换日清空 `marketSold` 并重新开窗。
- [x] App 补货 effect 改为每天只执行一次，移除对候选数量和 `marketTick` 的即时依赖；买人不再触发卡库补货。
- [x] 市场 UI 显示「今日挂牌 / 已签约 / 池中」，售罄卡不可点击；全部售罄仍保留空位。
- [x] 新增售罄槽位测试；`tsc --noEmit` 通过，市场 sold-slot 冒烟通过。

## 契约席位计数（修复）

- [x] 新增 `seatedGirls` / `seatsTaken`：只统计未死亡、未退役、未离队的在册成员；退役转文职不占床位。
- [x] HireDialog 与游戏内 hire / 复制体 / 委托奖励入职检查统一用 `seatsTaken`，不再用 `state.girls.length` 把退役或离队的人算进 6/6。
- [x] 新增「退役转文职不占契约席位」回归测试；252 项状态测试通过。

## v31 灯下私语：动作分层 / 表情 / 连发 / 委托记忆

- [x] `Message` 增加 `action` / `expression` / `burstId`；`DialogueLine` / `DialogueReply` 成为对话与私语共用结构。
- [x] `parseDialogueReply` 解析 1–3 条 JSON（动作、表情、总长/单条限制），失败时按换行拆纯文本；对话与私语都接入。
- [x] 对话与私语提示词加入【最近参与】最近 4 条委托；`MissionRun` 在战斗/调查结算时写入，旧档从 battles 派生。
- [x] `talk` / `addWhisper` 支持一次写入多条，同一轮共享 `burstId`，未读仍只 +1；字符串 reply 兼容旧调用与测试。
- [x] `Conversation` 按 burst 分组，名字只显示一次，动作灰色斜体排在台词下方；左侧立绘跟随最新/悬停消息表情并淡入切换。
- [x] 本地回退也改成结构化台词 + 动作 + 表情，高羁绊时一次两条。
- [x] `v31` 5 项测试、对话/私语提示词与断线回退回归通过；`tsc --noEmit` 通过。

## 叙事引擎日志完整保留 / 请求超时 600 秒

- [x] 移除日志请求段的 1100 字 / 3600 字预算和 14 段上限，段内正文不再截断。
- [x] 移除返回正文 8000 字与思维链 2400 字裁剪；localStorage 配额不足时优先保最新一条完整记录。
- [x] 所有普通生成请求超时 60s → 600s（OpenAI 兼容与 Vertex 同步），错误文案改为「超过 600 秒」。
- [x] 设置里的测试连接仍保持 40 秒，联网考据仍保持 30 秒，避免探针长时间挂起。

## 地图隐藏前一天完成的委托

- [x] `Mission.completedDay` 在战斗/调查完成时写入业务日。
- [x] `missionVisibleOnMap` 只允许未完成或当天完成的委托进入地图；换日后旧完成记录仍保留在档案与战报里，但不再显示。
- [x] 地图的计数、筛选、列表、路线与标记统一使用过滤后的委托集合；新增完成日可见性回归测试。

## v32 议题上限 / 提案瘦身 / 内容池 / 默认退休角色

- [x] `opinionLimit` 按会客厅等级 2→3、3→4、4→5；`trimOpinions` 把超限议题转为 `shelved`，议事桌与任务清单只显示上限内条目。
- [x] 删除新档默认议题与 `openingFill` 的本地议题兜底；首夜/每日议题全部由叙事者生成，首夜提示词要求补满 3 条。
- [x] `NightProposalV2.monster` 改为可选且不再 materialize；每日提案只写委托、议题、使者与装备，`addGeneratedContent` 不再增加 `customMonsters`。
- [x] 内容池：战斗 120 / 调查 20 / 魔物 50；新档本地填充，委托按标题+描述去重，LLM 重复委托被拒绝，容量满时替换旧自动委托。
- [x] 新游戏不再把栀子设为退休；5 人在册、退休区默认空。
- [x] v32 4 项测试，game/v26/v27/v24/v29/v31 回归通过；`tsc --noEmit` 通过。

## v33 数值职责 / 完成与升级提示 / 手动加点

- [x] 命中改由洞察对敏捷：`hitChanceOf` = 技能基础 + (洞察 − 敌敏) × 0.5 + 命中修正，30–95，不加基础补偿。
- [x] 攻击技双方都掷骰（治疗与增益不掷）；`speedOf` 只用敏捷，`initiativeOf` = 速度 + 掷骰，洞察不再影响先手。
- [x] 战报结算说明改写为「基础 + 洞察 − 敌敏」；旧战报没有洞察字段时回退旧的敏捷文案。
- [x] 新增 `GameNotice`：委托完成与升级各写一条，通知中心置顶显示；toast 改为队列（最多同时 3 条），不再互相覆盖。
- [x] 升级成长：手动模式每级 +10 可分配点、最大生命 +10；自动模式主属性 +6、副属性 +4，同样 +10 生命。
- [x] `allocateStat` 加点（1 点起、四维上限 120、共情加点重算心防）；档案成长页加点面板、名册 `+N` 角标、设置页自动/手动开关。
- [x] 旧档迁移：`levelUpMode` 缺省读作 auto、`unspentPoints` 补 0，不追溯退点。
- [x] v33 6 项测试；game 254、v24 25、budget 10、其余 87 全部通过；`tsc --noEmit` 通过。
- [x] 命中下限 30% → 15%；战报摘要恢复技能名与用途分类（支援/护持/回复不再写成攻击），正文允许引用技能名，只拦伤害与回合数值。

## v34 交互式角色剧情 / 工坊登记 / 蓝图角色

- [x] 蓝图事件节点新增 `cast`（≤3，必须含主角）与 `opening`（≤600 字）；`sanitizeGraph` 过滤非法 id 并截断开场白。
- [x] `CharacterEvent.mode = 'session'` + `turns/cast/opening/sessionDone`；蓝图事件与新建角色事件都进入交互模式。
- [x] 进入剧情先由叙事者写 250–350 字开场白（蓝图自带开场白时直接沿用，不再覆盖），并给三条参考行动。
- [x] 回合流：玩家行动 → `generateStoryTurn` 续写；旁白 900–3000 字（截断 >3000、拒收 <200），台词 2–8 句且只允许在场者与 player，选项 ≤3、每条 ≤24 字，羁绊 −2..2。
- [x] 对话框化：台词气泡带角色色、鼠标划过切到该句表情差分立绘；玩家用灰框、立绘位只显示「所长」。
- [x] 单段重写：`replaceStoryTurn` 只改旁白那一段、累加 `rewrites`，不新增回合、不改走向。
- [x] 只有「结束事件」+ 确认才收束（`finishStorySession`）：按轮数结算羁绊（每轮 0.8，上限 +4），写夜班记录与档案并继续蓝图；关弹窗/切标签/推进时间都不打断，最多 12 轮。
- [x] 内容工坊弹窗页签新增只读「叙事者生成」区，列 `state.incidentPool/incidents` 中 `source === 'llm'` 的弹窗（去重、≤20），可一键「登记」成自制弹窗卡再保存。
- [x] 蓝图事件节点编辑器加参与角色 chips 与开场白文本域。
- [x] v34 7 项测试；game 254、v24 25、budget 10、其余 87 全部通过（383 条）；`tsc --noEmit` 通过。

## v35 把 game.ts 按功能拆开

- [x] 护栏先行：`tests/game-api.test.ts` 冻结 79 个运行时导出名、`tools/check-imports.mjs`（`npm run check:rules`）查环与体积、`tools/fix-imports.mjs` 按 tsc 输出补/删 import 并把纯类型 import 改成 `import type`。
- [x] 21 个功能模块先落位：core / labels / candidate / outfits / pools / roster / market / missions / encounters / conditions / opinion / battle / investigation / incidentOps / storyCore / storyRun / storyEvent / time / dailyOps / state / persistence。
- [x] 拆开三处天然耦合：`hashText` 下沉 `core`（原 candidate ↔ outfits 环）、`defeatBoss` 归 `battle`（原 battle ↔ time 环）、蓝图推进与故事委托合成 `storyRun`（两者互相调用）。
- [x] `act` 的 70 个 case 全部搬成 `applyX(state, action)` 处理器，分进 dailyOps / rosterOps / growthOps / itemOps / cardOps / factionOps / storyOps；调度器只剩 96 行。
- [x] `cardOps` 里 `importCards → importCard` 改为直接调用处理器，不再递归 `act`；`validBattleNote` / `validGeneratedItem` / `canAcceptGeneratedContent` 移到 `validate.ts`，`persistence` 成为只进不出的终点。
- [x] `src/game.ts` 只剩 25 行显式 barrel，84 个导出名与类型一字不差；20 个 UI 文件与 11 个测试的 import 没改。
- [x] 最终规模：`src/rules/` 29 个模块，最大 429 行（battle），无循环依赖；`tsc --noEmit` 0 错。
- [x] v35 新增 1 条导出名快照测试；16 个文件 384 条逐文件全过（game 254 / v24 25 / v26 15 / v29 11 / budget 10 / vertex 10 / v27 10 / store 9 / market-window 7 / v33 6 / cards-api 5 / research 5 / v31 5 / v32 4 / v34 7 / game-api 1）。

## v36 卡库拆库：开局读卡库不再 OOM

- [x] 复现思路：整库存在一个 kv 键里（`night-sugar:cardbox:v1`，每条带 `raw` 全文），60 张带 2–3MB 立绘的卡 ≈ 一条 130MB+ 的记录；`loadCardBox()` 一次反序列化、`rosterPool` 再逐张 `JSON.parse`，开局就顶到内存上限。
- [x] 存储拆成「索引 + 单卡原文」：`night-sugar:cardbox:v2` 只存名字 / 等级 / 属性 / 出身 / 技能 / 字节数（几百字节），原文放 `night-sugar:cardbox:card:<hash>`，`readCardRaw(hash)` 按需读。
- [x] 自动迁移旧库：第一次 `loadCardBox()` 读到 v1 就逐张 `pop()` 拆开写入新结构（处理过的长文本可尽早回收），写完删掉旧键；读不动的旧值也一并清掉。
- [x] `cardboxCards(hashes)` 改为异步按 hash 取原文：开局导入 20 张、市场补货按缺口取，都不再把 60 张全读进来。
- [x] 编成池不再解析卡面：`cardSubject` 直接用索引元数据，立绘留空走程序化剪影；真正编进名册的那几张才在 `importCards` 时读原文。
- [x] 新增 `tests/cardbox.test.ts` 4 条：索引不带 `raw`、旧库迁移并删键、脏值清理、2MB 卡的索引仍 <2KB。
- [x] 17 个文件 388 条测试逐文件全过；`tsc --noEmit` 0 错；`npm run check:rules` 通过（29 模块 / 无环 / 无 BOM）。
- [x] 开局再加一道「卡面总量」预算：`OPENING_CARD_BYTES = 12MB`，超过就少读几张、剩下的留给市场按缺口补货；被截断时控制台打一行 `[卡库] 开局只读 N/M 张（约 XMB）`。
- [x] L1：`importCards` / `refillMarket` 不再逐张 `clone(state)`，改成 `importCardInto(next, card)` 只克隆一次；`hydrate` 对「刚拼好的字面量」支持 `{ clone: false }`，省掉每张卡一次 2–3MB 立绘深拷贝。
- [x] L2：新增 `src/cardImport.ts` 的分批规划（≤6 张 / ≤4MB 一批），开局与卡库导入都逐批 `cardboxCards` → `importCards`，每批解析完即丢；卡库对话框显示「正在分批读取 3/5 批」，控制台打 `[卡库] 分批读取 i/n`。
- [x] 新增 2 条测试：导入 20 张卡的 `JSON.parse` 次数 ≤4（锁住「不再逐张深拷贝」）、分批规划的张数/字节/超大单卡边界。

## v37 开局随机分配 / 派遣选人显示职业

- [x] `roster.ts` 新增 `shuffleWith` 与 `randomStarterAssignment(pool, { count, random })`：名册随机挑 2 位，三方各坐一位首领与一位随从，首领优先同势力的人；池子不足 6 人返回 `null` 交回默认分配。
- [x] 开局编成（`phase === 'roster'`）第一次拿到池子就随机分配一次；从设置页重开编成不随机，避免覆盖玩家已经调好的座位。
- [x] 编成页加「换一组」按钮（`#starter-reroll`），随时重掷名册与三方座位。
- [x] 派遣选人列表在名字后面显示职业（输出 / 守护 / 治愈 / 控制 / 侦查，缺省「未定」），样式 `.assignment-role`。
- [x] 新增 `tests/starter.test.ts` 5 条：座位不重叠、同种子可复现、池子不足回退、首领同势力、洗牌不丢不重。

## v38 委托板固定 12 条 / 删掉编号副本

- [x] 委托上限固定 `MISSION_POOL_SIZE = 12`：不再按 120 战斗 + 20 调查铺满，`poolLimits.missions` 新档与老档都压回 12。
- [x] `ensureMissionPools` 只从真实模板补（种子包 + `missions-extra` + 自制委托），同模板同时只出现一次，标题不再拼「辖区记录015」。
- [x] 完成/过期/换日都会立刻补回 12：`advance`、`syncShift` 过期后、`endNight` 同步各补一次；`trimMissionPools` 超限时先淘汰最旧的自动委托，使者与故事委托保留。
- [x] 魔物不再复制：删掉 `ensureMonsterPool` 的 `名字·N` / `档案第 N 号` 克隆，容量跟着真实魔物数量走；首夜空缺的魔物缺口按真实池子算。
- [x] 老档清理：`stripPoolPadding` 在读取时删掉带「记录NNN」「第 N 次现场记录」的委托与 `pool-mon-<day>-<index>` 魔物，然后把上限压回 12。
- [x] 新增 `tests/pool.test.ts` 6 条：12 条且模板不重复、完成后补回、换日仍 12、老档清副本、超限淘汰顺序、幂等。
- [x] 19 个文件 402 条测试逐文件全过；`tsc --noEmit` 0 错；`npm run check:rules` 通过。
- [x] 地图坐标不再挤在辖区标签点：`districtPin` 改成按多边形外接框拒绝采样（落别区就重抽），并给每条委托选「当前委托最少」的辖区；新增 2 条测试断言坐标落在本区多边形内、同区点也不重叠。

## v39 每日提案提示词瘦身 / girlId 改写

- [x] 目录里删掉 `skills`：v32 之后不再生成技能，60 多条技能只是把提示词撑长；`NightCatalog` 同步删字段。
- [x] 魔物表改用 `spawnableMonsters(state)`：只列真实可上场的魔物（去重、去掉 Boss/剧情专属与旧 `pool-mon-*` 副本），`enemyRefs` 校验照旧。
- [x] `changes[].girlId` 写成名册外的 id（常见是三方首领 id）时，改写为提出者并记一条 warning，不再让整份提案作废；defer/reject 本来要求改提出者羁绊，改写比作废更接近本意。
- [x] 新增 2 条测试：目录不含 skills 且魔物表无重复/无旧副本、girlId 误用后被改写为提出者且带 warning。

## v40 城市态势跟随开局指派的首领

- [x] `factionBrief` 接受当前首领：提示词的「城市态势」不再写死内置首领，改用 `factionRepresentativeOf(state, faction)`；换人时不沿用旧首领的台词（避免把雨宫澄的话安到维里奈头上）。
- [x] 新增 1 条测试：指派卡面首领后，城市态势里出现新首领、不出现内置首领与他的台词，势力信条保留。

## v41 全域文案润色与叙事重塑（分阶段执行）

- [x] 制定全域文案重塑方案 `tasks/plan-v41-copywriting.md`：根除机械短句与说明书腔调，建立具象感官描写与完整语流；明确五阶段执行路线与逻辑零破坏白名单机制。
- [x] **阶段一（世界书与势力设定）**：
  - `src/worldbook.ts`：全面重构 17 个内置词条（空月、生命与受伤、共情与羁绊、心防、侵蚀与魔女化、星砂与安定度、三方势力、夜班规则、九块辖区、委托与时限、议会、宿舍、诊所与治疗、治疗癖好、故事线、战斗札记），破除“A是B。B会C。”式机械碎句，转为语流连贯、具备都市怪谈冷调深度的设定文本；常驻与动态词条字数严格契合 1900 预算，保证战斗札记等动态条目稳定命中。
  - `src/factions.ts`：重塑三方势力 `factionDossiers`（星灯协会、樱雾市役所、月蚀庭）的历史渊源、成员构成、行事手段、对外公关、内部矛盾、技术与魔女化立场、少女管控及势力间恩怨描述；保留势力信条原句。
  - 验证：19 个测试文件 407 项全绿，`tsc --noEmit` 0 错，`check:rules` 通过，无 UTF-8 BOM。
- [x] **阶段二（派遣委托叙事简报）**：
  - `src/content/missions-extra.ts` 与 `src/content/seed-pack.ts`：全部 16 条内置/扩展委托模板 description 重构为 80~140 字的充实调查简报，补充市民报案背景、变电网杂波/镜潮信件/失落乳牙等现场感官异象，根除一两句话草率带过的梗概短句；逻辑属性 100% 绝对一致。
  - `src/rules/persistence.ts`：`stripPoolPadding` 在读档时自动将老存档保留的未完成委托 description 刷新为最新完整叙事简报，老玩家在地图上立刻看到丰满文案。
  - 验证：19 个测试文件 409 项全绿，`tsc --noEmit` 0 错，`check:rules` 通过。
- [x] **阶段三（都市魔物与天灾图鉴）**：
  - `src/content/monsters.ts` 与 `src/content/monsters-extra.ts`：全部 21 只基础与扩展魔物重构（回声猫、镜修女、末班车、糖王、糖蛾、空月、蜜蜡蜂、磁带蛇、沥青犬、雨伞树、失眠羊、焦糖蜘蛛、雾中列车员、静默护士、铁皮合唱团、灰烬马、午夜电台、无面主妇等）；称号、外貌生态描述（60~110字）、图鉴习性、弱点对策及特性说明全面升级为都市怪谈调查档案文风，根除“它叫你名字不要答应”类干瘪短句。
  - `src/content/bosses.ts`：重塑天灾 Boss 糖霜王座背景 blurb 与三阶段台词。
  - 验证：魔物 ID、阶级、五维数值、技能、立绘参数、触发规则完全一致；19 个测试文件 409 项全绿，`tsc --noEmit` 0 错，`check:rules` 通过。
- [x] **阶段四（技能体系与装备名录）**：
  - `src/content/skills.ts` 与 `src/content/bossSkills.ts`：全部 50 条公共技能与 8 条 Boss 专属技能重构，消除“一枚结晶糖针，甜得发苦”类短句，充实施术回路、魔力流向、光影形态与受击反馈；技能 ID、流派、消耗、倍率、目标、冷却与效果完全保持一致。
  - `src/content/traits.ts`：全部 24 条个性与体质特性重构为具备人物执念与怪癖细节的生动描写。
  - `src/content/equipment/`（tier1~tier5）：全 5 阶 76 件装备与道具 description 重塑为具象器物来历、打磨痕迹、材质触感与实战体会；消耗品恢复数值一字不落。
  - 验证：逻辑字段零变动；19 个测试文件 409 项全绿，`tsc --noEmit` 0 错，`check:rules` 通过。
- [x] **阶段五（UI 界面指引与系统说明）**：
  - `src/rules/labels.ts`：七阶羁绊心声 `stageHints`（从“她不想与你共处一室”升华到“她本能地抗拒与你在同一张桌前停留…”等细腻心理描写）；工种说明 `workDescriptions`（战斗与调查机制叙述更具实战沉浸感）。
  - `src/components/ClinicPanel.tsx`：诊所底部提示升华，由生硬计费说明重塑为严谨的药浴愈合与抚平心智褶皱指南。
  - `src/components/MissionDialog.tsx`：派遣编成备忘录、战果判定机制说明（消灭“玩家不介入战斗；结果由规则引擎结算”等代码腔，改为所长执业视角）、过期信号撤回提示。
  - `src/components/CharacterDialog.tsx`：魔女化警示、四维战斗与心防作用机理、手动/自动加点潜力说明、门诊导引。
  - `src/components/RoomDialog.tsx`：诊所药浴与睡眠疲劳区别、记忆重塑与灵体复制权能说明。
  - 验证：纯静态展示字串调整，零交互逻辑变动；19 个测试文件 409 项全绿，`tsc --noEmit` 0 错，`check:rules` 通过。

## v42 魔物模板扩充至 40 个与高密度委托矩阵（80战斗+16调查）

- [x] 方案设计 `tasks/plan-v42-monsters-commissions.md`：设定 40 个魔物与 96 条委托矩阵，严格规范 450 行单文件体积红线与多魔物战术梯队。
- [x] **阶段一（40 魔物库扩充）**：
  - 新建 `src/content/monsters-magical.ts`，新增 20 只经典魔法少女原型衍生的怪异（剪影裁缝、缎带舞女、糖霜小丑、假面歌姬、裂纹瓷偶、踏夜红鞋、纺锤金蜂、影中双子、笼中雀女、水银注剂师、发条重骑、迷宫画框、雾港海妖、噬电幼兽、噬光黑犬、结晶织棺者、铁律修女、空心合唱童、终焉传令使、铜钟夜鸮），覆盖七大属性与碎屑/游荡/灾厄阶级，带完整生态习性、弱点与几何 spec。
  - `src/content/monsters.ts` 聚合展开，普通魔物达到 40 只（总计 42 只，含剧情空月与天灾王座）。
- [x] **阶段二（16 调查委托矩阵）**：
  - 新建 `src/content/missions-investigation.ts`，扩充 10 条高质量调查委托（走失的发条八音盒、逆流的雨量计、浸蜡的空白日记、颠倒的重力回廊、褪色的誓言碑文、静止的第三秒钟、溢出的水银刻度、空教室的无声合唱、穹顶空月的因果裂隙、遗忘之城的盲端档案）。
  - 与既有调查委托整编为 16 条矩阵，分为低危 (4)、中危 (5)、高危 (5)、绝望 (2)，四维判定全面覆盖。
- [x] **阶段三（80 战斗委托矩阵，覆盖 1~6 只魔物）**：
  - 分卷构建 `src/content/missions-combat-low.ts`（单兵 15 条 + 双子 20 条，共 35 条）与 `src/content/missions-combat-high.ts`（三人队 25 条 + 四人群聚 10 条 + 五人蜂群 5 条 + 六体狂潮 5 条，共 45 条），合计 80 条战斗委托。
  - 单个委托明确配置 1~6 只魔物编成（涵盖单体刺杀、前后排协同、三维小队、卫队游行、多重蜂群至六体终焉灾厄）。
- [x] **阶段四（委托大池接入与测试验证）**：
  - `src/content/missions-extra.ts` 聚合并展开全部新增战斗与调查委托，委托大池无缝扩充至 96 条；`tests/v24.test.ts` 断言更新为 40 只普通魔物；`tests/pool.test.ts` 新增 96 条委托与 1~6 只魔物梯队专项测试。
  - 19 个测试文件共 410 项测试全绿，`tsc --noEmit` 0 错，`check:rules` 通过，无 UTF-8 BOM。

## v43 角色卡载入 / 表情差分导入 OOM 根治

- [x] 方案与复盘 `tasks/plan-v43-oom.md`：定位「原图直读 → 并发解码 → 状态树大字符串 → 全量签名」四条放大链路。
- [x] `src/image.ts` 新增 `safeOptimizedImageDataUrl`：长边 ≤1024 等比下采样、转 WebP(0.82)，已轻量的 WebP 直通，finally 里 revoke object URL 并把 canvas 宽高清零；新增 `yieldToGC` 让出事件循环；`originalImageDataUrl` 直接转发到安全版本，旧调用点自动受益。
- [x] `ExpressionVariantDialog`：单张与批量导入改走安全版本，批量串行处理并在每张之后让出 GC，界面显示「正在优化第 N 张」。
- [x] `WardrobeDialog` / `WitchFormDialog`：立绘与衣柜 JSON 里带进来的图逐张降维（新增 `slimOutfits`）。
- [x] `CustomGirlDialog`：衣柜包导入后整体瘦身（`slimWardrobePackage`）；立绘选择改用 object URL 并在换图/卸载时 revoke。
- [x] `src/cards.ts` 新增 `optimizeCardImages`：卡片落库前对主立绘、各套服装、魔女化立绘与全部差分逐张降维。
- [x] `src/rules/cardOps.ts`：`signature()` 改为图片指纹（长度 + 首尾 64 字符），不再把整张卡的 Base64 拼进 `JSON.stringify`。
- [x] `src/imageSlim.ts` 新增 `slimGirlImages` / `slimStateImages`：老存档读入后在后台清洗名册、候选与纪念墙里的超大图，确有改动才替换状态；`App.tsx` 的启动与三条读档路径都已接入。
- [x] 测试：新增「2.5MB 立绘卡片重复导入仍判重且指纹 < 4000 字符」「optimizeCardImages 保持结构」「无 Canvas 时 slimStateImages 原样返回」三条；19 个测试文件 413 项全绿，`tsc --noEmit` 0 错，`check:rules` 通过，无 BOM。

## v43 修复：自定义登记后立绘不显示

- [x] 根因：v43 把 `CustomGirlDialog.pickFile` 改用 `URL.createObjectURL` 提速，而提交时仍取 `source?.src` 当立绘——存进去的是 `blob:` 地址，弹窗一关就被 revoke，刷新后更是彻底失效，于是自定义登记出来的人只有剪影或破图。
- [x] 修复：新增 `portraitData` 状态，图片加载后立刻另存一份长边 ≤1024 的 WebP dataURL 作为真正的立绘；提交改用 `portraitData → preview → 衣柜包立绘` 的顺序，并在加载时同步落一张预览，杜绝「刚导完就点确认」的空档。
- [x] 加固：`src/image.ts` 新增 `isPersistablePortrait` / `sanitizePortraitSrc`，只承认 `data:image/…` 与内置 `/art/…`；`applyCreateGirl` 与自定义登记的提交口都过这一道，`blob:` / `http:` 一律挡掉。
- [x] 自愈：`slimGirlImages` 顺带清掉存档里遗留的 `blob:` 立绘（纯字符串判断，没有 Canvas 也能跑），老存档读入后不再留一张永远加载不出来的破图。
- [x] 测试：新增「立绘地址只收 data:image 与 /art/」「遗留 blob: 立绘读取后被清掉」两条；19 个测试文件 415 项全绿，`tsc` 0 错，`check:rules` 通过。

## v44 阶段一 / 二：私语概率进数值规则 + 议会助手席

- [x] **阶段一（灯下私语概率可调 + 故事线保底）**：
  - `src/balance.ts`：`BalanceRules` 新增 `whisperVictoryPct` / `whisperDefeatPct` / `whisperBondMaxPct` / `whisperStoryPct` / `whisperMaxPct` / `whisperDailyCap` 六项，默认 30 / 45 / 20 / 100 / 85 / 3，正好复刻旧公式；`BalanceField` 补 `group`，数值页按「运营与诊所」「灯下私语」分组显示。
  - `src/rules/whisper.ts`（新）：把判定从 `battle.ts` 抽出，新增纯函数 `whisperChance()`；故事线角色直接取专用档（默认 100%）且不吃疲劳/侵蚀修正，并优先占用当晚名额；每晚上限改读数值规则。
  - `src/rules/battle.ts`：改为再导出，`investigation.ts` 等调用方无需改 import；文件回落到 450 行红线内。
  - `src/views/WorldbookView.tsx`：数值页按分组渲染，私语组附带「故事线角色优先占位」的说明。
- [x] **阶段二（议会助手席 1.5 倍 + 半身立绘）**：
  - `GirlPortrait` 新增 `bust` 半身取景：导入立绘走 `object-fit: cover` + 1.38 倍放大与上移取景，程序化剪影用 CSS 放大到上半身。
  - `CouncilView` 助手席改用 `variant="bust"`；`styles.css` 立绘框 240 → 360px，名字 13 → 15px、说明 11 → 12px，内边距 16 → 18px。
  - 窄屏（≤1080px）不再 `display: none`，改成「120×160 缩略图 + 名字与说明」的两栏窄条。
- [x] 测试：新增 `tests/v44.test.ts` 六条（字段默认与夹取、老配置兼容、基准/羁绊/封顶、故事线专用档、优先占位、每晚上限、同日去重）；`game.test.ts` 的数值字段计数同步为 16。20 个测试文件 421 项全绿，`tsc --noEmit` 0 错，`check:rules` 30 模块无环无 BOM。

## v45 导出契约卡时带上她的故事线

- [x] `src/cardStory.ts`（新）：`cardStorylinesFor()` 导出深拷贝并剥掉旧存档的委托/事件引用；`sanitizeCardStorylines()` 洗净外部卡片（坏条目丢弃、最多三段、只留一条进行中）；`applyCardStorylines()` 导入时重写 id、把 `girlId` 指向新少女、重建段与段的先后关系。
- [x] `GirlCard` 新增顶层 `storylines?: Storyline[]`；`buildGirlCard()` 按 `girlId` 摘出这位少女的故事线一并写入，`parseGirlCard()` 读回时做同样的清洗。
- [x] `applyImportCard` / `importCards`：新登记与「同卡改版覆盖」两条路径都会落地故事线，日志与提示写明带了几段；卡片的改版指纹加上「段号/状态/进度/标题」，只有故事线推进过也会被识别成新版本。
- [x] `App.tsx` 导出提示补「（含 N 段故事线）」。
- [x] 测试：新增 `tests/v45.test.ts` 五条（导出剥离旧 id、卡片往返、导入重映射、重复导入与改版覆盖、三段上限与单条进行中）；21 个测试文件 426 项全绿，`tsc --noEmit` 0 错，`check:rules` 30 模块无环无 BOM。

## v47 每日提案与蓝图提示词（先于 v46 落地）

- [x] **每日提案提示词补全**：`buildNightPrompt` 重排为「机制目录 / 名册 / 城市 / 字段说明书 / 硬性规则 / JSON 形状」；新增字段说明书逐条写清 mission、envoy、opinions、`changes` 与 `outcomes` 的合法 kind 与方向。
- [x] **提案改两个分支**：模型只写 accept / reject；`validateOpinion` 改为只收这两项，`materializeNightProposal` 自动补一条固定的 defer（提出者羁绊 −1、势力 −2），界面仍是三个按钮，老提案里的 defer 会被丢掉后补回。
- [x] **目录瘦身**：`catalog.items` 改为阶级统计（每阶最多三个示例名），`catalog.monsters` 整段删除；提示词里的完整物品表与魔物表一起消失。
- [x] **委托只给难度**：新增 `src/nightPick.ts` 的 `pickMissionTemplate()`，按 work + difficulty 从真实委托模板确定性抽一条，数值与魔物组合原样沿用；每日提案的 mission / envoy 与蓝图阶段委托共用。
- [x] **掉落改阶级**：`loot` 只写 `{tier, slot, faction}`，`pickEquipmentOfTier()` 按阶级抽成品，`materializeLoot` 不再新造 `lm_item_*`；旧提案里自造装备仍走 fallback。
- [x] **蓝图阶段委托支持战斗**：`StoryMissionSpec` 加 `work`，`storyMissionForBeat` 在只写 work 时抽模板、沿用魔物组合、用模型写的 goal 覆盖描述；难度在「简单/常规/棘手/危险」与「低危/中危/高危/绝望」之间映射。
- [x] **角色事件 cast**：蓝图提示词写清「cast 1–3 人、必须含主角、每个人都要在 opening 里出场并有台词或动作」。
- [x] 测试：新增 `tests/v47.test.ts` 六条；22 个测试文件 432 项全绿，`tsc --noEmit` 0 错，`check:rules` 通过。

## v48 清除残留的内置首领名字

- [x] 新增 `representativeNameOf(state, faction)` / `representativeTitleOf(state, faction)`（`src/factions.ts`）：统一解析「现在这一方的代表是谁」，缺 state 时退回内置默认。
- [x] 替换的调用点：`App.tsx` 势力卡「代表：」、`FactionDialog` 来使名、`IncidentDialog` 弹窗势力行、`RoomDialog` 使者委托、`Shell` 顶栏势力提示、`AuxViews` 退休/势力面板、`MarketView` 物资分组头、`tasks.ts` 任务提示、`rules/cardOps` 接取代表委托的日志与消息、`incidents.ts` 的 `{envoy}` 占位、工坊事件预览。
- [x] `llm.ts` 蓝图提示词：城市态势那一行改由 `blueprintFactionLine(state)` 生成，按当前存档解析三方首领；没有 state 时只写势力名，绝不写死内置首领。
- [x] `prologue.ts`：开场三幕的领袖台词改由 `leaderNames` 生成，台词保留、名字换成当前首领。
- [x] 测试：新增 `tests/v48.test.ts` 四条（默认代表、换人后名字与头衔、开场三幕台词、蓝图提示词不残留旧名）；23 个测试文件 436 项全绿，`tsc` 0 错，`check:rules` 通过。

## v46 故事蓝图重做：删场景、奖励改阶级、补弹窗与提案、端口规则写进提示词

- [x] **① 删掉场景节点**：`StoryNodeKind` 去掉 `scene`；`NODE_LABELS` / `NODE_ACCENT` / `makeNode` / 编辑器调色板与检查器同步删除；`compileBeatsToGraph` 把每一幕的旁白 + summary + hook 压成一张**强制弹窗**（`spec.kind 'girl'`、`options: []`），幕与幕的连线不变；`graphBeats()` 改为按 event + incident 压平。
- [x] **② 奖励节点**：`StoryNodeData` 的 reward 改 `equipmentTier?: number`（1–5，0 = 不给），`sanitizeData` 按阶级收、旧 `equipmentId` 用 `tierOf(getItem())` 折算、`effect.skill` 直接剥掉；`advanceStoryGraph` 用 `pickEquipmentOfTier({tier, seed: story:id})` 抽一件非消耗品放进背包并写日志；编辑器删掉「装备」「技能」两个下拉，换成「装备阶级 1–5」数字输入。
- [x] **③ 弹窗与提案可生成**：`blueprintKinds` 加 `incident` / `opinion` 并去掉 `scene`；提示词补两段完整 data 形状（弹窗的 `IncidentEffect` 字段与幅度、提案的六种 topic 与 accept / reject 两项）；校验器删掉「禁止生成 incident / opinion」，改为 `event 1–2`、`incident 1–2`、`opinion ≤1`、至少一个 event 或 incident。
- [x] **④ 端口规则进初始提示词**：choice 只能是 `a/b/c/d`、每个选项恰好一条同名边、`trust_calc` / `defy_fate` 这类语义化端口名一律非法、弹窗用 `o1`–`o3`、提案固定 accept + reject、start 只有一条 out、end 无出边；末尾 8 条提交前自检；返修提示词补三条修正策略（补边而不改 id、把语义化 fromPort 改成真实出口、不删节点）。
- [x] **校验器**：`validateGraph` 的选择端口改为「每个选项必须且只能连一条线」并补「无法识别的出口」新文案，「弹窗 / 提案缺标题正文」降为 warning；`blueprintIssues` 对这两条仍按 error 处理，并新增弹窗（`o1`–`o3` 或单条 `out`）、提案（accept / reject 各一条，写 defer 报错）与 `start / event / reward / wait 只认 out` 三套端口规则。
- [x] **运行时接线**：`Incident` / `Opinion` 各加 `storyNodeId`，`resolveStoryWait` 新增 `chosenPort` 参数并按它找边；`applyResolveIncident` 传选项 id、`applyDecideOpinion` 传 accept / reject；提案节点在运行时只带 accept / reject，`advanceStoryGraph` 补一条固定的 defer（界面仍是三个按钮，暂缓不推进剧情）。
- [x] 测试：新增 `tests/v46.test.ts` 九条（读档迁移、奖励清洗、按阶级发放与确定性、结构校验、choice 端口、弹窗端口、提案端口、提案运行三分支、生成时 scene 静默转换与提示词内容）；24 个测试文件 445 项全绿，`tsc` 0 错，`check:rules` 通过。
- [x] `npm test` 脚本补进 v44–v48 五个文件；README 更新蓝图 / 内容工坊 / 回归规模与文件清单。

## 小修：契约魔法少女后不再塞一条默认欢迎议案

- [x] `src/rules/rosterOps.ts` 的 `applyHire` 删掉那条「欢迎〇〇 / 申请 300 星砂筹办欢迎会」的默认提案，`makeOpinion` 的 import 一并收回；会客厅空着时本来就有「今晚没有新的议题」的空态，不再被自家生成的凑数提案占位。契约日志与提示不变。
- [x] `tests/game.test.ts` 的雇佣用例补一条断言：缔结契约前后 `opinions` 数量不变。

## v49 提示词分区与宏：v46 / v47 的提示词交给玩家改

- [x] **`src/nightSpec.ts`（新）**：把每日提案的枚举与 `NIGHT_SCHEMA_EXAMPLE` 从 `llm-night.ts` 搬出来，宏与校验器读同一份；`llm-night.ts` 原样再导出，外部 import 路径不变。
- [x] **`src/tokens.ts`（新）**：`promptTokens` 单独成模块，`presets.ts` 再导出，避免分区与预设互相引用。
- [x] **`src/girlDossier.ts`（新）**：`dossierOf()` 输出她的九节全量档案（魔女化自动换人格、末尾自动附「没列出的事她不知道」），四份历史各自带条数参数、预算与「还有 N 条未列出」尾巴。
- [x] **`src/promptMacros.ts`（新）**：宏注册表（`{{heroine}}`、`{{heroine:brief}}`、`{{history.missions}}` / `storylines` / `chat` / `battles`、`{{girls}}`、`{{factions}}`、`{{leaders}}`、`{{districts}}`、`{{hostility}}`、`{{office}}`、`{{council}}` 与 `{{council.need/cap/pending}}`、`{{incidents}}`、`{{storylines}}`、`{{items:3}}`、`{{missions:combat}}`、`{{traits}}`、九个枚举宏）、`resolveMacros`（支持 `{{key:arg}}` 与点号键）、`MACRO_GROUPS`（编辑器分组）。
- [x] **`src/promptSections.ts`（新）**：`STORY_LIMITS`（提示词与校验器共用）、`limitsText()`、`storylineContract()`、13 条分区默认文本（蓝图 5 + 提案 4 + 对话 / 私语 / 私人事件 / 完整剧情各 1），全部走宏且通过「禁止数值」误报检查。
- [x] **`src/presets.ts`**：`DEFAULT_PROMPTS` 合并 13 条分区（27 条）；`ensurePromptScopes` 补 schema 5 只补缺、同步 `promptOrder`；`renderPresetSystem` / `composeTaskSystem` 先展开注册宏再走老变量，契约同样展开且永远最后；某用途一条分区都没有时补默认分区（旧预设兜底），但只要还剩一条就按玩家的增删来。
- [x] **接线**：蓝图 body 从 4 759 字瘦到「玩家方向 + 锁定契约」；每日提案换成 `dailyContract()` + `buildNightCatalog` 供宏取数（`buildNightPrompt(state)` 保留为兼容出口）；对话 / 私语删掉手写的档案与「最近参与 / 最近对话」，只留场景句与战报；私人事件 / 完整剧情 / 开场白补 `state` 与主角上下文。
- [x] **编辑器**：`PresetDialog` 增设宏面板（她是谁 / 她的过往 / 事务所与城市 / 目录 / 枚举与阈值五组，点一下插进光标所在的词条）、「代码追加的契约」只读预览；设置页补上 v44 起一直缺的「灯下私语」入口。
- [x] 测试：新增 `tests/v49.test.ts` 十一条（分区齐全、schema 5 迁移、档案九节与魔女化、brief 压缩、名册与档案不重、四种历史的条数与省略、拼装顺序与「删了就消失」、玩家自定义覆盖、宏面板键名）；25 个测试文件 456 项全绿，`tsc` 0 错，`check:rules` 通过。

## v50 城市新闻：每日播报 + 数值规则开关

- [x] **`src/cityNews.ts`（新）**：`CityNews` 两条来源——`sanitizeCityNews()` 洗模型输出（≤4 条、每条 ≤90 字、tone 四选一、只有标题没有条目就当没生成），`localCityNews()` 用当前存档拼本地快讯（最热的一对势力、最脏的辖区与读数、安定度档位、派遣栏里最难收尾的那条），`newsIsStale()` 判换日过期。
- [x] **存档**：`GameState.cityNews?`（`day` / `generatedAt` / `headline` / `items[]` / `source`），读档时过一遍 `sanitizeCityNews`，坏数据直接丢；新动作 `setCityNews`（传 null 清空）由 `rules/dailyOps.ts` 的 `applySetCityNews` 处理。
- [x] **数值规则开关**：`BalanceRules.cityNewsEnabled`（0 / 1，默认 1）；`BalanceField` 新增 `kind: 'toggle'`，世界书 → 数值页渲染成开关而不是数字框，并新增「城市新闻」分组与说明。
- [x] **生成任务**：`generateCityNews()` 走新 scope `news`（预设词条「城市新闻」+ 分区 `nw-brief` + 锁定契约 `newsContract()`），提示词里的城市数据全部来自 `{{night}}` / `{{factions}}` / `{{districts}}` / `{{hostility}}` / `{{council}}`；输出额度默认 1200；`LLM_BUDGET_TASKS` / `PROMPT_TASK_SCOPES` / `DEFAULT_PRESET_BINDING` / 设置页用途入口都补上这一档。
- [x] **派遣页**：`PageHeading` 右侧新增 `.heading-side`，装「城市播报」卡与原来的夜班徽标；卡上有标题、来源（叙事者 / 本地快讯）、4 条带色点的短讯与「刷新」按钮；窄屏自动堆到标题下方。
- [x] **自动生成**：换日时若开关开着且播报过期，先试叙事者，失败或没 Key 就用本地快讯落库；刷新按钮同一入口，失败时给出提示。
- [x] **每天 1–3 条**：契约、分区写法与清洗上限统一成 3 条（`CITY_NEWS_MAX`），本地快讯同样截到 3 条，只有标题没有条目的播报当作没生成。
- [x] **第一夜用开场那一条**：`OPENING_NEWS_DAY = 14`，`openingCityNews(day, playerName)` 给出「{名字}继承了事务所——它在多年沉寂后重新开张……」，新档开局即带这条；`newsIsStale` 在第一夜恒为 false，`refreshCityNews` 在第一天只补开场、不请求模型。
- [x] **电台口吻**：播报一律第三人称，不出现「你」；开场那条用委托人档案里的名字（没填时退回「新任所长」），生成提示词的 user 消息与 `nw-brief` 分区都写明「提到所长用他的名字」；改名后第一夜会自动重播一次。
- [x] 测试：新增 `tests/v50.test.ts` 八条（开关与夹取、本地快讯内容、第一夜开场、1–3 条上限、清洗规则、过期判定、存取与清空、预设档位齐全）；26 个测试文件 464 项全绿，`tsc` 0 错，`check:rules` 通过。

## v51 事务所档案与玩家档案：派遣页入口 + 双页签弹窗

- [x] **派遣页入口**：`dispatch-world-strip` 加第三列「事务所档案」卡（`#dispatch-office-card`），显示理念首句、对外代表、玩家名字与「编辑档案 →」；窄屏（≤1180px）折到势力栏下方，不挤三方卡片。
- [x] **双页签弹窗**：`OfficeDialog` 拆成「事务所档案 / 玩家档案」两页签（`#office-tab-office` / `#office-tab-player`）。事务所页保留原有背景 / 理念 / 目标与对外代表任命；玩家页新增名字、称呼、代词、外貌、性格、背景、与她们的关系七个字段（`#office-player-*`）。
- [x] **保存**：保存时先 `savePlayerProfile()` 再 `onSave(office)`，页脚按页签给出不同的落库说明（世界书 / 仅本地），并显示「已保存」。
- [x] 样式：卡片与 `.world-faction-card` 同一套边框、渐变与 hover；页签沿用设置页 `.settings-tab` 的观感（`.office-tab`）；`styles.css` 末尾追加，不动既有规则。
- [x] 回归：26 个测试文件 464 项全绿，`tsc` 0 错，`check:rules` 通过；世界书旧入口与浏览器验收用到的 `#office-*`、`#settings-player-*` 选择器全部保留。
## v52 开局编成直接定助手 + 势力等级统一

- [x] **助手位**：`setStarters` 动作新增 `assistantId`；`applySetStarters` 校验它必须在新名册里，缺省取第一位，并把她的好感抬到 `max(现有, 60)`，编成日志写明「她兼任助手与对外代表」。
- [x] **编成界面**：`StarterDialog` 在页脚上方新增「助手 / 对外代表」一栏，名册里的人排成一排 chip 可点选（`#starter-assistant-<id>`），默认沿用存档已有助手或名册第一位；选完人又被移出名册时自动回落。
- [x] **等级口径**：`factions.ts` 新增 `FACTION_LEADER_LEVEL = 10`、`FACTION_MEMBER_LEVELS = [8, 9]` 与 `factionLeaderLevel()` / `factionMemberLevel()`；`customGirlOf` / `customLeaderOf` 与 `sanitizeCustomGirl` / `sanitizeCustomLeader` 全部走这两个函数。
- [x] **内置数据**：`content/factionGirls.ts` 九位随从改成 8–9 级（每方一位 9 级、其余 8 级），首领本来就是 10 级。
- [x] 测试：新增 `tests/v52.test.ts` 三条（助手指派与好感 60、回落规则、等级口径与内置数据）；27 个测试文件 467 项全绿，`tsc` 0 错，`check:rules` 通过。
## v53 战斗札记补全上下文并暴露提示词

- [x] **`battleNote.ts`**：新增 `battlePlaceText()`（辖区、当主、污染读数、委托类型）、`battleTimeText()`（第几日几点开打、打到第几回合）、`battleGirlText()`（元素/职阶/等级/技能/特性 + 此刻的生命、心防、疲劳、侵蚀、疤痕、倒下时机）、`battleMonsterText()`（阶级、属性、习性、弱点、招式、倒下回合）。
- [x] **提示词搬进预设**：`promptSections.ts` 新增 `bt-brief`（scope `battle`）与 `battleContract()`；六个变量 `{{battlePlace}}` / `{{battleTime}}` / `{{battleGirls}}` / `{{battleMonsters}}` / `{{battleCast}}` / `{{battleReport}}` 由 `generateBattleNote` 现算后注入，代码只留 JSON 骨架、台词上限与数值禁令。
- [x] **接线**：`generateBattleNote(config, battle, preset?, state?)` 多收一个存档参数（App 传 `latestState.current ?? state`），修复请求同样带上下文；`chatJson` 用 `{ state }` 作为宏上下文。
- [x] 测试：新增 `tests/v53.test.ts` 五条（场地与时间、我方档案、敌方档案、契约与分区、拼装顺序）；28 个测试文件 472 项全绿，`tsc` 0 错，`check:rules` 通过。
## v54 分区补齐与完整剧情提示词暴露

- [x] **修迁移漏洞**：`PRESET_SCHEMA = 6`，`ensurePromptScopes` 对 schema ≥ 4 的预设只补缺失的 `SECTION_PROMPTS`（不重复加 `DEFAULT_PROMPTS` 里已有的），并同步写入 `promptOrder`；`builtinPresets()` 直接标最新 schema。v50 的城市新闻分区与 v53 的札记分区因此能在老预设里出现——之前运行时靠兜底注入，编辑器列表里看不到。
- [x] **完整剧情分区**：新增 `arc-brief`（scope `arc`）：只写本场主角的故事、三段上限、选项要分岔、tone / expression 规则、不写数值，并说明「这一次是写章节 / 开场白 / 续写」看数据段。
- [x] **三份契约**：`arcContract(targets)` / `arcOpeningContract()` / `arcTurnContract()` 保留 JSON 骨架、段落与台词数量、字数与 bond 上限等硬性要求；三处调用点改成「数据段 + 契约」，开场与续写不再互相污染。
- [x] 测试：新增 `tests/v54.test.ts` 四条（schema 5 → 6 补装分区与 promptOrder、默认词条里两块分区在、三份契约、拼装顺序与互不污染）；29 个测试文件 476 项全绿，`tsc` 0 错，`check:rules` 通过。
## 修：城市新闻闪一下就消失

- [x] **根因一（异步回写用了旧快照）**：`refreshCityNews` 等在 LLM 结果之后调用 `perform(setCityNews)`，而 `perform` 用的是渲染时捕获的 `state`——等待期间任何状态变化都会被这份旧快照盖回去。改成函数式更新 `setState(prev => act(prev, …))`，并改读 `latestState.current`。
- [x] **根因二（洗不出内容就删整块）**：`applySetCityNews` 原来在 `sanitizeCityNews` 返回 undefined 时 `delete next.cityNews`；模型偶尔给出半截条目就直接把播报删掉。现在只有显式传 `null` 才清空，洗不出来时返回 `ok:false` 并保留上一条。
- [x] **界面兜底**：新闻开关开着时这块就一直渲染，没有条目时显示「今晚的播报还在写」与一行占位，不再出现「先出现再消失」；第一夜重播开场前也比对标题与正文，避免同一条被反复写。
- [x] 测试：`tests/v50.test.ts` 的存取用例改为断言「洗不出来时保留旧播报、只有 null 才清空」；29 个测试文件 476 项全绿，`tsc` 0 错。
## 修：突发事件「模型没有给出可用的事件条目」

- [x] **根因**：`incident` 没有自己的输出预算，跟着统一值 2048 走，三条带选项的事件写不完 → 回复被 `length` 截断；`extractJsonObject` 在括号没闭合时会继续往里找 `{`，于是把**第一个选项对象**当成整份 JSON 返回，`raw.entries` 自然不存在，最终报「没有给出可用的事件条目」。
- [x] `extractJsonObject`：外层没闭合就只试剩下的尾巴，失败即判定「这次没给出 JSON」，不再滑进内层对象。
- [x] `chatJson`：识别到 `finish_reason: length` 就重试，**即使勉强解析出了对象**也重来；上一次被截断的结果不再当兜底，避免把半截数据交给调用方。
- [x] 预算：`DEFAULT_TASK_BUDGETS.incident = 3000`，批量事件调用再给 `tokenFloor 3000`（用户存的统一预算 / 预设额度偏低时也能拿到够用的额度）。
- [x] `incidentEntriesFrom`：容忍 `entries` / `incidents` / `items` / `events` / `data.*` 与「只给一条对象」的壳子，非对象条目丢掉。
- [x] 测试：新增 `tests/v55.test.ts`（截断不再返回半截、换壳子都能取到、突发事件预算 3000）；30 个文件 479 项全绿，`tsc` 与 `check:rules` 均通过。
## 修：PNG 契约卡导入不了

- [x] **根因**：「导入角色卡」这条口子自己写死 `file.size > 8_000_000`，而卡库扫描早就是 24MB。带立绘 + 魔女化 + 衣柜 + 表情差分的纯 PNG 卡是 10–22MB（`data/cards/` 里现成的六张超过 8MB），于是卡库收得进去、从文件导入反被判成过大。
- [x] 新增 `src/fileLimits.ts` 作为唯一出处：`CARD_FILE_BYTES_MAX`（24MB）、`SAVE_FILE_BYTES_MAX`（32MB，与存档位一致）、`formatBytes`、`cardFileGuard` / `saveFileGuard`。
- [x] `App.tsx` 两个闸口改用 guard，并报出真实体积；`CARD_BOX_MAX_BYTES`、`OPENING_CARD_BYTES` 都改成引用同一常量。
- [x] 存档导入的老 6MB 闸口一并改成 32MB（与 `SLOT_BYTES_LIMIT` 对齐），避免同类误杀。
- [x] 测试：新增 `tests/v56.test.ts`（十兆级 PNG 卡能过闸并解析、只有明显不是卡的文件才拦、三个上限同源）。
## 修：议会里助手那句的表情画在提案人脸上

- [x] **根因**：`CouncilView` 的大立绘固定取 `opinion.authorId`（提案人），只是把 `line.expression` 换上去。助手（琉音）笑着接话时，这张笑脸就贴在提案人（符玄）脸上。
- [x] 新增 `opinionSpeakerOf(state, opinion, line)`：先按 `line.speakerId` 解析说话人（名册 → 纪念堂 → 势力所属 → 首领 → 三方代表），解析不到才退回提案人。
- [x] 表情规则：解析得到说话人就用她那句的 `expression`；解析不到就退回提案人**本人**的表情，绝不照搬别人的表情。
- [x] 顺带修掉代表提案（`authorKind: leader`）立绘空白的问题：现在会退到该方代表/首领，侧栏卡片也显示代表本人。
- [x] 测试：新增 `tests/v57.test.ts`（助手那句换人换表情、本人表情、未知说话人不借表情、无对白、代表提案）。
## 修：委托的「危险度」和模板里写的不一样

- [x] **原因**：夜间委托的难度不是模板写的那一档，而是按辖区污染度重新抽的（`pickDifficulty`，v24 起的设定）。模板里的 `difficulty` 只当基线存进 `scaledFrom`，从不显示，于是同一张「高危」模板在干净辖区会变成「低危」，工坊投放测试看到的是高危、地图上是低危。
- [x] `pickDifficulty` 增加 `baseline` 锚点：辖区污染只在模板那一档**上下浮动一档**，高危模板不会再掉到低危；`makeCommission` 把模板档位当锚点传进去。
- [x] 新增 `missionBaselineNote(mission)`：实际档位与基线不同时，委托详情与地图列表会补一句「模板基线 高危」，玩家一眼能看出这是污染改写了档位。
- [x] 顺带修 `App` 里高危计数写成 `m.difficulty === '高'`（永远数不到），改成「高危 / 绝望」。
- [x] 测试：新增 `tests/v58.test.ts`（高危不掉低危、两端档位只浮动一档、无锚点旧行为不变、20 天 × 3 波 × 3 格的委托实际档位与基线最多差一档）。
## 修：灯下私语被截断、预设上限到底算不算数

- [x] **为什么截断**：灯下私语走的是「不写 JSON 的对话」通道，`params` 直接来自 `presetParams(runtime)`，而 `runtime.maxTokens` 已被 `taskRuntime` 换成输出预算（灯下私语默认 1200）。这条通道原来**没有**截断重试，回复被 `length` 砍断后，宽松解析器还洗出半条，于是显示「已生成（1 条）」且动作断在半句。
- [x] 新增 `isTruncatedFinish(finish)` 与 `truncatedRetryBudget(maxTokens)`：识别 `length` / `MAX_TOKENS`，截断就提额（至少翻倍、不低于 2400、封顶 32768）重来一次；`generateDialogue` 与 `generateWhisper` 两条路径都接上，日志里的请求快照同步换成实际发出的额度。
- [x] 灯下私语默认额度 1200 → 2400；提示词里的字数上限 420 → 300，与解析限制（每条 90、总 300）对齐，少写一点就不容易写断。
- [x] 预设「最大输出」的说明改成实话：额度由 设置 → 输出预算 决定，截断会自动放大重试（面板里本来就有 灯下私语 这一行输入框）。
- [x] 测试：新增 `tests/v59.test.ts`（截断判定、重试额度、默认额度、截断文本只洗出半条、说明文案）。
## 改：预设的上限也生效 / 属性加点改滑条

- [x] `taskRuntime`：输出额度改成「输出预算」与「预设自带最大输出」取较大者，再夹在 `BUDGET_MAX` 以内；没绑定预设时不算预设那一份（否则会退化到内置预设的 8000，白白放宽所有任务）。
- [x] 三处说明同步改成实话：预设「最大输出」的 hint、输出预算面板的说明、每行的小字补一句「与预设取较大者」。
- [x] 属性点：`+1` 按钮换成四条滑条（`girl-allocate-magic/insight/agility/empathy`，`type=range`），带「重置」与「确认加点 · N 点」；滑条单条上限 = min(剩余点数 + 本项已挂起, 120 − 当前值)，四项合计不超过剩余点数。
- [x] 新增动作 `allocateStats`（`applyAllocateStats`）：滑条一次提交四项、只克隆一次 state；点数不够时整批作废，不会半截生效。
- [x] 新增样式：`.allocate-row.slider`、`.allocate-actions`、`.allocate-delta`、`.llm-budget-hint`。
- [x] 测试：新增 `tests/v60.test.ts`（预设与预算取大、无预设不吃内置 8000、批量加点成功/失败原子性/封顶 120）。
## 修：1 级少女一单委托就升级

- [x] **原因**：委托经验按**委托的推荐等级**算（`battleExp(rec) = 30 + 10×(rec−1)`），而升级需求按**她自己的等级**算（`expNeeded(1) = 60`）。1 级少女去打推荐等级 4 的战斗委托，基础值正好 60 → 一单升一级；绝望委托（推荐等级 +2）更是一单能连升。
- [x] 新增 `missionExp(girl, recommendedLevel, kind)`：基础值照旧按推荐等级算，再按**她自己的等级需求封顶**——战斗最多 50%、调查最多 25%。封顶之内高难委托依旧给得更多。
- [x] `battle.ts` / `investigation.ts` 两处结算改走 `missionExp`；界面说明同步改成「一次最多给 50% / 25%，两次战斗或四次调查升一级」。
- [x] 测试：新增 `tests/v61.test.ts`（1 级打推荐 4 级战斗不升、两次才升、调查四次升、高难仍多于低难、满级 0）。
## 修：模板库推荐等级全是 3

- [x] **原因**：工坊新建模板时写死 `recommendedLevel: 3`（`baseMission`），库清洗的缺省值也是 3，于是危险度再高、魔物再多，模板上也只写着「推荐等级 3」。
- [x] 新增 `src/missionLevel.ts`：`suggestedLevel(difficulty, monsterCount)` —— 低危 2 / 中危 3 / 高危 5 / 绝望 7 起底，魔物超过 2 只每只加一档（最多加两档），并认蓝图四档（简单/常规/棘手/危险）。
- [x] 夜间委托：`recommendedLevel` 取「模板值」与「建议值」较大者（模板手写过更高的照用）。
- [x] 工坊：新建模板按难度与魔物数量给默认等级；改难度或改魔物时，只要这一项还停在自动值就自动跟着走，手改过的不动。
- [x] 库清洗：旧模板还停在 3 且难度不是中危的，按难度与魔物数量补正（中危保持 3，手写过的值不覆盖）。
- [x] 测试：新增 `tests/v62.test.ts`（建议值表、夜间委托不再统一 3、旧库补正三态）。
## v63-1 / v63-2：换日时机与弹窗事件（按 plan-v63.md 实施）

- [x] `shift.ts` 新增 `dayOf` / `minutesOf`：营业日只在 20:00 翻（00:00–02:00 仍算同一夜），公式从三处收成一处（`advanceClock`、`combat`、`endNight`）。
- [x] **修 `endNight` 的打烊边缘**：旧写法 `minutes < SHIFT_START || minutes >= SHIFT_END` 在「午夜后被拦住」时算出同一天，`advanceClock` 目标时间早于当前 → 静默 return，day 原地不动（看起来像午夜重开）。改成 `minutes >= SHIFT_START → day + 1`。
- [x] 委托分批投放**未改动**（按你的要求）。
- [x] **接上弹窗取用链路**：新增 `deployDueIncident()`（内置优先、模型待用池兜底），开门 / 每个时段 / 委托收尾三条路径全部改走它。`takeFromPool` 此前零调用，模型写的弹窗永远躺在池子里。
- [x] `sanitizeGeneratedIncident` 补齐触发器与类别：`trigger` 缺省按类别推导（report→dayStart、decision→wave 1、scene→missionDone），`kind` 与 `girlId` 不一致时降级成环境事件，`ttlMinutes` 夹在 60–480，`faction` / `district` 一起洗。
- [x] 新增 `incidentBatchContract()`：把突发事件的 JSON 形状、trigger 三选一、kind 三选一、出场角色白名单、效果幅度表、存活时长写进提示词（原来是硬编码字符串，且完全没有这些字段）。
- [x] 测试：新增 `tests/v63.test.ts` 七条（营业日只在 20:00 翻、跨午夜不刷新、开门刷新、午夜后打烊进下一天、池子条目按 trigger 投放、内置优先、触发器推导与降级）；顺手修 `game.test.ts` / `v24.test.ts` 里「把 report 也当有选项」的旧测试助手。
- [ ] 待做：v63-3（6 个结构契约 + 生成器字面量全部进预设、`PRESET_SCHEMA 7`、`prompt-lint` 测试）、v63-4（提示词全量视图 UI + 导入导出）。
## v63-3a：结构契约也进预设（可见、可改）

- [x] 新增 `src/promptContracts.ts`：10 条 `contract: true` 词条（daily / news / incident / battle / storyline / arc / arc:opening / arc:turn / chat / whisper），带 `defaultContent`（出厂文本）。
- [x] `PromptEntry` 增加 `contract` 与 `defaultContent`；`activePrompts` 与 `renderPresetSystem` 都跳过契约——它们不参与正文分层，只由 `composeTaskSystem` 作为最后一段注入。
- [x] `PresetRuntime` 增加 `contracts`（`presetRuntime` 填），`composeTaskSystem` 优先用预设里的契约；**只有玩家改过**（`content !== defaultContent`）才覆盖代码默认值，避免把带动态目标的契约固化成快照。
- [x] `PRESET_SCHEMA → 7`：内置预设与旧预设迁移都补上契约词条（只补不覆盖，幂等）。
- [x] `dialogueContract()` 进 `promptSections.ts`，`llm.ts` 的 `DIALOGUE_FORMAT_HINT` 改为调用它；`dailyContract` 由 `llm-night` 注册进契约表（避免 presets ⇄ llm-night 成环）。
- [x] 预设界面的契约词条带「结构契约 · 最后注入」角标，改了就按你写的走。
- [x] 测试：新增 `tests/v64.test.ts` 五条（契约词条齐备、改了就用预设、正文不重复、内置与 schema 7、迁移幂等不覆盖）；`game.test.ts` 三处计数断言改成「正文词条数不变 + 契约另算」。
- [ ] 待做：v63-3b（剩余生成器字面量：单条突发事件模板、storyline/arc 的 user 句、profile/outfit 契约；以及 `prompt-lint` 测试）、v63-4（提示词全量视图：按任务分组 + 改动标记 + 导入导出）。
## v63-3b / v63-4：字面量搬迁 + 已改标记 + 只减不增闸门

- [x] 又搬了 5 段进 `promptSections.ts`：`whisperUserHint()`、`outfitContract()`、`eventUserHint()`、`arcUserHint(kind)`，`llm.ts` 里对应调用改成函数。
- [x] 预设界面：普通词条与契约词条都带「已改」角标（契约比 `defaultContent`，普通词条比 `DEFAULT_PROMPTS` / `SECTION_PROMPTS` 的出厂文本），工具栏显示「已改 N 条」，一眼看出哪些被你自己动过。
- [x] 新增 `tests/prompt-lint.test.ts`：`src/llm.ts` / `llm-night.ts` / `nightSpec.ts` 里的提示词字面量**只减不增**（当前 7 处，全部列出），搬完一处就把 BUDGET 改小；另有「函数都在位」的断言。
- [ ] 还剩 7 处字面量（都在 `llm.ts` / `llm-night.ts`）：`JSON_RETRY_MESSAGE`、角色起草 / 故事线起点 / 战斗札记 / 单条突发事件 / 故事蓝图 的 JSON 形状段、`dailyContract` 的 JSON 形状行。下一步继续搬，闸门数字往下调。
- [ ] v63-4 余项：全量视图仍按任务页签分组（已有「全部」页签 + 已改计数），若要一屏平铺全部任务，再做分组折叠。
## 修：同一个人反复提相似的议案

- [x] **原因**：每日提案的提示词里只有**待议**的议题（`{{council}}`），已经决议过的题目模型一无所知，于是同一个作者连着几晚写同一个角度。
- [x] 新增 `src/opinionHistory.ts`：`recentOpinions()`（最近 8 天、默认 12 条）、`opinionHistoryText()`（`第 N 日｜作者｜主题｜「标题」｜结论`）、`dailyHistoryBlock()`（带「不要重复」与「换法」两块）、`repeatsRecentOpinion()`。
- [x] 每日提案的 user 消息尾部固定拼上 `dailyHistoryBlock()`：所有预设都吃得到，不依赖玩家有没有改词条。
- [x] 新增宏 `{{opinions}}` / `{{opinions:6}}`（「事务所与城市」分组），想自己放到词条里也能用。
- [x] `dailyContract()` 补一条硬规则：同一作者不要重复最近提过的议题，同题重提会被本地校验拦下。
- [x] 校验层兜底：`parseOpinion` 里同作者同名议题直接判错 → 修复轮会把历史清单再发一遍，逼它换角度或换人提。
- [x] 测试：新增 `tests/v66.test.ts` 五条（历史格式、窗口与条数、喂给模型的那块、撞题判定、宏展开）。
## 修：蓝图强制弹窗缺少触发条件

- [x] **问题**：蓝图 incident 节点的 spec 只有 kind/title/body/faction/district/options，**没有触发时机、没有超时、没有「拦不拦打烊」**；运行时（`rules/storyRun.ts`）走到节点就 `unshift` 一张无 trigger 的卡，按 `blockingIncidents` 的规则永远拦时间、永不自动过期。提示词里也没写这一层，模型只能猜。
- [x] `StoryIncidentSpec` 新增 `trigger`（immediate / dayStart / wave）、`ttlMinutes`（30–480，默认 240）、`blocking`（默认 true）；`Incident` 新增 `blocking`。
- [x] `sanitizeGraph` 收下三个字段并夹住范围；`makeNode` 的新节点默认 `immediate / 240 / true`，工坊新建即可见。
- [x] `storyRun` 投放：immediate 立刻上桌；dayStart / wave 先进待用池，由开门与时段两条路径投放；都带上 `ttlMinutes` 与 `expiresAt`。
- [x] `blockingIncidents` 认 `blocking === false`（纯通报不挡时间）；弹窗超时后若属于某条故事线，会 `resolveStoryWait(..., 'failure')` 让剧情沿 out 继续，不再永久卡死。
- [x] 提示词（`sl-draft` 的 incident 段）补上三个字段与写法建议：要当场答复用 immediate；纯通报写 blocking=false 且不给选项；ttl 别把必须处理的卡写成 30。
- [x] 工坊蓝图编辑器（`StoryGraphDialog`）补三个控件：触发时机下拉、超时分钟、拦住打烊开关（`story-graph-incident-trigger` / `-ttl` / `-blocking`）。
- [x] 测试：新增 `tests/v67.test.ts` 四条（默认值、手写值夹范围、blocking=false 不拦时间、新节点默认字段）。
- [ ] 已知边界：dayStart / wave 的弹窗先进池子，池子条目本身没有过期计时，靠被投放时才开始计时；若那条故事线一直等不到对应时段，会停在那张卡上（下次同触发点会继续）。
## 修：故事线里第二种强制弹窗（委托收尾追加卡）没写进提示词

- [x] **缺口**：蓝图里其实有两种强制弹窗——`incident` 节点（上一轮已补 trigger/ttl/blocking）与 `mission.followUpIncident`（委托结算后紧接着弹出来的那张卡）。后者提示词里**一个字没提**，而且 `sanitizeGraph` 是原样透传，字段与幅度都没审过。
- [x] 新增 `sanitizeIncidentPayload(raw)`（`storygraph.ts`）：节点与追加卡共用一套洗白——title/body 缺一即丢，kind 三选一，options 最多三条且 id 固定 o1–o3，ttl 夹 30–480，blocking 缺省 true，trigger 认 dayStart / wave（wave 夹 0–2）。
- [x] mission spec 的 `followUpIncident` 改为走这套洗白；`storyRun` 投放时补上 `ttlMinutes` / `expiresAt` / `blocking`，超时同样沿剧情继续。
- [x] 提示词（`sl-draft` 的 mission 段）补 `followUpIncident`：写法和 incident 节点完全一样、没有出边、只在「委托刚放下桌上就多一件事」时写；纯通报加 `blocking:false` 且不给选项；需要玩家先做选择就用 incident 节点。
- [x] 测试：新增 `tests/v68.test.ts` 五条（标题正文缺一即丢、trigger 与 ttl 夹住、选项最多三条、委托节点上的追加卡能洗出来、坏卡整张丢弃不影响蓝图）。
## 改：角色事件界面套用战斗札记的版式

- [x] `EventDialog` 的交互剧情改成三栏舞台：左侧所长（虚线占位 + 「你」）、中间旁白与台词、右侧在场角色长条立绘；底部选项、行动输入框、结束按钮原样保留。
- [x] 立绘卡沿用战斗札记的语言：3:4.2 长条、底部表情角标、有人说话时描边发光（`.event-portrait.speaking`）、名字 + 身份两行。
- [x] 新增 `.event-stage` / `.event-rail` / `.event-portrait` / `.event-center` 一套样式（`dialogs.css`），窄屏（≤980px）自动收成单列并隐藏侧栏。
- [x] 保留全部既有 id（`#event-close`、`#story-action`、`#story-submit`、`#story-end*`、`#story-option-*`、`#story-rewrite-*`），浏览器流程脚本不用改。
- [ ] 视觉验收：本机沙箱里 Chromium 起不来（spawn EPERM），没能截图自查；需要你刷新页面看一眼两侧立绘的宽度与中间文字的可读性。
## 改：角色事件直接复用战斗札记的全屏 UI

- [x] `StorySession` 不再自建三栏，直接套 `.battle-note-overlay` / `.battle-note-shell` / `.battle-note-head` / `.battle-note-stage`：全屏、同一套头部（标题 + 来源角标 + 关闭）、同一套侧栏立绘。
- [x] 阵营对调：**左侧 = 在场角色**，**右侧 = 所长**（虚线占位 + 「你」）；台词气泡按发言侧左右分（玩家在右）。
- [x] 中间沿用 `.battle-note-body` 的旁白与 `.battle-note-line` 气泡，底部新增 `.event-composer`（快捷选项 + 行动输入框 + 行动 / 结束事件），贴在中间列底部。
- [x] `App` 里交互剧情不再包 `.story-overlay`：那层带 `backdrop-filter`，会让里面的 `position:fixed` 以它为包含块，全屏会打折扣；`SceneEvent` 仍走旧居中弹窗。
- [x] 只补了必须的几条样式（`.event-center`、`.event-composer`、`.event-player-art`、`.battle-note-line.player-turn`），其余全部复用战斗札记。
- [ ] 视觉验收仍待你刷新页面确认（沙箱里 Chromium spawn EPERM，无法截图）。
## 加：叙事者完成提示音

- [x] 新增 `src/audio.ts`：WebAudio 现场合成两声短音（成功上行、失败下行），不需要音频资源；350ms 内连击只响一次（批量任务不炸耳朵）；没有 AudioContext 的环境静默跳过。
- [x] `llm.ts` 新增 `onLlmFinished(listener)`，在 `recordLlmLog` 收尾时通知一次——所有叙事者操作（提案、新闻、私语、战斗札记、突发、蓝图…）都自动覆盖，重试不会被算成两次。
- [x] 设置 → 通用新增「叙事者提示音」开关（`#settings-llm-chime`），默认开，存 localStorage（`night-sugar:llm-chime`）；连接测试不响。
- [x] 测试：新增 `tests/v69.test.ts` 三条（该不该响的判定、无 localStorage 的默认值、无 AudioContext 时空操作不抛错）。
## 修：战报摘要把「眩晕」渲染成角色对自己施放

- [x] **原因**：心防被打穿时 `combat.ts` 会记一条伪动作（`skillId: "stunned"`、`actor` 与 `targets` 同一个人）。`battleStoryDigest` 按普通事件渲染，就成了「Es对Es使用「眩晕」（支援）」——模型看到的是「她给自己上了一个支援技能」。
- [x] `battleNote.ts` 的 `describe()` 认 `skillId === "stunned"`：改成状态句「X的心防被打穿，陷入眩晕（本轮无法行动）」，不再走支援/攻击两个分支。
- [x] `battleContract()` 补一条硬规则：眩晕是状态不是技能，不许写成「X 使用眩晕」。
- [x] 测试：新增 `tests/v70.test.ts`（眩晕写成状态、被削心防的攻击与「击中多人」照旧、真支援仍走支援句式）；`v53` 的「契约排最后」断言改成按 `battleContract()` 最后一行比对，以后改契约不会再误伤。
## 修：存档 57MB 存不进存档位

- [x] **根因**：立绘 / 衣柜 / 魔女化立绘早已搬进 IndexedDB 资产（`portraitAsset`），但**表情差分**（`importedVariants`）仍是内联 data URL：四套服装 × 六种表情 × 每张几十万字符，一个角色就能顶十几兆。57MB 里绝大部分是它。
- [x] 新增 `src/saveSize.ts`：`measureState()` 按区块量体积（每个角色的差分 / 衣柜 / 魔女化 / 立绘引用分开算），`describeStateSize()` 给出前三名。存不进去时的提示现在会写「最大的几块：琉音 · 表情差分 12MB；…」。
- [x] 新增 `src/saveSlim.ts`：体积超过上限 80% 时，保存前把 >90KB 的差分重编码成 640px WebP（有损、只动偏大的图），并把省下的字节写进提示。没有 canvas 时整体空操作，绝不因为瘦身失败挡住存档。
- [x] 单槽上限 32MB → **96MB**；文件导入上限 `SAVE_FILE_BYTES_MAX` 同步放宽（否则导出的存档自己导不回来）。
- [x] 测试：新增 `tests/v71.test.ts` 四条（体检排序、该不该压的判定、无 canvas 空操作、两个上限一致）。
- [ ] 待办：真正的根治是让 `importedVariants` 也走资产（`portraitAsset` 那套），渲染层已在用资产解析；那样存档里只剩几百字节的键。等这轮体积问题确认缓解后再动。
## 修：角色剧情里台词全堆在正文后面

- [x] **原因**：`StoryLine` 只有 `speakerId/speakerName/expression/text/mode`，没有位置字段，渲染只能「先说完全部旁白、再列全部台词」——和战斗札记当初的问题一模一样。战斗札记是靠 `after`（插在第几段旁白之后）解决的，这里补齐同一套。
- [x] `StoryLine` 新增 `after?: number`（0 = 段落最前面）；`parseStoryLines` 收下并夹住；`arcTurnContract()` 把 `after` 写进 JSON 形状，并要求「台词必须贴着它回应或打断的那一段」。
- [x] 新增 `src/storyLines.ts`：`interleaveTurn(paragraphs, lines)` 按 `after` 交织；**没写 after 时均匀铺开**（老存档与没跟上的模型也不会整段塌在结尾）。
- [x] `EventDialog` 的旁白/台词改成按交织结果渲染，玩家台词仍靠右、心声与表情预览照旧。
- [x] 测试：新增 `tests/v72.test.ts` 四条（按 after 插、没写时铺开、越界夹到两端、解析保留 after 且丢弃不在场的说话人）。
## 修：角色剧情提示词里「（本任务没有指定主角）」

- [x] **原因**：`{{heroine}}` / `{{history.*}}` 都靠 `MacroContext.focus` 取人。`generateStoryTurn`（角色剧情的续写这一条）调 `callJson` 时**根本没传 ctx**，`generateStoryline` 也没传——于是宏展开成「（本任务没有指定主角）」。开场白与蓝图那两条早就传了 `{ state, focus }`，只有续写漏了。
- [x] 新增 `src/storyFocus.ts`：`focusGirlOf(state, event)` 统一判定主角（事件主人 → cast 第一位 → 名册里第一个能出勤的人）。
- [x] `generateStoryTurn` 补 `{ state, focus: focusGirlOf(state, event) }`；`generateStoryline` 补 `{ focus: girl }`（它没有 state 形参，且当前没有调用方；真要启用得先加 state）。
- [x] 测试：新增 `tests/v73.test.ts` 三条（优先级、兜底、带 focus 时渲染真名 / 缺 focus 时才是截图里那句）。
## 修：玩家行动在剧情里出现两次

- [x] **原因**：契约允许模型写 `speakerId: "player"` 的台词（原话是「player 的台词只能来自所长这一次的行动」），而界面本来就会把玩家这一轮的行动渲染成右侧气泡——于是同一句话出现两条：一条是模型复述的（常带【一边说着一边…】这类旁注），一条是系统记录的原文。
- [x] `parseStoryLines` 直接丢掉 `speakerId === "player"` 的台词：玩家说什么由他自己的行动气泡承担。
- [x] 契约改成「speakerId 只能取在场的少女，**不要写 player**（所长这一轮的话与动作已由系统显示）」，并把原来那句「不要替他编新话」改成「也不要把所长这一轮的动作复述成一句台词」。
- [x] 测试：新增 `tests/v74.test.ts` 三条（player 台词被丢、少女台词与 after/心声照旧、契约措辞）；`v34`/`v54` 两处旧断言跟着更新。

## v75-1：档案里的外貌 / 服装描述可编辑

- [x] 新增动作 setProfileText（ield: appearance | outfitDescription）：抹平换行、限长 240、允许清空、写一条 base 日志。
- [x] 档案 → 外观装备页顶部加两个文本域（#dossier-appearance-input / #dossier-outfit-input），草稿 + 失焦提交，与性格输入同一套交互。
- [x] 	ests/v75.test.ts 两条；方案见 	asks/plan-v75.md。


## v75-4（记作 v76）：自动生成只在换日触发

- [x] 新增 src/autoGenerate.ts 的 shouldAutoGenerate()：日号跟着存档走（state.generatedDay），缺字段按「就是今天」处理，读档不补发。
- [x] App 的自动生成 effect 改走它，并在发请求**之前**把 generatedDay 写进存档——失败也不会在读档时反复重放；顺手删掉原来的 lastGeneratedDay ref。
- [x] 初始状态与空白档案都把开局日记成「已补过」（首夜仍走 openingFilledAt）。
- [x] 	ests/v76.test.ts 两条。
- [ ] v75-2（战后癖好进简报）按你的要求推后；v75-3 / v75-5 / v75-6 继续排。


## v77：提案不全是花钱，两人议题要互相反驳

- [x] 契约两条：至少一条不花钱的提案；两人议题 dialogue 里两人都要说话，第二个必须反驳或加码。
- [x] 校验 warn：三条提案所有选项都在扣星砂时提醒（不拦下）。导出 `shouldWarnAllSpend()`，`tests/v77`。

## v78：立绘缺失可以重新载入

- [x] `src/portraitReload.ts`：`portraitMissing()` / `girlsMissingPortrait()`（空串与外链都算缺）。
- [x] 动作 `setPortrait`（只收 data URL，`sanitizePortraitSrc` 把关；空串＝清空），带日志。
- [x] 档案 → 外观装备页工具条：`#dossier-portrait-reload` 选图 → `resizeImageFile` → `setPortrait`；缺图时提示「立绘缺失，补一张就好」。
- [x] `tests/v78` 两条。
- [ ] 后续：名册卡片角标、从卡库按 cardId 自动取回。

## v79：势力首领召见（弹窗事件）

- [x] 数值规则新增「势力」两项：`leaderSummonChance`（0–100，默认 40）、`leaderSummonCooldownDays`（1–14，默认 3），随 `BALANCE_FIELDS` 自动进世界书。
- [x] `src/rules/summon.ts`：`summonRollsToday()` 按日号离散滚动（读档不重掷）+ 冷却记在 `incidentCooldowns`；`summonFactionToday()` 三方轮转；`buildSummonEvent()` 造一个只出场首领的 `session` 事件。
- [x] `endNight` 打烊后调用 `maybeSummon()`：塞事件、记冷却、写一条日志。
- [x] `storyCast` 认得首领 id（`leaderById`），召见弹窗里能出现首领本人。
- [x] `tests/v79` 两条。
- [ ] 后续：`{{leader}}` 宏与「每日至少一条首领提案」的名额校验，等这轮实际玩过再加。

## v80（方案已写，未开工）→ `tasks/plan-v80.md`

1. 原创角色语料（tone / habits / samples）进简报与起草接口，预设同步加契约；
2. 所长立绘与六格表情差分（档案新增「所长」页 + 交互剧情头像）；
3. 市场装备显示数值与用处（`itemStats.ts` 一个渲染器，市场与装备列表共用）。

## v80 完成情况（对应 `tasks/plan-v80.md`）

- [x] v80-1 语料：GirlVoice + voice.ts（sanitizeVoice / voiceLine）、接进 girlBrief 与档案、
      预设新增「角色起草 · 语料契约」、档案与自定义建人两个入口、`tests/v80`。
- [x] v80-2 所长立绘：PlayerProfile.portrait / portraitCrop / expressions（存本机不进存档）、
      directorPortraitOf 回落链、DirectorPortrait 组件接进交互剧情、设置里传图与六格差分、`tests/v80b`。
- [x] v80-3 装备数值：itemStats.ts（itemStatLines / itemEffectSummary）接进市场货架、
      货架标题右侧摘要、validGeneratedItem 要求至少一项数值或效果、`tests/v80c`。
- [ ] 后续可做：装备列表（AuxViews 的装备栏）也用同一渲染器；同槽位「+6 → +9」差值；
      所长立绘的裁剪拖拽界面（现在只存了 crop 数据，没有拖动条）。

## v163：Boss 专属技能边界（`tasks/plan-v163.md`）
- [x] `sanitizeLibrary` 拆公共池 / Boss 池：装备与普通魔物不能再引用 `boss-*`，Boss 模板照常可用。
- [x] `sanitizeCustomLeader` / `sanitizeCustomGirl` 过滤 Boss 技能，旧存档里的名册快照也会被清掉。
- [x] `tests/v163` 七条；全量 818 通过。
- [ ] 后续：战斗层兜底（旧档里已物化的 `state.customMonsters` / 装备）按本次范围暂不做。

## v164：流派被动技能（`tasks/plan-v164.md`）
- [x] 18 条被动进同一张技能表（`tier: 'passive'`）：六流派各 2、魔物 2、通用 4。
- [x] 混选上限：候选 30% 带 1 条、自定义建人 / 契约卡 / 工坊魔物 / 名册最多 1 条；装备与 Boss 阶段不收被动。
- [x] 战斗接入：常驻修正 + 开场 / 回合开始 / 命中 / 受击 / 击杀五个触发点，出招器过滤被动。
- [x] `tests/v164` 十条；全量 828 通过。
- [ ] 后续：内置初始角色与内置魔物暂不手写被动；等实战数据再决定示范挂载。
## v165：委托报酬与经验重算（`tasks/plan-v165.md`）
- [x] 星砂：队伍机会成本（300/人/小时）+ 治疗准备金 + 难度风险倍率；战斗按 1/2/3 人编成，4 只起叠加多怪加成。
- [x] 经验：战斗按魔物阶级/数量 × 时长，调查按难度 × 时长；二次等级曲线，单次最多升 1 级。
- [x] 标准委托生成、投放、标注、初始 12 条与旧档 open 委托统一走公式；Boss / 势力 / 剧情保留作者值。
- [x] `tests/v165` 九条，`v61` 与既有报酬断言已更新；全量 836 通过。
- [ ] 后续：按实战观察调整风险倍率与治疗准备金；工坊作者不能再手填最终报酬。

## v166：设置面板整理（`tasks/plan-v166.md`）
- [x] 设置拆成偏好 / 所长档案 / 叙事引擎 / 内容 / 存档与数据五页；标题页只留前三页。
- [x] 事务所档案并入所长档案页；新增本地默认值，新开局自动带入，旧存档不被覆盖。
- [x] 契约卡库移到设置标题旁；生成与自动补充移到内容页；测试连接回到连接分区。
- [x] `tests/v166` 两条，浏览器测试按新页签导航；全量 838 通过。

## v169：自定义起草的被动改成掷骰（`tasks/plan-v169.md`）
- [x] 起草提示词只列主动技能，不再写「最多 1 条被动」；模型塞进来的被动直接丢掉。
- [x] `rollPassiveSkill`：三条主动里三成概率换一条被动，本流派优先、其次通用，先换基础位；最多 1 条。
- [x] `pickCandidateSkills` 加 `withPassive` 开关，缺技能补位时只抽主动，不再把被动混进来。
- [x] `tests/v169` 四条；全量 842 通过。

## v186：蓝图开场白回归修复（`tasks/plan-v186.md`）
- [x] 抽出 `shouldAutoOpenStory`：蓝图 opening 非空也算可开场，不再干等 playerSeed。
- [x] App 自动开场门槛改用该函数；约谈 / 会议无 opening 的流程保持不变。
- [x] `tests/v186` 五条；全量 849 通过，`check:rules` 与 `tsc -b` 通过。
- [ ] 后续：若希望蓝图事件也先让玩家写开场，再单独改 EventDialog 的 empty 口径。
## v187：天气变化与提示词（`tasks/plan-v187.md`）
- [x] 六种天气，每夜三段（20:00 / 22:00 / 00:00），由 `(day, 段号)` 哈希取定；不新增存档字段。
- [x] 天气并入 `missionSnapshot` 的环境快照：目标、报酬、伤害、敌人生命、疲劳、精神流失与战斗共用一份口径。
- [x] 顶栏天气与下一段预告、地图天气层与 chip、委托详情标注「发布时」天气。
- [x] 提示词：`{{weather}}` 宏 + 共用分区「环境·天气」，预设 schema 7 → 8 自动补齐。
- [x] 数值规则新增「天气影响强度」；0 时天气只影响文案。
- [x] `tests/v187` 九条；全量 858 通过，`check:rules` 与 `tsc -b` 通过。
- [ ] 后续：季节（28 天一轮）按四季表另开一版。
- [ ] 后续：天气对市场货源与事件池权重的重排。
