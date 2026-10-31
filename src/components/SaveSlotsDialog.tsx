import { useEffect, useState } from 'react';
import { AlertTriangle, HardDriveDownload, HardDriveUpload, FolderOpen, RotateCcw, Save, Trash2 } from 'lucide-react';
import {
  SAVE_SLOT_IDS, formatSlotTime, slotLabel, slotSummaries, slotsUsedBytes, type SaveSlotId, type SaveSlotSummary,
} from '../saves.ts';
import { listLocalFiles, localPaths, shortPath, type LocalFile } from '../localfiles.ts';

type SlotAction = (id: SaveSlotId) => void | Promise<void>;

export function SaveSlotsDialog({ onSave, onLoad, onDelete, onRestart, onLoadFile }: {
  onSave: SlotAction;
  onLoad: SlotAction;
  onDelete: SlotAction;
  onRestart: () => void;
  /** 从项目 data/saves 里读一份导出过的存档；没有本地服务时是 undefined。 */
  onLoadFile?: (name: string) => void | Promise<void>;
}) {
  const [slots, setSlots] = useState<(SaveSlotSummary | null)[]>([]);
  const [used, setUsed] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [savesDir, setSavesDir] = useState('');
  const [files, setFiles] = useState<LocalFile[]>([]);

  const refresh = async () => {
    setSlots(await slotSummaries());
    setUsed(await slotsUsedBytes());
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    void (async () => {
      const paths = await localPaths();
      if (!paths) return;
      setSavesDir(paths.saves);
      setFiles((await listLocalFiles('save')) ?? []);
    })();
  }, []);

  const run = async (action: SlotAction, id: SaveSlotId) => {
    await action(id);
    await refresh();
  };

  return <div className="standard-modal slot-modal" id="save-slots-dialog">
    <div className="modal-eyebrow"><Save size={14} />存档位</div>
    <h2>三个位置，够把不同的夜晚都留着。</h2>
    <p className="muted">自动存档始终写当前进度；这里的三个位置只有你按下保存才会变。</p>

    {savesDir && onLoadFile && <section className="slot-local" id="slot-local">
      <div className="slot-local-head">
        <span><FolderOpen size={12} />项目目录里的存档</span>
        <small>{shortPath(savesDir)}</small>
      </div>
      {files.length === 0 ? <p className="muted" id="slot-local-empty">这里还没有导出过存档。设置里导出时会直接落在这儿。</p> : <ul className="slot-local-list">
        {files.map((file, index) => <li key={file.name}>
          <span className="slot-local-name" title={file.name}>{file.name}</span>
          <span className="slot-local-meta">{Math.max(1, Math.round(file.bytes / 1024))} KB</span>
          <button id={`slot-local-load-${index}`} type="button" className="llm-reset" onClick={() => void onLoadFile(file.name)}>
            <HardDriveDownload size={12} />读取
          </button>
        </li>)}
      </ul>}
    </section>}

    <ul className="slot-list">
      {SAVE_SLOT_IDS.map(id => {
        const summary = slots[id - 1] ?? null;
        return <li key={id} id={`slot-card-${id}`} className={`slot-card ${summary ? 'used' : 'empty'}`}>
          <div className="slot-head">
            <span className="slot-index">档位 {id}</span>
            <strong id={`slot-label-${id}`}>{slotLabel(summary)}</strong>
          </div>
          <div className="slot-body">
            {summary ? <>
              <span id={`slot-time-${id}`}>{formatSlotTime(summary.savedAt)}</span>
              <span>{summary.blank ? '空白档案' : summary.startersPicked ? '已编成' : '未编成'}</span>
              <span>{summary.headline}</span>
              <span>{Math.max(1, Math.round(summary.bytes / 1024))} KB</span>
            </> : <span className="slot-empty-note">还没有存过东西。</span>}
          </div>
          <div className="slot-actions">
            <button id={`slot-save-${id}`} type="button" className="btn" onClick={() => void run(onSave, id)}>
              <HardDriveUpload size={14} />{summary ? '覆盖' : '存入'}
            </button>
            <button id={`slot-load-${id}`} type="button" className="btn ghost" disabled={!summary} onClick={() => void run(onLoad, id)}>
              <HardDriveDownload size={14} />读取
            </button>
            <button id={`slot-delete-${id}`} type="button" className="btn ghost danger" disabled={!summary} onClick={() => void run(onDelete, id)}>
              <Trash2 size={14} />删除
            </button>
          </div>
        </li>;
      })}
    </ul>

    <div className="slot-foot">
      <span className="slot-usage" id="slots-used-bytes">三个档位共占 {Math.max(1, Math.round(used / 1024))} KB</span>
      {confirming ? <div className="slot-restart-confirm">
        <span><AlertTriangle size={14} />当前进度会被清空，三个档位不受影响。</span>
        <button id="slots-restart-confirm" type="button" className="btn danger" onClick={onRestart}>确认重新开始</button>
        <button id="slots-restart-cancel" type="button" className="btn ghost" onClick={() => setConfirming(false)}>再想想</button>
      </div> : <button id="slots-restart" type="button" className="btn ghost" onClick={() => setConfirming(true)}>
        <RotateCcw size={14} />重新开始
      </button>}
    </div>
  </div>;
}
