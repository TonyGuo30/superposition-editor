import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Download, FilePlus2, Redo2, RotateCcw, Undo2, Upload, X } from 'lucide-react';
import Stage from './components/Stage';
import ScenePanel from './components/ScenePanel';
import Inspector from './components/Inspector';
import Timeline from './components/Timeline';
import Decisions from './components/Decisions';
import { HelpDialog } from './components/Dialogs';
import {
  commitDecision,
  commitWorld,
  createDocument,
  decisions,
  isEditorDocument,
  makeObject,
  MAX_OBJECTS,
  MAX_RELATIONS,
  MAX_WORLDS,
  parseDocument,
  relationProblem,
  removeObject,
  worldCount,
  type Assignment,
  type Motion,
  type Point,
  type Relation,
  type SceneObject,
  type World,
} from './engine';
import { useEditor } from './useEditor';
import { useSimulation } from './useSimulation';
import type { Selection, Update } from './types';
export default function App() {
  const editor = useEditor();
  const { doc, time, playing, seek, undo, redo, togglePlay, restart } = editor;
  const [selection, setSelection] = useState<Selection>({ type: 'object', id: doc.objects[0].id });
  const [filters, setFilters] = useState<Assignment>({}),
    [focused, setFocused] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false),
    [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const { simulations, pending, error: simulationError } = useSimulation(doc);
  const totalWorlds = worldCount(doc);
  const allDecisions = decisions(doc);
  const validFilters = Object.fromEntries(
    Object.entries(filters).filter(([id, value]) =>
      allDecisions.some((d) => d.id === id && d.resolved === null && d.options.includes(value)),
    ),
  );
  const filterKey = JSON.stringify(validFilters);
  const matching = useMemo(
    () =>
      simulations.filter((s) =>
        Object.entries(validFilters).every(([id, value]) => s.world.assignment[id] === value),
      ),
    [simulations, filterKey],
  );
  const currentSelection =
    selection.type === 'object'
      ? doc.objects.some((o) => o.id === selection.id)
        ? selection
        : { type: 'object' as const, id: doc.objects[0].id }
      : doc.relations.some((l) => l.id === selection.id)
        ? selection
        : { type: 'object' as const, id: doc.objects[0].id };
  const report = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const update: Update = useCallback(
    (change) => {
      try {
        const next = change(doc);
        if (worldCount(next) > MAX_WORLDS)
          throw new Error(
            `That would exceed ${MAX_WORLDS} exact worlds. Commit a decision first, then add more alternatives.`,
          );
        if (!isEditorDocument(next))
          throw new Error(
            'This edit is outside the scene limits. Check the object or relationship settings.',
          );
        setNotice('');
        editor.update(() => next);
      } catch (error) {
        report(error instanceof Error ? error.message : 'The edit could not be applied.');
      }
    },
    [doc, editor.update, report],
  );
  const addObject = (copy?: SceneObject) => {
    if (doc.objects.length >= MAX_OBJECTS)
      return report(`A scene supports up to ${MAX_OBJECTS} objects.`);
    const id = `object-${crypto.randomUUID()}`;
    const next = copy
      ? {
          ...structuredClone(copy),
          id,
          name: `${copy.name.slice(0, 30)} copy`,
          origin: { x: Math.min(940, copy.origin.x + 45), y: Math.min(390, copy.origin.y + 20) },
          motion: { options: [...copy.motion.options], resolved: copy.motion.resolved },
          delay: { ...copy.delay, options: [...copy.delay.options] },
        }
      : makeObject(doc.objects.length, id);
    if (worldCount({ ...doc, objects: [...doc.objects, next] }) > MAX_WORLDS)
      return report(
        'Duplicating these open choices would exceed 128 worlds. Commit a choice first.',
      );
    update((d) => ({ ...d, objects: [...d.objects, next] }));
    setSelection({ type: 'object', id });
  };
  const addLink = () => {
    if (doc.relations.length >= MAX_RELATIONS)
      return report(`A scene supports up to ${MAX_RELATIONS} relationships.`);
    const source = currentSelection.type === 'object' ? currentSelection.id : doc.objects[0].id;
    let link: Relation | undefined;
    for (const target of doc.objects.filter((o) => o.id !== source)) {
      const candidate: Relation = {
        id: `link-${crypto.randomUUID()}`,
        source,
        target: target.id,
        trigger: 'impact',
        action: 'pulse',
        enabled: true,
        delay: 0,
        strength: 1,
        offset: { x: 110, y: -50 },
      };
      if (!relationProblem(doc, candidate)) {
        link = candidate;
        break;
      }
    }
    if (!link)
      return report(
        'No forward connection is available from this object. Select an earlier source, or disable a conflicting link.',
      );
    const created = link;
    update((d) => ({ ...d, relations: [...d.relations, created] }));
    setSelection({ type: 'relation', id: created.id });
  };
  const remove = () => {
    if (currentSelection.type === 'object') {
      if (doc.objects.length === 1) return;
      update((d) => removeObject(d, currentSelection.id));
    } else
      update((d) => ({ ...d, relations: d.relations.filter((l) => l.id !== currentSelection.id) }));
  };
  const commit = (id: string, value: Motion | number | null) => {
    update((d) => commitDecision(d, id, value));
    setFilters((f) => {
      const next = { ...f };
      delete next[id];
      return next;
    });
    setFocused(null);
  };
  const keep = (world: World) => {
    update((d) => commitWorld(d, world));
    setFilters({});
    setFocused(null);
    report(
      'World kept. All objects, relationships, edits, and alternatives are preserved. Reopen any decision to explore again.',
    );
  };
  const preview = (id: string, value: Motion | number) => {
    setFilters((f) => {
      const next = { ...f };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });
    setFocused(null);
  };
  const exportDocument = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'superposition'}-scene.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importDocument = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Scene files must be smaller than 1 MB.');
      const parsed = parseDocument(JSON.parse(await file.text()));
      if (!parsed)
        throw new Error(
          'Invalid scene file. Check choices, object limits, and causal links. Your current scene is unchanged.',
        );
      update(() => parsed);
      setSelection({ type: 'object', id: parsed.objects[0].id });
      setFilters({});
      setFocused(null);
      seek(0);
      report(
        `Imported ${parsed.objects.length} objects and ${worldCount(parsed)} worlds. Undo restores your previous scene.`,
      );
    } catch (error) {
      report(error instanceof Error ? error.message : 'Could not import that file.');
    }
    if (fileInput.current) fileInput.current.value = '';
  };
  const beginDrag = useCallback(
    (id: string) => {
      setSelection({ type: 'object', id });
      editor.beginGesture();
      seek(0);
    },
    [editor.beginGesture, seek],
  );
  const moveOrigin = useCallback(
    (id: string, origin: Point) =>
      editor.liveUpdate((d) => ({
        ...d,
        objects: d.objects.map((o) => (o.id === id ? { ...o, origin } : o)),
      })),
    [editor.liveUpdate],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        helpOpen ||
        (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable]'))
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (
        e.code === 'Space' &&
        !(e.target instanceof Element && e.target.closest('button,[role="button"]'))
      ) {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) restart();
      else if (e.key === '?') setHelpOpen(true);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [helpOpen, undo, redo, togglePlay, restart]);
  return (
    <div className="editor-app">
      <header className="app-header">
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M3 3h19v19H3z" stroke="#2560ff" />
            <path d="M12 12h17v17H12z" stroke="#159da1" />
          </svg>
          <span>SUPERPOSITION</span>
        </div>
        <input
          className="project-title"
          aria-label="Project title"
          value={doc.title}
          maxLength={100}
          onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
        />
        <nav className="header-actions" aria-label="Project actions">
          <button
            className="header-button"
            aria-label="Undo"
            disabled={!editor.canUndo}
            onClick={undo}
          >
            <Undo2 size={16} />
            <span>Undo</span>
          </button>
          <button
            className="header-button"
            aria-label="Redo"
            disabled={!editor.canRedo}
            onClick={redo}
          >
            <Redo2 size={16} />
            <span>Redo</span>
          </button>
          <i />
          <button
            className="header-button"
            aria-label="New scene"
            title="Start a blank scene (can be undone)"
            onClick={() => {
              const object = makeObject(0);
              update(() => ({
                version: 2,
                title: 'Untitled scene',
                objects: [object],
                relations: [],
              }));
              setSelection({ type: 'object', id: object.id });
              setFilters({});
              setFocused(null);
              seek(0);
            }}
          >
            <FilePlus2 size={16} />
            <span>New</span>
          </button>
          <button
            className="header-button"
            aria-label="Import"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            <span>Import</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Import scene file"
            onChange={(e) => void importDocument(e.target.files?.[0])}
          />
          <button className="header-button" aria-label="Export" onClick={exportDocument}>
            <Download size={16} />
            <span>Export</span>
          </button>
          <button
            className="header-button"
            title="Reset to starter scene (can be undone)"
            aria-label="Reset to starter scene"
            onClick={() => {
              update(() => createDocument());
              setFilters({});
              setFocused(null);
              seek(2.4);
            }}
          >
            <RotateCcw size={16} />
          </button>
          <i />
          <button className="header-button" onClick={() => setHelpOpen(true)} aria-label="Help">
            <CircleHelp size={17} />
            <span>Help</span>
          </button>
        </nav>
      </header>
      <main className="workspace">
        <ScenePanel
          doc={doc}
          selection={currentSelection}
          select={setSelection}
          addObject={() => addObject()}
          addLink={addLink}
        />
        <div className="center-workspace">
          <Stage
            doc={doc}
            simulations={matching}
            total={totalWorlds}
            pending={pending}
            error={simulationError}
            focused={focused}
            setFocused={setFocused}
            selection={currentSelection}
            select={setSelection}
            time={time}
            playing={playing}
            speed={editor.speed}
            setSpeed={editor.setSpeed}
            seek={seek}
            togglePlay={togglePlay}
            restart={restart}
            drag={{ begin: beginDrag, move: moveOrigin, end: editor.endGesture }}
          />
          <Decisions
            doc={doc}
            filters={validFilters}
            preview={preview}
            commit={commit}
            clear={() => {
              setFilters({});
              setFocused(null);
            }}
          />
        </div>
        <Inspector
          doc={doc}
          selection={currentSelection}
          update={update}
          duplicate={addObject}
          remove={remove}
          report={report}
        />
      </main>
      <Timeline
        doc={doc}
        simulations={matching}
        total={totalWorlds}
        focused={focused}
        preview={setFocused}
        keep={keep}
        time={time}
        seek={seek}
      />
      <footer className="status-bar">
        <span>
          <i className={editor.storageError ? 'save-error' : ''} />
          {editor.storageError
            ? 'Local save unavailable · export your scene'
            : 'Saved on this device'}
        </span>
        <span data-testid="world-status">
          {totalWorlds} exact world{totalWorlds === 1 ? '' : 's'} <b>·</b> no sampling <b>·</b>{' '}
          {doc.relations.length} shared links
        </span>
        <span>
          Space to play <b>·</b> R to replay
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => setNotice('')}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
