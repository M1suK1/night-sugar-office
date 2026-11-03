import { directorLabel, directorPortraitOf, loadPlayerProfile, type PlayerProfile } from '../player';
import type { Expression } from '../types';

/**
 * 所长的头像。有图就按表情取那一张，没有就画一个描边剪影——
 * 少女那边的 GirlPortrait 有整套衣柜与魔女化，所长只有这一张脸，不套那套机制。
 */
export function DirectorPortrait({ profile, expression, className = '' }: {
  profile?: PlayerProfile; expression?: Expression; className?: string;
}) {
  const person = profile ?? loadPlayerProfile();
  const src = directorPortraitOf(person, expression);
  const label = directorLabel(person);
  if (!src) return <span className={`director-portrait missing ${className}`} aria-hidden="true">{label.slice(0, 1)}</span>;
  const crop = person.portraitCrop;
  const style = crop ? { objectPosition: `${crop.x * 100}% ${crop.y * 100}%`, transform: `scale(${crop.zoom})` } : undefined;
  return <span className={`director-portrait ${className}`}><img src={src} alt={label} style={style} /></span>;
}
