import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commitDecision,
  commitWorld,
  createDocument,
  decisionId,
  decisions,
  enumerateWorlds,
  FLOOR,
  frameAt,
  isEditorDocument,
  makeObject,
  MAX_WORLDS,
  parseDocument,
  relationProblem,
  removeObject,
  simulateScene,
  simulateWorld,
  simulationKey,
  worldCount,
  type EditorDocument,
  type Relation,
  type Simulation,
} from './engine.ts';
const base = createDocument();
const all = simulateScene(base);
const eventTime = (sim: Simulation, objectId: string, type: string) =>
  sim.events.find((e) => e.objectId === objectId && e.type === type)?.time;
function link(source: string, target: string, patch: Partial<Relation> = {}): Relation {
  return {
    id: 'test-link',
    source,
    target,
    trigger: 'rest',
    action: 'launch',
    enabled: true,
    delay: 0,
    strength: 1,
    offset: { x: 90, y: -50 },
    ...patch,
  };
}
test('independent choices enumerate all 3 × 2 × 2 combinations with stable assignment IDs', () => {
  assert.equal(worldCount(base), 12);
  assert.equal(all.length, 12);
  assert.equal(new Set(all.map((s) => s.world.id)).size, 12);
  assert.equal(decisions(base).length, 3);
  const next = commitDecision(base, 'object-1:motion', 'shatter');
  const expected = all.filter((s) => s.world.assignment['object-1:motion'] === 'shatter');
  assert.deepEqual(
    enumerateWorlds(next).map((w) => w.id),
    expected.map((s) => s.world.id),
  );
});
test('a partial commit and reopening preserve object edits, links, and other open dimensions', () => {
  const d = structuredClone(base);
  d.objects[0].size = 43;
  d.objects[1].anchor = 'largest';
  const committed = commitDecision(d, 'object-1:motion', 'bounce');
  assert.equal(worldCount(committed), 4);
  assert.deepEqual(committed.relations, d.relations);
  assert.deepEqual(committed.objects[1], d.objects[1]);
  assert.deepEqual(commitDecision(committed, 'object-1:motion', null), d);
});
test('keeping a world changes bindings only and preserves its exact simulation', () => {
  const selected = all[9],
    committed = commitWorld(base, selected.world);
  assert.equal(worldCount(committed), 1);
  assert.deepEqual(committed.relations, base.relations);
  assert.deepEqual(simulateScene(committed)[0], selected);
});
test('two undecided dimensions on the same object multiply independently', () => {
  const d = structuredClone(base);
  d.objects[0].delay.options = [0, 0.6];
  assert.equal(worldCount(d), 24);
  assert.equal(decisions(d).filter((c) => c.objectId === 'object-1').length, 2);
});
test('shared edits propagate through worlds without editing assignments', () => {
  const changed = structuredClone(base);
  changed.objects[0].size = 52;
  const sims = simulateScene(changed);
  assert.deepEqual(
    sims.map((s) => s.world),
    all.map((s) => s.world),
  );
  assert.ok(sims.every((s) => frameAt(s, 0).objects[0].pieces[0].size === 52));
  assert.ok(
    sims.every(
      (s, i) => eventTime(s, 'object-1', 'impact') !== eventTime(all[i], 'object-1', 'impact'),
    ),
  );
});
test('the same launch relation fires at each world’s own rest event', () => {
  const times = new Set<number>();
  for (const sim of all) {
    const rest = eventTime(sim, 'object-2', 'rest')!;
    const release = eventTime(sim, 'object-3', 'release')!;
    const delay = sim.world.assignment['object-3:delay'] as number;
    assert.ok(Math.abs(release - rest - delay) < 0.018);
    const event = sim.events.find((e) => e.relationId === 'link-2')!;
    assert.equal(event.time, rest);
    times.add(rest);
  }
  assert.equal(times.size, 3);
});
test('delay starts after an incoming event, and multiple launch links use the earliest', () => {
  const d = structuredClone(base);
  d.relations.push(link('object-1', 'object-3', { id: 'early', trigger: 'impact', delay: 0.4 }));
  const sim = simulateScene(d)[1];
  assert.ok(
    Math.abs(eventTime(sim, 'object-3', 'release')! - eventTime(sim, 'object-1', 'impact')! - 1) <
      0.018,
  );
});
test('unmatched events do not silently launch objects and expose dormant diagnostics', () => {
  const d = structuredClone(base);
  d.relations = [link('object-1', 'object-3', { trigger: 'contact' })];
  d.objects[0].velocity = 0;
  d.objects[2].origin.x = 900;
  for (const sim of simulateScene(d)) {
    assert.ok(sim.waiting.includes('object-3'));
    assert.ok(sim.dormant.includes('test-link'));
    assert.equal(eventTime(sim, 'object-3', 'release'), undefined);
  }
});
test('disabling a launch link restores normal release', () => {
  const d = structuredClone(base);
  d.relations[1].enabled = false;
  assert.equal(eventTime(simulateScene(d)[0], 'object-3', 'release'), 0);
});
test('shattered identity is stable and centroid is mass weighted', () => {
  const sim = all.find((s) => s.world.assignment['object-1:motion'] === 'shatter')!;
  const body = frameAt(sim, 3).objects[0];
  assert.equal(body.pieces.length, 6);
  assert.ok(body.pieces.every((p) => p.id.startsWith('object-1/fragment-')));
  const mass = body.pieces.reduce((n, p) => n + p.size ** 2, 0);
  const x = body.pieces.reduce((n, p) => n + (p.x * p.size ** 2) / mass, 0);
  assert.ok(Math.abs(x - body.anchor.x) < 1e-9);
  assert.deepEqual(
    frameAt(sim, 4).objects[0].pieces.map((p) => p.id),
    body.pieces.map((p) => p.id),
  );
});
test('largest-fragment references change followers without changing source pieces', () => {
  const d = structuredClone(base);
  d.objects[0].anchor = 'largest';
  const world = all.find((s) => s.world.assignment['object-1:motion'] === 'shatter')!.world;
  const changed = simulateWorld(d, world),
    original = simulateWorld(base, world);
  const source = frameAt(changed, 3).objects[0];
  const biggest = source.pieces.reduce((a, b) => (a.size > b.size ? a : b));
  assert.equal(source.anchor.x, biggest.x);
  assert.deepEqual(source.pieces, frameAt(original, 3).objects[0].pieces);
  assert.notDeepEqual(
    frameAt(changed, 3).objects[1].anchor,
    frameAt(original, 3).objects[1].anchor,
  );
});
test('follow can target a shattered group and preserves all fragment IDs', () => {
  const d = structuredClone(base);
  d.objects[1].motion.options = ['shatter'];
  const sim = simulateScene(d)[0];
  assert.equal(frameAt(sim, 5).objects[1].pieces.length, 6);
  assert.equal(new Set(frameAt(sim, 5).objects[1].pieces.map((p) => p.id)).size, 6);
});
test('event propagation and simulation are independent of object and relation ordering', () => {
  const d = structuredClone(base);
  d.objects.reverse();
  d.relations.reverse();
  const a = simulateWorld(base, all[0].world),
    b = simulateWorld(d, all[0].world);
  assert.deepEqual(b.events, a.events);
  b.frames.forEach((f, i) =>
    assert.deepEqual(
      [...f.objects].sort((x, y) => x.id.localeCompare(y.id)),
      [...a.frames[i].objects].sort((x, y) => x.id.localeCompare(y.id)),
    ),
  );
});
test('contact triggers a push once, while contact by itself does not apply rigid-body collision', () => {
  const a = makeObject(0),
    b = makeObject(1);
  a.origin = { x: 200, y: 80 };
  b.origin = { x: 220, y: 80 };
  a.velocity = 0;
  b.velocity = 0;
  const d: EditorDocument = {
    version: 2,
    title: 'Contact',
    objects: [a, b],
    relations: [link(a.id, b.id, { trigger: 'contact', action: 'push' })],
  };
  const sim = simulateScene(d)[0];
  assert.equal(sim.events.filter((e) => e.type === 'link').length, 1);
  const noPush = simulateScene({ ...d, relations: [] })[0];
  assert.ok(frameAt(sim, 0.4).objects[1].anchor.x > frameAt(noPush, 0.4).objects[1].anchor.x + 20);
});
test('start-event cascades resolve at time zero independent of edge order', () => {
  const d = structuredClone(base);
  d.relations = [
    link('object-2', 'object-3', { id: 'second', trigger: 'start' }),
    link('object-1', 'object-2', { id: 'first', trigger: 'start' }),
  ];
  const sim = simulateScene(d)[0];
  assert.equal(eventTime(sim, 'object-3', 'release'), 0);
});
test('all exact worlds produce finite frames, bounded bodies, and deterministic rewind', () => {
  for (const sim of all)
    for (const frame of sim.frames)
      for (const o of frame.objects)
        for (const p of o.pieces) {
          assert.ok([p.x, p.y, p.angle].every(Number.isFinite));
          assert.ok(p.y <= FLOOR - p.size / 2 + 1e-6);
          assert.ok(p.x >= p.size / 2 - 1e-6 && p.x <= 960 - p.size / 2 + 1e-6);
        }
  assert.deepEqual(simulateWorld(base, all[0].world), all[0]);
  assert.equal(frameAt(all[0], -10).time, 0);
  assert.equal(frameAt(all[0], 20).time, 10);
});
test('causal graph validation catches self links, cycles, missing objects and competing follows', () => {
  assert.match(relationProblem(base, link('object-3', 'object-1'))!, /cycle/);
  assert.match(relationProblem(base, link('object-1', 'object-1'))!, /different/);
  assert.match(relationProblem(base, link('missing', 'object-1'))!, /exist/);
  const d = { ...base, relations: [base.relations[0]] };
  assert.match(
    relationProblem(d, link('object-3', 'object-2', { action: 'follow' }))!,
    /one source/,
  );
  assert.equal(relationProblem(base, link('object-3', 'object-1', { enabled: false })), null);
});
test('world limit is enforced on enumeration, import and reopening, with no sampling', () => {
  const d = structuredClone(base);
  for (let i = 3; i < 8; i++) {
    const o = makeObject(i);
    o.motion.options = ['bounce', 'slide'];
    d.objects.push(o);
  }
  assert.ok(worldCount(d) > MAX_WORLDS);
  assert.throws(() => enumerateWorlds(d), /exceeds/);
  assert.equal(isEditorDocument(d), false);
  d.objects[0].motion.resolved = 'bounce';
  assert.equal(worldCount(d), 128);
  assert.equal(enumerateWorlds(d).length, 128);
  assert.throws(() => commitDecision(d, 'object-1:motion', null), /exceed/);
});
test('deleting an object removes incident links while preserving unrelated intentions', () => {
  const next = removeObject(base, 'object-1');
  assert.equal(next.objects.length, 2);
  assert.equal(next.relations.length, 1);
  assert.deepEqual(next.relations[0], base.relations[1]);
  assert.equal(isEditorDocument(next), true);
});
test('JSON round trip validates all nested choices, bounds, IDs and references', () => {
  assert.equal(isEditorDocument(base), true);
  assert.deepEqual(parseDocument(JSON.parse(JSON.stringify(base))), base);
  for (const mutate of [
    (d: EditorDocument) => {
      d.objects[0].motion.options = [];
    },
    (d: EditorDocument) => {
      d.objects[0].delay.options = [99];
    },
    (d: EditorDocument) => {
      d.objects[0].motion.resolved = 'nope' as never;
    },
    (d: EditorDocument) => {
      d.objects[0].origin.x = NaN;
    },
    (d: EditorDocument) => {
      d.objects[0].id = d.objects[1].id;
    },
    (d: EditorDocument) => {
      d.relations[0].target = 'missing';
    },
    (d: EditorDocument) => {
      d.relations[1].target = 'object-1';
    },
    (d: EditorDocument) => {
      d.relations[0].offset.y = -999;
    },
  ]) {
    const d = structuredClone(base);
    mutate(d);
    assert.equal(parseDocument(d), null);
  }
  assert.equal(parseDocument(null), null);
  assert.equal(parseDocument({ version: 2, objects: [null] }), null);
});
test('legacy import preserves original motion choices and shared geometry', () => {
  const old = {
    version: 1,
    objectId: 'object-01',
    enabled: ['bounce', 'shatter'],
    resolved: null,
    origin: { x: 108, y: 62 },
    impact: 0.8,
    edits: { scale: 1.25, target: 'largest', spin: true },
  };
  const migrated = parseDocument(old)!;
  assert.equal(isEditorDocument(migrated), true);
  assert.deepEqual(migrated.objects[0].motion.options, old.enabled);
  assert.equal(migrated.objects[0].size, 40);
  assert.equal(migrated.objects[0].anchor, 'largest');
});
test('visual edits reuse the physics cache but geometry and relation edits invalidate it', () => {
  const d = structuredClone(base);
  d.title = 'New title';
  d.objects[0].name = 'Renamed';
  d.objects[0].color = '#ffffff';
  assert.equal(simulationKey(d), simulationKey(base));
  d.relations[0].offset.x += 10;
  assert.notEqual(simulationKey(d), simulationKey(base));
});

test('seeking a 60Hz event displays a snapshot at or after that event', () => {
  for (const sim of all)
    for (const event of sim.events) {
      assert.ok(frameAt(sim, event.time).time + 1e-8 >= event.time);
    }
});
