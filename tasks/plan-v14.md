# v14 战斗札记：多人战斗叙事与独立预设

## 1. 目标

把战斗结束后的逐轮战报，写成一篇可以阅读的「战斗札记」：

- 仍然是完整故事的结构：开场、分段、对白、收束，不是流水账。
- 因为一场战斗有多名契约者，界面改成中间文本、左右立绘的全屏舞台；当前说话者亮起，并按台词切换表情。我方在左，敌方在右。
- 未来的魔法少女对战中，敌方也使用同一套立绘、阵营与表情通道；当前魔物没有立绘，只出现在旁白和威胁条里。
- 战斗札记有独立的预设用途与预设标签页，不和完整剧情、私人事件共用提示词。
- 札记只解释已经发生的战斗，不改写结果、数值、疤痕、奖励或死亡。
- 没有 API Key 或生成失败时，仍能用本地战报生成可读的「简报版」，不把玩家挡在空白页前。

非目标：

- 不做战斗中的实时对话，也不做可选择的战后分支。
- 当前魔物素材没有立绘；本版不补魔物美术，但舞台与数据模型必须为未来的魔法少女敌人预留立绘、阵营与表情。
- 不新增角色、装备、奖励、辖区或规则。
- 不自动消耗 API：第一次打开札记时由玩家点「写这一战」。
- 不重写现有战斗结算，也不把 `BattleState` 变成叙事状态。
- 不引入新依赖，不新增后端；札记跟现有存档一样存在浏览器 `localStorage`。

## 2. 现状与缺口

| 模块 | 现状 | 缺口 |
| --- | --- | --- |
| 战斗记录 | `src/components/BattleReport.tsx` 有「回放 / 战报」两页 | 没有叙事入口，也没有札记数据 |
| 完整剧情 | `src/components/StoryPlayerDialog.tsx` 是单角色、分幕、每幕选项 | 不支持多人同台，也没有「只读回顾」模式 |
| 立绘 | `src/components/GirlPortrait.tsx` 读取 `girl.expression`，程序化 SVG 支持六种表情 | 不接受外部 `expression`；导入的单张立绘没有表情差分。`BattleUnit` 有 `portrait/color/name`，但敌方没有可复用的 `Girl` 展示对象；本版把入参收窄为 `PortraitSubject` 解决 |
| 预设 | v13 已有 9 种用途、8 个任务、按任务标签页 | 没有 `battle` 用途，也没有「战斗札记」任务预设 |
| 世界书 | `src/worldbook.ts:47` 有「战斗札记」设定词条 | 只是设定，没有生成器与界面 |
| 旧计划 | `tasks/plan-v7.md` 的 M6 计划过 1000–1800 字、双入口、无 Key 兜底 | 从未实现 |

`StoryPlayerDialog` 绑定 `CharacterEvent` 的 `passages`、`choices`、`chosen`，直接改造成多人札记会把剧情选择、存档推进和现有 52 组浏览器流程一起拖进来。**本版不抽共享运行时组件**，只共享 `GirlPortrait`、字体、颜色变量和少量舞台 CSS；札记使用独立的 `BattleNoteDialog`。等两套舞台都稳定后，再考虑抽 `NarrativeStage`。

## 3. 体验流程

```
战斗结束
  └─ 战斗记录（回放 / 战报）
       ├─ 顶部「战斗札记」按钮
       ├─ 战报里的「让叙事者写这一战」卡片
       └─ 记录页战斗档案里的札记书签
            ↓
      全屏札记舞台
       ├─ 没有札记：封面 + 编队 + 预计篇幅 + 生成按钮
       ├─ 生成中：叙事者正在整理回合
       ├─ 成功：中间文本、左右立绘、逐句表情
       └─ 失败 / 无 Key：本地简报版
```

入口有三处，但都落到同一份 `BattleNote`：

1. **战斗记录顶部**：`#battle-note-open`，不切换当前「回放 / 战报」页，直接打开全屏札记。
2. **战报页**：结果卡下方加一张「战斗札记」卡；没有札记时按钮是「让叙事者写这一战」，有札记时是「展开札记」。
3. **记录页战斗档案**：最近 6 场里有札记的战斗多一个书签按钮 `#records-note-${battle.id}`，可以直接打开；点整行仍然打开战斗记录。

第一次打开没有札记时**不自动请求**。封面明确写出「约 1200–1800 字 · 只改写叙述，不改战斗结果」，玩家点击后才生成。这样不会因为每场战斗都自动调用模型而烧额度。

## 4. 数据模型

### 4.1 `BattleNote`

