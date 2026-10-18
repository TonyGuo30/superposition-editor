/** The document stores intentions once. Worlds are deterministic interpretations of those intentions. */
export type Point = { x: number; y: number };
export type Motion = 'bounce' | 'slide' | 'shatter';
export type Shape = 'square' | 'circle' | 'diamond';
export type Anchor = 'centroid' | 'largest';
export type Choice<T extends string | number> = { options: T[]; resolved: T | null };
export type SceneObject = {
  id: string;
  name: string;
  color: string;
  shape: Shape;
  origin: Point;
  size: number;
  velocity: number;
  energy: number;
  anchor: Anchor;
  spin: boolean;
  motion: Choice<Motion>;
  delay: Choice<number>;
};
export type Trigger = 'start' | 'impact' | 'rest' | 'contact';
export type Action = 'follow' | 'push' | 'launch' | 'pulse';
export type Relation = {
  id: string;
  source: string;
  target: string;
  trigger: Trigger;
  action: Action;
  enabled: boolean;
  delay: number;
  strength: number;
  offset: Point;
};
export type EditorDocument = {
  version: 2;
  title: string;
  objects: SceneObject[];
  relations: Relation[];
};
export type Decision = {
  id: string;
  objectId: string;
  kind: 'motion' | 'delay';
  label: string;
  options: (Motion | number)[];
  resolved: Motion | number | null;
};
export type Assignment = Record<string, Motion | number>;
export type World = { id: string; assignment: Assignment };
export type Piece = Point & { id: string; size: number; angle: number; shape: Shape | 'fragment' };
export type ObjectFrame = {
  id: string;
  pieces: Piece[];
  anchor: Point;
  released: boolean;
  settled: boolean;
  pulse: boolean;
};
export type Frame = { time: number; objects: ObjectFrame[]; activeLinks: string[] };
export type SceneEvent = {
  time: number;
  type: 'release' | 'impact' | 'rest' | 'link';
  objectId: string;
  relationId?: string;
};
export type Simulation = {
  world: World;
  frames: Frame[];
  events: SceneEvent[];
  waiting: string[];
  dormant: string[];
};
export const DURATION = 10;
export const FLOOR = 430;
export const WIDTH = 960;
export const HEIGHT = 490;
export const MAX_WORLDS = 128;
export const MAX_OBJECTS = 10;
export const MAX_RELATIONS = 24;
export const MOTIONS: Motion[] = ['bounce', 'slide', 'shatter'];
export const DELAYS = [0, 0.6, 1.2];
export const COLORS = ['#2560ff', '#159da1', '#f97366', '#9460df', '#d89d19', '#de5c9f', '#447b6f'];
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const optionLabel = (v: string | number) =>
  typeof v === 'number' ? (v === 0 ? 'Now' : `+${v.toFixed(1)} s`) : titleCase(v);
