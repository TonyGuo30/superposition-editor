import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeBranches, BRANCHES, branchRestAt, createDocument, DURATION, evaluateBranch,
  FLOOR, impactTime, isEditorDocument, resolveDocument, toggleBranch, traceBranch } from './engine.ts';

test('resolving and reopening changes branch selection without copying or losing shared edits', () => {
  const doc = createDocument();
  doc.edits.caption = 'One reference, every future.';
  doc.edits.follow = true;
  doc.edits.spin = true;
  doc.edits.scale = 1.3;
  const resolved = resolveDocument(doc, 'shatter');
  assert.deepEqual(activeBranches(resolved), ['shatter']);
  assert.equal(resolved.edits, doc.edits);
  assert.deepEqual(resolved.origin, doc.origin);
  assert.deepEqual(activeBranches({ ...resolved, resolved: null }), ['bounce', 'slide', 'shatter']);
  assert.deepEqual(evaluateBranch(resolved, 'shatter', 3), evaluateBranch(doc, 'shatter', 3));
});

test('the logical object expands into stable fragment IDs and supports two reference resolutions', () => {
  const doc = createDocument();
  assert.equal(evaluateBranch(doc, 'shatter', 0).pieces[0].id, 'object-01');
  const a = evaluateBranch(doc, 'shatter', 2);
  const b = evaluateBranch(doc, 'shatter', 4);
  assert.equal(a.pieces.length, 7);
  assert.deepEqual(a.pieces.map(p => p.id), b.pieces.map(p => p.id));
  const largest = evaluateBranch({ ...doc, edits: { ...doc.edits, target: 'largest' } }, 'shatter', 2);
  const piece = a.pieces.reduce((x, y) => x.size > y.size ? x : y);
  assert.deepEqual(largest.target, { x: piece.x, y: piece.y });
  const area = a.pieces.reduce((s, p) => s + p.size ** 2, 0);
  assert.ok(Math.abs(a.target.x - a.pieces.reduce((s, p) => s + p.x * p.size ** 2, 0) / area) < 1e-9);
  assert.notDeepEqual(a.target, largest.target);
  for (const id of ['bounce', 'slide'] as const) {
    assert.deepEqual(evaluateBranch(doc, id, 2).target, evaluateBranch({ ...doc, edits: { ...doc.edits, target: 'largest' } }, id, 2).target);
  }
});

test('branch-conditional spin never mutates a fragment group', () => {
  const doc = createDocument();
  const withSpin = { ...doc, edits: { ...doc.edits, spin: true } };
  for (const t of [0, .5, 1.5, 3, 6]) {
    assert.deepEqual(evaluateBranch(doc, 'shatter', t).pieces, evaluateBranch(withSpin, 'shatter', t).pieces);
  }
  assert.notEqual(evaluateBranch(doc, 'bounce', 2).pieces[0].angle, evaluateBranch(withSpin, 'bounce', 2).pieces[0].angle);
  assert.equal(evaluateBranch(withSpin, 'shatter', 2).spinApplicable, false);
});

test('caption waits for the individual branch rest event, including after impact edits', () => {
  for (const impact of [.2, .8, 1.2]) {
    const doc = { ...createDocument(), impact };
    const restTimes = BRANCHES.map(b => branchRestAt(doc, b.id));
    assert.ok(new Set(restTimes).size === 3);
    for (const b of BRANCHES) {
      const rest = branchRestAt(doc, b.id);
      assert.equal(evaluateBranch(doc, b.id, rest - .001).caption, null);
      assert.equal(evaluateBranch(doc, b.id, rest + .001).caption, doc.edits.caption);
      assert.equal(evaluateBranch({ ...doc, edits: { ...doc.edits, captionEnabled: false } }, b.id, DURATION).caption, null);
    }
  }
});

test('all futures share the same approach; moving the origin updates all evaluations', () => {
  const doc = createDocument();
  const beforeHit = impactTime(doc) - .1;
  const first = evaluateBranch(doc, 'bounce', beforeHit).pieces;
  for (const b of BRANCHES) assert.deepEqual(evaluateBranch(doc, b.id, beforeHit).pieces, first);
  const moved = { ...doc, origin: { x: 200, y: 100 } };
  for (const b of BRANCHES) {
    assert.deepEqual(evaluateBranch(moved, b.id, 0).target, moved.origin);
    assert.deepEqual(traceBranch(moved, b.id)[0], moved.origin);
  }
});

test('simulation is finite, deterministic, above ground, and settled within the timeline', () => {
  for (const impact of [.2, .8, 1.2]) for (const scale of [.65, 1, 1.5]) {
    const seed = createDocument();
    const doc = { ...seed, impact, edits: { ...seed.edits, scale } };
    for (const b of BRANCHES) {
      assert.ok(branchRestAt(doc, b.id) < DURATION);
      for (let t = 0; t <= DURATION; t += .1) {
        const frame = evaluateBranch(doc, b.id, t);
        assert.deepEqual(frame, evaluateBranch(doc, b.id, t));
        for (const p of frame.pieces) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.angle));
          assert.ok(p.y + p.size / 2 <= FLOOR + .00001);
        }
      }
      assert.deepEqual(evaluateBranch(doc, b.id, DURATION).pieces, evaluateBranch(doc, b.id, DURATION - .1).pieces);
    }
  }
});

test('branch exclusions cannot produce an empty or invalid resolved scene', () => {
  let doc = createDocument();
  doc = toggleBranch(doc, 'bounce');
  doc = toggleBranch(doc, 'slide');
  assert.equal(toggleBranch(doc, 'shatter'), doc);
  assert.throws(() => resolveDocument(doc, 'bounce'));
  const resolved = resolveDocument(doc, 'shatter');
  assert.equal(toggleBranch(resolved, 'bounce'), resolved);
});

test('persisted documents are validated before use', () => {
  const doc = createDocument();
  assert.ok(isEditorDocument(JSON.parse(JSON.stringify(doc))));
  assert.equal(isEditorDocument({ ...doc, enabled: [] }), false);
  assert.equal(isEditorDocument({ ...doc, enabled: ['bounce', 'bounce'] }), false);
  assert.equal(isEditorDocument({ ...doc, impact: Number.NaN }), false);
  assert.equal(isEditorDocument({ ...doc, origin: { x: 1e10, y: 0 } }), false);
  assert.equal(isEditorDocument({ ...doc, edits: { ...doc.edits, caption: 'a'.repeat(121) } }), false);
  assert.equal(isEditorDocument({ ...doc, resolved: 'nope' }), false);
});