放进 `src/types.ts`，由 `src/battleNote.ts` 做校验与本地简报：

```ts
export interface BattleNoteLine {
  /** 这句话发生在第几轮，用于校验倒下的角色不会继续说话。 */
  round: number;
  /** 有立绘的 girl.id；当前版本通常是我方，未来可包含敌方魔法少女。 */
  speakerId: string;
  /** 与 speakerId 配对，避免敌我同 id 或模型左右站错。 */
  speakerSide: 'ally' | 'enemy';
  expression: Expression;
  text: string;
  mode?: 'speech' | 'thought';
}

export interface BattleNoteScene {
  id: string;
  roundFrom: number;
  roundTo: number;
  title: string;
  narration: string;
  lines: BattleNoteLine[];
}

export interface BattleNote {
  battleId: string;
  title: string;
  hook: string;
  summary: string;
  scenes: BattleNoteScene[];
  source: 'llm' | 'template';
  charCount: number;
  createdAt: string;
  model?: string;
  presetId?: string;
}
```

不存立绘、不存角色名、不存数值快照。显示时按 `speakerId + speakerSide` 解析：我方优先从 `state.girls` 取当前角色，敌方从 `BattleUnit` 的 `girlId/portrait/expression` 取；找不到角色就退回 `BattleUnit` 的名字与立绘，避免角色退役、改名或敌方单位离场后整篇札记打不开。

### 4.2 `GameState`

```ts
battleNotes?: BattleNote[]; // 最多 20 条，与 battles 对齐，一场战斗只有一条
```

- `createInitialState` 与空白存档写入 `battleNotes: []`。
- `loadState` 对旧存档使用 `battleNotes ?? []`，逐条 `sanitizeBattleNote`，只保留仍能在 `battles` 里找到的 `battleId`，再截到 20 条。
- **不提升 `GameState.version`**：这是可选字段，沿用 `version: 11`，避免为了一个只读展示字段强制重置存档。
- `recordBattle` 在 `battles` 截到 20 条后，同步过滤 `battleNotes`，防止札记指向已经被淘汰的战斗。
- 单条札记约 2–4 KB，20 条约 40–80 KB，不会明显撑大现有存档。
- 持久化沿用现有 `localStorage` 自动存档；没有后端，也没有跨设备同步。

### 4.3 Action

在 `GameAction` 里增加：

```ts
| { type: 'saveBattleNote'; note: BattleNote }
| { type: 'deleteBattleNote'; battleId: string }
```

`saveBattleNote`：

- `battleId` 必须存在于 `state.battles`，否则返回失败。
- 同一 `battleId` 直接替换旧札记，不产生第二条。
- 写入后按 `createdAt` 倒序保留 20 条。
- 只改 `battleNotes`，不碰 `battles`、`girls`、`gold`、`scars` 或 `memorial`。

`deleteBattleNote` 只删除札记；战斗记录仍然保留。删除后战报页回到「还没有写」状态。

### 4.4 敌方魔法少女兼容

当前魔物没有立绘：`MonsterTemplate` 只有 `spec`（bodyPlan/palette/aura），`BattleUnit.portrait` 存的是 `monster.id`，不是图片地址。未来引入魔法少女对战时，不能把 `monster.id` 直接塞进 `<img>`，也不能等到那时再改札记结构。

本版只在 `BattleUnit` 增加可选展示字段，不参与任何结算：

```ts
girlId?: string;        // 敌方魔法少女的 girl.id；魔物没有
codename?: string;      // 敌方姓名牌第二行
expression?: Expression; // 当前表情，用于舞台初始状态
portraitSpec?: PortraitSpec;
```

- `unitFromGirl` 顺手写入 `girlId/codename/expression`；我方仍从 `state.girls` 取最新角色。
- 未来的 `unitFromEnemyGirl` 写入 `girlId`、`portrait`（data URL 或资源路径）、`color`、`expression`；`uid` 仍用 `enemy-${girl.id}`。
- **只有带 `girlId` 且 `portrait` 非空的单位可以成为 `BattleNoteLine` 的说话者**。魔物没有 `girlId`，永远只能出现在旁白里，不会突然有了人格。
- 敌方女性单位出现在右侧敌方位；没有 `girlId` 的魔物不占主舞台立绘位，只在右上角「敌方」条里显示名称与数量。
- 这套字段只影响战斗记录/札记的展示；不增加敌方 AI、奖励、掉落或战斗规则。

## 5. 生成

### 5.1 输入

`generateBattleNote(config, battle, state, preset?)` 使用 `battle` scope，输入一份紧凑但完整的战报摘要：

