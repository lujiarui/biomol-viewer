# Application / Mol* boundary

React owns toolbar, Open dialog, scene panel, and selection sheet. `BiomolViewer` in `src/viewer/types.ts` is the application contract; React never manipulates PluginContext, loci, molecular queries, or state-tree refs.

`ViewerController` owns the headless PluginContext, scene entries, serialized mutations, selection events, camera, lifecycle, and visibility. Each open stages a new molecular subtree through `structureLoader`. Failed staging is deleted without touching previous structures. Normal opens accumulate entries. Mac Reload stages new data, transfers visibility flags, then removes the previous subtree. Successful loads clear selection. `SceneStructure` contains copied semantic metadata and visibility flags, keyed by an opaque session ID.

`representations` creates one component per protein chain, followed by nucleic-acid, ligand, glycan, ion, lipid, and water components. Lipids are excluded from the ligand component to avoid duplication. Protein colors are counted using actual protein components, not all label-chain records. Palette changes regenerate representations while retaining component visibility. Cartoon, cartoon-with-sticks, backbone, line, ball-and-stick, space-filling, and molecular-surface modes affect protein; non-protein species retain their distinguishing representation.

Selections contain semantic residue identity plus the owning scene ID, filename, and optional atom name. Label and author chain/sequence numbers, insertion code, and source model number are retained. Internal loci remain in the controller. Atom picking requires a single-atom pick; cartoon picks do not fabricate atomic precision. Bond picks use their first atom. The selected loci drives camera focus and a 5 Å whole-residue surroundings query. Nearby geometry persists while picking within it and is hidden on Clear; one temporary surroundings component per contributing file is retained. No interaction chemistry is inferred from proximity.

`createViewer` uses public PluginContext APIs without any Mol* desktop panels. The primary camera-focus behavior is omitted so taps do not zoom unexpectedly. Native Mol* camera input remains. Close inspection lowers the camera distance floor and near clipping limit. React does not subscribe to camera or render frames.

`server/library.ts` is a read-only Vite plugin shared by development and production preview servers. BIOMOL_LIBRARY selects one explicit folder, defaulting to shared-structures. GET /api/library lists nested PDB/mmCIF files and modification times. GET /api/library/file?name=… reads listed files after realpath containment validation. Hidden files, symlinks, traversal paths, non-structure extensions, and non-GET methods are rejected. No filesystem paths are accepted outside the configured root, no uploads are stored, and no CORS access is granted. This is intended for a trusted local network, not unauthenticated public hosting.

`src/viewer/sources.ts` validates RCSB identifiers and fetches files. RCSB traffic goes from the browser directly to the official download host. Local device files never leave the browser. The Mac library sends copies of explicitly shared files to the iPad; it does not mirror screens or synchronize viewer sessions.

On unmount the controller aborts fetches, disconnects ResizeObserver and subscriptions, unmounts the canvas, and stops the animation loop. Final plugin disposal waits for an in-flight mutation to settle. Tests cover disposal while parsing, actual CIF-to-residue conversion, library boundaries, palette selection, and browser workflows.

Official integration reference: https://molstar.org/docs/plugin/instance/#plugincontext-without-built-in-react-ui. Mol* 5.11.0 installed types/source are the implementation authority. The unavoidable state-tree visibility helper is isolated in ViewerController.

## Superposition and exports (1.2)

Each loaded structure has a dedicated TransformStructureConformation node before its components. Alignment computes a world-space rigid transform and left-composes it with that entry's existing transform; applying and undoing update the same node. No source coordinates are rewritten. Duplicate reloads the source into a distinct scene instance. Color offsets distinguish successive structures while reload retains its offset.

`alignment.ts` extracts observed polymer sequences and representative atoms, resolves independent endpoint regions, maps sequence correspondences, and validates a rigid least-squares fit. React receives semantic chains and reports. Captured region slots live in the mounted AlignmentPanel; picking remains available when the panel is closed. Picked component loci are remapped onto the entry structure before multi-residue set operations.

`server/exports.ts` provides bounded, same-origin PNG/JSON writes and read-only listings for both development and preview. Export uses Mol* viewportScreenshot with temporary transparency settings and restores those settings afterward. It saves only the molecular viewport, without React panels. The metadata records state and the latest fit, but does not contain source structure files or implement scene restoration.

## Alignment extensions (1.3)

`coordinateAlignment.ts` implements bounded geometry-only seeding and iterative local order-preserving correspondence; `alignment.ts` reuses the rigid solver for each correspondence. Quick mode evaluates compatible chain pairs and commits the selected fit within one serialized controller mutation. The geometry score is a custom coverage-aware ranking metric, not a TM-score.

Hold preview snapshots the mobile matrix, camera, and representation alpha factors, updates the existing state node temporarily, and restores them on release. It does not modify the stored entry matrix, provenance, or undo stack. UI pointer capture plus keyboard/blur/cancellation handlers keep release reliable. Other scene mutations are blocked while previewing.

Purge deletes all molecular data subtrees and clears selections/undo/provenance; configured filesystem directories are untouched. Trackball gesture gain is 0.25, zoom speed 4, staticMoving false, and damping factor 0.35, reducing pinch sensitivity and introducing gradual settling.

## Language and visible-atom views (1.4)

The React i18n context stores language preference locally. Each UI component translates its rendered React text and accessibility attributes with `localize`; controlled values, event handlers, molecular data and filenames remain intact. The translation catalog includes parameterized messages. No DOM rewriting or molecular reload occurs on language changes.

`visibleAtoms.ts` unions checked component loci after remapping them onto the parent structure. The controller uses that set for both world-space neighborhood search and automatic camera orientation. `bestView.ts` scores deterministic sampled projections; the controller scans all eligible atoms for a conservative bounding box, requests an invariant camera orientation, and stores one prior camera snapshot for undo.

## Flat project and compact runtime (1.5)

The root is the application workspace. Shared API handlers are exported from library.ts/exports.ts and reused by Vite and the standalone Node HTTP server. `npm run build` bundles the server into dist/server.mjs with esbuild; it has only Node built-in imports. The runtime serves allowlisted static asset types within dist, rejects traversal/symlinks leaving that root, and retains the existing API validation. `npm start` therefore does not require node_modules.

`npm run compact` builds first and removes the local dependency install plus disposable reports/caches. `npm ci` restores the development environment from the lockfile. Source examples, test fixtures, library inputs, saved exports, and Git history are preserved.
