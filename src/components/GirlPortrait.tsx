import { useId } from 'react';
import type { Expression, Outfit, PortraitSpec } from '../types';
import { currentExpressionOutfitId, expressionLabel, expressionVariantKey, expressionOutfits } from '../expressions';

/** 立绘只依赖这几项；我方 Girl 与敌方 BattleUnit 都能适配成这个形状。 */
export interface PortraitSubject {
  id: string;
  name: string;
  color: string;
  portrait: string;
  codename?: string;
  expression?: Expression;
  wardrobe?: Outfit[];
  outfitId?: string;
  corruption?: number;
  witch?: boolean;
  witchForm?: Outfit;
  portraitSpec?: PortraitSpec;
  importedVariants?: Record<string, string>;
  /** 原图的取景：与导入时的拖动/缩放一致。 */
  portraitCrop?: { zoom: number; x: number; y: number };
}

const expressionEyes: Record<Expression, { open: number; tilt: number; mouth: string }> = {
  calm: { open: 1, tilt: 0, mouth: 'M-9 2 Q0 5 9 2' },
  smile: { open: 0.7, tilt: -2, mouth: 'M-10 0 Q0 9 10 0' },
  surprise: { open: 1.25, tilt: 0, mouth: 'M-3 -1 Q0 7 3 -1 Q0 3 -3 -1' },
  sad: { open: 1, tilt: 3, mouth: 'M-9 5 Q0 -2 9 5' },
  angry: { open: 0.85, tilt: -5, mouth: 'M-9 4 L9 1' },
  shy: { open: 0.55, tilt: -1, mouth: 'M-8 2 Q0 7 8 2' },
};

/**
 * 取景只在显示层做：存的是原图，容器用 `object-fit: cover` 裁。
 *
 * `anchor` 决定裁到哪一段：竖版卡片取中段略偏下（+6 偏移，避免切头顶）；
 * 市场候选卡那种 2.5:1 的横幅只露出一条，必须取脸所在的靠上区域，
 * 否则一条横幅裁在胸口上，画面上只剩衣料。
 */
function cropStyle(crop: { zoom: number; x: number; y: number } | undefined, anchor: 'center' | 'face') {
  const zoom = Math.max(1, Math.min(4, crop?.zoom ?? 1));
  const y = Math.max(-100, Math.min(100, crop?.y ?? 0));
  const x = Math.max(-100, Math.min(100, crop?.x ?? 0));
  const biasY = anchor === 'face' ? -45 : 6;
  const posY = Math.max(0, Math.min(100, 50 - y / 2 + biasY));
  return { objectPosition: `${50 - x / 2}% ${posY}%`, transform: zoom === 1 ? undefined : `scale(${zoom})` } as const;
}