- 战役头：委托名、日期、开始时间、结果、轮数、种子。
- 我方编队：每名 ally 的 `girlId`、姓名、代号、元素、性格关键词、当前 HP/精神/疤痕/是否倒下。
- 敌方编队：有 `girlId` 且 `portrait` 非空的魔法少女给 `girlId/姓名/代号/元素/性格关键词/表情/HP/是否倒下`；魔物只给名称、规格、数量与威胁感，明确标注「不可说话」。
- 逐轮事件：轮次、行动者、技能名、目标、命中/落空、资源变化、效果、备注；只给叙事需要的字段，不给公式与随机数细节。
- 每人统计：造成、承受、治疗、控制、击倒，以及第一次倒下的轮次。
- 战后：疤痕、致命、奖励、队内关系（只取本场小队之间的数值）。
- 文风：只给关系与处境，不把完整角色卡塞进去，避免模型写成设定集。

事件很多时按轮压缩：保留每轮的首尾、击倒、治疗、倒下、致命与技能命中；普通重复攻击合并为一句「双方在货架间来回试探」。

### 5.2 输出契约

代码契约仍然最后追加，预设词条不能覆盖字段、枚举和预算。模型只返回：

```json
{
  "title": "潮声里的最后一箱",
  "hook": "战斗结束后，货舱里只剩潮水与没搬走的货。",
  "scenes": [
    {
      "roundFrom": 1,
      "roundTo": 2,
      "title": "货舱与潮声",
      "narration": "……",
      "lines": [
        {
          "round": 1,
          "speakerId": "girl-id",
          "speakerSide": "ally",
          "expression": "calm",
          "text": "……",
          "mode": "speech"
        }
      ]
    }
  ],
  "summary": "……"
}
```

`scenes[].id` 由本地生成（`scene-1`、`scene-2`…），模型不返回；`title`、`hook`、`summary` 必须非空。

硬约束：

- 3–5 场；1–2 轮的短战可以 2 场，允许同一轮拆成两个节拍。每场必须覆盖连续回合，合起来覆盖 `1..battle.rounds`，不能跳轮。
- 总字数目标 1200–1800；短战最低 900；`charCount` 由本地按去掉空白后的字符数计算，不信任模型。
- 单句台词不超过 400 字，每场旁白不超过 1200 字，`title` 不超过 30 字，`hook` 不超过 80 字，`summary` 不超过 300 字；超长走修复，不直接渲染巨型段落。
- `speakerId + speakerSide` 必须匹配本场一个有 `girlId` 且 `portrait` 非空的单位；当前是我方，未来可包含敌方魔法少女。魔物没有 `girlId`，不能说话。
- `expression` 只能是 `calm / smile / surprise / sad / angry / shy`。
- 角色在其倒下轮次之后不能说话；`lines[].round` 必须落在本场 `roundFrom..roundTo` 内；敌方倒下后也不能再发言。
- 不写具体伤害数字、概率、属性值、公式；只写看得见的后果。
- 不新增胜负、死亡、疤痕、奖励、敌人或新角色；不替玩家做决定。
- 不使用 HTML、Markdown 标题或列表；正文是纯文本，前端按段落渲染，`white-space: pre-wrap` 保留模型给出的换行。

默认 `battle` 词条建议写成：

> 这一战已经结束。你只负责把它写成札记，不改写战斗结果，也不新增伤害、死亡、奖励或规则。按轮次分段，每段先写有画面感的旁白，再写 4–10 句对白或心声；只让有名有姓、带立绘的参战魔法少女说话，魔物只能出现在旁白里。对白要贴着她们的性格、关系、伤势与当下动作，允许停顿、误解和没说完的话。魔物与招式用旁白交代，不替玩家做决定，不写战后选择。不写具体伤害数字、概率、属性值，只写看得见的后果。

### 5.3 长度与调用

- `tokenFloor: 3600`，确保推理模型的思维链不会把 1800 字正文挤掉；预设里的最大输出仍可更高。
- 优先使用 `battle` 绑定的预设；没有绑定就回退 `builtin-balanced`，再回退默认预设。
- `chatJson` 自带的截断重试保留；解析成功后若**语义校验**失败，最多再发一次「按错误清单修复」的请求。
- 修复仍失败、网络失败或没有 Key，都不抛出到全局；返回可操作的错误文案。

日志使用 `kind: '战斗札记'`，记录模型、耗时、字数、场景数、`source` 与校验错误摘要，方便在叙事引擎面板里排查。

### 5.4 本地简报版

`buildBattleBrief(battle, state)` 是纯函数，不调用模型：

