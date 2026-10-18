import { Copy, Info, Plus, Trash2, Unlink } from 'lucide-react';
import {
  COLORS,
  DELAYS,
  MOTIONS,
  optionLabel,
  relationProblem,
  titleCase,
  type Action,
  type EditorDocument,
  type Relation,
  type SceneObject,
  type Trigger,
} from '../engine';
import type { Selection, Update } from '../types';
import { ObjectMark } from './ScenePanel';
const triggerCopy: Record<Trigger, string> = {
  start: 'On source release',
  impact: 'After source hits floor',
  rest: 'After source first rests',
  contact: 'When these objects touch',
};
const actionCopy: Record<Action, string> = {
  follow: 'Spring-follow the source anchor. Fragments keep their logical identity.',
  launch: 'Hold the target at its origin until this event. Its release delay starts then.',
  push: 'Give the target a directional impulse away from the source, with an upward kick.',
  pulse: 'Briefly highlight the target when the event occurs.',
};
function Numeric({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value !== '') onChange(Math.max(min, Math.min(max, Number(e.target.value))));
        }}
      />
    </label>
  );
}
export default function Inspector({
  doc,
  selection,
  update,
  duplicate,
  remove,
  report,
}: {
  doc: EditorDocument;
  selection: Selection;
  update: Update;
  duplicate: (o: SceneObject) => void;
  remove: () => void;
  report: (message: string) => void;
}) {
  const object =
    selection.type === 'object' ? doc.objects.find((o) => o.id === selection.id) : null;
  const link =
    selection.type === 'relation' ? doc.relations.find((l) => l.id === selection.id) : null;
  const patchObject = (patch: Partial<SceneObject>) =>
    update((d) => ({
      ...d,
      objects: d.objects.map((o) => (o.id === object?.id ? { ...o, ...patch } : o)),
    }));
  const patchLink = (patch: Partial<Relation>) => {
    if (!link) return;
    const next = { ...link, ...patch };
    const problem = relationProblem(doc, next);
    if (problem) return report(problem);
    update((d) => ({ ...d, relations: d.relations.map((l) => (l.id === link.id ? next : l)) }));
  };
  return (
    <aside className="inspector" aria-label="Inspector">
      {object ? (
        <>
          <div className="inspector-heading">
            <ObjectMark object={object} />
            <h2>{object.name || 'Untitled'}</h2>
            <button
              className="icon-button"
              aria-label="Duplicate object"
              title="Duplicate object"
              onClick={() => duplicate(object)}
            >
              <Copy size={15} />
            </button>
          </div>
          <section className="inspector-section">
            <label className="field-row">
              <span>Name</span>
              <input
                aria-label="Object name"
                value={object.name}
                maxLength={40}
                onChange={(e) => patchObject({ name: e.target.value })}
              />
            </label>
            <label className="field-row">
              <span>Shape</span>
              <select
                value={object.shape}
                onChange={(e) => patchObject({ shape: e.target.value as SceneObject['shape'] })}
              >
                {['square', 'circle', 'diamond'].map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="color-row">
              <span>Color</span>
              <div>
                {COLORS.map((color) => (
                  <button
                    key={color}
                    style={{ background: color }}
                    className={object.color === color ? 'chosen' : ''}
                    aria-label={`Color ${color}`}
                    aria-pressed={object.color === color}
                    onClick={() => patchObject({ color })}
                  />
                ))}
              </div>
            </div>
            <Numeric
              label="Size (px)"
              value={object.size}
              min={16}
              max={64}
              onChange={(size) => patchObject({ size })}
            />
            <Numeric
              label="Launch velocity (px/s)"
              value={object.velocity}
              min={-220}
              max={220}
              step={5}
              onChange={(velocity) => patchObject({ velocity })}
            />
            <div className="coordinate-pair">
              <Numeric
                label="Start X"
                value={object.origin.x}
                min={20}
                max={940}
                onChange={(x) => patchObject({ origin: { ...object.origin, x } })}
              />
              <Numeric
                label="Start Y"
                value={object.origin.y}
                min={20}
                max={390}
                onChange={(y) => patchObject({ origin: { ...object.origin, y } })}
              />
            </div>
          </section>
          <section className="inspector-section">
            <h3>
              On impact{' '}
              <span>
                {object.motion.resolved !== null
                  ? 'Committed'
                  : object.motion.options.length > 1
                    ? 'Undecided'
                    : 'Fixed'}
              </span>
            </h3>
            <div className="option-toggles">
              {MOTIONS.map((motion) => (
                <label
                  key={motion}
                  className={object.motion.options.includes(motion) ? 'included' : ''}
                >
                  <input
                    type="checkbox"
                    checked={object.motion.options.includes(motion)}
                    disabled={
                      object.motion.options.length === 1 && object.motion.options[0] === motion
                    }
                    onChange={() => {
                      const options = MOTIONS.filter((m) =>
                        m === motion
                          ? !object.motion.options.includes(m)
                          : object.motion.options.includes(m),
                      );
                      patchObject({
                        motion: {
                          options,
                          resolved:
                            object.motion.options.includes(motion) &&
                            object.motion.resolved &&
                            options.includes(object.motion.resolved)
                              ? object.motion.resolved
                              : null,
                        },
                      });
                    }}
                  />
                  {titleCase(motion)}
                </label>
              ))}
            </div>
            <p className="field-help">Include more than one to keep this decision open.</p>
            <Numeric
              label="Bounce energy"
              value={object.energy}
              min={0.2}
              max={1.2}
              step={0.05}
              onChange={(energy) => patchObject({ energy })}
            />
            <label className="check-row">
              <input
                type="checkbox"
                checked={object.spin}
                onChange={(e) => patchObject({ spin: e.target.checked })}
              />
              Spin intact body
            </label>
          </section>
          <section className="inspector-section">
            <h3>
              Release delay{' '}
              <span>
                {object.delay.resolved !== null
                  ? 'Committed'
                  : object.delay.options.length > 1
                    ? 'Undecided'
                    : 'Fixed'}
              </span>
            </h3>
            <div className="option-toggles">
              {DELAYS.map((delay) => (
                <label
                  key={delay}
                  className={object.delay.options.includes(delay) ? 'included' : ''}
                >
                  <input
                    type="checkbox"
                    checked={object.delay.options.includes(delay)}
                    disabled={
                      object.delay.options.length === 1 && object.delay.options[0] === delay
                    }
                    onChange={() => {
                      const options = DELAYS.filter((v) =>
                        v === delay
                          ? !object.delay.options.includes(v)
                          : object.delay.options.includes(v),
                      );
                      patchObject({
                        delay: {
                          options,
                          resolved:
                            object.delay.options.includes(delay) &&
                            object.delay.resolved !== null &&
                            options.includes(object.delay.resolved)
                              ? object.delay.resolved
                              : null,
                        },
                      });
                    }}
                  />
                  {optionLabel(delay)}
                </label>
              ))}
            </div>
            <p className="field-help">
              {doc.relations.some(
                (l) => l.enabled && l.target === object.id && l.action === 'launch',
              )
                ? 'Starts after the first incoming launch event.'
                : 'Starts at the beginning of the scene.'}
            </p>
          </section>
          <section className="inspector-section">
            <h3>Reference anchor</h3>
            <div className="segmented">
              <button
                aria-pressed={object.anchor === 'centroid'}
                className={object.anchor === 'centroid' ? 'active' : ''}
                onClick={() => patchObject({ anchor: 'centroid' })}
              >
                Centroid
              </button>
              <button
                aria-pressed={object.anchor === 'largest'}
                className={object.anchor === 'largest' ? 'active' : ''}
                onClick={() => patchObject({ anchor: 'largest' })}
              >
                Largest piece
              </button>
            </div>
            <p className="info-note">
              <Info size={15} />
              <span>
                Every edit applies to this object in all compatible worlds. A shattered object keeps
                its identity.
              </span>
            </p>
          </section>
          <button className="danger-button" disabled={doc.objects.length === 1} onClick={remove}>
            <Trash2 size={14} /> Delete object & its links
          </button>
        </>
      ) : link ? (
        <>
          <div className="inspector-heading">
            <Unlink size={22} />
            <h2>Relationship</h2>
          </div>
          <section className="inspector-section">
            <label className="check-row">
              <input
                type="checkbox"
                checked={link.enabled}
                onChange={(e) => patchLink({ enabled: e.target.checked })}
              />
              Enabled in every world
            </label>
            <label className="stack-field">
              Source
              <select
                aria-label="Relationship source"
                value={link.source}
                onChange={(e) => patchLink({ source: e.target.value })}
              >
                {doc.objects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              Target
              <select
                aria-label="Relationship target"
                value={link.target}
                onChange={(e) => patchLink({ target: e.target.value })}
              >
                {doc.objects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              When
              <select
                aria-label="Relationship trigger"
                value={link.trigger}
                onChange={(e) => patchLink({ trigger: e.target.value as Trigger })}
              >
                {Object.entries(triggerCopy).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-field">
              Then
              <select
                aria-label="Relationship action"
                value={link.action}
                onChange={(e) => patchLink({ action: e.target.value as Action })}
              >
                {(['follow', 'launch', 'push', 'pulse'] as Action[]).map((a) => (
                  <option key={a} value={a}>
                    {titleCase(a)} target
                  </option>
                ))}
              </select>
            </label>
            <p className="info-note">
              <Info size={15} />
              <span>{actionCopy[link.action]}</span>
            </p>
            <Numeric
              label="Event delay (s)"
              value={link.delay}
              min={0}
              max={3}
              step={0.1}
              onChange={(delay) => patchLink({ delay })}
            />
            {['follow', 'push'].includes(link.action) && (
              <Numeric
                label="Strength"
                value={link.strength}
                min={0.2}
                max={2}
                step={0.1}
                onChange={(strength) => patchLink({ strength })}
              />
            )}
            {link.action === 'follow' && (
              <>
                <Numeric
                  label="Offset X (px)"
                  value={link.offset.x}
                  min={-400}
                  max={400}
                  step={10}
                  onChange={(x) => patchLink({ offset: { ...link.offset, x } })}
                />
                <Numeric
                  label="Offset Y (px)"
                  value={link.offset.y}
                  min={-250}
                  max={200}
                  step={10}
                  onChange={(y) => patchLink({ offset: { ...link.offset, y } })}
                />
              </>
            )}
          </section>
          <section className="inspector-section">
            <h3>Local to each world</h3>
            <p className="field-help">
              This link listens to the source in each world. If the event never happens within 10
              seconds, the link stays dormant there.
            </p>
            <p className="field-help">
              Events fire once. Multiple launch links use the first event. Cycles are prevented so a
              chain has a clear direction.
            </p>
            {link.trigger === 'contact' && (
              <p className="info-note">
                <Info size={15} />
                <span>
                  Contact senses bounding-circle overlap. Add a push action to transfer motion.
                </span>
              </p>
            )}
          </section>
          <button className="danger-button" onClick={remove}>
            <Trash2 size={14} /> Delete relationship
          </button>
        </>
      ) : (
        <p className="empty-note">
          <Plus size={18} /> Select an object or relationship.
        </p>
      )}
    </aside>
  );
}
