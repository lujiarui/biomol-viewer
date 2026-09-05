# Milestone record

- M0: Vite/React/TypeScript bootstrap, exact Mol* 5.11.0 pin, bundled 1CRN mmCIF. Install, build, tests, lint passed.
- M1–M2: Headless PluginContext rendering without desktop UI. Chromium and desktop WebKit camera drag and canvas resize tests passed; rendered structure inspected.
- M3: Local .pdb/.cif/.mmcif support, metadata, replacement, malformed-file recovery. Build, tests, lint, and both browser engines passed.
- M4: Full-screen iPad-first layout, custom native file-picker entry, 44px controls. Portrait/split-width layout checked at 834, 600, and 375 CSS px; both browser engines passed.
- M5: Single-residue tap, persistent whole-residue highlight, semantic sheet, replace and clear selection. See the automated test suite for verification.

Physical iPad checks remain unchecked in `ipad-testing.md`. Subsequent implementation starts at M6 with hardening semantic identity (insertion codes, differing author/label IDs, non-polymers), then M7 multi-selection. PWA and publishing are not part of this increment.

## 1.1 expansion

The user confirmed success on physical iPad and requested a v1.0.0 checkpoint. Commit 7aaf5e5 and annotated tag v1.0.0 preserve that version. The subsequent 1.1 scope adds a read-only Mac folder library with reload, RCSB ID loading, multistructure scene management, chain palettes and species styling, and atomic close-up inspection. These requirements supersede the earlier V0 deferrals for remote loading and multiple structures. PWA, alignment, AI, and annotations remain out of scope.