- 按轮次分 3–4 段，覆盖所有回合。
- 只写旁白，不编造角色台词；没有 `lines`，舞台显示为「简报版」。
- 600–900 字，写清谁在什么时候做了什么、谁倒下、战斗如何结束。
- 明确标记 `source: 'template'`，封面与舞台都显示「本地简报 · 未使用叙事者」，不假装是完整札记。
- 无 Key 时按钮直接写「生成简报版」；有 Key 但生成失败时，错误条提供「改用本地简报」按钮，不自动替换。

## 6. 独立预设

### 6.1 新用途

```ts
export type PromptScope =
  | 'shared' | 'chat' | 'daily' | 'profile' | 'storyline'
  | 'event' | 'arc' | 'battle' | 'incident' | 'outfit';
```

- `battle` 的标签是「战斗札记」，提示是「战斗结束后的多人叙事」。
- 位置放在 `arc` 之后、`incident` 之前；叙事类任务相邻，但不和完整剧情共用预设。
- `PROMPT_TASK_SCOPES` 变成 9 项；`DEFAULT_PROMPTS` 增加一条 `id: 'battle'` 的默认词条，总数 13（4 共用 + 9 任务）。
- `DEFAULT_PRESET_BINDING` 增加 `battle: 'builtin-balanced'`。
- 预设编辑器从 10 个标签页变成 11 个：共用、角色对话、每日提案、角色起草、故事线、私人事件、完整剧情、**战斗札记**、突发事件、服装词条、全部词条。
- 设置页任务入口从 9 个变成 10 个，新增 `#settings-prompt-battle`。

### 6.2 `schema: 4`

新增 `PRESET_SCHEMA = 4`，所有内置预设、空白预设、复制预设、导出都写 4。

`ensurePromptScopes` 按来源 schema 补齐：

| 来源 | 行为 |
| --- | --- |
| `schema <= 2`（旧版 / 外部 ST） | 补齐全部缺失默认词条（13 条），保留用户已有词条与顺序 |
| `schema === 3`（v12 / v13） | 只补 `battle` 一条，不重新补用户删掉的旧任务词条 |
| `schema === 4` | 原样返回 |

ST 导入：

- `Number(raw.schema ?? 0) < 4` 才补齐。
- 外部 ST 文件按 `schema <= 2` 处理，补 13 条；本作 v13 导出的 schema 3 文件只补 battle。
- 提示文案沿用「导入了 N 条任务默认词条（已标记为默认）…」。
- 导出写 `schema: 4`，每个 prompt 继续带 `scope`；API Key 仍然剥离。

`duplicatePreset`、`blankPreset`、`sanitizePreset` 的 schema 常量统一到 `PRESET_SCHEMA`，避免再出现 3/4 混写。

### 6.3 任务预设迁移

- `TASK_PRESET_MARKER` 从 `night-sugar:task-presets-v1` 升到 `night-sugar:task-presets-v2`。
- 启动时 `ensureTaskPresets` 看到 v2 标记才执行；已有八个任务预设保持名字与绑定。
- `battle` 默认绑定 `builtin-balanced`；第一次执行时复制一份并命名为「战斗札记」，之后不再覆盖用户改绑。
- `ensureTaskPresets` 继续保留 v13 的保护：只接管内置预设的「… 副本」，不重命名用户自己的「… 副本」；任务名已正确时直接复用，不重复复制。
- `LEGACY_TASK` 改成 `Partial<Record<PromptTask, 'chat' | 'generate' | 'story'>>`，**不给 battle 映射旧 story 或 generate**。旧三档绑定迁移时，battle 直接拿默认 `builtin-balanced`，避免新任务继承旧剧情预设。

### 6.4 预设编辑器

- 任务页的顶部下拉 `#preset-bind-current` 和聚焦模式不改，只是多一个 `battle` 标签。
- 从战斗札记封面点「调整这一战的写法」时，`openPresetScope('battle')` 打开当前绑定的「战斗札记」预设，而不是完整剧情预设。
- 词条用途下拉增加「战斗札记」；从全部词条页按用途筛选时能看到它。
- 旧「角色对话和提案生成」的设置说明同步改成「每个生成任务可独立绑定」，避免文案落后。

## 7. 全屏舞台

### 7.1 画面结构

