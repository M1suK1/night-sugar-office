import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Radio, UserRoundCog } from 'lucide-react';
import type { CityNews, GameState } from '../types';
import { newsCastPool } from '../cityNews';

/** 一条停留多久（毫秒）：够看完一句 60 字以内的话。 */
const LINE_DWELL_MS = 4200;

/**
 * 夜间访谈的详情（v176 / v177 逐条播放）。
 *
 * 主页只放一小块摘要；点开这里能看完整的对话、今日要闻，并就地换主持人。
 * 对话一次只显示一条、自动往下走 —— 十条一次铺开会把整个弹窗顶到屏幕外。
 */
export function NewsDialog({ state, news, busy, presetName, onHost, onRefresh, onClose }: {
  state: GameState;
  news?: CityNews;
  busy: boolean;
  /** 这一档用的是哪份预设（v177）：不写出来，玩家没法核对词条。 */
  presetName?: string;
  onHost: (girlId: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const pool = newsCastPool(state);
  const hostId = news?.host?.id ?? state.newsHostId ?? pool[0]?.id ?? '';
  const lines = news?.lines ?? [];
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // 换了一档节目（或重新生成）就回到第一句，并且重新开始播。
  const episodeKey = `${news?.day ?? 0}|${news?.headline ?? ''}|${lines.length}`;
  useEffect(() => {
    setCursor(0);
    setPlaying(lines.length > 1);
  }, [episodeKey, lines.length]);

  // 光标越界（重新生成后句子变少）时拉回最后一句。
  useEffect(() => {
    if (cursor > lines.length - 1) setCursor(Math.max(0, lines.length - 1));
  }, [cursor, lines.length]);

  useEffect(() => {
    if (!playing || lines.length <= 1 || showAll) return;
    if (cursor >= lines.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setCursor(current => Math.min(current + 1, lines.length - 1)), LINE_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, lines.length, showAll]);

  const current = lines[cursor];
  const isHost = Boolean(current && current.speakerId === news?.host?.id);
  const counter = lines.length ? `${cursor + 1} / ${lines.length}` : '0 / 0';

  const step = (delta: number) => {
    setPlaying(false);
    setCursor(value => Math.max(0, Math.min(value + delta, lines.length - 1)));
  };

  return (
    <div className="standard-modal news-dialog" id="news-dialog" role="dialog" aria-modal="true" aria-label="夜间访谈">
      <div className="modal-eyebrow"><Radio size={14} />夜糖电台 · 夜间访谈</div>
      <h2>{news?.headline ?? '今晚的节目还没开始'}</h2>
      <p className="news-dialog-meta">
        {news ? `第 ${news.day} 日 · ${news.source === 'llm' ? '叙事者' : '本地快报'} · ${lines.length} 句` : '还没有播报：先选主持人，再点刷新。'}
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

      {lines.length ? (
        <section className="news-dialog-stage" aria-label="访谈对话" aria-live="polite">
          {showAll ? (
            <ol className="news-dialog-lines">
              {lines.map((line, index) => (
                <li key={`${line.speakerId}-${index}`} className={line.speakerId === news?.host?.id ? 'is-host' : 'is-guest'}>
                  <span className="news-speaker">{line.speakerName}</span>
                  <p>{line.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className={`news-dialog-line ${isHost ? 'is-host' : 'is-guest'}`} id="news-dialog-line">
              <span className="news-speaker">{current?.speakerName ?? ''}</span>
              <p>{current?.text ?? ''}</p>
            </div>
          )}
          <div className="news-dialog-player">
            <button id="news-dialog-prev" type="button" className="btn ghost" disabled={cursor <= 0} aria-label="上一句" onClick={() => step(-1)}>
              <ChevronLeft size={14} />
            </button>
            <button
              id="news-dialog-play"
              type="button"
              className="btn ghost"
              aria-label={playing ? '暂停播放' : '继续播放'}
              disabled={lines.length <= 1}
              onClick={() => {
                if (showAll) return;
                // 已经播到最后一句时，再点就是从头重播。
                if (cursor >= lines.length - 1) { setCursor(0); setPlaying(true); return; }
                setPlaying(value => !value);
              }}
            >
              {playing && !showAll ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button id="news-dialog-next" type="button" className="btn ghost" disabled={cursor >= lines.length - 1} aria-label="下一句" onClick={() => step(1)}>
              <ChevronRight size={14} />
            </button>
            <span className="news-dialog-progress" id="news-dialog-progress">{counter}</span>
            <button id="news-dialog-all" type="button" className="btn ghost" onClick={() => { setShowAll(value => !value); setPlaying(false); }}>
              {showAll ? '逐条播放' : '看全文'}
            </button>
          </div>
        </section>
      ) : (
        <p className="news-dialog-note">还没有对话内容。{news ? '这段播报只有要闻，没有访谈。' : ''}</p>
      )}

      {news?.items?.length ? (
        <section className="news-dialog-items" aria-label="今日要闻">
          <h3>今日要闻</h3>
          <ul>{news.items.map((item, index) => <li key={`${item.tone}-${index}`} className={`tone-${item.tone}`}>{item.text}</li>)}</ul>
        </section>
      ) : null}

      <p className="news-dialog-note" id="news-dialog-preset">
        叙事者预设：{presetName ?? '（还没选）'} —— 读的是这份预设里「城市新闻」那一栏的词条；想看这一次实际发出去的全文，在控制台敲 <code>prompt</code>。
      </p>

      <div className="meeting-actions">
        <button id="news-dialog-close" type="button" className="btn" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}
