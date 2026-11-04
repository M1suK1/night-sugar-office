import { useEffect, useState } from 'react';
import { assetUrl } from './store.ts';
import type { Girl } from './types.ts';

/**
 * 立绘的实际来源：优先内联的 data URL，没有就按 `portraitAsset` 去资产库取。
 *
 * v92 之后存档里只留资产 id，读档时虽然会统一 hydrate 回来，但只要有一步没跑成
 * （资产被清理、切页太快、单位置刷新），界面上就会显示成剪影。
 * 这里让每个头像自己兜底：手里只有 id 也能把图画出来。
 */
export function usePortraitSrc(girl: Pick<Girl, 'portrait' | 'portraitAsset'>): string {
  const [resolved, setResolved] = useState('');
  useEffect(() => {
    if (girl.portrait || !girl.portraitAsset) { setResolved(''); return; }
    let alive = true;
    void assetUrl(girl.portraitAsset)
      .then(url => { if (alive) setResolved(url ?? ''); })
      .catch(() => { /* 取不到就当没有图 */ });
    return () => { alive = false; };
  }, [girl.portrait, girl.portraitAsset]);
  return girl.portrait || resolved;
}
