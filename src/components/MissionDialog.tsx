import { useState } from 'react';
import { ArrowUpRight, Clock3, Sparkles, Shield, Check, Radio, Heart, Swords, ScanEye, Skull, Bandage, Users, ChevronRight } from 'lucide-react';
import type { GameState, Girl, Mission } from '../types';
import { chance, clock, squadChance, squadLimit, statLabels, statusLabels, workDescriptions, workLabels } from '../game';
import { getMonster } from '../content/monsters';
import { MonsterGlyph } from './MonsterGlyph';

function canGo(girl: Girl): { ok: boolean; reason: string } {
  if (girl.retired) return { ok: false, reason: '已退役' };
  if (girl.status !== 'idle') return { ok: false, reason: statusLabels[girl.status] };
  if (girl.hp < 25) return { ok: false, reason: '血量过低' };
  if (girl.fatigue >= 80) return { ok: false, reason: '疲劳过高' };
  return { ok: true, reason: '' };
}

export function MissionDialog({ state, mission, initialGirlId, onDispatch, onGirl, onEnemy }: {
  state: GameState; mission: Mission; initialGirlId?: string;
  onDispatch: (girlIds: string[], missionId: string) => void;
  onGirl: (id: string) => void; onEnemy: (id: string) => void;
}) {
  const initial = initialGirlId ? state.girls.find(g => g.id === initialGirlId) : undefined;
  const [selected, setSelected] = useState<string[]>(initial && canGo(initial).ok ? [initial.id] : []);
  const limit = squadLimit(mission);
  const squad = selected.map(id => state.girls.find(g => g.id === id)).filter((g): g is Girl => Boolean(g));
  const squadReady = squad.length > 0 && squad.every(g => canGo(g).ok) && squad.length <= limit;
  const chanceValue = squadChance(squad, mission);
  const assigned = mission.squad.map(id => state.girls.find(g => g.id === id)).filter((g): g is Girl => Boolean(g));
  const toggle = (girl: Girl) => {
    if (!canGo(girl).ok) return;
    setSelected(current => current.includes(girl.id) ? current.filter(id => id !== girl.id) : current.length >= limit ? current : [...current, girl.id]);
  };
  const workIcon = mission.work === 'combat' ? <Swords size={14} /> : <ScanEye size={14} />;
  return (
    <div className="mission-dialog-content">
      <div className="modal-eyebrow">{workIcon}城市委托 / {mission.category} · {workLabels[mission.work]}</div>
      <div className="mission-title-row">
        <h2>{mission.title}</h2>
        <span className={`pill work-${mission.work}`}>{mission.difficulty}</span>
      </div>
      <p className="mission-description">{mission.description}</p>
      <div className="mission-facts">
        <div><Sparkles size={18} /><small>委托报酬</small><b>{mission.reward.toLocaleString()}<em> 星砂</em></b></div>
        <div><Clock3 size={18} /><small>预计耗时</small><b>{mission.duration}<em> 分钟</em></b></div>
        <div><Shield size={18} /><small>{mission.work === 'combat' ? '战斗轮次' : '推荐能力'}</small><b>{mission.work === 'combat' ? mission.rounds : statLabels[mission.requirement]}<em>{mission.work === 'combat' ? ` × ${mission.rounds} 轮` : ` ${mission.target}+`}</em></b></div>
        <div><Users size={18} /><small>编队上限</small><b>{limit}<em> 人</em></b></div>
      </div>

      {mission.work === 'combat' && (
        <section className="enemy-lineup" aria-label="本次委托的魔物">
          <div className="modal-section-heading"><h3>魔物反应</h3><small>点击查看图鉴</small></div>
          <div className="enemy-row">
            {(mission.enemyIds ?? []).map(id => {
              const monster = getMonster(id);
              return (
                <button id={`enemy-${id}`} key={id} className="enemy-card" onClick={() => onEnemy(id)} style={{ '--enemy-color': monster.color } as React.CSSProperties}>
                  <MonsterGlyph monster={monster} size={62} />
                  <span><b>{monster.name}</b><small>{monster.rank} · {monster.epithet}</small></span>
                  <em>{monster.maxHp}<small>基础血量</small></em>
                  <ChevronRight size={14} />
                </button>
              );
            })}
          </div>
          <p className="enemy-note"><Skull size={12} />战斗全自动进行，每 15 分钟一轮，玩家无法干预结果。失败会让全员获得疤痕。</p>
        </section>
      )}

      {mission.status === 'open' ? (
        <>
          <div className="modal-section-heading"><h3>编成出勤小队</h3><small>{selected.length} / {limit} 人 · {workDescriptions[mission.work]}</small></div>
          <div className="assignment-roster">
            {state.girls.map(person => {
              const check = canGo(person); const picked = selected.includes(person.id);
              const fatalRisk = person.scars.length >= 4;
              return (
                <button id={`assign-${person.id}`} key={person.id} aria-pressed={picked} className={`assignment-girl ${picked ? 'selected' : ''} ${fatalRisk ? 'fatal-risk' : ''}`} disabled={!check.ok}
                  onClick={() => toggle(person)}>
                  <img src={person.portrait} alt="" />
                  <span>
                    <b>{person.name}</b>
                    <small>{!check.ok ? check.reason : `${statLabels[mission.requirement]} ${person.stats[mission.requirement]} · 疲劳 ${person.fatigue}`}</small>
                  </span>
                  <em>{check.ok ? `${chance(person, mission)}%` : '—'}<small>{check.ok ? '单人契合' : ''}</small></em>
                  {picked && <Check size={15} />}
                  {fatalRisk && <span className="risk-flag" title="第五道疤痕会导致死亡"><Bandage size={11} />濒危</span>}
                </button>
              );
            })}
          </div>
          <div className="assignment-note">
            <Radio size={14} />
            <span>{squad.length ? `${squad.map(g => g.name).join('、')}预计于 ${clock((state.minutes + mission.duration) % 1440)} 返回。${mission.work === 'combat' ? '战斗开始后不可撤回。' : '调查以队伍最高相关能力判定。'}${squadChance(squad, mission) < 45 ? ' 队伍契合度偏低，失败概率较高。' : ''}` : '选择 1 至 ' + limit + ' 位待命契约者。血量不足或疲劳过高时请先安排照顾。'}</span>
          </div>
          <div className="squad-readiness">
            <div><span>队伍契合</span><b className={chanceValue < 45 ? 'low' : chanceValue > 75 ? 'high' : ''}>{squad.length ? `${chanceValue}%` : '—'}</b></div>
            <div><span>疤痕风险</span><b className={squad.some(g => g.scars.length >= 4) ? 'low' : ''}>{squad.some(g => g.scars.length >= 4) ? '致命' : squad.length ? '可承受' : '—'}</b></div>
            <div><span>预计轮次</span><b>{mission.work === 'combat' ? `${mission.rounds} 轮` : '判定一次'}</b></div>
          </div>
          <div className="modal-actions">
            <span>玩家不介入战斗；结果由规则引擎结算。</span>
            <button id="dispatch-confirm" className="btn primary" disabled={!squadReady} onClick={() => onDispatch(selected, mission.id)}>确认派遣<ArrowUpRight size={17} /></button>
          </div>
        </>
      ) : (
        <div className="mission-result">
          {mission.status === 'active' ? <>
            <Radio size={30} /><h3>{assigned.map(g => g.name).join('、')}正在执行委托</h3>
            <p>距离返回还有 {Math.min(...assigned.map(g => g.remaining), 999)} 分钟。推进游戏时间即可结算{mission.work === 'combat' ? '并生成战斗报告' : ''}。</p>
            <div className="result-squad">{assigned.map(g => <button key={g.id} id={`mission-assigned-${g.id}`} className="btn" onClick={() => onGirl(g.id)}><img src={g.portrait} alt="" />{g.name}<Heart size={13} /></button>)}</div>
          </> : <>
            <Check size={30} /><h3>这个心愿，已经被好好守护。</h3><p>最后一次结果：{mission.lastOutcome === 'victory' ? '战斗胜利' : mission.lastOutcome === 'repelled' ? '暂时击退' : '调查完成'}。报酬已计入星砂储备。</p>
          </>}
        </div>
      )}
    </div>
  );
}

export function AssignmentPicker({ state, girlId, onSelect }: { state: GameState; girlId: string; onSelect: (id: string) => void }) {
  const girl = state.girls.find(g => g.id === girlId);
  const missions = state.missions.filter(m => m.status === 'open' && (m.work === 'investigation'));
  return (
    <div className="standard-modal">
      <div className="modal-eyebrow"><Radio size={14} />出勤安排</div>
      <h2>为{girl?.name ?? '她'}选择一个调查委托</h2>
      <p className="muted">战斗委托需要在地图上编成 1–3 人小队；调查可单独前往，也可再带一位同伴。</p>
      <div className="picker-missions">
        {missions.map(m => (
          <button id={`picker-${m.id}`} key={m.id} onClick={() => onSelect(m.id)}>
            <span><b>{m.title}</b><small>{m.category} · {m.duration} 分钟 · {m.reward} 星砂</small></span>
            <em>{girl ? `${chance(girl, m)}%` : '—'}</em>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {missions.length === 0 && <p className="empty-note">今晚的调查委托都已安排。让她们休息一下吧。</p>}
    </div>
  );
}
