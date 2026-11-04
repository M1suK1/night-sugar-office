import { useState } from 'react';
import type { Girl } from '../types';

/**
 * 列表里的小头像：没有立绘（或图坏了）就画一个带名字首字的方块。
 *
 * 以前这些地方直接写 `<img src={girl.portrait}>`：图一缺就是一块空白，
 * 连名字首字都没有，看起来像界面坏了。
 */
export function GirlThumb({ girl, className = '' }: { girl: Pick<Girl, 'name' | 'portrait' | 'color'>; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { '--thumb-color': girl.color || '#c478b8' } as React.CSSProperties;
  if (girl.portrait && !broken) {
    return <img className={className} src={girl.portrait} alt="" style={style} onError={() => setBroken(true)} />;
  }
  return <span className={`${className} girl-thumb-fallback`} style={style} aria-hidden="true">{girl.name.slice(0, 1)}</span>;
}
