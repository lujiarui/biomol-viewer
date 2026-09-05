# Milestone record

- M0: Vite/React/TypeScript bootstrap, exact Mol* 5.11.0 pin, bundled 1CRN mmCIF. Install, build, tests, lint passed.
- M1–M2: Headless PluginContext rendering without desktop UI. Chromium and desktop WebKit camera drag and canvas resize tests passed; rendered structure inspected.
- M3: Local .pdb/.cif/.mmcif support, metadata, replacement, malformed-file recovery. Build, tests, lint, and both browser engines passed.
- M4: Full-screen iPad-first layout, custom native file-picker entry, 44px controls. Portrait/split-width layout checked at 834, 600, and 375 CSS px; both browser engines passed.
- M5: Single-residue tap, persistent whole-residue highlight, semantic sheet, replace and clear selection. See the automated test suite for verification.

Physical iPad checks remain unchecked in `ipad-testing.md`. Subsequent implementation starts at M6 with hardening semantic identity (insertion codes, differing author/label IDs, non-polymers), then M7 multi-selection. PWA and publishing are not part of this increment.

## 1.1 expansion

The user confirmed success on physical iPad and requested a v1.0.0 checkpoint. Commit 7aaf5e5 and annotated tag v1.0.0 preserve that version. The subsequent 1.1 scope adds a read-only Mac folder library with reload, RCSB ID loading, multistructure scene management, chain palettes and species styling, and atomic close-up inspection. These requirements supersede the earlier V0 deferrals for remote loading and multiple structures. PWA, alignment, AI, and annotations remain out of scope.

## 1.2 — comparison and Mac exports

Seven bundled scenario/comparison examples, sequence-guided chain and independently captured region fits, previewed RMSD and complete residue pairs, applied world transforms with undo, distinct structure colors, and transparent PNG plus JSON export to the Mac. Numerical tests cover known rigid transforms, reflections, outliers, missing anchors, sequence gaps, discontinuous regions, insertion codes, invalid geometry, and real ubiquitin structures. Browser coverage checks applied transforms, undo, touch captures, actual rendered examples, PNG alpha, and cross-device export retrieval.

## 1.3 — interactive and sequence-independent comparison

Temporary translucent hold preview with restoration on release/cancel/blur; bounded coordinate-only matching with unequal lengths and gaps; automatic compatible-chain search and immediate fit for exactly two files; lower-gain damped pinch zoom; scene purge. Tests include randomized sequences, synthetic insertions, a real ubiquitin loop deletion, automatic selection against a decoy chain, quick undo, preview restoration, and clean reload after purge.

## 1.4 — bilingual UI and visibility-aware inspection

English/Simplified Chinese interface and remembered language preference; optional sampled automatic orientation with camera undo; nearby atoms restricted to checked file components. Validation covers Chinese UI/errors/accessibility, real-water exclusion, projection-score improvement, and exported camera state before/after/undo.

## 1.5 — Biomol, compact checkout and cross-file inspection

Renamed the app to Biomol Viewer and flattened the application into the repository root. Removed unused PWA tooling and disposable caches. Added a dependency-free Node runtime for the built UI and existing Mac APIs, plus explicit clean/compact scripts. Development remains reproducible with npm ci. Existing language settings and legacy environment variables remain compatible.

Nearby atoms now spans checked components across aligned files. Smaller language control with flags and a direct scenario-gallery shortcut.
