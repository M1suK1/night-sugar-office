/**
 * 叙事者写完时的提示音。
 *
 * 用 WebAudio 现场合成两声短音（不需要音频资源、不占体积、不进构建产物）：
 * 成功是上行三度，失败是下行小二度。开关存在 localStorage，默认开着。
 * 不判断环境：没有 AudioContext（Node 测试、老浏览器）就静默跳过。
 */
export const CHIME_KEY = 'night-sugar:llm-chime';
export type ChimeKind = 'done' | 'fail';

/** 不该响的情况：关掉了、或者只是连接测试（那种一次就会响两次）。 */
export function resolveChime(info: { kind: string; ok: boolean }, enabled: boolean): ChimeKind | null {
  if (!enabled) return null;
  if (info.kind === '连接测试') return null;
  return info.ok ? 'done' : 'fail';
}

export function loadChimeEnabled(): boolean {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CHIME_KEY);
    return raw === null ? true : raw === 'on';
  } catch {
    return true;
  }
}

export function saveChimeEnabled(value: boolean): void {
  try { localStorage.setItem(CHIME_KEY, value ? 'on' : 'off'); } catch { /* 没有 localStorage 就只在本次生效 */ }
}

let lastPlayed = 0;

type AudioCtor = new () => AudioContext;
const audioContext = (): AudioContext | null => {
  try {
    const ctor = (globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }).AudioContext
      ?? (globalThis as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    return ctor ? new ctor() : null;
  } catch {
    return null;
  }
};

/**
 * 响一声。350ms 内的连击只响第一次——批量任务（卡库导入、批量补池）
 * 会在几秒里连发好几次完成，听感上只要一声就够。
 */
export function playChime(kind: ChimeKind): void {
  const now = Date.now();
  if (now - lastPlayed < 350) return;
  const context = audioContext();
  if (!context) return;
  lastPlayed = now;
  const tones = kind === 'done' ? [660, 880] : [520, 415];
  const start = context.currentTime + 0.01;
  tones.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const at = start + index * 0.11;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.05, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.22);
  });
  // 两声放完就关掉上下文，别让浏览器一直挂着一个音频通道。
  window.setTimeout(() => { void context.close().catch(() => undefined); }, 600);
}
