/** One document owns edits. Branches are deterministic evaluations, not copies. */
export type BranchId = 'bounce' | 'slide' | 'shatter';
export type ReferenceTarget = 'centroid' | 'largest';
export type Point = { x: number; y: number };
export type SharedEdits = {
  trajectory: boolean;
  follow: boolean;
  captionEnabled: boolean;
  caption: string;
  target: ReferenceTarget;
  spin: boolean;
  scale: number;
};
export type EditorDocument = {
  version: 1;
  objectId: 'object-01';
  enabled: BranchId[];
  resolved: BranchId | null;
  origin: Point;
  impact: number;
  edits: SharedEdits;
};
export type Piece = Point & { id: string; size: number; angle: number; polygon: boolean };
export type BranchFrame = {
  branch: BranchId;
  pieces: Piece[];
  target: Point;
  restAt: number;
  settled: boolean;
  caption: string | null;
  spinApplicable: boolean;
};
export const BRANCHES: { id: BranchId; name: string; color: string; description: string }[] = [
  { id: 'bounce', name: 'Bounce', color: '#2560ff', description: 'Elastic impact. One body.' },
  { id: 'slide', name: 'Slide', color: '#159da1', description: 'Carry momentum. One body.' },
  { id: 'shatter', name: 'Shatter', color: '#f97366', description: 'One object becomes seven pieces.' },
];
export const DURATION = 6;
export const WORLD_WIDTH = 900;
export const FLOOR = 290;
const GRAVITY = 430;
const APPROACH_VX = 100;
const FRAGMENTS = [
  { size: 13, vx: -126, vy: 137, angle: -1.1 },
  { size: 17, vx: -60, vy: 191, angle: 1.6 },
  { size: 23, vx: 62, vy: 163, angle: -.4 },
  { size: 12, vx: 118, vy: 208, angle: 2.1 },
  { size: 16, vx: 165, vy: 126, angle: -.8 },
  { size: 11, vx: 216, vy: 169, angle: 1.2 },
  { size: 14, vx: 261, vy: 107, angle: -2.4 },
];
export function createDocument(): EditorDocument {
  return {
    version: 1, objectId: 'object-01', enabled: ['bounce', 'slide', 'shatter'],
    resolved: null, origin: { x: 108, y: 62 }, impact: .8,
    edits: { trajectory: true, follow: false, captionEnabled: true,
      caption: 'Every ending begins here.', target: 'centroid', spin: false, scale: 1 },
  };
}
export const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
export function activeBranches(doc: EditorDocument): BranchId[] {
  return doc.resolved ? [doc.resolved] : doc.enabled;
}
export function impactTime(doc: EditorDocument): number {
  return Math.sqrt(2 * Math.max(0, FLOOR - 16 * doc.edits.scale - doc.origin.y) / GRAVITY);
}
function restDuration(up: number, restitution: number): number {
  let duration = 0;
  for (let i = 0; i < 8 && up > 14; i++, up *= restitution) duration += 2 * up / GRAVITY;
  return duration;
}
function bounceHeight(t: number, up: number, restitution: number): number {
  for (let i = 0; i < 8 && up > 14; i++, up *= restitution) {
    const duration = 2 * up / GRAVITY;
    if (t <= duration) return Math.max(0, up * t - .5 * GRAVITY * t * t);
    t -= duration;
  }
  return 0;
}
export function branchRestAt(doc: EditorDocument, id: BranchId): number {
  const hit = impactTime(doc);
  if (id === 'slide') return hit + (170 + doc.impact * 100) / 105;
  if (id === 'bounce') return hit + restDuration(GRAVITY * hit * (.46 + doc.impact * .28), .52);
  return hit + Math.max(...FRAGMENTS.map(f => restDuration(f.vy * (.55 + doc.impact * .55), .26)));
}
export function evaluateBranch(doc: EditorDocument, id: BranchId, time: number): BranchFrame {
  const t = clamp(time, 0, DURATION);
  const hit = impactTime(doc);
  const restAt = branchRestAt(doc, id);
  const settled = t >= restAt;
  const size = 32 * doc.edits.scale;
  const hitX = doc.origin.x + APPROACH_VX * hit;
  const spinApplicable = id !== 'shatter';
  let pieces: Piece[];
  if (t < hit) {
    pieces = [{ id: doc.objectId, x: doc.origin.x + APPROACH_VX * t,
      y: doc.origin.y + .5 * GRAVITY * t * t, size,
      angle: doc.edits.spin && spinApplicable ? t * 170 : 12 + t * 10, polygon: false }];
  } else if (id === 'shatter') {
    const dt = t - hit;
    pieces = FRAGMENTS.map((f, index) => {
      const partSize = f.size * doc.edits.scale;
      const up = f.vy * (.55 + doc.impact * .55);
      const localRest = restDuration(up, .26);
      const localT = Math.min(dt, localRest);
      return { id: `${doc.objectId}/fragment-${index}`, size: partSize, polygon: true,
        x: hitX + f.vx * (1 - Math.exp(-.78 * localT)) / .78,
        y: FLOOR - partSize * .5 - bounceHeight(localT, up, .26),
        angle: f.angle * 40 + localT * (index % 2 ? 120 : -150) };
    });
  } else {
    const dt = Math.min(t - hit, restAt - hit);
    let x: number;
    let y = FLOOR - size / 2;
    if (id === 'slide') {
      const vx = 170 + doc.impact * 100;
      x = hitX + vx * dt - .5 * 105 * dt * dt;
    } else {
      x = hitX + 160 * (1 - Math.exp(-.35 * dt)) / .35;
      y -= bounceHeight(dt, GRAVITY * hit * (.46 + doc.impact * .28), .52);
    }
    pieces = [{ id: doc.objectId, x, y, size, polygon: false,
      angle: doc.edits.spin ? Math.min(t, restAt) * 170 : 0 }];
  }
  let target: Point;
  if (doc.edits.target === 'largest') {
    const biggest = pieces.reduce((a, b) => a.size >= b.size ? a : b);
    target = { x: biggest.x, y: biggest.y };
  } else {
    const area = pieces.reduce((s, p) => s + p.size * p.size, 0);
    target = pieces.reduce((s, p) => ({ x: s.x + p.x * p.size * p.size / area,
      y: s.y + p.y * p.size * p.size / area }), { x: 0, y: 0 });
  }
  return { branch: id, pieces, target, restAt, settled, spinApplicable,
    caption: doc.edits.captionEnabled && settled ? doc.edits.caption : null };
}
export function traceBranch(doc: EditorDocument, id: BranchId, until = DURATION): Point[] {
  const steps = Math.max(1, Math.ceil(until * 30));
  return Array.from({ length: steps + 1 }, (_, i) => evaluateBranch(doc, id, until * i / steps).target);
}
export function resolveDocument(doc: EditorDocument, branch: BranchId): EditorDocument {
  if (!doc.enabled.includes(branch)) throw new Error('Cannot resolve an excluded branch');
  return { ...doc, resolved: branch };
}
export function toggleBranch(doc: EditorDocument, branch: BranchId): EditorDocument {
  if (doc.resolved) return doc;
  const enabled = doc.enabled.includes(branch)
    ? doc.enabled.filter(id => id !== branch) : BRANCHES.map(b => b.id).filter(id => id === branch || doc.enabled.includes(id));
  return enabled.length ? { ...doc, enabled } : doc;
}
export function isEditorDocument(value: unknown): value is EditorDocument {
  if (!value || typeof value !== 'object') return false;
  const d = value as EditorDocument;
  const isBranch = (id: unknown): id is BranchId => BRANCHES.some(b => b.id === id);
  const numberIn = (n: unknown, low: number, high: number) => typeof n === 'number' && Number.isFinite(n) && n >= low && n <= high;
  return d.version === 1 && d.objectId === 'object-01' && Array.isArray(d.enabled) && d.enabled.length > 0
    && d.enabled.every(isBranch) && new Set(d.enabled).size === d.enabled.length
    && (d.resolved === null || (isBranch(d.resolved) && d.enabled.includes(d.resolved)))
    && !!d.origin && numberIn(d.origin.x, 45, 260) && numberIn(d.origin.y, 30, 170)
    && numberIn(d.impact, .2, 1.2) && !!d.edits
    && ['trajectory', 'follow', 'captionEnabled', 'spin'].every(k => typeof d.edits[k as keyof SharedEdits] === 'boolean')
    && typeof d.edits.caption === 'string' && d.edits.caption.length <= 120
    && ['centroid', 'largest'].includes(d.edits.target) && numberIn(d.edits.scale, .65, 1.5);
}
