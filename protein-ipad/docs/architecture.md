# Application / Mol* boundary

## Scope

This increment implements M0–M5. Multi-residue selection, focus/sticks/hide actions, representation switching, PWA, and the development debug panel remain later milestones. Clear is present to make single-residue selection reversible. No future controls are shown as placeholders.

## Ownership

- React owns toolbar, native file input, empty/loading/error states, and the selection sheet.
- `ProteinViewer` in `src/viewer/types.ts` is the UI-facing contract. It exposes load, reset, selection subscription, clear, and disposal; it does not expose PluginContext or loci.
- `ViewerController` owns the PluginContext, current data subtree, operation lock, subscriptions, camera commands, and ResizeObserver.
- `createViewer` initializes a headless PluginContext. No Mol* React UI or Mol* UI stylesheet is used. The installed Mol* 5.11.0 types and implementation are the authority for APIs.
- `structureLoader` detects extensions, parses through Mol* builders, creates the first model's deposited coordinates, and extracts metadata. Biological assemblies and multi-model trajectories are not loaded in this milestone.
- `representations` creates polymer cartoon, ligand ball-and-stick, and ion spacefill components. Water is not represented. Chains use Mol* chain colors.
- `selection` converts atomic/bond loci into one whole residue and a semantic object.

## Loading and recovery

Only one load can run at a time. Text is read locally; it is not uploaded or stored. A replacement is staged as a new data subtree, including representations. The previous subtree is deleted only after staging succeeds. If parsing fails, the staging subtree is removed and the previous structure and selection remain available. On successful replacement, selection clears and the camera resets. No external structure endpoints are called at runtime.

Atom count counts the loaded first model's elements; residue count includes all atomic residues, including water/ligand residues even when hidden. Chain summaries use label chain identifiers and retain author identifiers. mmCIF label and author identifiers can differ.

## Selection semantics

`SelectionState` contains `ResidueRef[]`; M5 populates zero or one item. Each residue records label chain/sequence identifiers, author identifiers, insertion code when present, and the residue name. `modelId` is the source model number as a string, not Mol*'s generated UUID. For non-polymer residues without a label sequence number, `residueNumber` falls back to the author number. The current deposited-model-only scope avoids assembly-instance ambiguity.

A tap uses the first atomic residue in the picked loci and extends its rendering selection to the whole residue. Bond picks resolve to the first residue. The selection uses persistent Mol* selection marks, independently of hover. The default click-to-focus and default focus-representation behaviors are not registered, so a tap cannot unexpectedly zoom or create extra representations. Camera drag/pinch/pan still use Mol*'s native input handling. React does not subscribe to render frames or camera motion.

Subscribers receive copies of semantic state. Background taps leave selection unchanged; a new residue tap replaces it. Clear removes all selection marks. Internal loci never enter React state or browser persistence.

## Lifecycle

React owns one controller per mounted ViewerCanvas. Initialization checks AbortSignal before/after mounting and disposes on failure. Cleanup aborts fetches, disconnects ResizeObserver, unsubscribes clicks, clears listeners, unmounts the canvas, and stops the animation loop. If molecular parsing is already in progress, final PluginContext disposal waits for that operation to settle; the canvas is detached immediately. This avoids disposing Mol* state while a builder is committing.

## Verification and sources

Vitest covers extension detection, bundled data, actual mmCIF parsing/metadata, and atom-pick conversion into a whole residue and serializable reference. Playwright tests Chromium and desktop WebKit, including canvas changes after dragging, viewport resizing, local files, malformed-file recovery, touch target sizing, and actual touchscreen residue taps.

Desktop WebKit is not actual iPad Safari. Follow [the physical iPad checklist](ipad-testing.md) before accepting touch comfort or releasing V0.

Official integration reference: https://molstar.org/docs/plugin/instance/#plugincontext-without-built-in-react-ui. Relevant installed modules: `mol-plugin/context`, `mol-plugin/spec`, `mol-plugin-state/builder/structure`, `mol-plugin-state/manager/interactivity`, and `mol-model/structure/structure/element/loci`.
