/** 会议地点（v168）：会客厅、天台，以及三方各自的辖区。 */
import type { GameState } from '../types.ts';
import { districtOrder, districts } from '../districts.ts';

export interface MeetingPlace {
  id: string;
  name: string;
  /** 一句话说明这场地适合开什么会。 */
  note: string;
}

export function meetingPlacesOf(state: GameState): MeetingPlace[] {
  const rooms: MeetingPlace[] = (state.rooms ?? [])
    .filter(room => room.type === 'lounge' || room.type === 'dorm')
    .map(room => ({ id: room.id, name: room.name, note: room.type === 'lounge' ? '一张长桌，灯在头顶。' : '床铺之间摆几张凳子。' }));
  const extras: MeetingPlace[] = [
    { id: 'roof', name: '事务所天台', note: '风大，说话要抬高一点。' },
  ];
  const street: MeetingPlace[] = districtOrder.map(id => ({
    id: `district:${id}`,
    name: districts[id].name,
    note: `在${districts[id].name}的街面上开，人来人往${state.territories?.[id] ? '' : '，这一段暂时无主' }。`,
  }));
  return [...rooms, ...extras, ...street];
}

export function meetingPlaceOf(state: GameState, placeId: string): MeetingPlace | undefined {
  return meetingPlacesOf(state).find(place => place.id === placeId);
}
