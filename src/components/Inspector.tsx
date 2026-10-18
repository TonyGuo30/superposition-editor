import { Camera, CircleHelp, Route, RotateCw, Type } from 'lucide-react';
import { activeBranches, type EditorDocument, type SharedEdits } from '../engine';

function Toggle({ label, checked, onChange, icon, extra }: {
  label: string; checked: boolean; onChange: () => void; icon: React.ReactNode; extra?: React.ReactNode;
}) {
  return <div className="toggle-row"><span className="toggle-label">{icon}<span>{label}</span>{extra}</span>
    <button role="switch" aria-label={label} aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={onChange}><span /></button>
  </div>;
}
export default function Inspector({ doc, update, speed, setSpeed }: {
  doc: EditorDocument; update: (change: (doc: EditorDocument) => EditorDocument) => void;
  speed: number; setSpeed: (value: number) => void;
}) {
  const setEdit = <K extends keyof SharedEdits>(key: K, value: SharedEdits[K]) => update(d => ({ ...d, edits: { ...d.edits, [key]: value } }));
  const active = activeBranches(doc);
  const spinCount = active.filter(id => id !== 'shatter').length;
  return <aside className="inspector" aria-label="Shared edits inspector">
    <div className="panel-heading"><h2>Shared edits</h2><span className="scope-label">{active.length} {active.length === 1 ? 'future' : 'futures'}</span></div>
    <section className="inspector-section toggle-section">
      <Toggle label="Show trajectory" icon={<Route size={15} />} checked={doc.edits.trajectory} onChange={() => setEdit('trajectory', !doc.edits.trajectory)} />
      <Toggle label="Follow object" icon={<Camera size={15} />} checked={doc.edits.follow} onChange={() => setEdit('follow', !doc.edits.follow)} />
      <Toggle label="Caption after rest" icon={<Type size={15} />} checked={doc.edits.captionEnabled} onChange={() => setEdit('captionEnabled', !doc.edits.captionEnabled)} />
      <Toggle label="Spin intact" icon={<RotateCw size={15} />} checked={doc.edits.spin} onChange={() => setEdit('spin', !doc.edits.spin)}
        extra={<span className="applicability" title="This operation requires an intact body">{spinCount}/{active.length}</span>} />
      {doc.edits.spin && <div className="applicability-note" data-testid="applicability-note"><CircleHelp size={13} />{active.includes('shatter') ? 'Shatter skips spin: the body becomes a group.' : 'Applied to every intact body.'}</div>}
    </section>
    <section className="inspector-section">
      <h3>Camera target</h3>
      <div className="segmented" role="group" aria-label="Camera reference target">
        <button aria-pressed={doc.edits.target === 'centroid'} className={doc.edits.target === 'centroid' ? 'selected' : ''} onClick={() => setEdit('target', 'centroid')}>Center</button>
        <button aria-pressed={doc.edits.target === 'largest'} className={doc.edits.target === 'largest' ? 'selected' : ''} onClick={() => setEdit('target', 'largest')}>Largest piece</button>
      </div>
      <p className="field-help">After shattering, “it” refers to the {doc.edits.target === 'centroid' ? 'area-weighted center of all fragments.' : 'largest surviving fragment.'}</p>
      <div className="field-heading"><label htmlFor="caption">Caption</label><span>at each branch’s rest</span></div>
      <textarea id="caption" aria-label="Caption text" value={doc.edits.caption} maxLength={120}
        onChange={e => setEdit('caption', e.target.value)} rows={2} />
      <div className="character-count">{doc.edits.caption.length}/120</div>
    </section>
    <section className="inspector-section slider-section">
      <label htmlFor="speed">Speed <span>(simulation rate)</span></label>
      <div className="range-with-value"><input id="speed" aria-label="Simulation speed" type="range" min="0.25" max="2" step="0.25" value={speed}
        style={{ '--range-progress': `${(speed - .25) / 1.75 * 100}%` } as React.CSSProperties} onChange={e => setSpeed(Number(e.target.value))} /><output>{speed.toFixed(2).replace(/0$/, '')}×</output></div>
      <label htmlFor="impact">Impact strength</label>
      <div className="range-with-value"><input id="impact" aria-label="Impact strength" type="range" min="0.2" max="1.2" step="0.05" value={doc.impact}
        style={{ '--range-progress': `${(doc.impact - .2) * 100}%` } as React.CSSProperties} onChange={e => update(d => ({ ...d, impact: Number(e.target.value) }))} /><output>{doc.impact.toFixed(2).replace(/0$/, '')}</output></div>
      <label htmlFor="scale">Object scale</label>
      <div className="range-with-value"><input id="scale" aria-label="Object scale" type="range" min="0.65" max="1.5" step="0.05" value={doc.edits.scale}
        style={{ '--range-progress': `${(doc.edits.scale - .65) / .85 * 100}%` } as React.CSSProperties} onChange={e => setEdit('scale', Number(e.target.value))} /><output>{doc.edits.scale.toFixed(2).replace(/0$/, '')}×</output></div>
    </section>
    <div className="inspector-footnote"><span className="tiny-dot" /> Shared once. Evaluated in every future.</div>
  </aside>;
}
