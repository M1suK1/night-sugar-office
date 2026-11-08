# 方案 v188 · 结束剧情的引子

TASK
  点「结束事件 / 结束会议 / 导向结局」时，输入框里已经写好、还没发出去的那一句会被丢掉。
  现在要把它带进收尾提示词，作为叙事者写结局的引子。

APPROACH
  1. `EventDialogProps.onEnd` 加第二个参数 `lead`，两处确认结束的按钮都传 `draft.trim()`。
     舞台模式与普通面板共用同一个 `draft`，两条路径一起生效。
  2. `App.endStorySession(eventId, lead)` 原样转给 `generateStoryEnding`。
  3. 提示词里原来的两行「所长把这段剧情停在这里」收成 `endingLeadBlock(lead)`，
     放进 `promptSections.ts`（提示词文本不外泄到生成器）：
     · 有内容：压成一行、截 300 字，作为「他最后写的是：『…』」，并要求接着写、不复述、不替所长补话；
     · 空内容：说明「没有多写一句」，不让模型自己编一句所长台词。
  4. 不把这句话写回 `turns`：它没有真正发出去，只是收尾的引子。要留下痕迹另开一版。

FILES
  · src/components/EventDialog.tsx  onEnd 签名 + 两处按钮传 draft
  · src/App.tsx                     endStorySession 收 lead 并转给生成器
  · src/llm.ts                      generateStoryEnding 增加 lead，上下文改用 endingLeadBlock
  · src/promptSections.ts           新增 endingLeadBlock
  · tests/v188.test.ts             4 条
  · package.json / tasks/plan-v188.md / tasks/todo.md

EDGE IN
  · 空串、纯空白、含换行与制表符的输入；超长输入截 300 字（与输入框上限一致）
  · 舞台模式与普通面板两个结束按钮
  · 收尾失败时剧情仍然开着，可以再点一次（沿用 v117 行为）

EDGE OUT
  · 不把引子写进 turns / 存档；不改变回合提交与重写流程
  · 没有配置叙事者、只能本地收尾时，引子仍不落档（本地收尾不调模型）
  · 不改蓝图岔路口的「导向结局」判定

ASSUME
  「输入框里的内容」指点击结束那一刻 textarea 的当前值；发送过的内容已经在 turns 里。
