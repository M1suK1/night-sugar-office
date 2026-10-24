import { useId } from 'react';
import type { MonsterTemplate } from '../types';

const shapes: Record<MonsterTemplate['spec']['bodyPlan'], string> = {
  machine: 'M34 44 L86 44 L92 78 L78 96 L42 96 L28 78 Z',
  feline: 'M36 58 C36 44 48 38 60 38 C72 38 84 44 84 58 L82 84 L70 92 L50 92 L38 84 Z',
  humanoid: 'M60 18 L74 30 L80 62 L92 100 L28 100 L40 62 L46 30 Z',
  moth: 'M60 34 C34 26 20 44 24 70 C28 92 48 92 60 74 C72 92 92 92 96 70 C100 44 86 26 60 34 Z',
  orb: 'M60 22 C82 22 98 40 98 60 C98 82 80 98 60 98 C40 98 22 82 22 60 C22 40 38 22 60 22 Z',
  swarm: 'M26 44 L40 30 L54 46 L44 60 Z M64 32 L78 18 L92 36 L80 50 Z M52 66 L68 54 L84 70 L70 84 Z M22 78 L36 64 L50 82 L36 96 Z',
};
const auras: Record<MonsterTemplate['spec']['aura'], string> = {
  静电: 'M18 30 L26 38 L18 46 M96 68 L104 76 L96 84',
  余烬: 'M22 96 C18 84 26 78 24 68 M98 24 C94 34 102 40 100 50',
  花瓣: 'M20 26 C30 20 34 30 26 36 C18 42 14 32 20 26 M100 88 C92 82 96 72 104 76 C112 80 108 92 100 88',
  故障: 'M20 22 L36 22 M84 100 L100 100 M28 52 L42 52 M78 64 L94 64',
};

export function MonsterGlyph({ monster, size = 96, className = '' }: { monster: MonsterTemplate; size?: number; className?: string }) {
  const raw = useId();
  const id = `mg-${raw.replace(/[^a-zA-Z0-9-]/g, '')}`;
  const { spec } = monster;
  const aura = auras[spec.aura];
  return (
    <svg className={`monster-glyph ${className}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${monster.name}，${monster.epithet}`}>
      <defs>
        <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={spec.palette.rim} stopOpacity=".95" />
          <stop offset="60%" stopColor={spec.palette.rim} stopOpacity=".25" />
          <stop offset="100%" stopColor={spec.palette.rim} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={spec.palette.body} />
          <stop offset="100%" stopColor={spec.palette.shade} />
        </linearGradient>
        <clipPath id={`${id}-clip`}><path d={shapes[spec.bodyPlan]} /></clipPath>
      </defs>
      <circle cx="60" cy="60" r="54" fill={`url(#${id}-core)`} opacity=".35" />
      <path d={shapes[spec.bodyPlan]} fill={`url(#${id}-body)`} stroke={spec.palette.rim} strokeWidth="1.1" strokeOpacity=".65" transform={`translate(60 60) scale(${spec.scale}) translate(-60 -60)`} />
      <g clipPath={`url(#${id}-clip)`} opacity=".55">
        {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${18 + i * 12} 120 L${34 + i * 12} 14`} stroke={spec.palette.rim} strokeWidth=".6" opacity=".35" />)}
      </g>
      <path d={shapes[spec.bodyPlan]} fill="none" stroke={spec.palette.rim} strokeWidth="1" strokeOpacity=".9" transform={`translate(60 60) scale(${spec.scale * 0.82}) translate(-60 -60)`} strokeDasharray="3 4" />
      <g className="monster-core">
        <circle cx="60" cy="54" r="7" fill={spec.palette.rim} opacity=".9" />
        <circle cx="60" cy="54" r="13" fill="none" stroke={spec.palette.rim} strokeWidth=".8" opacity=".5" />
        <circle cx="60" cy="54" r="19" fill="none" stroke={spec.palette.rim} strokeWidth=".5" opacity=".25" />
      </g>
      <path d={aura} fill="none" stroke={spec.palette.rim} strokeWidth="1.1" strokeLinecap="round" opacity=".7" />
      {Array.from({ length: Math.min(6, Math.max(2, spec.appendages - 2)) }, (_, i) => <circle key={i} cx={22 + i * 16} cy={spec.bodyPlan === 'orb' ? 104 : 108} r="1.4" fill={spec.palette.rim} opacity={0.35 + i * 0.08} />)}
      <g opacity=".8">
        {spec.motif === '猫' && <path d="M92 34 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z" fill={spec.palette.rim} opacity=".55" />}
        {spec.motif === '糖' && <rect x="92" y="30" width="9" height="9" rx="2" transform="rotate(18 96 34)" fill="none" stroke={spec.palette.rim} strokeWidth="1" opacity=".7" />}
        {spec.motif === '星' && <path d="M96 26 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z" fill={spec.palette.rim} opacity=".7" />}
        {spec.motif === '月' && <path d="M98 26 a8 8 0 1 0 6 13 a7 7 0 0 1 -6 -13 Z" fill={spec.palette.rim} opacity=".55" />}
        {spec.motif === '蝶' && <path d="M94 32 q10 -6 12 4 q-8 6 -12 -4 M94 32 q-8 -2 -6 8 q8 2 6 -8" fill="none" stroke={spec.palette.rim} strokeWidth="1" opacity=".7" />}
        {spec.motif === '钟' && <><circle cx="97" cy="33" r="6" fill="none" stroke={spec.palette.rim} strokeWidth="1" opacity=".7" /><path d="M97 33 V29 M97 33 L100 35" stroke={spec.palette.rim} strokeWidth="1" /></>}
      </g>
      <text x="60" y="117" textAnchor="middle" fontSize="6" letterSpacing="2" fill={spec.palette.rim} opacity=".55">{spec.core}核</text>
    </svg>
  );
}
