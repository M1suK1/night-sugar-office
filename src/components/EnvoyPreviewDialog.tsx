import { useMemo, useState } from 'react';
import { Coins, MapPin, ShieldAlert, Sparkles, Users } from 'lucide-react';
import type { FactionId, GameState } from '../types';
import { factionInfo } from '../content/items';
import { envoyPreviewOf } from '../rules/envoyPreview';
import { factionRepresentativeOf } from '../factions';
import { GirlPortrait } from './GirlPortrait';

/**
 * 代表委托的预览（v167）。
 *
 * 卡片上只留一行摘要，真正要判断的都在这里：这条街现在多脏、当主是谁、会不会被拦、
 * 办砸了赔多少。数字全部来自 `envoyPreviewOf`，与结算同源。
 */
export function EnvoyPreviewDialog({ state, faction, onAccept, onClose }: {
  state: GameState;
  faction: FactionId;
  onAccept: (faction: FactionId, girlId?: string, hours?: number, amount?: number) => void;
  onClose: () => void;
}) {
  const preview = useMemo(() => envoyPreviewOf(state, faction), [state, faction]);
  const [girlId, setGirlId] = useState<string | undefined>(preview.loan?.candidates[0]?.id);
  const info = factionInfo[faction];
  const leader = factionRepresentativeOf(state, faction);
  const title = preview.mission ? preview.mission.title : preview.kind === 'tribute' ? '协调费' : preview.kind === 'loan' ? '借调人手' : '代表委托';

  return (
    <div className="standard-modal envoy-preview" id="envoy-preview-dialog" role="dialog" aria-modal="true" aria-label="委托预览">
      <div className="envoy-preview-head">
        {!preview.vacant && (
          <span className="envoy-preview-face">
            <GirlPortrait
              girl={{
                id: leader.id, name: leader.name, color: leader.color,
                portrait: leader.portrait ?? '', portraitSpec: leader.portraitSpec,
                witch: leader.witch, witchForm: leader.witchForm,
                wardrobe: leader.wardrobe, outfitId: leader.outfitId, expression: leader.expression,
              }}
              variant="avatar"
            />
          </span>
        )}
        <div className="envoy-preview-heading">
          <div className="modal-eyebrow"><Sparkles size={14} />{info.name} · {leader.name}</div>
          <h2>{title}</h2>
          <p className="envoy-preview-lead">{preview.note}</p>
        </div>
      </div>

      {preview.vacant ? (
        <p className="envoy-preview-empty">{preview.vacantNote}</p>
      ) : (
        <>
          {preview.mission && (
            <section className="envoy-preview-block" aria-label="委托书">
              <h3>委托书</h3>
              <dl>
                <div><dt>类型</dt><dd>{preview.mission.workLabel} · {preview.mission.difficulty}</dd></div>
                <div><dt>时长</dt><dd>{preview.mission.duration} 分钟</dd></div>
                <div><dt>推荐等级</dt><dd>Lv.{preview.mission.recommendedLevel}</dd></div>
                <div><dt>目标</dt><dd>{preview.mission.requirementLabel} {preview.mission.target}</dd></div>
                <div><dt>报酬</dt><dd><Coins size={12} /> {preview.mission.reward.toLocaleString('zh-CN')} 星砂</dd></div>
              </dl>
            </section>
          )}

          <section className="envoy-preview-block" aria-label="现场">
            <h3><MapPin size={12} /> 现场</h3>
            <dl>
              <div><dt>辖区</dt><dd>{preview.field.districtName}（当主 {preview.field.ownerName}）</dd></div>
              <div><dt>污染</dt><dd>{preview.field.pollution} · {preview.field.pollutionLabel}（每天 +{preview.field.dailyRise}）</dd></div>
              <div><dt>态度</dt><dd>{preview.field.ownerName} 对你的态度：{preview.field.attitudeLabel}（{preview.field.attitudeNote}）</dd></div>
              <div><dt>风险</dt><dd><ShieldAlert size={12} /> {preview.field.intercept}</dd></div>
            </dl>
          </section>

          <section className="envoy-preview-block" aria-label="收益与代价">
            <h3>收益</h3>
            <ul>{preview.gains.map(line => <li key={line}>{line}</li>)}</ul>
            <h3>办砸了</h3>
            <p className="envoy-preview-cost">{preview.cost}</p>
          </section>

          {preview.loan && (
            <section className="envoy-preview-block" aria-label="借调人选">
              <h3><Users size={12} /> 借调 {preview.loan.hours} 小时 · 共 {preview.loan.pay.toLocaleString('zh-CN')} 星砂</h3>
              <div className="envoy-preview-picks">
                {preview.loan.candidates.map(girl => (
                  <button
                    key={girl.id}
                    id={`envoy-preview-pick-${girl.id}`}
                    type="button"
                    className={`av-envoy-loan-pick${girlId === girl.id ? ' picked' : ''}`}
                    onClick={() => setGirlId(girl.id)}
                  >
                    {girl.name} · Lv.{girl.level} · {girl.statusLabel}
                  </button>
                ))}
                {!preview.loan.candidates.length && <span className="muted">现在没有空闲的人可以借。</span>}
              </div>
            </section>
          )}

          {preview.tribute && (
            <section className="envoy-preview-block" aria-label="协调费">
              <h3>协调费 {preview.tribute.amount.toLocaleString('zh-CN')} 星砂 · 好感 +{preview.tribute.standing}</h3>
              <p className="muted">每 200 星砂换 1 点好感；给多少都行，最高 {preview.tribute.maxAmount.toLocaleString('zh-CN')}。</p>
            </section>
          )}
        </>
      )}

      <div className="envoy-preview-actions">
        <button id="envoy-preview-close" type="button" className="btn" onClick={onClose}>先不接</button>
        {!preview.vacant && !preview.done && (
          <button
            id="envoy-preview-accept"
            type="button"
            className="btn primary"
            onClick={() => {
              if (preview.kind === 'loan') onAccept(faction, girlId, preview.loan?.hours);
              else if (preview.kind === 'tribute') onAccept(faction, undefined, undefined, preview.tribute?.amount);
              else onAccept(faction);
              onClose();
            }}
          >
            {preview.kind === 'loan' ? '借出人手' : preview.kind === 'tribute' ? '付这笔钱' : '接下这单'}
          </button>
        )}
        {preview.done && <span className="envoy-preview-done">今天已经接过这一方的委托了。</span>}
      </div>
    </div>
  );
}
