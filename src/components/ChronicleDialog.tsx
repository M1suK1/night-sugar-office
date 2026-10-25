import { useState } from 'react';
import { BookOpen, ChevronRight, ScrollText, Sparkles } from 'lucide-react';
import type { ChronicleEntry, GameState } from '../types';

const kinds: ChronicleEntry['kind'][] = ['魔物', '少女', '事件', '议程', '代表', '登记'];

export function ChronicleDialog({ state }: { state: GameState }) {
  const [filter, setFilter] = useState<'all' | ChronicleEntry['kind']>('all');
  const entries = state.chronicle.filter(entry => filter === 'all' || entry.kind === filter);
  return <div className="chronicle-dialog">
    <header className="chronicle-heading"><span className="eyebrow">叙事者档案 · CHRONICLE</span><h2>被写下来的夜晚</h2><p>每一次生成都会留下缓存。即使内容已从事件池移除，这里仍保留当时的名字与摘要。</p></header>
    <div className="chronicle-meta"><span><ScrollText size={13} />共 {state.chronicle.length} 条</span><span><Sparkles size={13} />第 {state.day} 日 · 缓存上限 200 条</span></div>
    <div className="chronicle-filters" role="group" aria-label="编年史分类">{[['all', '全部'] as const, ...kinds.map(kind => [kind, kind] as const)].map(([value, label]) => <button id={`chronicle-filter-${value}`} key={value} type="button" className={`av-filter ${filter === value ? 'active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {entries.length ? <ol className="chronicle-list">{entries.map(entry => <li key={entry.id} className={`chronicle-entry chronicle-${entry.kind}`}><div className="chronicle-entry-top"><span className="chronicle-kind">{entry.kind}</span><time>{entry.at}</time></div><h3>{entry.title}</h3><p>{entry.summary}</p></li>)}</ol> : <div className="chronicle-empty"><BookOpen size={26}/><b>这一页还是空的。</b><p>在设置中连接叙事者，生成一次提案或登记一位契约者，编年史就会开始记录。</p></div>}
    <footer className="chronicle-foot"><ChevronRight size={12} />缓存随存档保存在当前浏览器；清空浏览器数据会一并移除。</footer>
  </div>;
}
