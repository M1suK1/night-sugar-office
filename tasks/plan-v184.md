# 方案 v184 · 控制台「立刻获取指定装备」命令

TASK
  控制台新增 `gear` 命令：按「槽位 + 阶级（+ 可选套装）」立刻把一件装备放进事务所仓库，
  不扣星砂、不看声望、不动货架。种类口径已确认：槽位与套装两个维度都要，
  `gear <槽位> <阶级> [套装]`。

APPROACH
  1. 新动作 `debugGrantEquipment { slot, tier, setId? }`，处理器放在 `src/rules/debugOps.ts`，
     沿用 clone + 日志的正常 reducer 通道（与 witch/reset/contract 一致）。
  2. 候选池取内置内容 `content/equipment/tier1..5` 里 slot、tier、setId 全部命中的条目；
     不把炼制实例、故事专属、运行时注册的装备混进来。用 `hashText(day/minutes/slot/tier/set/当前库存合计)`
     确定性选一件：同存档同日同参数结果稳定，重复执行会轮换到下一件，方便逐个试。
  3. 命中后 `inventory[item.id] += 1`，写一条 `【调试】` 日志；无命中时报错并列出该槽位该阶级可用的套装。
  4. `App.tsx` 的 `runCommand` 增 `gear` / `装备` 分支，解析中英文别名；help 加一行，终端快捷 chip 加 `gear 法器 3`。

FILES
  · src/types.ts                        GameAction 增加 debugGrantEquipment
  · src/rules/act.ts                    分发到新处理器
  · src/rules/debugOps.ts               实现发放逻辑（含候选筛选、确定性挑选、日志）
  · src/App.tsx                         gear/装备 命令解析 + help 文案
  · src/components/CommandConsole.tsx   快捷 chip
  · tests/v184.test.ts                  新测试
  · package.json                        test 脚本追加 tests/v184.test.ts
  · tasks/plan-v184.md                  本方案
  · tasks/todo.md                       v184 勾选

EDGE IN
  · 槽位别名：法器/武器/weapon、护符/charm、消耗品/道具/consumable
  · 套装别名：星辉/星光、甜晶/糖霜、幽月/月影、织梦/梦境、常磐/自然、焚烬/赤焰（英文 id 也收）
  · 阶级写法：1–5 与 一阶–五阶
  · 缺参、非法槽位、非法阶级、该组合没有装备（如「法器 五阶 甜晶」）、消耗品带套装参数
  · 重复执行轮换、日志、旧存档不受影响（不改存档结构，无需 migrate）

EDGE OUT
  · 不做数量参数（一次一件，重复敲即可）
  · 不发放故事奖励 / 炼制实例 / LLM 生成装备（它们不在内置池里）
  · 不按装备名精确指定、不改货架与声望
  · 不给「随机阶级」：阶级必须写，避免调试时结果不可控

ASSUME
  · 「立刻获取」= 直接进仓库（inventory），不进装备栏；玩家自行在档案里装上
  · 套装参数只对法器/护符有意义；消耗品在内容里没有套装归属
