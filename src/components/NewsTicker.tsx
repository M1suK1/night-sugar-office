import { useEffect, useRef, useState } from 'react';
import type { CityNews } from '../types';

/** 一句停留多久（毫秒）。 */
const DWELL_MS = 3400;

/**
 * 首页那块新闻卡（v177）：在卡片里上下滚动播放。
 *
 * 访谈最多十句，一次铺开会把整块面板撑长；这里让它像电台的滚动字幕一样，
 * 一句一句往上走，走到头再回第一句。鼠标停在上面就暂停，方便看清楚。
 */
export function NewsTicker({ news }: { news?: CityNews }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const lines = news?.lines ?? [];

  useEffect(() => {
    setIndex(0);
    boxRef.current?.scrollTo({ top: 0 });
  }, [news?.day, news?.headline, lines.length]);

  useEffect(() => {
    if (lines.length <= 1 || paused) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % lines.length), DWELL_MS);
    return () => window.clearInterval(timer);
  }, [lines.length, paused, news?.headline]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const target = box.querySelectorAll<HTMLElement>('.news-ticker-line')[index];
    if (!target) return;
    box.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  }, [index, lines.length]);

  return (
    <div
      className="news-ticker"
      id="dispatch-news-ticker"
      ref={boxRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="news-ticker-inner">
        <ol className="news-lines">
          {lines.map((line, at) => (
            <li
              key={`${line.speakerId}-${at}`}
              className={`news-ticker-line ${line.speakerId === news?.host?.id ? 'is-host' : 'is-guest'}${at === index ? ' is-current' : ''}`}
            >
              <span className="news-speaker">{line.speakerName}</span>
              <p>{line.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
