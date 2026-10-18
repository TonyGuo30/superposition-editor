# Superposition Editor — implementation brief

Reference: `concept.png`, generated with the built-in ImageGen tool.

Prompt: a full primary desktop screen for SUPERPOSITION, a geometric 2D animation editor with one unresolved object and Bounce / Slide / Shatter alternatives; true-white chrome, pale cool-gray dot-grid canvas, cobalt blue, teal and coral branches; left Scene panel, three live branch previews, overlaid central stage, right Shared edits inspector, bottom parallel timeline. All controls and simulation artwork are native HTML/CSS/SVG. The simulation intentionally uses geometric primitives, not raster game sprites.

Tokens: white #ffffff, canvas #f7f9fc, ink #141b30, muted #748098, border #e5eaf2, accent #1552ff, branch bounce #2560ff / slide #159da1 / shatter #f97366. UI: system sans, 12–14px controls, 18px project title; tabular figures for the timeline. Panels use 1px boundaries and small radii; no nested decorative cards.

Structure: 58px header; 214px scene sidebar; fluid center; 280px inspector; 218px timeline; 30px status footer. At small viewports, panels stack and the timeline scrolls inside its own container.

Required functional extensions to the reference: resolution dialog; undo/redo; a branch-conditional Spin intact operation (2/3 applicability); visible logical reference mapping; drag-to-change shared origin; reset and JSON export; keyboard and local persistence. Initial follow-camera is off so the user can see its effect on enabling it. These are intentional workflow additions to the concept.

Rendering uses a single logical document and shared operation list. Branch evaluation is deterministic at a shared time. Resolving changes the active branch set without copying or discarding edits. Shattering expands a stable logical ID into seven stable fragment IDs; references resolve to the area-weighted centroid or largest fragment.