```
┌────────────────────────────────────────────────────────────┐
│ 章节 / 委托名                                     关闭      │
│                                                            │
│  ┌────────┐      ┌──────────────────────────┐   ┌────────┐ │
│  │ 我方   │      │ 第 2–3 轮 · 货舱与潮声   │   │ 敌方   │ │
│  │ 立绘   │      │                          │   │ 立绘   │ │
│  │        │      │      旁白，居中           │   │        │ │
│  │        │      │  ┌────────────────────┐  │   │        │ │
│  │        │      │  │ 她说的话            │  │   │        │ │
│  │        │      │  └────────────────────┘  │   │        │ │
│  │ 姓名牌 │      │        （向右的台词）     │   │ 姓名牌 │ │
│  └────────┘      └──────────────────────────┘   └────────┘ │
│                                                            │
│  第 2 / 4 场        ← 上一场   下一场 →      收进战报       │
└────────────────────────────────────────────────────────────┘
```

- 整页是 `<dialog>` 全屏层，`100dvh`，背景 `#08070c` + 暗角 + 极轻的战场噪点；不使用真实战斗截图，避免抢文本。
- 三列：左侧我方、中央阅读列、右侧敌方。中央列 `min(680px, 54vw)`，两侧 `min(26vw, 300px)`。
- 右侧敌方位只在存在“有 `girlId` 且有立绘”的敌人时展开；纯魔物战斗不占立绘栏，中央列加宽，只在右上角显示敌方名称与数量。
- 中央列独立滚动；立绘栏固定，不随文本滚走。顶部与底部控制条固定在舞台内。
- 参考图里的「细金线框 + 姓名牌 + 半透明台词卡」保留，但颜色跟本作一致：暗紫黑、旧金、角色自己的颜色作为当前说话者的光。
- 参考图右侧的战利品浮层不照搬；战果在封面与战报页看，舞台只保留右上角一个可收起的「战果」小条，避免遮住立绘。

### 7.2 多人分配

- **按阵营固定左右**：我方在左，敌方在右；不因为谁说话就换边，同一角色始终在同一侧。
- 只有带 `girlId` 的魔法少女进入立绘位；没有 `girlId` 的魔物不占位，只在右上角敌方条里出现。
- 我方 1 人：左栏居中，中央加宽；我方 2–3 人：左栏纵向错开，当前说话者在前。
- 敌方有 1–2 名魔法少女：右栏与左栏对称；敌方 3 人：右栏纵向叠放，当前说话者在前。
- 每侧最多 3 个主位；更多单位进入顶部「候场」头像条，说话时换入主位，不无限压缩。
- 倒下的角色保留在台上，压暗、加「倒下」标记；致命角色加「留下」标记，之后不再有台词。敌我双方一致。
- 敌方魔法少女的姓名牌带「敌方」细标；纯魔物没有姓名牌，只有右上角的威胁条。

`castForBattle(battle, state)` 是纯函数：返回 `allies`（全部我方单位，保留倒下者）、`enemies`（仅 `girlId` 且 `portrait` 非空的敌方魔法少女）、`monsters`（无 `girlId` 的敌方单位）。每侧主位取前 3 个，其余进候场条；当前说话者若在候场，临时换入主位，但不改变原本的侧别与顺序。

### 7.3 台词与表情

- 每句 `line` 渲染成一张台词卡：小头像、姓名、阵营细标、正文；`mode === 'thought'` 用括号与斜体色，仍靠说话者一侧。
- 左侧我方的卡靠左，右侧敌方的卡靠右；旁白始终居中，最大宽度 620px。
- 当前阅读行通过 `IntersectionObserver` 激活：
  - 对应立绘放大到 `1.02`、亮度 100%、角色色描边；
  - 其他立绘降到 55% 亮度、轻微去饱和；
  - 当前角色用该句 `expression` 重新渲染同一套立绘组件；
  - 台词卡出现角色色左边线（右侧镜像）。
- 点击任意台词卡也会把它设为当前行；键盘 `↑/↓` 在行间移动，`←/→` 切换场景，`Esc` 关闭。
- 旁白不触发换表情；只有带 `speakerId` 的台词触发。
- 敌方说话时右侧立绘高亮，中央文本不换边；当前说话者可以从敌方换回我方，只改高亮不改站位。
- 尊重 `prefers-reduced-motion`：关闭缩放、交叉淡入和视差，只保留颜色变化。

### 7.4 `GirlPortrait` 的通用立绘对象

敌方魔法少女没有完整的 `Girl` 记录，不能为了舞台复制一套 SVG。把 `GirlPortrait` 的入参从 `Girl` 收窄成“只要求展示字段”的 `PortraitSubject`：

