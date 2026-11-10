import { Coins, Heart, MapPin, ScrollText, Users } from 'lucide-react';
import type { MeetingRecord } from '../types';

/** 会议记录（v168）：日期、标题、地点、人数、花费，点开看摘要与回看入口。 */
export function MeetingRecordsDialog({ records, onReplay, onClose }: {
  records: MeetingRecord[];
  onReplay: (eventId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="standard-modal meeting-records" id="meeting-records-dialog" role="dialog" aria-modal="true" aria-label="会议记录">
      <div className="modal-eyebrow"><ScrollText size={14} />议会 · 会议记录</div>
      <h2>{records.length ? `${records.length} 场会议` : '还没有开过会'}</h2>
      {!records.length && <p className="meeting-note">第一场会开完，这里就会有记录：谁来了、在哪儿、谈了什么、散了之后关系有没有变近。</p>}

      <ol className="meeting-record-list">
        {records.map(record => (
          <li key={record.id} id={`meeting-record-${record.id}`}>
            <header>
              <b>{record.title}</b>
              {record.kind === 'wedding' && <em className="meeting-record-wedding"><Heart size={10} />婚礼</em>}
              <small>{record.at || `第 ${record.day} 日`}</small>
            </header>
            <div className="meeting-record-meta">
              <span><MapPin size={11} />{record.placeName}</span>
              <span><Users size={11} />{record.attendees.length} 人：{record.attendees.map(person => person.name).join('、')}</span>
              <span><Coins size={11} />{record.fee} 星砂</span>
              {record.relationshipGain > 0 && <span className="meeting-record-gain">关系 +{record.relationshipGain}</span>}
            </div>
            {record.buys && <p className="meeting-record-buys">买了：{record.buys}</p>}
            {record.summary && <p className="meeting-record-summary">{record.summary}</p>}
            <button id={`meeting-replay-${record.id}`} type="button" className="vn-chip" onClick={() => onReplay(record.eventId)}>
              回看这一段
            </button>
          </li>
        ))}
      </ol>

      <div className="meeting-actions">
        <button id="meeting-records-close" type="button" className="btn" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}
