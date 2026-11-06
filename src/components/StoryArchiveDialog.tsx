import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, Trash2 } from 'lucide-react';
import { clearStoryArchive, deleteStoryFromArchive, loadStoryArchive, type ArchivedStory } from '../storyArchive';

/**
 * 已保存的剧情（v176）。
 *
 * 开局界面就能打开，不需要读档：这里存的是可读副本（旁白 + 台词 + 摘要），
 * 谁在这段里出现过也一并记着，所以即使卡库里的卡被删了，文字也还在。
 */
export function StoryArchiveDialog({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<ArchivedStory[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    void loadStoryArchive().then(stories => {
      setList(stories);
      setActiveId(current => current && stories.some(item => item.id === current) ? current : (stories[0]?.id ?? ''));
      setLoading(false);
    });
  };
  useEffect(reload, []);

  const active = useMemo(() => list.find(item => item.id === activeId), [list, activeId]);

  const exportOne = (story: ArchivedStory) => {
    const text = [
      `# ${story.title}`,
      `第 ${story.day} 日 · ${story.participants.map(person => person.name).join('、')}`,
      story.summary ? `\n摘要：${story.summary}` : '',
      '',
      ...story.turns.map(turn => turn.role === 'player'
        ? `所长：${turn.text}`
        : `${turn.text}${turn.lines.length ? `\n${turn.lines.map(line => `${line.speakerName}：${line.text}`).join('\n')}` : ''}`),
    ].filter(Boolean).join('\n\n');
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${story.title}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="standard-modal story-archive" id="story-archive-dialog" role="dialog" aria-modal="true" aria-label="已保存的剧情">
      <div className="modal-eyebrow"><BookOpen size={14} />存档 · 已保存的剧情</div>
      <h2>{list.length ? `${list.length} 段演出` : '还没有保存的剧情'}</h2>
      <p className="meeting-lead">演完的对话会在这里留一份可读副本：不用读档，开局就能翻。删档不影响正篇存档。</p>

      {loading && <p className="meeting-note">正在读……</p>}
      {!loading && !list.length && <p className="meeting-note">还没有任何一段演完的剧情。去角色档案里开场一段，或者先读档。</p>}

      {list.length > 0 && (
        <div className="story-archive-body">
          <ol className="story-archive-list">
            {list.map(story => (
              <li key={story.id}>
                <button type="button" id={`story-archive-${story.id}`} className={`story-archive-item${story.id === activeId ? ' active' : ''}`} onClick={() => setActiveId(story.id)}>
                  <b>{story.title}</b>
                  <small>第 {story.day} 日 · {story.participants.length} 人 · {story.turns.length} 轮</small>
                </button>
                <button type="button" className="story-archive-del" title="删掉这份副本" onClick={() => { void deleteStoryFromArchive(story.id).then(reload); }}><Trash2 size={12} /></button>
              </li>
            ))}
          </ol>

          {active && (
            <article className="story-archive-read" id="story-archive-read">
              <header>
                <h3>{active.title}</h3>
                <small>第 {active.day} 日 · {active.participants.map(person => person.name).join('、')}</small>
                <button type="button" className="vn-chip" onClick={() => exportOne(active)}><Download size={12} />导出这一段</button>
              </header>
              {active.summary && <p className="story-archive-summary">{active.summary}</p>}
              <div className="story-archive-turns">
                {active.turns.map((turn, index) => turn.role === 'player' ? (
                  <p key={index} className="story-archive-line player"><span>所长</span>{turn.text}</p>
                ) : (
                  <section key={index} className="story-archive-turn">
                    <p className="story-archive-narration">{turn.text}</p>
                    {turn.lines.map((line, at) => (
                      <p key={at} className="story-archive-line"><span>{line.speakerName}{line.mode === 'thought' ? ' · 心声' : ''}</span>{line.text}</p>
                    ))}
                  </section>
                ))}
              </div>
            </article>
          )}
        </div>
      )}

      <div className="meeting-actions">
        {list.length > 0 && <button id="story-archive-clear" type="button" className="btn" onClick={() => { void clearStoryArchive().then(reload); }}>清空全部副本</button>}
        <button id="story-archive-close" type="button" className="btn primary" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}