```ts
type PortraitSubject = Pick<Girl, 'id' | 'name' | 'color' | 'portrait'> &
  Partial<Pick<Girl,
    'codename' | 'expression' | 'wardrobe' | 'outfitId' |
    'importedVariants' | 'corruption' | 'witch' | 'portraitSpec'
  >>;

<GirlPortrait
  girl={actor.portrait}
  expression={line.expression}
  variant="full"
  bare
/>
```

- 我方：`actor.portrait` 从 `state.girls` 取，保留衣柜、侵蚀、魔女形态；敌方：从 `BattleUnit` 的 `girlId/name/codename/color/portrait/expression` 适配成同一形状；现有调用方继续传完整 `Girl`，类型兼容。
- 程序化 SVG 立绘：真实切换六种眼睛/嘴型，满足「表情变化」。
- 组件内先算 `const resolvedExpression = expression ?? girl.expression ?? 'calm';`，之后所有表情表、变体查找与 `aria-label` 都用它。
- 导入立绘：先查 `girl.importedVariants` 里键为 `<outfitId>:<resolvedExpression>` 的项；命中就使用该差分图，是真正的表情变化。没有对应变体时沿用当前立绘，姓名牌旁显示表情文字（如「微笑」「别开脸」），并用角色色表演光变化；**不伪造换脸**。
- 现有变体数据已经以 `<outfitId>:<expression>` 为键，本版只读取，不新增上传界面；没有变体的导入角色不会报错，也不会被挡在舞台外。
- 魔物不进入 `GirlPortrait`：有 `unit.monster.spec` 时用基于 spec 的剪影/徽记，没有就只显示名称与数量；绝不把 `monster.id` 当图片地址。
- 不把「上传六张表情图」塞进战斗札记；之后可在角色详情里补齐变体，舞台会自动使用。

### 7.5 封面、生成中与结束

- **封面**：委托名、结果、轮数、编队头像、每人一句状态（受伤/倒下/疤痕）、预计字数、`生成` / `生成简报版`、`调整这一战的写法`。
- **生成中**：不伪造阶段进度，只显示「叙事者正在把第 X 轮整理成画面……」与当前已等待秒数；超过 25 秒补一句「长札记会慢一些」，不转圈到死。
- **结束**：最后一场后接一张收束卡：`summary`、战果、疤痕、`收进战报`、`重新写`、`删除这页札记`。
- 重新生成前做二次确认，避免误触覆盖；生成成功立即 `saveBattleNote`，关闭页面不会丢。
- 生成中关闭：允许关闭，但用 `cancelled` ref 忽略迟到结果，不写入状态；按钮旁提示「关闭后这次生成不会保存」。

## 8. 入口与返回

`App` 的 `Modal` 增加：

```ts
| { type: 'battle-note'; id: string; from?: 'battle' | 'records' }
```

- 从战报打开：`from: 'battle'`；关闭时回到 `{ type: 'battle', id }`，不丢战报。
- 从记录页打开：`from: 'records'`；关闭回记录页。
- 不嵌套两个 `<dialog>`：打开札记时替换当前 modal，避免原生 dialog 的焦点与 Esc 冲突。
- `BattleReport` 新增 `onNote?: () => void` 与 `note?: BattleNote`；按钮 `#battle-note-open`、卡片 `#battle-note-cta`。
- `AuxViews` 新增 `onBattleNote?: (id: string) => void`；有札记时在行尾显示书签按钮，不改变整行点击行为。
- 记录页只显示最近 6 场，札记入口也只对这 6 场显示；更早的战斗从任务详情进入。

## 9. 文件改动

| 文件 | 工作 |
| --- | --- |
| `src/types.ts` | `BattleNote*`（含 `speakerSide`）、`BattleUnit` 可选展示字段、`GameState.battleNotes?`、两个 action |
| `src/game.ts` | 初始化/读档清洗、`recordBattle` 过滤、`saveBattleNote`、`deleteBattleNote` |
| `src/battleNote.ts` | 类型守卫、`sanitizeBattleNote`、`validateBattleNote`、`buildBattleBrief`、`battleDigest`、`castForBattle` |
| `src/presets.ts` | `battle` scope、13 条默认词条、schema 4、绑定、marker v2、导入/导出 |
| `src/llm.ts` | `generateBattleNote`、一次语义修复、日志 |
| `src/components/BattleNoteDialog.tsx` | 封面、生成、全屏舞台、键盘与滚动联动 |
| `src/components/BattleReport.tsx` | 札记按钮、战报卡片、结果页 CTA |
| `src/App.tsx` | modal、生成与保存、入口接线 |
| `src/views/AuxViews.tsx` | 记录页书签入口 |
| `src/components/GirlPortrait.tsx` | 入参收窄为 `PortraitSubject`；`expression` 覆盖；读取 `importedVariants` 的表情差分 |
| `src/components/PresetDialog.tsx` | battle 标签自动出现（由 scope 驱动，通常无需硬编码） |
| `src/components/UtilityDialogs.tsx` | `#settings-prompt-battle`、更新说明文案 |
| `src/combat.css` / `src/styles.css` | 全屏舞台、姓名牌、台词卡、响应式、reduced-motion |
| `tests/game.test.ts` | 数据/校验/迁移/预设 |
| `tests/browser.mjs` | 入口、舞台、表情、记录直达、预设 |
| `README.md` / `tasks/todo.md` | 行为与计数 |

