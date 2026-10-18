import { Box, Check, ChevronDown, CircleHelp, GitBranch, Layers2, Scan, Sparkles } from 'lucide-react';
import { activeBranches, BRANCHES, toggleBranch, type EditorDocument } from '../engine';

export default function ScenePanel({ doc, update, onHelp }: {
  doc: EditorDocument; update: (change: (doc: EditorDocument) => EditorDocument) => void; onHelp: () => void;
}) {
  const active = activeBranches(doc);
  return <aside className="scene-panel" aria-label="Scene and futures">
    <div className="panel-heading"><h2>Scene</h2><span className="scene-count">01</span></div>
    <div className="scene-tree">
      <div className="tree-scene"><ChevronDown size={14} /><span>Scene 01</span></div>
      <div className="selected-object"><Box size={19} /><span>Object 01</span><span className="object-menu"><Layers2 size={14} /></span></div>
      <div className="branch-list">{BRANCHES.map(branch => <label key={branch.id} className={`branch-row ${!active.includes(branch.id) ? 'inactive' : ''}`}>
        <input type="checkbox" aria-label={`Enable ${branch.name}`} checked={active.includes(branch.id)}
          disabled={!!doc.resolved || (active.length === 1 && active.includes(branch.id))}
          onChange={() => update(d => toggleBranch(d, branch.id))} />
        <i style={{ background: branch.color }} className="branch-dot" /><span>{branch.name}</span>
        {doc.resolved === branch.id && <Check size={13} className="resolved-check" />}
      </label>)}</div>
    </div>
    <button className={`undecided-button ${doc.resolved ? '' : 'is-undecided'}`}
      onClick={() => update(d => ({ ...d, resolved: null }))} disabled={!doc.resolved}>
      <Scan size={17} />{doc.resolved ? 'Reopen possibilities' : 'Keeping undecided'}
    </button>
    <div className="scene-note"><CircleHelp size={16} /><p>Edits follow this object across all futures. Shape what happens next, then choose an ending.</p></div>
    <div className="logical-reference">
      <div className="section-overline"><GitBranch size={13} /> LIVE REFERENCE</div>
      <strong>object-01</strong>
      <div className="reference-branches"><span>Intact</span><span>1 body</span><span>Shattered</span><span>{doc.edits.target === 'centroid' ? 'group center' : 'largest piece'}</span></div>
      <p>The reference survives the change in shape.</p>
    </div>
    <button className="try-button" onClick={onHelp}><Sparkles size={14} /><span>A quick experiment</span><span className="keycap">?</span></button>
  </aside>;
}
