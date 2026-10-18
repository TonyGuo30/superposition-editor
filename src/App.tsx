import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, CircleHelp, Download, GitBranch, Layers2, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import Stage from './components/Stage';
import ScenePanel from './components/ScenePanel';
import Inspector from './components/Inspector';
import Timeline from './components/Timeline';
import { HelpDialog, ResolveDialog } from './components/Dialogs';
import { activeBranches, BRANCHES, createDocument, resolveDocument, type BranchId } from './engine';
import { useEditor } from './useEditor';

export default function App() {
  const editor = useEditor();
  const { doc, update, time, playing, seek, undo, redo, togglePlay, restart } = editor;
  const [compare, setCompare] = useState(false);
  const [focus, setFocus] = useState<BranchId | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const branches = activeBranches(doc);
  const resolvedName = BRANCHES.find(b => b.id === doc.resolved)?.name;
  const moveOrigin = useCallback((origin: { x: number; y: number }) => editor.liveUpdate(d => ({ ...d, origin })), [editor.liveUpdate]);
  const exportDocument = useCallback(() => {
    const blob = new Blob([JSON.stringify({ ...doc }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'superposition-scene.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [doc]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (resolveOpen || helpOpen || (e.target instanceof Element && e.target.closest('input,textarea,select'))) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (e.code === 'Space' && !(e.target instanceof Element && e.target.closest('button,[role="button"]'))) { e.preventDefault(); togglePlay(); }
      else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) restart();
      else if (e.key === '?') setHelpOpen(true);
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [resolveOpen, helpOpen, undo, redo, togglePlay, restart]);
  return <div className="editor-app">
    <header className="app-header">
      <div className="brand"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M4 11h21v21H4zM12 4h21v21H12z" /><path d="M8 8h21v21H8z" className="logo-middle" /></svg><span>SUPERPOSITION</span></div>
      <div className="project-title">An object, three futures</div>
      <div className="header-actions">
        <div className="history-actions"><button className="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)" disabled={!editor.canUndo} onClick={undo}><Undo2 size={17} /></button>
          <button className="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)" disabled={!editor.canRedo} onClick={redo}><Redo2 size={17} /></button></div>
        <button className={`secondary-button compare-button ${compare ? 'active' : ''}`} aria-pressed={compare} onClick={() => { setCompare(c => !c); setFocus(null); }}><Layers2 size={16} /><span>Compare</span></button>
        <button className="primary-button header-resolve" onClick={() => setResolveOpen(true)}><span>{doc.resolved ? `Resolved: ${resolvedName}` : 'Resolve branch'}</span>{doc.resolved ? <Check size={15} /> : <ArrowRight size={15} />}</button>
        <button className="icon-button utility-button" aria-label="Export scene JSON" title="Export scene JSON" onClick={exportDocument}><Download size={17} /></button>
        <button className="icon-button utility-button" aria-label="Reset scene" title="Reset scene (can be undone)" onClick={() => { update(() => createDocument()); seek(2.4); editor.setSpeed(1); setFocus(null); setCompare(false); }}><RotateCcw size={16} /></button>
        <button className="icon-button help-button" aria-label="How to use Superposition" title="A quick experiment (?)" onClick={() => setHelpOpen(true)}><CircleHelp size={18} /></button>
      </div>
    </header>
    <div className="workspace">
      <ScenePanel doc={doc} update={update} onHelp={() => setHelpOpen(true)} />
      <Stage doc={doc} time={time} playing={playing} compare={compare} focus={focus} setFocus={setFocus}
        togglePlay={togglePlay} restart={restart} seek={seek} beginGesture={editor.beginGesture} endGesture={editor.endGesture} moveOrigin={moveOrigin} />
      <Inspector doc={doc} update={update} speed={editor.speed} setSpeed={editor.setSpeed} />
    </div>
    <Timeline doc={doc} time={time} seek={seek} setFocus={id => { setCompare(false); setFocus(id); }} />
    <footer className="status-bar"><div><span className="status-dot" /><span data-testid="branch-status">1 logical object <b>·</b> {branches.length} {doc.resolved ? 'resolved branch' : 'live branches'} <b>·</b> {doc.resolved ? 'Shared edits preserved' : 'Edits preserved on resolve'}</span></div>
      <div><span className="save-status">{editor.storageError ? 'Local save unavailable · export to keep your scene' : 'Saved on this device'}</span><span className="keyboard-tip">Space to play <b>·</b> R to replay</span></div></footer>
    <ResolveDialog open={resolveOpen} doc={doc} initialBranch={focus} onClose={() => setResolveOpen(false)} onReopen={() => {
      update(d => ({ ...d, resolved: null })); setResolveOpen(false); setFocus(null);
    }} onResolve={id => {
      update(d => resolveDocument(d, id)); setResolveOpen(false); setFocus(null); setCompare(false);
    }} />
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    <div className="sr-only" aria-live="polite">{doc.resolved ? `Resolved to ${resolvedName}. Shared edits preserved.` : `${branches.length} possible futures remain.`}</div>
  </div>;
}
