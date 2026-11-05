/**
 * 视觉小说开关（v93）。
 *
 * 默认关闭——关着时行为与「原文」完全一致，这是回归基线。
 * 存 localStorage，不进 GameState：它只是这台机器上的显示偏好。
 */
const KEY = 'night-sugar:vn-story';

export type VnStoryMode = 'off' | 'on';

export function loadVnStory(): VnStoryMode {
  try {
    return localStorage.getItem(KEY) === 'on' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export function saveVnStory(mode: VnStoryMode): void {
  try {
    localStorage.setItem(KEY, mode === 'on' ? 'on' : 'off');
  } catch {
    /* 存不进去就算了：下次刷新回到原文 */
  }
}

export const vnStoryEnabled = (mode: VnStoryMode): boolean => mode === 'on';
