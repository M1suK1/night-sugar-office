/**
 * 锁定契约也是词条。
 *
 * 这些文本以前只活在生成器里（promptSections.ts 的 *Contract() 与 llm-night.ts 的
 * dailyContract()），界面上看不到、也没法改——出问题只能等报错。现在它们作为
 * contract: true 的词条进预设：不参与正文分层（renderPresetSystem 会跳过），
 * 但由 composeTaskSystem 作为「永远排在最后」的那一段注入，可以逐条审核与修改。
 *
 * v198：dailyContract 也搬进了 promptSections，这里不再需要间接注册。
 */
import type { PromptEntry, PromptScope } from './presets.ts';
import {
  arcContract, arcEndingContract, arcOpeningContract, arcTurnContract, battleContract,
  dailyContract, dialogueContract, eventContract, incidentBatchContract, newsContract,
  profileSchemaContract, singleIncidentContract, storylineContract, storylineStartContract,
  witchFormContract,
} from './promptSections.ts';

interface ContractSpec {
  id: string;
  scope: PromptScope;
  name: string;
  make: () => string;
}

const SPECS: ContractSpec[] = [
  { id: 'profile:contract', scope: 'profile', name: '角色起草 · 结构契约', make: profileSchemaContract },
  { id: 'profile:witch', scope: 'profile', name: '魔女化形态 · 结构契约', make: witchFormContract },
  { id: 'daily:contract', scope: 'daily', name: '每日提案 · 结构契约', make: dailyContract },
  { id: 'news:contract', scope: 'news', name: '城市新闻 · 结构契约', make: newsContract },
  { id: 'incident:contract', scope: 'incident', name: '突发事件 · 批量契约', make: incidentBatchContract },
  { id: 'incident:single', scope: 'incident', name: '突发事件 · 单条契约', make: singleIncidentContract },
  { id: 'event:contract', scope: 'event', name: '私人事件 · 结构契约', make: eventContract },
  { id: 'battle:contract', scope: 'battle', name: '战斗札记 · 结构契约', make: battleContract },
  { id: 'storyline:contract', scope: 'storyline', name: '故事线蓝图 · 结构契约', make: storylineContract },
  { id: 'storyline:start', scope: 'storyline', name: '故事线起点 · 结构契约', make: storylineStartContract },
  { id: 'arc:contract', scope: 'arc', name: '故事线蓝图 · 结构契约', make: () => arcContract('demo-node') },
  { id: 'arc:opening', scope: 'arc', name: '蓝图开场 · 结构契约', make: arcOpeningContract },
  { id: 'arc:turn', scope: 'arc', name: '蓝图续写 · 结构契约', make: arcTurnContract },
  { id: 'arc:ending', scope: 'arc', name: '剧情收尾 · 结构契约', make: arcEndingContract },
  { id: 'chat:contract', scope: 'chat', name: '角色对话 · 回复格式契约', make: dialogueContract },
  { id: 'whisper:contract', scope: 'whisper', name: '灯下私语 · 回复格式契约', make: dialogueContract },
];

/** 该用途默认用哪一条契约词条。 */
export function contractIdFor(scope: PromptScope): string {
  return `${scope}:contract`;
}

/** 全部契约词条（含默认文本），给预设迁移与提示词全量视图用。 */
export function contractPrompts(): PromptEntry[] {
  return SPECS.map(spec => {
    const content = spec.make().trim();
    return {
      id: spec.id,
      name: spec.name,
      content,
      defaultContent: content,
      role: 'system' as const,
      enabled: true,
      scope: spec.scope,
      builtin: true,
      contract: true,
    };
  }).filter(entry => entry.content.length > 0);
}
