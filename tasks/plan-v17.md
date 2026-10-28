# v17 魔女化第五格、服装锁定与负面人格

## 目标

魔女化立绘不再只能等到侵蚀达标后才出现，而是像四格礼装之外的第五格一样始终预留、可提前导入；真正切换后，普通服装锁定在魔女形态。魔女化还会启用一套独立的负面人格记录，可由玩家在档案里编辑，退出后不覆盖普通人格。

## 数据

- `Girl` 增加 `witchPersonality?: string`；普通 `personality` 原样保留。
- `GirlCard.girl` 保留 `witchPersonality`，契约卡导出、导入与哈希覆盖该字段。
- 不新增 `GameState.version`，旧存档在 `hydrate` 时为已经处于魔女化的角色补默认负面人格。
- `GameAction`：
  - `setPersonality { girlId, text }`：魔女化时写 `witchPersonality`，否则写 `personality`。
  - `setWitchForm { girlId, outfit, activate? }`：`activate:false` 只保存立绘；`outfit:null` 只退出魔女化并保留第五格。
  - `clearWitchForm { girlId }`：彻底移除第五格。

## 第五格与切换

- 外观页衣柜固定渲染第五格「魔女化 · 夜之形」，不再依赖 `witchForm` 是否存在。
- 第五格没有立绘时显示「待导入」，点击打开专用 `WitchFormDialog`；有立绘时点击切换魔女化，已处于魔女化时点击退出。
- 专用弹窗只负责第五格：导入/替换立绘、形态名称、形态描述、保存、移除；不占用四格礼装，也不混入普通服装的六表情差分。
- 侵蚀低于 `corruptionThreshold` 时允许提前保存，切换时才拒绝。
- 魔女化期间 `changeOutfit` 返回锁定提示，普通服装保持原样；衣柜普通格显示锁定标记。
- 退出魔女化后第五格保留，角色恢复普通服装与普通人性格。

## 负面人格

`src/personality.ts`：

- `defaultWitchPersonality(girl)`：保留原人格第一句，再拼接偏执、冷酷、易怒、多疑、嫉妒、控制欲强、占有欲强、缺乏同理心、沉迷疼痛与甜言蜜语诱捕等负面特质，以及一段扭曲占有欲描述。
- `activePersonality(girl)`：魔女化时优先 `witchPersonality`，缺失时用默认值；普通状态只用 `personality`。
- 档案状态概览新增人格面板：显示当前生效人格、魔女化提示、编辑按钮、600 字输入与保存/取消。
- 对话、角色简述与故事线/事件/剧情元数据都读取 `activePersonality`，让模型看到的魔女台词建立在负面人格上。

## 实现边界

- 人格是文本记录，不改变四维、技能或战斗结果。
- 魔女化仍只有一个形态槽，不扩展成多套魔女服装。
- 立绘仍是静态图片，不做骨骼或逐帧表情动画。
- 第三阶段魔女与侵蚀数值规则保持不变；本版只改立绘、服装锁定与人格呈现。

## 验收

- 状态测试：低于阈值用 `activate:false` 预留、45 侵蚀激活、默认负面人格、普通服装锁定、魔女人格编辑不覆盖普通人性格、退出保留第五格、普通人性格编辑不覆盖魔女记录、契约卡往返与哈希变化、移除第五格。
- 浏览器：第五格提前导入并保存、低侵蚀点击切换被拒绝、提高侵蚀后切换成功、点击普通服装仍保持魔女化、档案显示并保存负面人格、退出后恢复普通形态且第五格仍在。
- 121 项状态测试、56 组浏览器流程、生产构建通过。

## 涉及文件

- `src/personality.ts`
- `src/components/WitchFormDialog.tsx`
- `src/components/CharacterDialog.tsx`
- `src/components/GirlPortrait.tsx`
- `src/App.tsx`
- `src/game.ts`
- `src/types.ts`
- `src/cards.ts`
- `src/llm.ts`
- `src/combat.css`
- `tests/game.test.ts`
- `tests/browser.mjs`
- `README.md`
