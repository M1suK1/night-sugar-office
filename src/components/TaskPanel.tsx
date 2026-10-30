import { useState } from 'react';
import { ClipboardList, ChevronDown, AlertTriangle, Swords, ShieldCheck, Coins, ScrollText, MessageSquareQuote } from 'lucide-react';
import type { GameState } from '../types.ts';
import { TASK_VISIBLE, taskInbox, type TaskEntry } from '../tasks.ts';

const kindIcon = {
  war: Swords,
  incident: AlertTriangle,
  council: MessageSquareQuote,
  faction: ShieldCheck,
  mission: ClipboardList,
  storyline: ScrollText,
  contract: Coins,
} as const;

const kindLabel = {
  war: '战线',
  incident: '待处理',
  council: '议会',
  faction: '势力',
  mission: '委托',
  storyline: '故事',
  contract: '契约',
} as const;

/**
 * 首页左上角的任务面板：只收今晚不做就会变糟的事。
 *
 * 收起时是一枚带计数的徽标，点开摊成清单；点条目跳去对应的地方，不新增路由。
 */
export function TaskPanel({ state, onOpen, onNavigate }: { state: GameState; onOpen: (target: TaskEntry['target']) => void; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const inbox = taskInbox(state);
  if (inbox.length === 0) return null;
  const shown = inbox.slice(0, TASK_VISIBLE);
  const hidden = inbox.length - shown.length;
  const urgent = inbox.filter(item => item.urgent).length;

  return (
    <aside className={`task-panel ${open ? 'open' : ''}`} id="task-panel">
      <button
        type="button"
        id="task-panel-toggle"
        className="task-panel-toggle"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <ClipboardList size={14} />
        <span>今晚要做</span>
        <b id="task-panel-count">{inbox.length}</b>
        {urgent > 0 && <i className="task-panel-urgent" aria-label={`${urgent} 件急事`} />}
        <ChevronDown size={13} className="task-panel-caret" />
      </button>
      {open && (
        <div className="task-panel-body">
          {shown.map((entry, index) => {
            const Icon = kindIcon[entry.kind];
            return (
              <button
                type="button"
                key={entry.id}
                id={`task-panel-item-${index}`}
                className={`task-panel-row ${entry.urgent ? 'urgent' : ''} kind-${entry.kind}`}
                onClick={() => { onOpen(entry.target); setOpen(false); }}
              >
                <span className="task-panel-kind"><Icon size={12} />{kindLabel[entry.kind]}</span>
                <strong>{entry.title}</strong>
                <small>{entry.hint}</small>
              </button>
            );
          })}
          {hidden > 0 && (
            <button type="button" id="task-panel-more" className="task-panel-more" onClick={() => { onNavigate(); setOpen(false); }}>
              还有 {hidden} 件事，去会客厅慢慢看
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
