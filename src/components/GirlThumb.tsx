import { useState } from 'react';
import type { Girl } from '../types';
import { usePortraitSrc } from '../usePortrait';

/**
 * 列表里的小头像：没有立绘（或图坏了）就画一个带名字首字的方块。
 *
 * 以前这些地方直接写 `<img src={girl.portrait}>`：图一缺就是一块空白，
 * 连名字首字都没有，看起来像界面坏了。
 */
export function GirlThumb({ girl, className = '' }: { girl: Pick<Girl, 'name' | 'portrait' | 'portraitAsset' | 'color'>; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = usePortraitSrc(girl);
  const style = { '--thumb-color': girl.color || '#c478b8' } as React.CSSProperties;
  if (src && !broken) {
    return <img className={className} src={src} alt="" style={style} onError={() => setBroken(true)} />;
  }
  return <span className={`${className} girl-thumb-fallback`} style={style} aria-hidden="true">{girl.name.slice(0, 1)}</span>;
}
