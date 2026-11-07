# 方案 v195 · 存档不再背着图片

TASK
  第三天存档就有 79MB。上一次只是让「超长日志」不再判坏档，体积问题还在：图片仍以 data URL 躺在存档里。

APPROACH
  1. 量出来源：`unitFromGirl` 把整张立绘抄进战斗单位，而 `frames` 每回合复制一次单位数组——
     一场 4 人 6 帧的战斗就能塞进二十多张同一张图。衣柜、魔女化立绘、三方首领/随从也从没搬进资产库。
  2. 战报单位只留 `portraitAsset`（资产 id），不再存 data URL；
     界面本来就有「按 girlId 回查当前存档」的兜底，战报、札记、侧栏三处都不受影响。
  3. `extractStatePortraits` 扩展为「所有图都进资产库」：
     · 少女：立绘、表情差分、**衣柜每一套**、**魔女化立绘**；
     · 三方首领与随从的立绘（类型补 `portraitAsset`）；
     · 战报的 `units` 与 `frames[].units`。
     同一张图按指纹去重，一局只写一次。
  4. `hydrateStatePortraits` 对称还原衣柜、魔女化与势力人物，界面拿到的仍是 data URL。
  5. 札记的「能不能说话」判定从「有没有立绘」改成「有没有 girlId」——
     立绘可能只剩资产 id，不能拿图当门槛。

FILES
  · src/portraitAssets.ts   全部图片资产化 + 对称还原
  · src/combat.ts           单位只留资产 id
  · src/types.ts            首领/随从补 portraitAsset
  · src/battleNote.ts       说话者判定改为 girlId
  · tests/v195.test.ts      4 条
  · package.json / tasks/plan-v195.md / tasks/todo.md

EDGE IN
  · 衣柜、魔女化、势力人物、战报单位与逐帧快照里的 data URL 全部搬走
  · 同一张图多帧引用只写一次；没有内联图时不做任何写库
  · 读档后立绘仍然能显示；导出存档时靠同一套还原

EDGE OUT
  · 不改导出文件的自包含策略（导出的 JSON 里仍带 data URL，方便换机器）
  · 不压缩图片本身，只改「存在哪里」
  · 老的巨型存档不会被就地重写；下一次保存时自动瘦下来

ASSUME
  79MB 主要是重复的立绘副本（战报逐帧复制 + 衣柜/势力）；文字部分不足以撑到这个量级。
