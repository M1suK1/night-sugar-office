import { Radio, UserRoundCog } from 'lucide-react';
import type { CityNews, GameState } from '../types';
import { newsCastPool } from '../cityNews';

/**
 * 夜间访谈的详情（v176）。
 *
 * 主页只放一小块摘要；点开这里能看完整的对话、今日要闻，并就地换主持人。
 * 没有播报时也开得出来 —— 至少能先把人定好，再点「刷新」。
 */
export function NewsDialog({ state, news, busy, onHost, onRefresh, onClose }: {
  state: GameState;
  news?: CityNews;
  busy: boolean;
  onHost: (girlId: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const pool = newsCastPool(state);
  const hostId = news?.host?.id ?? state.newsHostId ?? pool[0]?.id ?? '';

  return (
    <div className="standard-modal news-dialog" id="news-dialog" role="dialog" aria-modal="true" aria-label="夜间访谈">
      <div className="modal-eyebrow"><Radio size={14} />夜糖电台 · 夜间访谈</div>
      <h2>{news?.headline ?? '今晚的节目还没开始'}</h2>
      <p className="news-dialog-meta">
        {news ? `第 ${news.day} 日 · ${news.source === 'llm' ? '叙事者' : '本地快报'} · ${news.lines?.length ?? 0} 句` : '还没有播报：先选主持人，再点刷新。'}
      </p>

      <section className="news-dialog-host" aria-label="主持人">
        <h3><UserRoundCog size={13} />主持人</h3>
        <div className="news-dialog-host-row">
          <select
            id="news-dialog-host"
            className="news-host-pick"
            value={hostId}
            onChange={event => onHost(event.target.value)}
          >
            {pool.map(person => <option key={person.id} value={person.id}>{person.name} · {person.title}</option>)}
            {!pool.length && <option value="">现场没有人</option>}
          </select>
          <button id="news-dialog-refresh" type="button" className="btn" disabled={busy} onClick={onRefresh}>
            {busy ? '正在写' : '重新生成'}
          </button>
        </div>
        {news?.host && <p className="news-dialog-note">现在由 {news.host.name}（{news.host.title}）主持。</p>}
      </section>

      {news?.lines?.length ? (
        <ol className="news-dialog-lines">
          {news.lines.map((line, index) => (
            <li key={`${line.speakerId}-${index}`} className={line.speakerId === news.host?.id ? 'is-host' : 'is-guest'}>
              <span className="news-speaker">{line.speakerName}</span>
              <p>{line.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="news-dialog-note">还没有对话内容。{news ? '这段播报只有要闻，没有访谈。' : ''}</p>
      )}

      {news?.items?.length ? (
        <section className="news-dialog-items" aria-label="今日要闻">
          <h3>今日要闻</h3>
          <ul>{news.items.map((item, index) => <li key={`${item.tone}-${index}`} className={`tone-${item.tone}`}>{item.text}</li>)}</ul>
        </section>
      ) : null}

      <div className="meeting-actions">
        <button id="news-dialog-close" type="button" className="btn" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}
