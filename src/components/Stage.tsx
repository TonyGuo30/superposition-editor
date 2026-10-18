import { useMemo, useRef, type PointerEvent } from 'react';
import { ArrowUpRight, Check, Focus, Layers2, Move, Pause, Play, RotateCcw, SkipBack } from 'lucide-react';
import { activeBranches, BRANCHES, clamp, DURATION, evaluateBranch, FLOOR, traceBranch,
  type BranchId, type EditorDocument, type Piece, type Point } from '../engine';

function Shape({ piece, color, opacity = 1 }: { piece: Piece; color: string; opacity?: number }) {
  const s = piece.size;
  return <g transform={`translate(${piece.x} ${piece.y}) rotate(${piece.angle})`} opacity={opacity}>
    {piece.polygon
      ? <polygon points={`${-s * .55},${s * .45} ${s * .55},${s * .45} ${s * .12},${-s * .6}`} fill={color} />
      : <rect x={-s / 2} y={-s / 2} width={s} height={s} rx="1.5" fill={color} />}
  </g>;
}
type SceneViewProps = {
  doc: EditorDocument;
  branches: BranchId[];
  time: number;
  mini?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDrag?: (origin: Point) => void;
  onDragEnd?: () => void;
};
export function SceneView({ doc, branches, time, mini = false, draggable = false,
  onDragStart, onDrag, onDragEnd }: SceneViewProps) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const cameraAtDragStart = useRef(0);
  const frames = branches.map(id => evaluateBranch(doc, id, time));
  const inferredCameraX = doc.edits.follow && frames.length
    ? clamp(frames.reduce((s, f) => s + f.target.x, 0) / frames.length - 440, -65, 170) : 0;
  const cameraX = dragging.current ? cameraAtDragStart.current : inferredCameraX;
  const tracks = useMemo(() => branches.map(id => {
    const points = traceBranch(doc, id);
    return { id, path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
      ghosts: [.0, .38, .72, 1.15, 1.65, 2.3, 3.15, 4.15].map(t => evaluateBranch(doc, id, t)) };
  }), [doc, branches.join(',')]);
  const setOrigin = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onDrag?.({ x: clamp(p.x + cameraAtDragStart.current, 45, 260), y: clamp(p.y, 30, 170) });
  };
  const start = (event: PointerEvent<SVGCircleElement>) => {
    if (!draggable) return;
    event.preventDefault();
    dragging.current = true;
    cameraAtDragStart.current = cameraX;
    onDragStart?.();
    svg.current?.setPointerCapture(event.pointerId);
  };
  const finish = () => { if (dragging.current) { dragging.current = false; onDragEnd?.(); } };
  const allSettled = frames.length > 0 && frames.every(f => f.settled);
  return <div className={`scene-view ${mini ? 'mini-scene' : ''}`} data-testid={mini ? undefined : 'scene-view'}>
    {!mini && <div className="scene-topline">
      <span>{doc.resolved ? 'RESOLVED VIEW' : branches.length > 1 ? 'SUPERIMPOSED VIEW' : 'BRANCH PREVIEW'}</span>
      <span>{doc.edits.follow ? <><Focus size={12} /> Camera follows {doc.edits.target === 'largest' ? 'largest piece' : 'object center'}</> : 'WORLD SPACE'}</span>
    </div>}
    <svg ref={svg} viewBox="0 0 900 350" role={draggable ? 'group' : 'img'} aria-label={`${branches.join(', ')} animation at ${time.toFixed(1)} seconds`}
      onPointerMove={e => { if (dragging.current) setOrigin(e); }} onPointerUp={finish} onPointerCancel={finish}>
      <g transform={`translate(${-cameraX} 0)`}>
        <line x1={-100} y1={FLOOR} x2={1100} y2={FLOOR} className="ground-line" />
        {Array.from({ length: 25 }, (_, i) => <line key={i} x1={i * 40} y1={FLOOR + 4} x2={i * 40 - 6} y2={FLOOR + 10} className="ground-hatch" />)}
        {doc.edits.trajectory && tracks.map(track => {
          const color = BRANCHES.find(b => b.id === track.id)!.color;
          return <g key={track.id}>
            <path d={track.path} fill="none" stroke={color} strokeWidth={mini ? 2 : 1.4} strokeDasharray="3 6" opacity=".55" />
            {track.ghosts.map((frame, i) => <g key={i}>{frame.pieces.map(p => <Shape key={p.id} piece={p} color={color} opacity={i === 0 ? .15 : .1} />)}</g>)}
          </g>;
        })}
        {frames.map(frame => {
          const color = BRANCHES.find(b => b.id === frame.branch)!.color;
          return <g key={frame.branch} data-branch={frame.branch} data-pieces={frame.pieces.length}>
            <ellipse cx={frame.target.x} cy={FLOOR + 2} rx={20 + (FLOOR - frame.target.y) * .025} ry="3" fill={color} opacity=".1" />
            {frame.pieces.map(p => <Shape key={p.id} piece={p} color={color} opacity={branches.length > 1 ? .85 : 1} />)}
            {!mini && doc.edits.follow && <g stroke={color} strokeWidth="1" opacity=".65" transform={`translate(${frame.target.x} ${frame.target.y})`}>
              <circle r="27" fill="none" strokeDasharray="3 4" /><path d="M-34 0h12m44 0h12M0-34v12m0 44v12" />
            </g>}
          </g>;
        })}
        {draggable && <g className="origin-handle">
          <circle cx={doc.origin.x} cy={doc.origin.y} r="18" fill="transparent" onPointerDown={start} role="button" tabIndex={0}
            aria-label="Drag shared starting position" onKeyDown={e => {
              const step = e.shiftKey ? 15 : 5;
              const offset = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
              if (offset) { e.preventDefault(); onDragStart?.(); onDrag?.({ x: clamp(doc.origin.x + offset[0], 45, 260), y: clamp(doc.origin.y + offset[1], 30, 170) }); onDragEnd?.(); }
            }} />
          <circle cx={doc.origin.x} cy={doc.origin.y} r="6" className="origin-center" pointerEvents="none" />
          <path d={`M${doc.origin.x - 11} ${doc.origin.y}h22M${doc.origin.x} ${doc.origin.y - 11}v22`} className="origin-cross" pointerEvents="none" />
          <text x={doc.origin.x + 19} y={doc.origin.y + 4} className="origin-label" pointerEvents="none">shared origin</text>
        </g>}
      </g>
    </svg>
    {doc.edits.captionEnabled && allSettled && <div className={`stage-caption ${mini ? 'small-caption' : ''}`} data-testid="stage-caption">{doc.edits.caption || '…'}</div>}
    {!mini && <div className="scene-bottomline"><span><Move size={12} /> Drag the origin · edits reach every active future</span><span>{allSettled ? 'All motion at rest' : 'Evaluating shared edits'}</span></div>}
  </div>;
}
type StageProps = {
  doc: EditorDocument; time: number; playing: boolean; compare: boolean;
  focus: BranchId | null; setFocus: (id: BranchId | null) => void;
  togglePlay: () => void; restart: () => void; seek: (time: number) => void;
  beginGesture: () => void; endGesture: () => void;
  moveOrigin: (origin: Point) => void;
};
export default function Stage({ doc, time, playing, compare, focus, setFocus, togglePlay, restart, seek,
  beginGesture, endGesture, moveOrigin }: StageProps) {
  const active = activeBranches(doc);
  const visible = focus && active.includes(focus) ? [focus] : active;
  return <main className="canvas-panel">
    <div className="canvas-heading"><h1>{doc.resolved ? `One future. Every edit preserved.` : `Editing all ${active.length} future${active.length > 1 ? 's' : ''}`}</h1>
      <span className="canvas-heading-note">One object. Decide later.</span></div>
    <div className="branch-previews">
      {BRANCHES.map(branch => {
        const enabled = active.includes(branch.id);
        return <button key={branch.id} className={`branch-preview ${!enabled ? 'excluded' : ''} ${focus === branch.id ? 'focused' : ''}`}
          aria-label={`Preview ${branch.name}`} aria-pressed={focus === branch.id} disabled={!enabled}
          onClick={() => setFocus(focus === branch.id ? null : branch.id)} style={{ '--branch-color': branch.color } as React.CSSProperties}>
          <div className="preview-title"><span><i className="branch-dot" />{branch.name.toUpperCase()}</span>
            {doc.resolved === branch.id ? <Check size={13} /> : enabled ? <ArrowUpRight size={13} /> : <span className="excluded-label">Excluded</span>}</div>
          <SceneView doc={doc} branches={[branch.id]} time={time} mini />
          <div className="preview-meta"><span>{enabled ? evaluateBranch(doc, branch.id, time).settled ? 'At rest' : 'Live' : 'Inactive'}</span><span>0.0 — 6.0 s</span></div>
        </button>;
      })}
    </div>
    <div className={`main-stage ${compare ? 'is-comparing' : ''}`}>
      {compare ? <div className="comparison-grid">{active.map(id => <div className="compare-cell" key={id}>
        <span style={{ color: BRANCHES.find(b => b.id === id)!.color }} className="compare-name">{BRANCHES.find(b => b.id === id)!.name}</span>
        <SceneView doc={doc} branches={[id]} time={time} mini />
      </div>)}</div> : <SceneView doc={doc} branches={visible} time={time} draggable
        onDragStart={() => { beginGesture(); seek(0); }} onDrag={moveOrigin} onDragEnd={endGesture} />}
      {!compare && focus && !doc.resolved && <button className="overlay-button" onClick={() => setFocus(null)}><Layers2 size={13} /> Show all futures</button>}
      <div className="playback-bar">
        <button className="icon-button" title="Jump to start" aria-label="Jump to start" onClick={() => seek(0)}><SkipBack size={17} fill="currentColor" /></button>
        <button className="icon-button play-button" title="Play / pause (Space)" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
          {playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
        <button className="icon-button" title="Replay (R)" aria-label="Replay" onClick={restart}><RotateCcw size={17} /></button>
        <span className="playback-time" data-testid="playback-time">{time.toFixed(1)} <span>/ {DURATION.toFixed(1)} s</span></span>
      </div>
    </div>
  </main>;
}