## 10. 实施阶段

### 阶段 A：数据与预设

1. 加 `BattleNote` 类型、`battleNotes` 字段、两个 action、读档清洗与战斗淘汰过滤。
2. 加 `battle` scope、默认词条、第 9 个任务、schema 4、marker v2、导入/导出。
3. 单元测试先覆盖数据与预设，再接 UI。

### 阶段 B：生成与兜底

1. 写 `battleNote.ts` 的摘要、校验、模板；用固定战斗样本跑通。
2. 接 `generateBattleNote`，包括无 Key、网络失败、JSON 截断、语义修复、本地简报。
3. 先做一个纯文本的 `BattleNoteDialog` 验证数据，再上舞台。

### 阶段 C：舞台

1. 三列布局、立绘分配、姓名牌、当前行高亮。
2. `GirlPortrait` 的 `expression` 覆盖与导入立绘 fallback。
3. 键盘、滚动联动、场景跳转、移动端与 reduced-motion。

### 阶段 D：入口与验收

1. 战报顶部、战报卡片、胜利页、记录页书签四处入口。
2. 浏览器覆盖 1440 / 900 / 390 三个宽度。
3. 更新 README、plan、todo 与测试计数。

## 11. 测试

### 单元

- `battle` scope 只注入共用 + battle 词条，代码契约仍在最后。
- schema 2 补 13 条；schema 3 只补 battle；schema 4 不动；导出写 4。
- 旧三档绑定迁移后 battle 用默认 balanced，不继承 story。
- `ensureTaskPresets` 生成「战斗札记」、保留已有八任务、第二次执行 `created === 0`。
- `validateBattleNote` 拒绝：未知 speaker、非法 expression、回合缺口、场次越界、角色倒下后发言、过短、场次过少、空标题/空摘要、单句超长。
- `validateBattleNote` 拒绝 `speakerSide` 与单位阵营不符、`speakerSide: 'enemy'` 但单位没有 `girlId` 或 `portrait` 为空、敌方角色倒下后继续发言。
- `buildBattleBrief` 覆盖全部回合、只含旁白、字数在 600–900、`source === 'template'`。
- `saveBattleNote` 同 battle 替换、上限 20、删除、找不到 battle 时失败；不改变任何战斗/角色数值。
- 旧存档没有 `battleNotes` 时能读；指向已淘汰战斗的札记被过滤。
- `charCount` 忽略空白，和展示一致。

### 浏览器

- 战报出现 `#battle-note-open`；无 Key 时点开是封面，点「生成简报版」进入舞台。
- 舞台有左右立绘、姓名牌、至少两场；切换台词后当前说话者 class 与表情文字变化。
- 敌方魔法少女 fixture 有 `girlId/portrait/expression` 时右侧立绘出现，敌方台词只高亮右侧；纯魔物战斗右侧立绘栏为 0，只显示右上角威胁条。
- 固定导入角色同时预置 `calm` / `smile` 两张 `importedVariants` 时，切换台词后立绘 `src` 跟着变；没有变体时 `src` 不变，但表情标签变。
- `#battle-note-scene-next` 能切场；`Esc` 关闭回战报。
- 记录页有札记的战斗出现书签，点击直达；没有札记的战斗不显示。
- 预设编辑器有 11 个标签页；`#preset-task-tab-battle` 打开「战斗札记」；设置页有 `#settings-prompt-battle`。
- 导出预设 `schema === 4`，且至少一条 prompt `scope === 'battle'`。
- 390px 下立绘栏收成顶部头像条，文本不横向溢出。

### 手工

- 三人编队、一人倒下、胜利/失败/击退三种结果各看一场。
- 导入角色：有 `importedVariants` 差分时切换台词会换图；没有差分时只显示表情标签与表演光，不出现脸部错位。
- 生成中断网、只有推理模型、输出被截断三种情况。

## 12. 风险与边界

