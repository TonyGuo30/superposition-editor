import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, GitBranch, Layers2, LockKeyhole, X } from 'lucide-react';
import { BRANCHES, type BranchId, type EditorDocument } from '../engine';

function Modal({ open, onClose, labelledBy, children, className = '' }: {
  open: boolean; onClose: () => void; labelledBy: string; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); else if (!open && ref.current?.open) ref.current?.close(); }, [open]);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={labelledBy}
    onCancel={onClose} onClick={e => { if (e.target === ref.current) {
      const r = ref.current.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
    } }}>
    <button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>{children}
  </dialog>;
}
export function ResolveDialog({ open, doc, initialBranch, onClose, onResolve, onReopen }: {
  open: boolean; doc: EditorDocument; initialBranch: BranchId | null;
  onClose: () => void; onResolve: (id: BranchId) => void; onReopen: () => void;
}) {
  const [selected, setSelected] = useState<BranchId>('bounce');
  useEffect(() => { if (open) setSelected(initialBranch && doc.enabled.includes(initialBranch) ? initialBranch : doc.resolved || doc.enabled[0]); }, [open, initialBranch, doc.enabled, doc.resolved]);
  const chosen = BRANCHES.find(b => b.id === selected)!;
  const edits = [doc.edits.trajectory && 'Trajectory', doc.edits.follow && 'Camera follow', doc.edits.captionEnabled && 'Caption after rest', doc.edits.spin && 'Spin intact', doc.edits.scale !== 1 && 'Object scale'].filter(Boolean);
  return <Modal open={open} onClose={onClose} labelledBy="resolve-title">
    <div className="dialog-symbol"><GitBranch size={24} /></div><h2 id="resolve-title">Choose an ending.</h2>
    <p className="dialog-description">Resolve the behavior. Keep the work you’ve already done.</p>
    <div className="resolve-options">{BRANCHES.filter(b => doc.enabled.includes(b.id)).map(branch => <button key={branch.id}
      className={`resolve-option ${selected === branch.id ? 'chosen' : ''}`} aria-pressed={selected === branch.id}
      onClick={() => setSelected(branch.id)} style={{ '--branch-color': branch.color } as React.CSSProperties}>
      <i className="branch-dot" /><div><strong>{branch.name}</strong><span>{branch.description}</span></div>
      <span className="radio-circle">{selected === branch.id && <Check size={12} />}</span>
    </button>)}</div>
    <div className="preserved-edits"><Layers2 size={16} /><div><strong>Shared edits stay attached</strong><p>{edits.length ? edits.join(' · ') : 'Origin and impact settings'}{doc.edits.spin && selected === 'shatter' ? ' · Spin remains stored, but does not apply to fragments.' : ''}</p></div></div>
    <button className="primary-button resolve-confirm" onClick={() => onResolve(selected)}>Resolve to {chosen.name}<ArrowRight size={16} /></button>
    {doc.resolved && <button className="secondary-button reopen-dialog-button" onClick={onReopen}><Layers2 size={14} />Reopen possibilities</button>}
    <p className="dialog-reassurance"><LockKeyhole size={11} /> You can reopen possibilities or undo this decision.</p>
  </Modal>;
}
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Modal open={open} onClose={onClose} labelledBy="help-title" className="help-modal">
    <div className="dialog-symbol"><Layers2 size={24} /></div><h2 id="help-title">Edit first. Decide later.</h2>
    <p className="dialog-description">一个物体，三种未来。先操作它，再决定它会变成什么。</p>
    <ol className="experiment-steps">
      <li><span>01</span><div><strong>保持三种行为未决</strong><p>上方预览和主画布共享同一时间。点击预览可以单独观察某种未来；Compare 可以并排播放。</p></div></li>
      <li><span>02</span><div><strong>对同一个“它”进行编辑</strong><p>打开 Follow object，修改 Caption，再打开 Spin intact。旋转会标记为 2/3：碎裂之后不再有一个完整刚体。</p></div></li>
      <li><span>03</span><div><strong>改变“它”的指向</strong><p>选择 Center 或 Largest piece。物体碎裂后，相机分别跟随碎片群的中心或最大的碎片；在完整分支里，两者指向同一物体。</p></div></li>
      <li><span>04</span><div><strong>最后再选一种结局</strong><p>点击 Resolve branch。所有共享编辑保留，字幕在该分支真正停止运动时出现。Reopen possibilities 随时恢复其他未来。</p></div></li>
    </ol>
    <div className="help-shortcuts"><span><kbd>Space</kbd> 播放 / 暂停</span><span><kbd>R</kbd> 重播</span><span><kbd>⌘ / Ctrl Z</kbd> 撤销</span></div>
    <button className="primary-button resolve-confirm" onClick={onClose}>Start experimenting <ArrowRight size={16} /></button>
  </Modal>;
}
