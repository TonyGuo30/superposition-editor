import { ArrowRight, ChevronRight, Plus } from 'lucide-react';
import {
  decisions,
  MAX_OBJECTS,
  MAX_RELATIONS,
  titleCase,
  type EditorDocument,
  type SceneObject,
} from '../engine';
import type { Selection } from '../types';
export function ObjectMark({ object, small = false }: { object: SceneObject; small?: boolean }) {
  return (
    <span
      className={`object-mark ${object.shape} ${small ? 'small' : ''}`}
      style={{ '--object-color': object.color } as React.CSSProperties}
    />
  );
}
export default function ScenePanel({
  doc,
  selection,
  select,
  addObject,
  addLink,
}: {
  doc: EditorDocument;
  selection: Selection;
  select: (s: Selection) => void;
  addObject: () => void;
  addLink: () => void;
}) {
  const all = decisions(doc);
  return (
    <aside className="scene-panel" aria-label="Scene objects and relationships">
      <div className="rail-section">
        <h2>
          Scene <span>{doc.objects.length}</span>
        </h2>
        <button
          className="outline-button add-button"
          onClick={addObject}
          disabled={doc.objects.length >= MAX_OBJECTS}
        >
          <Plus size={15} /> Add object
        </button>
        <div className="object-list">
          {doc.objects.map((object) => {
            const open = all.filter((d) => d.objectId === object.id && d.resolved === null).length;
            return (
              <button
                key={object.id}
                className={`object-row ${selection.type === 'object' && selection.id === object.id ? 'selected' : ''}`}
                onClick={() => select({ type: 'object', id: object.id })}
                aria-label={`Edit ${object.name}`}
                aria-pressed={selection.type === 'object' && selection.id === object.id}
              >
                <ObjectMark object={object} />
                <span className="row-copy">
                  <strong>{object.name || 'Untitled'}</strong>
                  <small>
                    {open ? `${open} decision${open > 1 ? 's' : ''} open` : 'Choices set'}
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="rail-section relations-section">
        <h2>
          Relationships <span>{doc.relations.length}</span>
        </h2>
        <button
          className="outline-button add-button"
          onClick={addLink}
          disabled={doc.objects.length < 2 || doc.relations.length >= MAX_RELATIONS}
        >
          <Plus size={15} /> Add link
        </button>
        <div className="relation-list">
          {doc.relations.map((link) => {
            const source = doc.objects.find((o) => o.id === link.source)!,
              target = doc.objects.find((o) => o.id === link.target)!;
            return (
              <button
                key={link.id}
                className={`relation-row ${!link.enabled ? 'muted-link' : ''} ${selection.type === 'relation' && selection.id === link.id ? 'selected' : ''}`}
                onClick={() => select({ type: 'relation', id: link.id })}
                aria-label={`Edit link ${source.name} to ${target.name}`}
              >
                <span className="relation-pair">
                  <ObjectMark object={source} small />
                  <strong>{source.name}</strong>
                  <ArrowRight size={13} />
                  <ObjectMark object={target} small />
                  <strong>{target.name}</strong>
                </span>
                <small>
                  {link.enabled
                    ? `${titleCase(link.action)} · ${link.trigger === 'start' ? 'on release' : `after ${link.trigger}`}`
                    : 'Disabled'}
                </small>
              </button>
            );
          })}
        </div>
        {!doc.relations.length && (
          <p className="empty-note">Connect two objects to build a chain reaction.</p>
        )}
      </div>
      <p className="rail-note">
        Relationships refer to objects,
        <br />
        across every world.
      </p>
      <div className="rail-legend">
        <span className="legend-ghost" /> Translucent shapes are alternatives, not extra objects.
      </div>
    </aside>
  );
}
