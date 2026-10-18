import { Box, ChevronRight, GitBranch, Layers2 } from 'lucide-react';
import { activeBranches, branchRestAt, BRANCHES, clamp, DURATION, impactTime, type BranchId, type EditorDocument } from '../engine';

export default function Timeline({ doc, time, seek, setFocus }: {
  doc: EditorDocument; time: number; seek: (time: number) => void; setFocus: (id: BranchId | null) => void;
}) {
  const active = activeBranches(doc);
  const hit = impactTime(doc);
  const editNames = [doc.edits.trajectory && 'trajectory', doc.edits.follow && 'camera', doc.edits.captionEnabled && 'caption', doc.edits.spin && 'spin'].filter(Boolean);
  return <section className="timeline" aria-label="Timeline">
    <div className="timeline-heading"><h2>Timeline <span>0.0 — 6.0 s</span></h2><span className="timeline-legend"><Layers2 size={13} /> Shared edits stay linked</span></div>
    <div className="timeline-scroll"><div className="timeline-grid">
      <div className="timeline-label ruler-label"><span>ONE OBJECT / THREE FUTURES</span></div>
      <div className="ruler"><div className="ruler-ticks">{Array.from({ length: 7 }, (_, i) => <span key={i} style={{ left: `${i / 6 * 100}%` }}>{i} s</span>)}</div></div>
      <button className="timeline-label shared-label" onClick={() => setFocus(null)}><ChevronRight size={13} /><Box size={19} /><span>Object <span className="muted">(shared edits)</span></span></button>
      <div className="timeline-track shared-track"><span>Object 01{editNames.length ? ` · ${editNames.join(' · ')}` : ' · no operations yet'}</span></div>
      {BRANCHES.map(branch => {
        const restAt = branchRestAt(doc, branch.id);
        const enabled = active.includes(branch.id);
        return <div className={`timeline-row-fragment ${enabled ? '' : 'disabled-track'}`} key={branch.id}>
          <button className="timeline-label" disabled={!enabled} onClick={() => setFocus(branch.id)}><ChevronRight size={13} /><i className="branch-dot" style={{ background: branch.color }} /><span>{branch.name} <span className="muted">({doc.resolved === branch.id ? 'resolved' : enabled ? 'live' : 'excluded'})</span></span></button>
          <div className="timeline-track" style={{ '--branch-color': branch.color } as React.CSSProperties}>
            <div className="motion-clip" style={{ width: `${restAt / DURATION * 100}%` }}><span>{branch.name === 'Shatter' ? 'body → fragment group' : 'intact body'}</span></div>
            {doc.edits.captionEnabled && <div className="caption-clip" title={`Caption starts when ${branch.name} rests at ${restAt.toFixed(2)} s`}
              style={{ left: `${restAt / DURATION * 100}%`, width: `${(DURATION - restAt) / DURATION * 100}%` }}>Aa</div>}
            <i className="keyframe" style={{ left: `${hit / DURATION * 100}%` }} title={`Impact at ${hit.toFixed(2)} s`} />
            <i className="keyframe" style={{ left: `${restAt / DURATION * 100}%` }} title={`At rest at ${restAt.toFixed(2)} s`} />
            {doc.edits.spin && branch.id !== 'shatter' && <span className="spin-clip">↻</span>}
          </div>
        </div>;
      })}
      <div className="timeline-scrub" onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect(); seek(clamp((e.clientX - rect.left) / rect.width * DURATION, 0, DURATION));
      }} onPointerMove={e => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) { const rect = e.currentTarget.getBoundingClientRect(); seek(clamp((e.clientX - rect.left) / rect.width * DURATION, 0, DURATION)); }
      }} onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}>
        <div className="playhead" style={{ left: `${time / DURATION * 100}%` }}><span>{time.toFixed(1)} s</span><i /></div>
        <input type="range" aria-label="Timeline playhead" min="0" max={DURATION} step="0.01" value={time} onChange={e => seek(Number(e.target.value))} />
      </div>
    </div></div>
    <div className="timeline-bottom"><GitBranch size={12} /><span>Diamonds mark impact and rest. Captions wait for each future’s own ending.</span></div>
  </section>;
}
