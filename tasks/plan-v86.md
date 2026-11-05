# v86 · 废掉静态三方名册

## 决定（你定的）

三方名册（首领 3 人 + 随从 9 人）那套内置数据**彻底不用**。任何人进三方位置都必须来自契约卡库；
卡不够时界面提示「契约卡不足，需要导入」，不再偷偷塞回内置人物。

## 已改的地方

### 数据层

- `src/content/factionGirls.ts`：`factionGirls = []`，`girlsOfFaction()` 恒空。
- `src/content/factionLeaders.ts`：不再是三个人物，而是三个「空缺占位」——`id: vacant-<faction>`、
  `name: 席位空缺`、`vacant: true`、属性归零。
- `src/factions.ts`：
  - `defaultFactionRoster()` 返回全空席（`leaderId: ''`、`memberIds: []`）。
  - 新增 `factionSeatEmpty()` / `factionSeatsMissing(state)`，界面与开局提示都读它。
  - `factionRepresentativeOf()` 把 `vacant` 带出去。
  - `factionBrief()` 在空席时写「首领席位空缺（契约卡不足，需要导入）」。

### 规则层

- `hireLeader`：空席不能被雇佣（`这个席位还空着，没有人可以雇。`）。
- `frontPower`（前线战力）改成按本局名册的随从数算，不再读静态表。
- 编成池不再把空缺占位塞进去。
- `llm-night` 的 `representatives` 过滤掉空席，模型不会把人写成「席位空缺」。
- 读档：老存档里指向内置 id 的三方名册解析失败时，清空成空席并写一条通知说明原因。

### 界面

- 开局：卡不够时提示「三方还有 N 个席位空着：契约卡不足，需要导入」。
- 开局编成：池子里已导入的人不足 6 位时，顶部给一条说明（需要 3 首领 + 3 随从）。
- 会客厅：代表空席时卡片写「席位空缺 · 需要导入契约卡」，不显示接单按钮。
- 势力档案：空席时顶部提示「席位空缺：契约卡不足，需要导入」。

## 影响与取舍

- 新档必须有至少 6 张可编的契约卡（自己的名册 2 人 + 三方 3 首领 3 随从）；不够时三方留空，
  游戏仍能进行，但拦截战、势力代表委托、势力前线的人数加成都会缺席。
- 老存档：三方名册会被清空并提示重新编成；辖区归属、态度与其它进度不动。
- 内置那三位首领的台词、头衔与关系档案（`factionDossiers`）保留，但不再有「人」坐这个位置。

## 验收

- `tests/v147.test.ts`：空席、`factionSeatsMissing`、代表 `vacant`、档案文案、空席不可雇佣。
- 受影响的历史测试改成用合成名册播种（`tests/fixtureRoster.ts`）。
