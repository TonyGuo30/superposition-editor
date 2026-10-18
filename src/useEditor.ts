import { useCallback, useEffect, useRef, useState } from 'react';
import { createDocument, DURATION, isEditorDocument, type EditorDocument } from './engine';

const STORAGE_KEY = 'superposition-document-v1';
function loadDocument(): EditorDocument {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return isEditorDocument(value) ? value : createDocument();
  } catch { return createDocument(); }
}
type HistoryState = { past: EditorDocument[]; present: EditorDocument; future: EditorDocument[] };
export function useEditor() {
  const [history, setHistory] = useState<HistoryState>(() => ({ past: [], present: loadDocument(), future: [] }));
  const [time, setTime] = useState(2.4);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [storageError, setStorageError] = useState(false);
  const transaction = useRef<EditorDocument | null>(null);
  const doc = history.present;
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(doc)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [doc]);
  const update = useCallback((change: (doc: EditorDocument) => EditorDocument) => {
    setHistory(h => {
      const next = change(h.present);
      if (JSON.stringify(next) === JSON.stringify(h.present)) return h;
      return { past: [...h.past, h.present].slice(-60), present: next, future: [] };
    });
  }, []);
  const beginGesture = useCallback(() => { transaction.current = doc; }, [doc]);
  const liveUpdate = useCallback((change: (doc: EditorDocument) => EditorDocument) => {
    setHistory(h => ({ ...h, present: change(h.present) }));
  }, []);
  const endGesture = useCallback(() => {
    const before = transaction.current;
    transaction.current = null;
    if (before) setHistory(h => JSON.stringify(before) === JSON.stringify(h.present) ? h
      : { past: [...h.past, before].slice(-60), present: h.present, future: [] });
  }, []);
  const undo = useCallback(() => setHistory(h => h.past.length ? {
    past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future],
  } : h), []);
  const redo = useCallback(() => setHistory(h => h.future.length ? {
    past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1),
  } : h), []);
  useEffect(() => {
    if (!playing) return;
    let id: number;
    let previous: number | undefined;
    let elapsed = time;
    const frame = (now: number) => {
      const delta = previous === undefined ? 0 : Math.min((now - previous) / 1000, .1);
      previous = now;
      elapsed = Math.min(DURATION, elapsed + delta * speed);
      setTime(elapsed);
      if (elapsed >= DURATION) setPlaying(false);
      else id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
    // A seek pauses playback; time changes from this loop must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);
  const seek = useCallback((t: number) => { setPlaying(false); setTime(t); }, []);
  const togglePlay = useCallback(() => {
    if (time >= DURATION) setTime(0);
    setPlaying(p => !p);
  }, [time]);
  const restart = useCallback(() => { setTime(0); setPlaying(true); }, []);
  return { doc, update, liveUpdate, beginGesture, endGesture, undo, redo,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0,
    time, playing, speed, setSpeed, seek, togglePlay, restart, storageError };
}
