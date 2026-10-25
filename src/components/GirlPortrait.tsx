import { useId } from 'react';
import type { Expression, Girl } from '../types';

const expressionEyes: Record<Expression, { open: number; tilt: number; mouth: string }> = {
  calm: { open: 1, tilt: 0, mouth: 'M-9 2 Q0 5 9 2' },
  smile: { open: 0.7, tilt: -2, mouth: 'M-10 0 Q0 9 10 0' },
  surprise: { open: 1.25, tilt: 0, mouth: 'M-3 -1 Q0 7 3 -1 Q0 3 -3 -1' },
  sad: { open: 1, tilt: 3, mouth: 'M-9 5 Q0 -2 9 5' },
  angry: { open: 0.85, tilt: -5, mouth: 'M-9 4 L9 1' },
  shy: { open: 0.55, tilt: -1, mouth: 'M-8 2 Q0 7 8 2' },
};

export function GirlPortrait({ girl, variant = 'card', className = '' }: { girl: Girl; variant?: 'card' | 'full' | 'avatar'; className?: string }) {
  const id = useId().replace(/:/g, '');
  const wardrobe = girl.wardrobe?.find(o => o.id === girl.outfitId);
  const outfitColor = wardrobe?.palette?.[0] ?? girl.color;
  const expression = (girl.expression ?? 'calm') as Expression;
  const face = expressionEyes[expression] ?? expressionEyes.calm;
  const seed = Array.from(girl.id + girl.name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const longHair = seed % 3 !== 0;
  const sideTail = seed % 2 === 0;
  if (girl.portrait?.startsWith('data:')) {
    return <span className={`girl-portrait ${variant} imported ${className}`}><img src={girl.portrait} alt={`${girl.name}的立绘`} /></span>;
  }
  return (
    <span className={`girl-portrait ${variant} ${girl.witch ? 'witch' : ''} ${className}`} style={{ '--portrait-color': outfitColor, '--portrait-accent': girl.color } as React.CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 260 340" preserveAspectRatio="xMidYMax meet" role="presentation">
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#231528" /><stop offset="0.55" stopColor="#100d16" /><stop offset="1" stopColor="#08070c" />
          </linearGradient>
          <radialGradient id={`glow-${id}`} cx="50%" cy="34%" r="60%">
            <stop offset="0" stopColor={girl.color} stopOpacity="0.4" /><stop offset="1" stopColor={girl.color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={outfitColor} stopOpacity="0.5" /><stop offset="0.45" stopColor="#15101c" /><stop offset="1" stopColor="#09070e" />
          </linearGradient>
          <radialGradient id={`face-${id}`} cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#211722" /><stop offset="1" stopColor="#0b0810" />
          </radialGradient>
        </defs>
        <rect width="260" height="340" fill={`url(#bg-${id})`} />
        <rect width="260" height="340" fill={`url(#glow-${id})`} />
        <g opacity="0.24" stroke={girl.color} strokeWidth="0.6">
          {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${18 + i * 36} 0 V340`} opacity={i % 2 ? 0.2 : 0.45} />)}
        </g>
        <g opacity="0.3" fill={girl.color}>
          <path d="M38 96 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3Z" />
          <path d="M216 150 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2Z" />
        </g>
        {longHair && <path d={sideTail ? 'M68 150 C44 196 46 262 64 302 C82 276 82 220 94 182Z' : 'M62 158 C38 212 52 272 74 306 C88 270 84 218 96 178Z'} fill={girl.color} opacity="0.2" stroke={girl.color} strokeOpacity="0.35" />}
        <path d="M46 340 C50 266 80 224 112 210 L148 210 C182 226 210 268 214 340Z" fill={`url(#body-${id})`} stroke={girl.color} strokeOpacity="0.38" strokeWidth="1" />
        <path d="M112 210 C118 198 122 190 130 190 C138 190 142 198 148 210" fill={outfitColor} opacity="0.45" />
        <path d="M100 214 L160 214 L148 288 L130 306 L112 288Z" fill="#08060c" opacity="0.75" />
        <path d="M92 252 C108 244 152 244 168 252" stroke={girl.color} strokeWidth="1.2" fill="none" opacity="0.55" />
        <path d="M116 196 L116 182 L144 182 L144 196Z" fill="#0b0810" />
        <ellipse cx="130" cy="146" rx="48" ry="54" fill={`url(#face-${id})`} />
        <path d="M82 158 C64 104 82 52 130 48 C180 44 200 96 184 160 L180 192 C170 152 160 122 130 118 C98 120 88 152 80 194Z" fill={girl.color} opacity="0.34" stroke={girl.color} strokeOpacity="0.7" strokeWidth="1.2" />
        <path d="M88 120 C96 78 118 64 132 64 C152 66 168 84 174 116 C158 96 144 88 130 102 C116 88 102 94 88 120Z" fill={girl.color} opacity="0.72" />
        <path d="M84 158 C74 178 72 196 78 214 C88 198 94 182 96 168Z" fill={girl.color} opacity="0.42" />
        <path d="M176 158 C186 178 188 196 182 214 C172 198 166 182 164 168Z" fill={girl.color} opacity="0.42" />
        <g transform="translate(130 148)" fill="#ffe3ee">
          <g style={{ transform: `scaleY(${face.open})`, transformOrigin: '0 -4px' }}>
            <path d={`M-24 ${-2 + face.tilt} Q-16 ${-8 + face.tilt} -8 ${-2 + face.tilt} Q-16 ${3 + face.tilt} -24 ${-2 + face.tilt}Z`} opacity="0.92" />
            <path d={`M8 ${-2 + face.tilt} Q16 ${-8 + face.tilt} 24 ${-2 + face.tilt} Q16 ${3 + face.tilt} 8 ${-2 + face.tilt}Z`} opacity="0.92" />
          </g>
          <g fill={girl.color} opacity="0.42">
            <ellipse cx="-31" cy="12" rx="9" ry="4.5" /><ellipse cx="31" cy="12" rx="9" ry="4.5" />
          </g>
          <path d={face.mouth} stroke="#f6c9da" strokeWidth="1.6" fill="none" strokeLinecap="round" transform="translate(0 24)" opacity="0.78" />
        </g>
        <path d="M94 196 C110 190 122 192 130 200 C138 192 150 190 166 196" stroke={girl.color} strokeWidth="2" fill="none" opacity="0.8" />
        <path d="M84 92 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4Z" fill={girl.color} opacity="0.85" />
        {girl.corruption >= 1 && <g stroke="#d9a7ff" fill="none" opacity={0.25 + Math.min(0.55, girl.corruption / 140)}>
          <path d="M92 246 C106 266 100 288 116 308" /><path d="M166 240 C152 264 162 286 146 312" />
        </g>}
        {girl.witch && <g fill="none" stroke="#e2c4ff" strokeWidth="3" opacity="0.85"><path d="M86 72 C74 50 68 38 66 24" /><path d="M174 72 C186 50 192 38 194 24" /></g>}
        <path d="M0 340 H260" stroke={girl.color} strokeWidth="1" opacity="0.22" />
      </svg>
      <span className="portrait-vignette" />
    </span>
  );
}
