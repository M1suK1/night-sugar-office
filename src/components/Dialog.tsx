import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export function Dialog({children,onClose,label,wide=false}:{children:React.ReactNode;onClose:()=>void;label:string;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=ref.current,previous=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className={`game-dialog ${wide?'wide':''}`} aria-label={label} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="dialog-interior"><button id="modal-close" className="modal-close icon-btn" aria-label="关闭窗口" onClick={onClose}><X size={19}/></button>{children}</div></dialog>;
}
