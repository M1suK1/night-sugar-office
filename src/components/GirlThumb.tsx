import { useState } from 'react';
import { usePortraitSrc } from '../usePortrait';
import { portraitSource, type PortraitSubjectLike } from '../portrait';

/**
 * 列表里的小头像：没有立绘（或图坏了）就画一个带名字首字的方块。
 *
 * v87：以前这里只认 `girl.portrait`，而契约卡导入的图其实存在衣柜那套礼装里
 * （`wardrobe[0].portrait`），于是同一张卡在大头像里能看见、在小头像里变成首字。
 * 现在走 `portraitSource()`，和大头像同一条规则（魔女形态 → 表情差分 → 礼装图 → 本体图）。
 */
export function GirlThumb({ girl, className = '' }: { girl: PortraitSubjectLike & { name: string; color?: string }; className?: string }) {
  const [broken, setBroken] = useState(false);
  const source = portraitSource(girl);
  const src = usePortraitSrc({ portrait: source.portrait, portraitAsset: source.asset });
  const style = { '--thumb-color': girl.color || '#c478b8' } as React.CSSProperties;
  if (src && !broken) {
    return <img className={className} src={src} alt="" style={style} onError={() => setBroken(true)} />;
  }
  return <span className={`${className} girl-thumb-fallback`} style={style} aria-hidden="true">{girl.name.slice(0, 1)}</span>;
}
