import { useId, useMemo, useRef, useState } from 'react';
import { Layers2, Pause, Play, RotateCcw, SkipBack } from 'lucide-react';
import {
  clamp,
  DURATION,
  FLOOR,
  frameAt,
  HEIGHT,
  WIDTH,
  type EditorDocument,
  type Piece,
  type Point,
  type Simulation,
} from '../engine';
import type { Selection } from '../types';
function Shape({ piece, color }: { piece: Piece; color: string }) {
  const s = piece.size;
  return (
    <g transform={`translate(${piece.x} ${piece.y}) rotate(${piece.angle})`} fill={color}>
      {piece.shape === 'circle' ? (
        <circle r={s / 2} />
      ) : piece.shape === 'fragment' ? (
        <polygon points={`${-s / 2},${s / 2} ${s / 2},${s * 0.35} ${s * 0.1},${-s / 2}`} />
      ) : (
        <rect
          x={-s / 2}
          y={-s / 2}
          width={s}
          height={s}
          rx={piece.shape === 'square' ? 2 : 0}
          transform={piece.shape === 'diamond' ? 'rotate(45) scale(.78)' : undefined}
        />
      )}
    </g>
  );
}
export function SceneView({
  doc,
  simulations,
  time,
  mini = false,
  trails,
  origins = false,
  selection,
  select,
  drag,
}: {
  doc: EditorDocument;
  simulations: Simulation[];
  time: number;
  mini?: boolean;
  trails: boolean;
  origins?: boolean;
  selection?: Selection;
  select?: (s: Selection) => void;
  drag?: { begin: (id: string) => void; move: (id: string, p: Point) => void; end: () => void };
}) {
  const svg = useRef<SVGSVGElement>(null),
    dragging = useRef<string | null>(null);
  const marker = useId().replace(/:/g, '');
  const frames = simulations.map((sim) => frameAt(sim, time));
  const tracks = useMemo(() => {
    const seen = new Set<string>();
    return simulations.flatMap((sim) =>
      doc.objects.flatMap((o) => {
        const path = sim.frames
          .filter((_, i) => i % 3 === 0)
          .map((frame, i) => {
            const p = frame.objects.find((b) => b.id === o.id)!.anchor;
            return `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(' ');
        const key = `${o.id}:${path}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ id: key, objectId: o.id, path }];
      }),
    );
  }, [simulations]);
  const seen = new Set<string>();
  const bodies = frames.flatMap((frame) =>
    frame.objects.flatMap((body) => {
      const key = `${body.id}:${body.pieces.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.angle.toFixed(0)}`).join(';')}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...body, key }];
    }),
  );
  const originStatus = (id: string) => {
    if (!doc.relations.some((l) => l.enabled && l.action === 'launch' && l.target === id))
      return 'shared origin';
    if (!frames.length) return 'launch-gated origin';
    const released = frames.filter((f) => f.objects.find((o) => o.id === id)?.released).length;
    return released === 0
      ? 'waiting for launch'
      : released === frames.length
        ? 'launched in view'
        : 'mixed launch states';
  };
  const finish = () => {
    if (dragging.current) {
      dragging.current = null;
      drag?.end();
    }
  };
  return (
    <svg
      ref={svg}
      className={`scene-svg ${mini ? 'mini' : ''}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="group"
      aria-label={mini ? 'World preview' : `Scene at ${time.toFixed(1)} seconds`}
      onPointerMove={(e) => {
        if (!dragging.current || !svg.current) return;
        const matrix = svg.current.getScreenCTM();
        if (!matrix) return;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
        drag?.move(dragging.current, { x: clamp(p.x, 20, 940), y: clamp(p.y, 20, 390) });
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    >
      <defs>
        <marker
          id={marker}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0L8 4L0 8" fill="#8c9bb3" />
        </marker>
        <pattern
          id={`${marker}-hatch`}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="10" stroke="#dbe4f1" strokeWidth="1" />
        </pattern>
      </defs>
      <rect
        x="-1000"
        y={FLOOR}
        width={WIDTH + 2000}
        height={HEIGHT - FLOOR}
        fill={`url(#${marker}-hatch)`}
        opacity=".65"
      />
      <line x1="-1000" y1={FLOOR} x2={WIDTH + 1000} y2={FLOOR} stroke="#b9c8de" />
      {trails &&
        tracks.map((track) => (
          <path
            key={track.id}
            d={track.path}
            fill="none"
            stroke={doc.objects.find((o) => o.id === track.objectId)!.color}
            strokeDasharray="3 6"
            strokeWidth={mini ? 2 : 1.3}
            opacity={simulations.length > 12 ? 0.14 : 0.32}
          />
        ))}
      {!mini &&
        doc.relations
          .filter((l) => l.enabled)
          .map((link) => {
            const first = frames[0];
            if (!first) return null;
            const a = first.objects.find((o) => o.id === link.source)!.anchor,
              b = first.objects.find((o) => o.id === link.target)!.anchor;
            const active = first.activeLinks.includes(link.id),
              selected = selection?.type === 'relation' && selection.id === link.id;
            return (
              <g
                key={link.id}
                className="canvas-link"
                opacity={selected ? 0.85 : active ? 0.48 : 0.22}
                onClick={() => select?.({ type: 'relation', id: link.id })}
              >
                <path
                  d={`M${a.x} ${a.y - 25} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 85} ${b.x} ${b.y - 25}`}
                  stroke={selected ? '#2560ff' : '#8c9bb3'}
                  strokeWidth={selected ? 2 : 1.3}
                  strokeDasharray={active ? undefined : '5 5'}
                  fill="none"
                  markerEnd={`url(#${marker})`}
                />
                <path
                  d={`M${a.x} ${a.y - 25} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 85} ${b.x} ${b.y - 25}`}
                  stroke="transparent"
                  strokeWidth="15"
                  fill="none"
                />
                {selected && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={Math.min(a.y, b.y) - 55}
                    textAnchor="middle"
                    className="link-label"
                  >
                    {link.action} · {link.trigger}
                  </text>
                )}
              </g>
            );
          })}
      {bodies.map((body) => {
        const object = doc.objects.find((o) => o.id === body.id)!;
        const selected = selection?.type === 'object' && selection.id === body.id;
        return (
          <g
            key={body.key}
            className="canvas-object"
            data-object={body.id}
            data-released={body.released}
            opacity={body.released ? (simulations.length > 1 ? 0.62 : 1) : 0.35}
            onClick={() => select?.({ type: 'object', id: body.id })}
          >
            {body.pulse && (
              <circle
                cx={body.anchor.x}
                cy={body.anchor.y}
                r={object.size * 1.6}
                stroke={object.color}
                strokeWidth="3"
                fill={object.color}
                fillOpacity=".1"
              />
            )}
            {selected && !mini && (
              <circle
                cx={body.anchor.x}
                cy={body.anchor.y}
                r={object.size * 0.8 + 8}
                stroke={object.color}
                strokeWidth="1"
                strokeDasharray="3 4"
                fill="none"
                opacity=".6"
              />
            )}
            {body.pieces.map((p) => (
              <Shape key={p.id} piece={p} color={object.color} />
            ))}
          </g>
        );
      })}
      {origins &&
        !mini &&
        doc.objects.map((o) => (
          <g key={o.id} className="origin-handle">
            <circle
              cx={o.origin.x}
              cy={o.origin.y}
              r="16"
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`Move ${o.name} origin`}
              onPointerDown={(e) => {
                e.preventDefault();
                dragging.current = o.id;
                drag?.begin(o.id);
                svg.current?.setPointerCapture(e.pointerId);
              }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 20 : 5;
                const offset = {
                  ArrowLeft: [-step, 0],
                  ArrowRight: [step, 0],
                  ArrowUp: [0, -step],
                  ArrowDown: [0, step],
                }[e.key];
                if (offset) {
                  e.preventDefault();
                  drag?.begin(o.id);
                  drag?.move(o.id, {
                    x: clamp(o.origin.x + offset[0], 20, 940),
                    y: clamp(o.origin.y + offset[1], 20, 390),
                  });
                  drag?.end();
                }
              }}
            />
            <circle
              cx={o.origin.x}
              cy={o.origin.y}
              r="5"
              stroke={o.color}
              fill="white"
              pointerEvents="none"
            />
            <path
              d={`M${o.origin.x - 9} ${o.origin.y}h18M${o.origin.x} ${o.origin.y - 9}v18`}
              stroke={o.color}
              strokeWidth="1"
              pointerEvents="none"
            />
            <text
              x={o.origin.x + 14}
              y={o.origin.y - 10}
              fill={o.color}
              className="origin-label"
              pointerEvents="none"
            >
              {o.name}
              <tspan x={o.origin.x + 14} dy="15" fill="#7e8ba1" fontSize="10">
                {originStatus(o.id)}
              </tspan>
            </text>
          </g>
        ))}
    </svg>
  );
}
export default function Stage({
  doc,
  simulations,
  total,
  pending,
  error,
  focused,
  setFocused,
  selection,
  select,
  time,
  playing,
  speed,
  setSpeed,
  seek,
  togglePlay,
  restart,
  drag,
}: {
  doc: EditorDocument;
  simulations: Simulation[];
  total: number;
  pending: boolean;
  error?: string;
  focused: string | null;
  setFocused: (id: string | null) => void;
  selection: Selection;
  select: (s: Selection) => void;
  time: number;
  playing: boolean;
  speed: number;
  setSpeed: (s: number) => void;
  seek: (time: number) => void;
  togglePlay: () => void;
  restart: () => void;
  drag: { begin: (id: string) => void; move: (id: string, p: Point) => void; end: () => void };
}) {
  const [view, setView] = useState<'overlay' | 'worlds'>('overlay');
  const [trails, setTrails] = useState(true),
    [origins, setOrigins] = useState(true);
  const focusedSim = simulations.find((s) => s.world.id === focused);
  const visible = focusedSim ? [focusedSim] : simulations;
  const open = doc.objects.reduce(
    (n, o) =>
      n +
      Number(o.motion.options.length > 1 && o.motion.resolved === null) +
      Number(o.delay.options.length > 1 && o.delay.resolved === null),
    0,
  );
  return (
    <section className="canvas-panel" aria-label="Simulation workspace">
      <div className="canvas-heading">
        <div>
          <h1>Keep making. Decide later.</h1>
          <p>
            {doc.objects.length} objects <b>·</b> {open} open decisions <b>·</b> {total} possible
            world{total === 1 ? '' : 's'}
          </p>
        </div>
        <div className="canvas-toolbar">
          <div className="segmented">
            <button
              aria-pressed={view === 'overlay'}
              className={view === 'overlay' ? 'active' : ''}
              onClick={() => setView('overlay')}
            >
              Overlay
            </button>
            <button
              aria-pressed={view === 'worlds'}
              className={view === 'worlds' ? 'active' : ''}
              onClick={() => setView('worlds')}
            >
              Worlds
            </button>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={trails} onChange={(e) => setTrails(e.target.checked)} />
            <span />
            Trails
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={origins}
              onChange={(e) => setOrigins(e.target.checked)}
            />
            <span />
            Origins
          </label>
        </div>
      </div>
      <div className={`main-stage ${view === 'worlds' ? 'world-grid-stage' : ''}`}>
        <div className="scene-topline">
          <span>
            {focusedSim
              ? 'SINGLE WORLD PREVIEW'
              : view === 'worlds'
                ? 'PARALLEL WORLDS'
                : 'SUPERIMPOSED'}
          </span>
          <span>
            {pending
              ? `Calculating ${total} exact worlds…`
              : `${visible.length} / ${total} worlds in view`}
          </span>
        </div>
        {view === 'overlay' ? (
          <SceneView
            doc={doc}
            simulations={visible}
            time={time}
            trails={trails}
            origins={origins}
            selection={selection}
            select={select}
            drag={drag}
          />
        ) : (
          <div className="world-grid">
            {visible.slice(0, 6).map((sim, i) => (
              <button
                key={sim.world.id}
                className="world-tile"
                onClick={() => {
                  setFocused(sim.world.id);
                  setView('overlay');
                }}
                aria-label={`Inspect world ${i + 1}`}
              >
                <span>W{String(simulations.indexOf(sim) + 1).padStart(2, '0')}</span>
                <SceneView doc={doc} simulations={[sim]} time={time} trails={trails} mini />
                <small>
                  {doc.objects
                    .map((o) => `${o.name}: ${sim.world.assignment[`${o.id}:motion`]}`)
                    .join(' · ')}
                </small>
              </button>
            ))}
            {visible.length > 6 && (
              <p className="grid-note">
                Showing the first 6 worlds. Use the explorer below to preview any combination.
              </p>
            )}
          </div>
        )}
        {(pending || error) && (
          <div className={`calculation-status ${error ? 'calculation-error' : ''}`} role="status">
            {error || 'Updating every possible world…'}
          </div>
        )}
        {focusedSim && (
          <button className="show-all-button" onClick={() => setFocused(null)}>
            <Layers2 size={13} /> Show matching worlds
          </button>
        )}
      </div>
      <div className="transport">
        <span className="canvas-hint">
          {origins ? 'Drag an origin to edit every world.' : 'Click an object or link to edit.'}
        </span>
        <div className="transport-buttons">
          <button className="icon-button" aria-label="Jump to start" onClick={() => seek(0)}>
            <SkipBack size={16} />
          </button>
          <button
            className="play-button"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={togglePlay}
          >
            {playing ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
          </button>
          <button className="icon-button" aria-label="Replay" onClick={restart}>
            <RotateCcw size={17} />
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={DURATION}
          step={1 / 30}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Playhead"
        />
        <span className="playback-time">
          {time.toFixed(1)} <span>/ 10.0 s</span>
        </span>
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {[0.25, 0.5, 1, 1.5, 2].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