- **模型编造**：战斗札记最危险的是写出没发生的救援、死亡或奖励。用「回合覆盖 + speaker 白名单 + 倒下轮次 + 结果锁」四道校验，不只靠提示词。
- **长输出**：1800 字 JSON 容易被推理模型的思维链挤掉；`tokenFloor 3600` + 截断重试 + 一次语义修复，仍失败就本地简报，不无限重试。
- **成本**：不自动生成；每场最多一次正常调用 + 一次修复。封面明确字数，重新生成需确认。
- **静态立绘**：导入角色只有在 `importedVariants` 有对应 `<outfitId>:<expression>` 时才真正换图；没有差分就只做表情标签与表演光，不伪装成换脸。程序化立绘必须真实切换。
- **旧测试**：预设标签数、设置入口、导出的 schema 都会变；先改单元测试，再改浏览器断言，避免一处改动引发连环失败。
- **响应式**：两侧立绘在 900px 以下必须让位给文本；不能为了构图把正文压成一条缝。
- **可访问性**：舞台是原生 `<dialog>`，关闭按钮先获得焦点；台词是纯文本，不用 `dangerouslySetInnerHTML`；当前行用 `aria-current`，场景切换用礼貌级 `aria-live`，不逐句播报。

## 13. 验收

- `tsc -b` 通过。
- 现有单元测试 + 新增战斗札记测试全部通过。
- 生产构建通过。
- `node tests/browser.mjs` 全部通过，覆盖上述新增流程。
- 1440×900、900×700、390×844 三种尺寸无横向滚动，文本可读，立绘不遮字。
- 同一场战斗重复打开只有一条札记；生成失败不会写半成品；无 Key 能读简报版。
- 札记保存后重开游戏仍在；删除后战报回到「还没有写」。
- 战斗结果、角色数值、疤痕、奖励、死亡记录在生成前后完全一致。

## 14. 已知边界

- 本版不给魔物做立绘或对白；魔物只通过旁白与右上角威胁条出现。敌方魔法少女的立绘、阵营与表情数据通道已预留，但当前没有敌方魔法少女战斗内容，实际只在测试 fixture 中验证。
- 本版没有战后选择、分支或多结局；札记是回顾，不是可玩剧情。
- 本版没有语音、自动播放、逐字打字机或立绘 Live2D。
- 本版不把 `StoryPlayerDialog` 抽成通用组件；两套舞台共享视觉语言，不共享状态机。
- 导入角色只有存在对应 `importedVariants` 差分时才真正换图；没有差分时显示表情标签与表演光，不生成假表情。补齐变体不在本版范围内。

## 15. 实施记录（2026-10-28）

- `BattleNote` / `BattleNoteScene` / `BattleNoteLine`、`GameState.battleNotes`、`saveBattleNote` / `deleteBattleNote` 已落地；旧存档仍按 v11 读取，最多保留 20 条。
- `src/battleNote.ts` 负责选角、战斗摘要、回合覆盖、阵营/表情/倒下校验与本地简报；`src/game.ts` 的 `validBattleNote` 负责存档边界校验。
- `battle` 已加入 `PromptScope`、`PROMPT_TASK_SCOPES`、`DEFAULT_PROMPTS` 与 `DEFAULT_PRESET_BINDING`；预设 schema 升到 4，`TASK_PRESET_MARKER` 升到 v2，设置页新增「战斗札记」入口。
- `src/llm.ts` 的 `generateBattleNote` 使用 `battle` scope、`tokenFloor 3600`、一次语义修复；失败由 UI 调用 `buildBattleBrief` 保存本地简报。
- `src/components/BattleNoteDialog.tsx` 已实现全屏舞台、左右立绘、当前说话者高亮、表情切换、场景键盘切换、移动端头像条；无敌人时会把多名我方分到左右两侧，有可说话敌人时固定我方左/敌方右。
- `BattleReport` 顶部与底部、`RecordsView` 书签三处入口已接通；`GirlPortrait` 已收窄为 `PortraitSubject`，敌方从 `BattleUnit` 适配。
- 验证：`npx tsc -b` 通过；`npm test` **117 tests / 117 pass**；生产构建通过；`node tests/browser.mjs` **52/52 PASS**。浏览器 fixture 覆盖无 Key 简报、多场舞台、记录直达、保存替换、敌方魔法少女右侧立绘与右对齐台词，截图 `artifacts/battle-note.png` 与 `artifacts/battle-note-enemy.png`。
- 当前仍有的边界：没有真实敌方魔法少女战斗内容与魔物立绘；导入单张立绘没有真实表情差分；札记不是战后分支剧情。
