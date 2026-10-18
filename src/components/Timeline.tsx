import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, LockKeyhole } from 'lucide-react';
import {
  decisions,
  DURATION,
  optionLabel,
  titleCase,
  type EditorDocument,
  type SceneEvent,
  type Simulation,
  type World,
} from '../engine';
export function worldDescription(doc: EditorDocument, sim: Simulation): string {
  const all = decisions(doc);
  return all.length
    ? all
        .map(
          (d) =>
            `${doc.objects.find((o) => o.id === d.objectId)!.name}: ${optionLabel(sim.world.assignment[d.id])}`,
        )
        .join(' / ')
    : 'All choices fixed';
}
function eventDescription(doc: EditorDocument, event: SceneEvent): string {
  const name = doc.objects.find((o) => o.id === event.objectId)?.name || 'Object';
  if (event.type === 'link') {
    const link = doc.relations.find((l) => l.id === event.relationId)!;
    const source = doc.objects.find((o) => o.id === link.source)?.name;
    return `${source} → ${name} · ${titleCase(link.action)}`;
  }
  return `${name} ${event.type === 'release' ? 'released' : event.type === 'impact' ? 'hits floor' : 'at rest'}`;
}
export default function Timeline({
  doc,
  simulations,
  total,
  focused,
  preview,
  keep,
  time,
  seek,
}: {
  doc: EditorDocument;
  simulations: Simulation[];
  total: number;
  focused: string | null;
  preview: (id: string | null) => void;
  keep: (w: World) => void;
  time: number;
  seek: (t: number) => void;
}) {
  const [tab, setTab] = useState<'worlds' | 'events'>('worlds'),
    [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(simulations.length / 4));
  useEffect(() => setPage(0), [simulations]);
  const visible = simulations.slice(page * 4, (page + 1) * 4);
  const current = simulations.find((s) => s.world.id === focused) || simulations[0];
  const waiting = current?.waiting
    .map((id) => doc.objects.find((o) => o.id === id)?.name)
    .join(', ');
  return (
    <section className="world-explorer" aria-label="World explorer">
      <div className="explorer-heading">
        <div className="explorer-tabs">
          <button className={tab === 'worlds' ? 'active' : ''} onClick={() => setTab('worlds')}>
            Worlds <span>{simulations.length}</span>
          </button>
          <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
            Events
          </button>
        </div>
        <span>
          {tab === 'worlds'
            ? `${simulations.length} of ${total} combinations · preview before you commit`
            : focused
              ? 'Events in the previewed world'
              : 'Events in the first matching world'}
        </span>
        <div className="pagination">
          <button
            className="icon-button"
            disabled={page === 0 || tab !== 'worlds'}
            aria-label="Previous worlds"
            onClick={() => setPage((p) => p - 1)}
          >
            <ArrowLeft size={14} />
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button
            className="icon-button"
            disabled={page + 1 >= pages || tab !== 'worlds'}
            aria-label="Next worlds"
            onClick={() => setPage((p) => p + 1)}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
      {tab === 'worlds' ? (
        <div className="world-table-scroll">
          <table className="world-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Choice combination</th>
                <th className="event-column">
                  <div className="time-ruler">
                    {[0, 2, 4, 6, 8, 10].map((n) => (
                      <span key={n}>{n}s</span>
                    ))}
                  </div>
                </th>
                <th>Preview</th>
                <th>Decide</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((sim, i) => {
                const selected = sim.world.id === focused;
                const description = worldDescription(doc, sim);
                return (
                  <tr key={sim.world.id} className={selected ? 'previewed-row' : ''}>
                    <td className="mono">W{String(page * 4 + i + 1).padStart(2, '0')}</td>
                    <td>
                      <span className="world-description" title={description}>
                        {description}
                      </span>
                      {sim.waiting.length > 0 && (
                        <small className="world-warning">
                          {sim.waiting.length} waiting for launch
                        </small>
                      )}
                    </td>
                    <td className="event-column">
                      <div
                        className="event-track"
                        role="group"
                        aria-label={`Events world ${page * 4 + i + 1}`}
                      >
                        {doc.objects.map((o, row) => {
                          const release = sim.events.find(
                            (e) => e.objectId === o.id && e.type === 'release',
                          )?.time;
                          const rest =
                            sim.events.find((e) => e.objectId === o.id && e.type === 'rest')
                              ?.time ?? DURATION;
                          return release === undefined ? null : (
                            <span
                              key={o.id}
                              className="object-track"
                              style={{
                                left: `${(release / DURATION) * 100}%`,
                                width: `${(Math.max(0, rest - release) / DURATION) * 100}%`,
                                top: `${10 + (row % 5) * 5}px`,
                                background: o.color,
                              }}
                            />
                          );
                        })}
                        {sim.events
                          .filter((e) => e.type !== 'release')
                          .map((e, index) => (
                            <button
                              key={index}
                              className={`event-marker ${e.type}`}
                              style={{
                                left: `${Math.min(98, (e.time / DURATION) * 100)}%`,
                                color: doc.objects.find((o) => o.id === e.objectId)!.color,
                              }}
                              title={`${eventDescription(doc, e)} at ${e.time.toFixed(2)}s`}
                              aria-label={`${eventDescription(doc, e)} at ${e.time.toFixed(2)} seconds in world ${page * 4 + i + 1}`}
                              onClick={() => {
                                preview(sim.world.id);
                                seek(e.time);
                              }}
                            />
                          ))}
                        <span
                          className="track-playhead"
                          style={{ left: `${(time / DURATION) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td>
                      <button
                        className={`outline-button compact ${selected ? 'active' : ''}`}
                        aria-label={`Preview world ${page * 4 + i + 1}`}
                        aria-pressed={selected}
                        onClick={() => preview(selected ? null : sim.world.id)}
                      >
                        {selected ? <Check size={12} /> : <Eye size={13} />}
                        {selected ? 'Viewing' : 'Preview'}
                      </button>
                    </td>
                    <td>
                      <button
                        className="primary-button compact"
                        aria-label={`Keep world ${page * 4 + i + 1}`}
                        disabled={total === 1}
                        onClick={() => keep(sim.world)}
                      >
                        <LockKeyhole size={12} /> Keep world
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="event-log">
          <div className="event-log-context">{current && worldDescription(doc, current)}</div>
          <div className="event-log-list">
            {current?.events.map((event, i) => (
              <button
                key={i}
                className={`event-log-row ${event.time > time ? 'upcoming' : ''}`}
                onClick={() => seek(event.time)}
              >
                <span className="mono">{event.time.toFixed(2)} s</span>
                <i
                  style={{ background: doc.objects.find((o) => o.id === event.objectId)!.color }}
                />
                <span>{eventDescription(doc, event)}</span>
                <small>{event.time > time ? 'upcoming' : 'fired'}</small>
              </button>
            ))}
          </div>
          {current && (current.dormant.length > 0 || waiting) && (
            <p className="event-diagnostic">
              {waiting ? `${waiting} did not receive a launch within 10 s. ` : ''}
              {current.dormant.length > 0
                ? `${current.dormant.length} link(s) have no matching event within this window.`
                : ''}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
