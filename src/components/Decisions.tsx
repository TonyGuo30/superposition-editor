import { LockKeyhole, UnlockKeyhole, X } from 'lucide-react';
import {
  decisions,
  optionLabel,
  type Assignment,
  type EditorDocument,
  type Motion,
} from '../engine';
import { ObjectMark } from './ScenePanel';
export default function Decisions({
  doc,
  filters,
  preview,
  commit,
  clear,
}: {
  doc: EditorDocument;
  filters: Assignment;
  preview: (id: string, value: Motion | number) => void;
  commit: (id: string, value: Motion | number | null) => void;
  clear: () => void;
}) {
  const choices = decisions(doc);
  return (
    <section className="decisions-panel" aria-label="Decisions">
      <div className="section-heading">
        <h2>{choices.some((c) => c.resolved === null) ? 'Open decisions' : 'Decisions'}</h2>
        <span>Click to preview · lock to decide</span>
        {Object.keys(filters).length > 0 && (
          <button className="text-button" onClick={clear}>
            <X size={12} /> Clear previews
          </button>
        )}
      </div>
      <div className="decision-strip">
        {choices.length ? (
          choices.map((choice) => {
            const object = doc.objects.find((o) => o.id === choice.objectId)!;
            return (
              <div
                className={`decision-card ${choice.resolved !== null ? 'committed' : ''}`}
                key={choice.id}
              >
                <div className="decision-title">
                  <ObjectMark object={object} small />
                  <strong>{object.name}</strong>
                  <span>/ {choice.label}</span>
                </div>
                {choice.resolved !== null ? (
                  <div className="committed-choice">
                    <LockKeyhole size={13} />
                    <strong>{optionLabel(choice.resolved)}</strong>
                    <button
                      className="text-button"
                      aria-label={`Reopen ${object.name} ${choice.label}`}
                      onClick={() => commit(choice.id, null)}
                    >
                      <UnlockKeyhole size={12} /> Reopen
                    </button>
                  </div>
                ) : (
                  <div className="decision-options">
                    {choice.options.map((option) => (
                      <div
                        className={`decision-option ${filters[choice.id] === option ? 'previewing' : ''}`}
                        key={option}
                      >
                        <button
                          aria-label={`Preview ${object.name} ${choice.label} ${optionLabel(option)}`}
                          aria-pressed={filters[choice.id] === option}
                          onClick={() => preview(choice.id, option)}
                        >
                          {optionLabel(option)}
                        </button>
                        <button
                          className="commit-option"
                          aria-label={`Commit ${object.name} ${choice.label} ${optionLabel(option)}`}
                          title={`Decide: ${optionLabel(option)}. Other edits are preserved.`}
                          onClick={() => commit(choice.id, option)}
                        >
                          <LockKeyhole size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="empty-note">
            Include multiple impact behaviors or release delays in the inspector to open a decision.
          </p>
        )}
      </div>
    </section>
  );
}
