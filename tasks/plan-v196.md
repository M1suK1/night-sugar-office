# 方案 v196 · 角色档案的装备界面补上套装与词条

TASK
  角色详情里的装备只能看到「名字 + 一句 passive/属性」，v180 之后的套装与精炼词条在配置时完全看不见，
  玩家得跑去观星工坊才知道自己穿的是什么、还差哪件能激活套装。

APPROACH
  1. 新 `equipmentFacts.ts` 负责把装备读成人话：
     基础加成（四维 / 生命 / 心防 / 增伤 / 先手）、词条（名称 + 方向 + 数值，百分比型补 %）、
     槽位与阶级（法器 · 三阶）、套装查表。
  2. 新组件 `EquipmentFacts` 排版三段：阶级 + 套装标签 → 基础加成 chips → 词条 chips；
     没有词条时写「未精炼」，仓库卡片额外显示 passive。
  3. 接进三处：装备槽、仓库抽屉的槽位、持有装备卡片。
  4. 两件同套时在槽位下方加一条「套装已激活」：套装名 + 被动名 + 效果说明，颜色取套装色。
  5. 删掉只拼一行字的 `gearSummary`，避免两套口径。

FILES
  · src/equipmentFacts.ts                 新增：格式化与查表
  · src/components/EquipmentFacts.tsx     新增：装备信息块
  · src/components/CharacterDialog.tsx    三处接入 + 套装激活条
  · src/styles.css                        chips、套装条
  · tests/v196.test.ts                    4 条
  · package.json / tasks/plan-v196.md / tasks/todo.md

EDGE IN
  · 没有套装、没有词条、没有 tier 的旧装备（tier 由价格推断）
  · 百分比词条（减伤/增伤）与数值词条分开写
  · 套装 id 认不出来时按「无套装」处理
  · 两件不同套 → 不显示激活条

EDGE OUT
  · 不在角色页做精炼操作（仍回工坊）
  · 不改装备数据与掉落
  · 不做装备对比数值（与当前槽位的增减差）

ASSUME
  「配置装备时」= 角色详情的装备区与它打开的仓库抽屉；工坊那套展示已经够用，不重做。
