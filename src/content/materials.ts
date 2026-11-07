import type { Material, MaterialId } from '../types.ts';

export const materials: Material[] = [
  {
    id: 'mat-stardust',
    name: '星屑',
    element: '星光系',
    setId: 'set-starlight',
    description: '击碎星光系魔物或澄澈夜空中凝结的光尘碎片，微温且轻盈，是星辉套装的核心媒介。',
    color: '#e2dcff',
  },
  {
    id: 'mat-frosting',
    name: '糖霜晶',
    element: '糖霜系',
    setId: 'set-frosting',
    description: '自糖霜系魔物残骸中析出的甜味晶簇，触感冰凉柔韧，是编织甜晶套装的原料。',
    color: '#ffd4e5',
  },
  {
    id: 'mat-moonlight',
    name: '月华砂',
    element: '月影系',
    setId: 'set-moonlight',
    description: '沉淀于深邃暗影底层的冷色细砂，散发着微弱的月相残响，对应幽月套装。',
    color: '#d8b8f8',
  },
  {
    id: 'mat-dream',
    name: '梦呓絮',
    element: '梦境系',
    setId: 'set-dream',
    description: '浮游于梦境裂隙中的幻光棉絮，能折射出不稳定的幻象，是织梦套装的编织线。',
    color: '#b2e8f8',
  },
  {
    id: 'mat-nature',
    name: '藤心脂',
    element: '自然系',
    setId: 'set-nature',
    description: '从变异林木与自然系魔物核心提取的常青树脂，蕴含坚韧生机，常磐套装之源。',
    color: '#b2f0c8',
  },
  {
    id: 'mat-cinder',
    name: '余火种',
    element: '赤焰系',
    setId: 'set-cinder',
    description: '焦土与赤焰魔物心脏中长明不灭的灼热余烬，触碰时杀意自生，焚烬套装的薪柴。',
    color: '#ffb8a2',
  },
];

export const materialById = new Map<MaterialId, Material>(materials.map(m => [m.id, m]));

export function findMaterial(id: string | undefined): Material | undefined {
  return id ? materialById.get(id as MaterialId) : undefined;
}
