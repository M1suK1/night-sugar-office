import type { Equipment, EquipmentSet, EquipmentSetId } from '../types.ts';

export const equipmentSets: EquipmentSet[] = [
  {
    id: 'set-starlight',
    name: '星辉套装',
    element: '星光系',
    materialId: 'mat-stardust',
    skillName: '极光序曲',
    skillDescription: '战斗首轮即可直接施放奥义技能（解除第 2 轮限制）；且开局首轮获得「迅捷」（速度 +8）。',
    color: '#e2dcff',
  },
  {
    id: 'set-frosting',
    name: '甜晶套装',
    element: '糖霜系',
    materialId: 'mat-frosting',
    skillName: '甘饴庇护',
    skillDescription: '开局获得相当于生命上限 20% 的护盾（持续 2 轮）；受到致命直击且心防未碎时，免死 1 次保留 1 点生命。',
    color: '#ffd4e5',
  },
  {
    id: 'set-moonlight',
    name: '幽月套装',
    element: '月影系',
    materialId: 'mat-moonlight',
    skillName: '暗蚀残响',
    skillDescription: '伤害性法术攻击附带 20% 穿透伤害；受击时给攻击者附加 2 轮「虚弱」（使其造成的伤害降低 15%）。',
    color: '#d8b8f8',
  },
  {
    id: 'set-dream',
    name: '织梦套装',
    element: '梦境系',
    materialId: 'mat-dream',
    skillName: '镜花幻影',
    skillDescription: '开局进入「幻影」状态，第 1 轮受到的首个单体攻击必定 Miss 偏折；攻击时 35% 几率令目标失衡 1 轮。',
    color: '#b2e8f8',
  },
  {
    id: 'set-nature',
    name: '常磐套装',
    element: '自然系',
    materialId: 'mat-nature',
    skillName: '常磐护卫',
    skillDescription: '每场战斗 1 次在友方受到直接伤害时挺身而出替其承受；且每轮开始时自愈已损失生命的 10%。',
    color: '#b2f0c8',
  },
  {
    id: 'set-cinder',
    name: '焚烬套装',
    element: '赤焰系',
    materialId: 'mat-cinder',
    skillName: '烈火焚身',
    skillDescription: '任意攻击命中必附加 2 轮「灼伤」（持续伤害）；自身生命低于 50% 时全伤害激增 25%。',
    color: '#ffb8a2',
  },
];

export const equipmentSetById = new Map<EquipmentSetId, EquipmentSet>(
  equipmentSets.map(set => [set.id, set]),
);

export function findEquipmentSet(id: string | undefined): EquipmentSet | undefined {
  return id ? equipmentSetById.get(id as EquipmentSetId) : undefined;
}

/** 现存 60 件法器与护符的套装归属字典。 */
export const ITEM_SET_MAP: Record<string, EquipmentSetId> = {
  // ── 星辉套装 (星光系 / 星屑) ──
  't1-assoc-lantern-rod': 'set-starlight',
  't1-assoc-thread-whip': 'set-starlight',
  't1-assoc-lamp-charm': 'set-starlight',
  't2-assoc-wick-whip': 'set-starlight',
  't2-assoc-lamp-brooch': 'set-starlight',
  't2-assoc-silver-band': 'set-starlight',
  'silver-wand': 'set-starlight',
  'association-badge': 'set-starlight',
  't4-assoc-starfall-staff': 'set-starlight',
  't5-assoc-last-lamp': 'set-starlight',

  // ── 甜晶套装 (糖霜系 / 糖霜晶) ──
  't1-assoc-chalk-wand': 'set-frosting',
  't2-assoc-stitch-staff': 'set-frosting',
  't3-assoc-starweave': 'set-frosting',
  't1-assoc-sugar-cube': 'set-frosting',
  't1-witch-black-salt': 'set-frosting',
  't1-gov-shift-bell': 'set-frosting',
  't2-witch-blood-salt': 'set-frosting',
  'black-sugar': 'set-frosting',
  't2-gov-shift-band': 'set-frosting',
  'pocket-watch': 'set-frosting',
  't3-assoc-choir-ribbon': 'set-frosting',
  't3-gov-duty-plate': 'set-frosting',
  't4-assoc-choir-cape': 'set-frosting',

  // ── 幽月套装 (月影系 / 月华砂) ──
  't1-witch-eclipse-token': 'set-moonlight',
  't1-gov-number-tag': 'set-moonlight',
  't2-witch-bone-lance': 'set-moonlight',
  't2-witch-vesper-staff': 'set-moonlight',
  't2-witch-eclipse-earring': 'set-moonlight',
  't3-witch-eclipse-staff': 'set-moonlight',
  't3-witch-moonveil': 'set-moonlight',
  'moon-weapon': 'set-moonlight',
  'night-ring': 'set-moonlight',
  't4-witch-eclipse-scepter': 'set-moonlight',
  't5-witch-eclipse-heart': 'set-moonlight',

  // ── 织梦套装 (梦境系 / 梦呓絮) ──
  't1-witch-bone-needle': 'set-dream',
  't1-witch-moth-wing': 'set-dream',
  't1-gov-lead-ring': 'set-dream',
  't1-gov-tin-whistle': 'set-dream',
  't2-gov-searchlight': 'set-dream',
  't3-assoc-lantern-flail': 'set-dream',
  't3-assoc-keeper-gloves': 'set-dream',
  't3-gov-archive-blade': 'set-dream',
  't4-gov-sealed-armor': 'set-dream',
  't5-gov-sealed-verdict': 'set-dream',

  // ── 常磐套装 (自然系 / 藤心脂) ──
  't1-witch-thorn-wand': 'set-nature',
  't1-witch-thorn-censer': 'set-nature',
  't1-assoc-feather-pin': 'set-nature',
  't1-assoc-reed-wand': 'set-nature',
  't1-gov-baton': 'set-nature',
  't2-gov-serial-baton': 'set-nature',
  't3-witch-night-thorn': 'set-nature',
  't4-witch-thorn-crown': 'set-nature',

  // ── 焚烬套装 (赤焰系 / 余火种) ──
  't1-witch-cinder-staff': 'set-cinder',
  't1-gov-stamp-wand': 'set-cinder',
  't1-gov-flare-rod': 'set-cinder',
  't2-gov-suppress-rod': 'set-cinder',
  'riot-charm': 'set-cinder',
  't3-witch-cinder-ring': 'set-cinder',
  't3-gov-riot-rod': 'set-cinder',
  't4-gov-verdict': 'set-cinder',
};

const ALL_SET_IDS: EquipmentSetId[] = [
  'set-starlight',
  'set-frosting',
  'set-moonlight',
  'set-dream',
  'set-nature',
  'set-cinder',
];

/** 推断或分配装备所属套装。消耗品不归入套装。 */
export function setOfItem(item: Pick<Equipment, 'id' | 'slot'>): EquipmentSetId | undefined {
  if (item.slot === 'consumable') return undefined;
  if (ITEM_SET_MAP[item.id]) return ITEM_SET_MAP[item.id];
  let sum = 0;
  for (let i = 0; i < item.id.length; i += 1) sum = (sum * 31 + item.id.charCodeAt(i)) % 9973;
  return ALL_SET_IDS[sum % ALL_SET_IDS.length];
}

/** 包装装备：确保武器和护符具备 setId。 */
export function withItemSet(item: Equipment): Equipment {
  if (item.slot === 'consumable') return item;
  if (item.setId) return item;
  const setId = setOfItem(item);
  return setId ? { ...item, setId } : item;
}