export function GirlPortrait({ girl, variant = 'card', className = '', bare = false, anchor = 'center' }: { girl: PortraitSubject; variant?: 'card' | 'full' | 'avatar'; className?: string; bare?: boolean; anchor?: 'center' | 'face' }) {
  const id = useId().replace(/:/g, '');
  const activeOutfitId = currentExpressionOutfitId(girl);
  const wardrobe = expressionOutfits(girl).find(o => o.id === activeOutfitId);
  const outfitColor = wardrobe?.palette?.[0] ?? girl.color;
  const outfitKey = wardrobe?.layerKey ?? activeOutfitId;
  const expression = (girl.expression ?? 'calm') as Expression;
  const face = expressionEyes[expression] ?? expressionEyes.calm;
  const seed = Array.from(girl.id + girl.name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const longHair = seed % 3 !== 0;
  const sideTail = seed % 2 === 0;
  const corruption = girl.corruption ?? 0;
  const gemCore = girl.witch ? '#d85a7f' : corruption >= 40 ? '#c478b8' : '#fff2f8';

  const portrait = wardrobe?.portrait?.startsWith('data:') ? wardrobe.portrait : girl.portrait;
  const variantKey = expressionVariantKey(activeOutfitId, expression);
  const expressionVariant = girl.importedVariants?.[variantKey];
  const activeVariant = expressionVariant?.startsWith('data:image/') ? expressionVariant : undefined;
  const shownPortrait = activeVariant ?? portrait;
  if (shownPortrait?.startsWith('data:')) {
    return (
      <span
        className={`girl-portrait ${variant} imported ${activeVariant ? 'expression-variant' : ''} ${bare ? 'bare' : ''} ${className}`}
        data-expression={expression}
        data-expression-variant={activeVariant ? expression : undefined}
      >
        <img
          src={shownPortrait}
          alt={activeVariant ? `${girl.name}的${expressionLabel(expression)}表情` : `${girl.name}的立绘`}
          style={cropStyle(activeVariant ? undefined : girl.portraitCrop, anchor)}
        />
      </span>
    );
  }
  return (
    <span className={`girl-portrait ${variant} ${girl.witch ? 'witch' : ''} ${bare ? 'bare' : ''} ${className}`} data-expression={expression} style={{ '--portrait-color': outfitColor, '--portrait-accent': girl.color } as React.CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 260 340" preserveAspectRatio="xMidYMax meet" role="presentation">
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#19101f" /><stop offset="0.52" stopColor="#0b0910" /><stop offset="1" stopColor="#050408" />
          </linearGradient>
          <radialGradient id={`glow-${id}`} cx="50%" cy="36%" r="58%">
            <stop offset="0" stopColor={outfitColor} stopOpacity="0.38" /><stop offset="0.65" stopColor={girl.color} stopOpacity="0.1" /><stop offset="1" stopColor={girl.color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={outfitColor} stopOpacity="0.56" /><stop offset="0.42" stopColor="#120d18" /><stop offset="1" stopColor="#060509" />
          </linearGradient>
          <radialGradient id={`face-${id}`} cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#241927" /><stop offset="1" stopColor="#09070d" />
          </radialGradient>
        </defs>
        {!bare && <rect width="260" height="340" fill={`url(#bg-${id})`} />}
        {!bare && <rect width="260" height="340" fill={`url(#glow-${id})`} />}

        {/* Baroque Labyrinth Halo & Filigree */}
        <g opacity="0.28" stroke="#f7f2f5" strokeWidth="0.6" fill="none">
          <circle cx="130" cy="134" r="88" stroke={outfitColor} strokeOpacity="0.55" />
          <circle cx="130" cy="134" r="76" strokeDasharray="3 5" />
          <path d="M130 34 L135 46 L130 58 L125 46 Z M42 134 L54 129 L66 134 L54 139 Z M218 134 L206 129 L194 134 L206 139 Z" fill={outfitColor} fillOpacity="0.35" stroke="none" />
          <path d="M14 14 H42 M14 14 V42 M246 14 H218 M246 14 V42" stroke={outfitColor} strokeOpacity="0.65" strokeWidth="1" />
        </g>

        <g opacity="0.36" fill="#f7f2f5">
          <path d="M38 96 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3Z" fill={outfitColor} />
          <path d="M216 150 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2Z" />
        </g>

        {longHair && <path d={sideTail ? 'M66 148 C40 196 42 264 62 308 C82 278 82 220 94 182Z' : 'M60 156 C36 212 50 274 72 310 C88 272 84 218 96 178Z'} fill={girl.color} opacity="0.24" stroke="#f7f2f5" strokeOpacity="0.28" />}
        {longHair && <path d={sideTail ? 'M194 148 C220 196 218 264 198 308 C178 278 178 220 166 182Z' : 'M200 156 C224 212 210 274 188 310 C172 272 176 218 164 178Z'} fill={girl.color} opacity="0.18" stroke={girl.color} strokeOpacity="0.3" />}

        {/* Torso & Outfit Silhouette */}
        <path d="M44 340 C48 264 78 222 112 208 L148 208 C182 222 212 264 216 340Z" fill={`url(#body-${id})`} stroke="#f7f2f5" strokeOpacity="0.36" strokeWidth="1.1" />
        <path d="M100 212 L160 212 L148 292 L130 312 L112 292Z" fill="#07050a" opacity="0.82" stroke={outfitColor} strokeOpacity="0.4" strokeWidth="0.8" />

        {/* Outfit-specific Collar & Lace Geometry */}
        {outfitKey.includes('formal') ? (
          <g>
            <path d="M74 226 C94 204 114 206 130 220 C146 206 166 204 186 226 L172 262 L130 244 L88 262Z" fill={outfitColor} fillOpacity="0.34" stroke="#f7f2f5" strokeOpacity="0.65" strokeWidth="1" />
            <path d="M104 206 L130 232 L156 206" stroke="#f7f2f5" strokeWidth="1.2" fill="none" strokeDasharray="2 2" />
          </g>
        ) : outfitKey.includes('casual') ? (
          <g>
            <path d="M64 236 C86 210 110 206 130 214 C150 206 174 210 196 236 L184 276 C162 262 98 262 76 276Z" fill={outfitColor} fillOpacity="0.26" stroke={outfitColor} strokeOpacity="0.65" strokeWidth="1.1" />
          </g>
        ) : (
          <g>
            <path d="M84 216 L112 208 L130 232 L148 208 L176 216 L164 252 L130 238 L96 252Z" fill={outfitColor} fillOpacity="0.3" stroke="#f7f2f5" strokeOpacity="0.55" strokeWidth="1" />
            <path d="M92 254 C108 244 152 244 168 254" stroke={outfitColor} strokeWidth="1.3" fill="none" opacity="0.7" />
          </g>
        )}

        {/* Soul Gem Brooch on Chest */}
        <g transform="translate(130 236)">
          <path d="M0 -13 L10 0 L0 13 L-10 0 Z" fill="#09070e" stroke="#f7f2f5" strokeWidth="1.1" opacity="0.95" />
          <ellipse cx="0" cy="0" rx="5" ry="7.5" fill={outfitColor} opacity="0.88" />
          <ellipse cx="0" cy="-1" rx="2.4" ry="4" fill={gemCore} />
        </g>

        <path d="M116 196 L116 182 L144 182 L144 196Z" fill="#0b0810" />
        <ellipse cx="130" cy="146" rx="48" ry="54" fill={`url(#face-${id})`} stroke="#f7f2f5" strokeOpacity="0.22" strokeWidth="0.9" />
        <path d="M82 158 C64 104 82 52 130 48 C180 44 200 96 184 160 L180 192 C170 152 160 122 130 118 C98 120 88 152 80 194Z" fill={girl.color} opacity="0.38" stroke="#f7f2f5" strokeOpacity="0.48" strokeWidth="1.1" />
        <path d="M88 120 C96 78 118 64 132 64 C152 66 168 84 174 116 C158 96 144 88 130 102 C116 88 102 94 88 120Z" fill={girl.color} opacity="0.78" />
        <path d="M84 158 C74 178 72 196 78 214 C88 198 94 182 96 168Z" fill={girl.color} opacity="0.46" />
        <path d="M176 158 C186 178 188 196 182 214 C172 198 166 182 164 168Z" fill={girl.color} opacity="0.46" />

        <g transform="translate(130 148)" fill="#fff0f6">
          <g style={{ transform: `scaleY(${face.open})`, transformOrigin: '0 -4px' }}>
            <path d={`M-24 ${-2 + face.tilt} Q-16 ${-8 + face.tilt} -8 ${-2 + face.tilt} Q-16 ${3 + face.tilt} -24 ${-2 + face.tilt}Z`} opacity="0.96" />
            <path d={`M8 ${-2 + face.tilt} Q16 ${-8 + face.tilt} 24 ${-2 + face.tilt} Q16 ${3 + face.tilt} 8 ${-2 + face.tilt}Z`} opacity="0.96" />
          </g>
          <g fill={outfitColor} opacity="0.45">
            <ellipse cx="-31" cy="12" rx="9" ry="4.5" /><ellipse cx="31" cy="12" rx="9" ry="4.5" />
          </g>
          <path d={face.mouth} stroke="#ffd6e5" strokeWidth="1.7" fill="none" strokeLinecap="round" transform="translate(0 24)" opacity="0.88" />
        </g>

        <path d="M94 196 C110 190 122 192 130 200 C138 192 150 190 166 196" stroke="#f7f2f5" strokeWidth="1.6" fill="none" opacity="0.75" />
        <path d="M84 92 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4Z" fill="#ffd6e5" opacity="0.9" />

        {corruption >= 1 && <g stroke="#d85a7f" strokeWidth="1.2" fill="none" opacity={0.35 + Math.min(0.55, corruption / 130)}>
          <path d="M92 246 C106 266 100 288 116 308" /><path d="M166 240 C152 264 162 286 146 312" />
          <circle cx="130" cy="236" r="18" strokeDasharray="2 3" />
        </g>}
        {girl.witch && <g fill="none" stroke="#ffd6e5" strokeWidth="2.6" opacity="0.92"><path d="M86 72 C70 46 66 32 62 16 C78 30 88 46 96 66" /><path d="M174 72 C190 46 194 32 198 16 C182 30 172 46 164 66" /></g>}
        {!bare && <path d="M0 340 H260" stroke="#f7f2f5" strokeWidth="1" opacity="0.28" />}
      </svg>
      {!bare && <span className="portrait-vignette" />}
    </span>
  );
}
