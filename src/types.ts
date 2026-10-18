import type { EditorDocument } from './engine';
export type Selection = { type: 'object' | 'relation'; id: string };
export type Update = (change: (doc: EditorDocument) => EditorDocument) => void;
