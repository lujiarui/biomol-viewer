# Application / Mol* boundary

React owns toolbar, Open dialog, scene panel, and selection sheet. `ProteinViewer` in `src/viewer/types.ts` is the application contract; React never manipulates PluginContext, loci, molecular queries, or state-tree refs.

`ViewerController` owns the headless PluginContext, scene entries, serialized mutations, selection events, camera, lifecycle, and visibility. Each open stages a new molecular subtree through `structureLoader`. Failed staging is deleted without touching previous structures. Normal opens accumulate entries. Mac Reload stages new data, transfers visibility flags, then removes the previous subtree. Successful loads clear selection. `SceneStructure` contains copied semantic metadata and visibility flags, keyed by an opaque session ID.

`representations` creates one component per protein chain, followed by nucleic-acid, ligand, glycan, ion, lipid, and water components. Lipids are excluded from the ligand component to avoid duplication. Protein colors are counted using actual protein components, not all label-chain records. Palette changes regenerate representations while retaining component visibility. Global cartoon/cartoon-sticks/atoms modes affect protein; non-protein species retain their distinguishing representation.

Selections contain semantic residue identity plus the owning scene ID, filename, and optional atom name. Label and author chain/sequence numbers, insertion code, and source model number are retained. Internal loci remain in the controller. Atom picking requires a single-atom pick; cartoon picks do not fabricate atomic precision. Bond picks use their first atom. The selected loci drives camera focus and a 5 Å whole-residue surroundings query. Nearby geometry persists while picking within it and is hidden on Clear; only one temporary surroundings component is retained. No interaction chemistry is inferred from proximity.

`createViewer` uses public PluginContext APIs without any Mol* desktop panels. The primary camera-focus behavior is omitted so taps do not zoom unexpectedly. Native Mol* camera input remains. Close inspection lowers the camera distance floor and near clipping limit. React does not subscribe to camera or render frames.

`server/library.ts` is a read-only Vite plugin shared by development and production preview servers. PROTEIN_LIBRARY selects one explicit folder, defaulting to shared-structures. GET /api/library lists nested PDB/mmCIF files and modification times. GET /api/library/file?name=… reads listed files after realpath containment validation. Hidden files, symlinks, traversal paths, non-structure extensions, and non-GET methods are rejected. No filesystem paths are accepted outside the configured root, no uploads are stored, and no CORS access is granted. This is intended for a trusted local network, not unauthenticated public hosting.

`src/viewer/sources.ts` validates RCSB identifiers and fetches files. RCSB traffic goes from the browser directly to the official download host. Local device files never leave the browser. The Mac library sends copies of explicitly shared files to the iPad; it does not mirror screens or synchronize viewer sessions.

On unmount the controller aborts fetches, disconnects ResizeObserver and subscriptions, unmounts the canvas, and stops the animation loop. Final plugin disposal waits for an in-flight mutation to settle. Tests cover disposal while parsing, actual CIF-to-residue conversion, library boundaries, palette selection, and browser workflows.

Official integration reference: https://molstar.org/docs/plugin/instance/#plugincontext-without-built-in-react-ui. Mol* 5.11.0 installed types/source are the implementation authority. The unavoidable state-tree visibility helper is isolated in ViewerController.