export const decisionId = (id: string, kind: 'motion' | 'delay') => `${id}:${kind}`;
export function makeObject(index: number, id = `object-${index + 1}`): SceneObject {
  return {
    id,
    name: ['Atlas', 'Echo', 'Ember', 'Nova', 'Orbit', 'Mica', 'Flux', 'Lumen', 'Pico', 'Vega'][
      index % 10
    ],
    color: COLORS[index % COLORS.length],
    shape: (['square', 'circle', 'diamond'] as Shape[])[index % 3],
    origin: { x: 100 + (index % 5) * 150, y: 65 + (index % 3) * 60 },
    size: 30,
    velocity: 95 - index * 8,
    energy: 0.65,
    anchor: 'centroid',
    spin: false,
    motion: { options: ['bounce'], resolved: null },
    delay: { options: [0], resolved: null },
  };
}
export function createDocument(): EditorDocument {
  const atlas = makeObject(0),
    echo = makeObject(1),
    ember = makeObject(2);
  atlas.motion.options = [...MOTIONS];
  echo.motion.options = ['bounce', 'slide'];
  echo.origin = { x: 380, y: 150 };
  echo.velocity = 45;
  ember.origin = { x: 700, y: 100 };
  ember.velocity = -70;
  ember.delay.options = [0, 0.6];
  return {
    version: 2,
    title: 'An unfinished chain reaction',
    objects: [atlas, echo, ember],
    relations: [
      {
        id: 'link-1',
        source: atlas.id,
        target: echo.id,
        trigger: 'impact',
        action: 'follow',
        enabled: true,
        delay: 0,
        strength: 1,
        offset: { x: 120, y: -45 },
      },
      {
        id: 'link-2',
        source: echo.id,
        target: ember.id,
        trigger: 'rest',
        action: 'launch',
        enabled: true,
        delay: 0,
        strength: 1,
        offset: { x: 100, y: -40 },
      },
    ],
  };
}
export function decisions(doc: EditorDocument): Decision[] {
  return doc.objects.flatMap((o) =>
    (['motion', 'delay'] as const)
      .filter((k) => o[k].options.length > 1)
      .map((kind) => ({
        id: decisionId(o.id, kind),
        objectId: o.id,
        kind,
        label: kind === 'motion' ? 'On impact' : 'Release delay',
        options: o[kind].options,
        resolved: o[kind].resolved,
      })),
  );
}
export function worldCount(doc: EditorDocument): number {
  return doc.objects.reduce(
    (count, o) =>
      count *
      (o.motion.resolved === null ? o.motion.options.length : 1) *
      (o.delay.resolved === null ? o.delay.options.length : 1),
    1,
  );
}
/** Stable IDs depend on the assignment, not its position in the current list. */
export function enumerateWorlds(doc: EditorDocument): World[] {
  if (worldCount(doc) > MAX_WORLDS)
    throw new Error(`This scene exceeds ${MAX_WORLDS} worlds. Commit another decision first.`);
  let worlds: Assignment[] = [{}];
  for (const o of doc.objects)
    for (const kind of ['motion', 'delay'] as const) {
      const c = o[kind];
      const values = c.resolved !== null ? [c.resolved] : c.options;
      worlds = worlds.flatMap((w) =>
        values.map((value) => ({ ...w, [decisionId(o.id, kind)]: value })),
      );
    }
  return worlds.map((assignment) => ({
    id: Object.entries(assignment)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('|'),
    assignment,
  }));
}
export function commitDecision(
  doc: EditorDocument,
  id: string,
  value: Motion | number | null,
): EditorDocument {
  const object = doc.objects.find(
    (o) => id === decisionId(o.id, 'motion') || id === decisionId(o.id, 'delay'),
  );
  if (!object) throw new Error('That decision no longer exists.');
  const kind = id === decisionId(object.id, 'motion') ? 'motion' : 'delay';
  if (value !== null && !(object[kind].options as (Motion | number)[]).includes(value))
    throw new Error('Choose an available option.');
  const next = {
    ...doc,
    objects: doc.objects.map((o) =>
      o.id !== object.id ? o : { ...o, [kind]: { ...o[kind], resolved: value } },
    ),
  };
  if (worldCount(next) > MAX_WORLDS)
    throw new Error(
      `Reopening this decision would exceed ${MAX_WORLDS} worlds. Commit another choice first.`,
    );
  return next;
}
export function commitWorld(doc: EditorDocument, world: World): EditorDocument {
  return {
    ...doc,
    objects: doc.objects.map((o) => ({
      ...o,
      motion: { ...o.motion, resolved: world.assignment[decisionId(o.id, 'motion')] as Motion },
      delay: { ...o.delay, resolved: world.assignment[decisionId(o.id, 'delay')] as number },
    })),
  };
}
export function removeObject(doc: EditorDocument, id: string): EditorDocument {
  return {
    ...doc,
    objects: doc.objects.filter((o) => o.id !== id),
    relations: doc.relations.filter((r) => r.source !== id && r.target !== id),
  };
}
/** Causal edges form a DAG: no hidden solver order or cyclic launch deadlocks. */
export function relationProblem(doc: EditorDocument, link: Relation): string | null {
  if (link.source === link.target) return 'Choose two different objects.';
  if (![link.source, link.target].every((id) => doc.objects.some((o) => o.id === id)))
    return 'Both objects must exist.';
  const links = [
    ...doc.relations.filter((r) => r.id !== link.id && r.enabled),
    ...(link.enabled ? [link] : []),
  ];
  const visit = (id: string, path: Set<string>): boolean => {
    if (path.has(id)) return true;
    const next = new Set(path).add(id);
    return links.filter((r) => r.source === id).some((r) => visit(r.target, next));
  };
  if (doc.objects.some((o) => visit(o.id, new Set())))
    return 'This creates a causal cycle. Connect the objects in one direction.';
  if (
    link.enabled &&
    links.some(
      (r) =>
        r.id !== link.id &&
        r.target === link.target &&
        r.action === 'follow' &&
        link.action === 'follow',
    )
  )
    return 'An object can follow one source at a time. Disable its other follow link first.';
  return null;
}

