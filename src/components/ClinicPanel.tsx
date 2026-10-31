import { HeartPulse, Sparkles, Stethoscope } from 'lucide-react';
import { clinicQuote, treatmentFor } from '../game';
import { effectiveMaxHp } from '../economy.ts';
import type { GameState, Girl, Treatment } from '../types';
import { GirlPortrait } from './GirlPortrait';

export function ClinicPanel({ state, girls, onTreat, onClear, onGirl }: {
  state: GameState;
  girls: Girl[];
  onTreat: (girlId: string, kink: boolean) => void;
  onClear?: (girlId: string) => void;
  onGirl?: (girlId: string) => void;
}) {
  const scoped = girls.map(g => state.girls.find(item => item.id === g.id) ?? g);
  const ongoing: { treatment: Treatment; girl: Girl }[] = [];
  for (const treatment of state.treatments) {
    const girl = scoped.find(item => item.id === treatment.girlId);
    if (girl) ongoing.push({ treatment, girl });
  }
  const injured = scoped.filter(g => !g.dead && g.status === 'idle' && g.hp < effectiveMaxHp(g) && !treatmentFor(state, g.id));

  if (!ongoing.length && !injured.length) {
    return (
      <div className="clinic-panel empty">
        <Stethoscope size={16} />
        <p>今晚没有人需要躺上治疗台。受伤的契约者会出现在这里。</p>
      </div>
    );
  }

  return (
    <div className="clinic-panel">
      {ongoing.length > 0 && (
        <section className="clinic-ongoing" aria-label="正在治疗">
          <h4><HeartPulse size={13} />正在治疗</h4>
          {ongoing.map(({ treatment, girl }) => {
            const total = Math.max(1, treatment.endsAt - treatment.startedAt);
            const now = state.day * 1440 + state.minutes;
            const progress = Math.max(4, Math.min(100, Math.round((now - treatment.startedAt) / total * 100)));
            const left = Math.max(0, Math.ceil((treatment.endsAt - now)));
            return (
              <div key={treatment.id} className="clinic-row treating" id={`clinic-treatment-${girl.id}`}>
                <span className="clinic-face">{onGirl ? <button type="button" id={`clinic-face-${girl.id}`} className="clinic-face-btn" onClick={() => onGirl(girl.id)} aria-label={`查看${girl.name}`}><GirlPortrait girl={girl} variant="avatar" /></button> : <GirlPortrait girl={girl} variant="avatar" />}</span>
                <div className="clinic-info">
                  <b>{girl.name} <em>{treatment.kink ? '癖好护理中' : '治疗中'}</em></b>
                  <div className="clinic-hp"><i style={{ width: `${Math.round(girl.hp / Math.max(1, effectiveMaxHp(girl)) * 100)}%` }} /><span>{girl.hp} / {effectiveMaxHp(girl)}</span></div>
                  <small>已付 {treatment.paid} 星砂 · 还需约 {left} 分钟{treatment.kink ? ' · 结束后羁绊 +4 / 侵蚀 +3' : ''}</small>
                  <div className="clinic-progress"><i style={{ width: `${progress}%` }} /></div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {injured.length > 0 && (
        <section className="clinic-injured" aria-label="等待治疗">
          {ongoing.length > 0 && <h4><Stethoscope size={13} />等待治疗</h4>}
          {injured.map(girl => {
            const quote = clinicQuote(girl, false);
            const kinkQuote = clinicQuote(girl, true);
            const affordable = state.gold >= quote.cost;
            const kinkAffordable = state.gold >= kinkQuote.cost;
            return (
              <div key={girl.id} className="clinic-row" id={`clinic-row-${girl.id}`}>
                <span className="clinic-face">{onGirl ? <button type="button" id={`clinic-face-${girl.id}`} className="clinic-face-btn" onClick={() => onGirl(girl.id)} aria-label={`查看${girl.name}`}><GirlPortrait girl={girl} variant="avatar" /></button> : <GirlPortrait girl={girl} variant="avatar" />}</span>
                <div className="clinic-info">
                  <b>{girl.name} <em>缺 {quote.missing} 点生命</em></b>
                  <div className="clinic-hp"><i style={{ width: `${Math.round(girl.hp / Math.max(1, effectiveMaxHp(girl)) * 100)}%` }} /><span>{girl.hp} / {effectiveMaxHp(girl)}</span></div>
                  <small>{quote.cost} 星砂 · 约 {quote.minutes} 分钟（半小时一档）· 每小时恢复 {quote.perHour} 点</small>
                </div>
                <div className="clinic-actions">
                  <button id={`clinic-treat-${girl.id}`} type="button" className="btn clinic-start" disabled={!affordable || girl.status !== 'idle'} onClick={() => onTreat(girl.id, false)}>
                    {affordable ? `开始治疗 · ${quote.cost}` : `星砂不足 · ${quote.cost}`}
                  </button>
                  <button id={`clinic-kink-${girl.id}`} type="button" className="clinic-kink-btn" disabled={!kinkAffordable || girl.status !== 'idle'} onClick={() => onTreat(girl.id, true)}>
                    <Sparkles size={11} />{kinkAffordable ? `治疗癖好 · ${kinkQuote.cost} · 2 小时` : `星砂不足 · ${kinkQuote.cost}`}
                  </button>
                  {onClear && <button id={`clinic-clear-${girl.id}`} type="button" className="clinic-kink-btn" disabled={state.gold < 1200 || girl.status !== 'idle' || !girl.scars.some(scar => scar.kind === 'mental')} onClick={() => onClear(girl.id)}>
                    <Sparkles size={11} />记忆清除 · 1,200 · 清一条精神疤痕
                  </button>}
                </div>
              </div>
            );
          })}
        </section>
      )}
      <p className="clinic-note">普通治疗按 30 分钟一档计价，治疗期间无法派遣，也不会恢复疲劳。疲劳请回宿舍休息。癖好护理单独计时 2 小时，不回血。</p>
    </div>
  );
}
