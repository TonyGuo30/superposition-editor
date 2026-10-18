# Superposition Editor

**Build interactions before deciding which behavior to keep.**

Superposition Editor is an experimental interactive system for authoring scenes across multiple possible worlds. Keep an object's motion and release timing undecided while adding more objects and connecting their behaviors. Each combination runs its own simulation, so the same relationship can trigger at different times in different worlds.

Objects and relationships are defined once and shared across worlds. Preview any combination, commit a single decision, or keep an entire world without losing your edits. Reopen a decision whenever you want to explore its alternatives again.

Built with React, TypeScript, Vite, SVG, and a deterministic simulation worker. No account, API key, backend, or model call is needed.

## Run

Requires Node.js 22.6+ and npm.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Production and engine validation:

```sh
npm test
npm run build
npm run preview
```

The GitHub Actions workflow runs the engine tests and production build on pushes and pull requests.

## Try the mechanism

The starter scene contains Atlas, Echo, and Ember, with three independent open decisions and **12 exact worlds**. Echo follows Atlas after its impact; Ember launches after Echo first rests. Atlas's behavior changes the event timing, so Ember can start at different times in different worlds.

1. **Add object**, name it Relay, and include both Bounce and Slide in its inspector. Include Now and +0.6 s under Release delay as well. The two dimensions remain independently undecided, giving 48 worlds with the original scene.
2. Select an existing source and **Add link**. In the relationship inspector, set its target, trigger, action, delay, and optional follow offset. The relationship applies to every world; no branch has to be chosen first.
3. Click options under **Open decisions** to combine preview filters. These buttons do not modify the document. Click **Preview** in the world explorer to isolate a complete combination. **Worlds** above the canvas compares the first six matching worlds; pagination below can reach every combination.
4. Inspect **Events** to see actual release, floor impact, rest, and relationship activation times in the previewed world, or the first matching world when no world is isolated. Click an event to seek there.
5. Click an option's **lock** to commit that dimension alone. **Keep world** commits the whole combination. **Reopen**, Undo, and Redo preserve objects, edits, links, and candidate alternatives.
6. **New** starts a blank, single-object scene. The reset icon loads the starter scene. Both are undoable. Import and Export round-trip the complete unresolved document.

Drag a labeled origin to update the object in every world. Origins also accept arrow keys (Shift for larger steps). Space plays/pauses, R replays, and Cmd/Ctrl Z undoes. The in-app Help includes Chinese instructions.

## Authoring model

- Up to **10 logical objects**, each with editable identity, shape, color, size, position, horizontal launch velocity, bounce energy, spin, and reference anchor.
- Two independent choice dimensions per object: **on-impact behavior** (bounce, slide, shatter) and **release delay** (0, 0.6, 1.2 seconds). Include any nonempty subset of each dimension. Adding a new alternative reopens that decision.
- Up to **24 directed relationships**. Triggers: source release, first floor impact, first rest, or source–target contact. Actions: spring follow, launch, directional push, or pulse highlight. Events can be delayed.
- Follow references the source's area-weighted centroid or largest fragment. Shattering preserves the parent identity and gives each of six fragments a stable child identity. A shattered group can also be a follower.
- Launch holds a target at its origin until a matching event. Its own release delay starts then. Multiple launch links use the earliest activation; an event that never occurs leaves the target waiting.
- Relationships form a directed acyclic graph. Self-links, causal cycles, and simultaneous competing follow sources are rejected with an explanation. Links can be disabled without being deleted.
- The scene contains a maximum of **128 active combinations**. All are evaluated; there is no hidden sampling. An edit or import that exceeds the budget is rejected. Commit another decision before expanding further. Reopening is subject to the same budget.

## Runtime and semantics

`src/engine.ts` is a pure document-to-world evaluator. It enumerates stable assignment IDs, integrates each world at 60 Hz over a 10-second window, and caches 30 Hz snapshots for deterministic scrubbing. Simulation runs in a cancellable Web Worker with a short input debounce, keeping direct manipulation responsive. Superseded jobs are terminated; the UI marks recomputation instead of showing stale worlds as current. Names, colors, and title changes reuse the physics result.

Event cascades run to a bounded fixed point. State and edge processing have a canonical order, and follow forces read the previous step's anchors, so rearranging document rows does not change outcomes. Event rules are one-shot. The log distinguishes actual events from links that never activate during the window.

This is a bounded 2D authoring system, **not a general rigid-body physics engine**. Contact senses bounding-circle overlap; objects do not automatically collide with each other. Add Push to create a contact response. Bodies do collide with the floor and side walls. Follow uses a damped spring and overrides gravity while active; impact alternatives still apply when the body reaches the floor. Rest means speed below a small threshold for 0.3 seconds, with a followed source also at rest. The rest trigger uses the first rest, even if a later impulse wakes the body.

Current limits: fixed 10-second window, the listed behavior/action vocabulary, two choice dimensions per object, no cyclic constraints, no arbitrary scripting, and no collaborative editing or video export. No claim of research novelty is made by the implementation alone.

## Persistence

Scenes autosave on this device under `superposition-document-v2`. Preview filters, selected world, and playback state are transient. History holds the last 60 document edits. Dragging is a single history transaction. Import validates all IDs, references, ranges, choices, graph constraints, and world limits, and is itself undoable. Legacy v1 JSON exports migrate to a single-object v2 scene; the old v1 local-storage key remains untouched. Migration carries geometry, motion choices, spin, and reference anchor; v1 camera and caption settings have no v2 document equivalent.

## Structure

- `src/engine.ts`, `src/engine.test.ts`: model, validation, exact world enumeration, event simulation, and semantic tests.
- `src/simulation.worker.ts`, `src/useSimulation.ts`: cancellable background computation.
- `src/useEditor.ts`: persistence, history, gestures, and playback.
- `src/components/`: scene/relationship list, SVG canvas, choice shelf, context inspector, world/event explorer, and help.
- `design/workspace-v2.png`, `design/system-v2.md`: visual reference, design tokens, and interaction contract. The original single-object concept is retained in `design/concept.png`.

Fonts are bundled locally. Scene geometry, interface labels, controls, and timelines are native code; the concept images are design references only.