type Body = Piece & { vx: number; vy: number; angular: number };
type State = {
  object: SceneObject;
  bodies: Body[];
  releaseAt: number;
  released: boolean;
  hit: boolean;
  rest: boolean;
  quiet: number;
  pulseUntil: number;
  lastRest: number | null;
};
type LinkState = { link: Relation; due: number | null; fired: boolean };
const DT = 1 / 60;
function anchorOf(state: State): Point {
  if (state.object.anchor === 'largest') {
    const p = state.bodies.reduce((a, b) => (a.size >= b.size ? a : b));
    return { x: p.x, y: p.y };
  }
  const mass = state.bodies.reduce((s, p) => s + p.size * p.size, 0);
  return state.bodies.reduce(
    (p, b) => ({ x: p.x + (b.x * b.size ** 2) / mass, y: p.y + (b.y * b.size ** 2) / mass }),
    { x: 0, y: 0 },
  );
}
function initialBody(o: SceneObject): Body {
  return {
    id: o.id,
    ...o.origin,
    size: o.size,
    angle: 0,
    shape: o.shape,
    vx: o.velocity,
    vy: 0,
    angular: o.spin ? 130 : 0,
  };
}
export function simulateWorld(doc: EditorDocument, world: World): Simulation {
  const enabled = doc.relations.filter((r) => r.enabled).sort((a, b) => a.id.localeCompare(b.id));
  const states: State[] = [...doc.objects]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((object) => ({
      object,
      bodies: [initialBody(object)],
      releaseAt: enabled.some((r) => r.target === object.id && r.action === 'launch')
        ? Infinity
        : Number(world.assignment[decisionId(object.id, 'delay')]),
      released: false,
      hit: false,
      rest: false,
      quiet: 0,
      pulseUntil: -1,
      lastRest: null,
    }));
  const byId = new Map(states.map((s) => [s.object.id, s]));
  const links: LinkState[] = enabled.map((link) => ({ link, due: null, fired: false }));
  const events: SceneEvent[] = [];
  const frames: Frame[] = [];
  const firstEvents = new Map<string, number>();
  const record = (s: State, type: 'release' | 'impact' | 'rest', time: number) => {
    const key = `${s.object.id}:${type}`;
    if (!firstEvents.has(key)) {
      firstEvents.set(key, time);
      events.push({ objectId: s.object.id, type, time });
    }
  };
  for (let step = 0; step <= DURATION / DT; step++) {
    const t = step * DT;
    // Event rules are one-shot. Cascades settle in a bounded number of passes, independent of document ordering.
    for (let pass = 0; pass <= states.length; pass++) {
      let changed = false;
      for (const s of states)
        if (!s.released && t + 1e-8 >= s.releaseAt) {
          s.released = true;
          record(s, 'release', t);
          changed = true;
        }
      for (const l of links) {
        if (l.fired) continue;
        const source = byId.get(l.link.source)!,
          target = byId.get(l.link.target)!;
        if (l.due === null) {
          const triggerTime =
            l.link.trigger === 'contact'
              ? source.released &&
                source.bodies.some((a) =>
                  target.bodies.some(
                    (b) => Math.hypot(a.x - b.x, a.y - b.y) <= (a.size + b.size) * 0.5,
                  ),
                )
                ? t
                : undefined
              : firstEvents.get(
                  `${source.object.id}:${l.link.trigger === 'start' ? 'release' : l.link.trigger}`,
                );
          if (triggerTime !== undefined) l.due = triggerTime + l.link.delay;
        }
        if (l.due !== null && t + 1e-8 >= l.due) {
          l.fired = true;
          changed = true;
          events.push({ time: t, type: 'link', objectId: target.object.id, relationId: l.link.id });
          if (l.link.action === 'launch' && !target.released)
            target.releaseAt = Math.min(
              target.releaseAt,
              t + Number(world.assignment[decisionId(target.object.id, 'delay')]),
            );
          if (l.link.action === 'pulse') target.pulseUntil = t + 0.8;
          if (l.link.action === 'push') {
            const a = anchorOf(source),
              b = anchorOf(target),
              distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            target.bodies.forEach((body) => {
              body.vx += ((b.x - a.x) / distance) * 200 * l.link.strength;
              body.vy -= 100 * l.link.strength;
            });
            target.rest = false;
            target.quiet = 0;
          }
        }
      }
      if (!changed) break;
    }
    if (step % 2 === 0)
      frames.push({
        time: t,
        activeLinks: links.filter((l) => l.fired).map((l) => l.link.id),
        objects: states.map((s) => ({
          id: s.object.id,
          released: s.released,
          settled: s.rest,
          pulse: t < s.pulseUntil,
          anchor: anchorOf(s),
          pieces: s.bodies.map(({ vx: _vx, vy: _vy, angular: _a, ...piece }) => ({ ...piece })),
        })),
      });
    if (step === DURATION / DT) break;
    const previousAnchors = new Map(states.map((s) => [s.object.id, anchorOf(s)]));
    const previousRest = new Map(states.map((s) => [s.object.id, s.rest]));
    for (const s of states) {
      if (!s.released) continue;
      const o = s.object;
      const motion = world.assignment[decisionId(o.id, 'motion')] as Motion;
      const follow = links.find(
        (l) => l.fired && l.link.target === o.id && l.link.action === 'follow',
      );
      const center = anchorOf(s);
      const source = follow ? byId.get(follow.link.source)! : null;
      const sourceAnchor = source ? previousAnchors.get(source.object.id)! : null;
      let broken: Body[] | null = null;
      let moving = false;
      for (const b of s.bodies) {
        if (follow && sourceAnchor) {
          const k = 10 * follow.link.strength;
          b.vx += ((sourceAnchor.x + follow.link.offset.x - center.x) * k - b.vx * 6) * DT;
          b.vy += ((sourceAnchor.y + follow.link.offset.y - center.y) * k - b.vy * 6) * DT;
        } else b.vy += 430 * DT;
        b.x += b.vx * DT;
        b.y += b.vy * DT;
        const radius = b.size / 2;
        if (b.x < radius || b.x > WIDTH - radius) {
          b.x = clamp(b.x, radius, WIDTH - radius);
          b.vx *= -0.5;
        }
        if (b.y < radius) {
          b.y = radius;
          b.vy = Math.abs(b.vy) * 0.5;
        }
        if (b.y >= FLOOR - radius) {
          b.y = FLOOR - radius;
          const speed = Math.abs(b.vy);
          if (!s.hit) {
            s.hit = true;
            record(s, 'impact', t + DT);
            if (motion === 'shatter') {
              broken = Array.from({ length: 6 }, (_, i) => ({
                id: `${o.id}/fragment-${i}`,
                x: b.x + (i - 2.5) * 4,
                y: FLOOR - 12 - (i % 2) * 7,
                size: o.size * [0.34, 0.48, 0.64, 0.38, 0.43, 0.3][i],
                angle: i * 49,
                shape: 'fragment',
                vx: b.vx * 0.45 + (i - 2.5) * 53,
                vy: -85 - (i % 3) * 45 * o.energy,
                angular: (i % 2 ? 1 : -1) * (95 + i * 18),
              }));
            }
          }
          const restitution =
            b.shape === 'fragment' ? 0.3 : motion === 'bounce' ? 0.35 + o.energy * 0.38 : 0;
          b.vy = speed > 24 ? -speed * restitution : 0;
          if (Math.abs(b.vy) < 12) b.vy = 0;
          // Friction stops a sliding body in finite time. Follow has its own damping.
          if (!follow)
            b.vx =
              Math.sign(b.vx) * Math.max(0, Math.abs(b.vx) - (motion === 'slide' ? 32 : 49) * DT);
          if (Math.abs(b.vx) < 1 && Math.abs(b.vy) < 1) b.angular = 0;
        }
        b.angle += b.angular * DT;
        if (Math.hypot(b.vx, b.vy) > 3) moving = true;
      }
      if (broken) {
        s.bodies = broken;
        moving = true;
      }
      if (source && !previousRest.get(source.object.id)) moving = true;
      s.quiet = moving ? 0 : s.quiet + DT;
      s.rest = s.quiet >= 0.3;
      if (s.rest && s.lastRest === null) {
        s.lastRest = t + DT;
        record(s, 'rest', t + DT);
      }
    }
  }
  return {
    world,
    frames,
    events: events.sort((a, b) => a.time - b.time),
    waiting: states.filter((s) => !s.released).map((s) => s.object.id),
    dormant: links.filter((l) => !l.fired).map((l) => l.link.id),
  };
}
export function frameAt(sim: Simulation, time: number): Frame {
  return sim.frames[clamp(Math.round(time * 30 + 1e-8), 0, sim.frames.length - 1)];
}
export function simulateScene(doc: EditorDocument): Simulation[] {
  return enumerateWorlds(doc).map((w) => simulateWorld(doc, w));
}
/** Visual-only edits do not invalidate the physics cache. */
export function simulationKey(doc: EditorDocument): string {
  return JSON.stringify({
    objects: doc.objects.map(({ name: _n, color: _c, ...o }) => o),
    relations: doc.relations,
  });
}
function finite(n: unknown, lo: number, hi: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
}
export function isEditorDocument(value: unknown): value is EditorDocument {
  if (!value || typeof value !== 'object') return false;
  const d = value as EditorDocument;
  const point = (v: Point, x1: number, x2: number, y1: number, y2: number) =>
    !!v && finite(v.x, x1, x2) && finite(v.y, y1, y2);
  const choice = (c: Choice<Motion | number>, allowed: readonly (Motion | number)[]) =>
    !!c &&
    Array.isArray(c.options) &&
    c.options.length > 0 &&
    c.options.every((v) => allowed.includes(v)) &&
    new Set(c.options).size === c.options.length &&
    (c.resolved === null || c.options.includes(c.resolved));
  const id = (s: unknown): s is string => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(s);
  try {
    if (
      d.version !== 2 ||
      typeof d.title !== 'string' ||
      d.title.length > 100 ||
      !Array.isArray(d.objects) ||
      d.objects.length < 1 ||
      d.objects.length > MAX_OBJECTS ||
      !Array.isArray(d.relations) ||
      d.relations.length > MAX_RELATIONS
    )
      return false;
    if (
      new Set(d.objects.map((o) => o.id)).size !== d.objects.length ||
      new Set(d.relations.map((r) => r.id)).size !== d.relations.length
    )
      return false;
    if (
      !d.objects.every(
        (o) =>
          id(o.id) &&
          typeof o.name === 'string' &&
          o.name.length <= 40 &&
          /^#[0-9a-fA-F]{6}$/.test(o.color) &&
          ['square', 'circle', 'diamond'].includes(o.shape) &&
          point(o.origin, 20, 940, 20, 390) &&
          finite(o.size, 16, 64) &&
          finite(o.velocity, -220, 220) &&
          finite(o.energy, 0.2, 1.2) &&
          ['centroid', 'largest'].includes(o.anchor) &&
          typeof o.spin === 'boolean' &&
          choice(o.motion, MOTIONS) &&
          choice(o.delay, DELAYS),
      )
    )
      return false;
    if (
      !d.relations.every(
        (r) =>
          id(r.id) &&
          typeof r.enabled === 'boolean' &&
          ['start', 'impact', 'rest', 'contact'].includes(r.trigger) &&
          ['follow', 'push', 'launch', 'pulse'].includes(r.action) &&
          finite(r.delay, 0, 3) &&
          finite(r.strength, 0.2, 2) &&
          point(r.offset, -400, 400, -250, 200) &&
          !relationProblem(d, r),
      )
    )
      return false;
    return worldCount(d) <= MAX_WORLDS;
  } catch {
    return false;
  }
}
/** Older exports remain importable; no preset is silently discarded. */
export function parseDocument(value: unknown): EditorDocument | null {
  if (isEditorDocument(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const old = value as Record<string, unknown>;
  if (
    old.version !== 1 ||
    old.objectId !== 'object-01' ||
    !Array.isArray(old.enabled) ||
    !old.enabled.length ||
    !old.enabled.every((v) => MOTIONS.includes(v)) ||
    new Set(old.enabled).size !== old.enabled.length
  )
    return null;
  const origin = old.origin as Point,
    edits = old.edits as Record<string, unknown>;
  if (
    !origin ||
    !finite(origin.x, 45, 260) ||
    !finite(origin.y, 30, 170) ||
    !edits ||
    !finite(edits.scale, 0.65, 1.5) ||
    !finite(old.impact, 0.2, 1.2) ||
    (old.resolved !== null && !old.enabled.includes(old.resolved))
  )
    return null;
  const object = makeObject(0);
  object.id = 'object-01';
  object.origin = { x: origin.x, y: origin.y * 1.3 };
  object.size = edits.scale * 32;
  object.energy = old.impact;
  object.spin = edits.spin === true;
  object.anchor = edits.target === 'largest' ? 'largest' : 'centroid';
  object.motion = { options: old.enabled as Motion[], resolved: old.resolved as Motion | null };
  return { version: 2, title: 'Imported superposition scene', objects: [object], relations: [] };
}
