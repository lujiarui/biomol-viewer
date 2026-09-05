# Biomol Viewer 1.5.0

A touch-first protein and molecular structure viewer. React owns the interface; Mol* 5.11.0 owns parsing, molecular representations, picking, and the camera. The original iPad-tested release is tagged `v1.0.0`.

## Requirements

Node.js >=22, npm, and WebGL-capable Safari or Chrome. Mac and iPad should be on the same Wi-Fi for the Mac library.

## Run from the repository root

The project lives directly in `biomol_viewer/`; there is no nested application directory.

For this compact checkout, the built app is ready:

```sh
npm start
```

Open the printed **Network URL** in iPad Safari on the same Wi-Fi. The Mac serves files; the iPad renders independently. Keep the Mac awake.

For a fresh clone or to edit the app:

```sh
npm ci
npm run dev
```

To build a new standalone version:

```sh
npm run build
npm start
```

`npm start` needs only Node.js and the generated `dist/` directory. It serves the UI, Mac library, and exports on port 5173 without Vite or `node_modules`. Set `PORT` or `HOST` to override the listener. `npm run serve` rebuilds and starts this same server, so it needs development dependencies installed.

## Keep disk use small

```sh
npm run clean     # remove caches, test reports and TypeScript build state
npm run compact   # rebuild, then remove node_modules and generated caches/reports
```

Both commands preserve source, the built app, shared structures, and scene exports. After compacting, continue using `npm start`. Run `npm ci` before editing, rebuilding, or running tests again. The build directory is Git-ignored and must be generated after a fresh clone.

The previous 323 MB dependency folder was a local development install, not tracked Git content. The unused PWA plugin was removed; required Mol*, compiler, bundler, and test dependencies remain declared reproducibly in the lockfile. No dependency package is partially stripped. Global npm caches and shared Playwright browser installations are left alone.

## Language and automatic view

Switch between **English and 简体中文** using **中文 / EN** in the toolbar. The choice persists on each browser.

**Files → Auto view · Beta** rotates and fits visible components to reduce sampled projection overlap; **Undo view** restores the prior camera. It does not change alignment coordinates. **Nearby atoms · 5 Å** respects the checked Files components, including hidden water and chains. See [language and view controls](docs/view-and-language.md).

## Mac → iPad workflow

1. Save/copy generated `.pdb`, `.cif`, or `.mmcif` files into `shared-structures/` in this application directory. Subfolders are supported.
2. On iPad, choose **Open → Mac library → Refresh**, then tap a file.
3. Continue generating structures on the Mac. For an already-open filename, use **Files → Reload** on iPad. Reload reads the latest disk contents and replaces that scene entry, preserving structure/part visibility. If parsing fails, the previous structure stays usable.

To use an existing output folder without copying, stop the server and restart with:

```sh
BIOMOL_LIBRARY="/Users/yourname/path/to/outputs" npm start
```

Use the absolute path to the folder you want to share. The API is read-only, skips hidden files and symlinks, and serves only PDB/mmCIF files within that folder. The library has no write/delete endpoints; the separate Export API writes only generated PNG images and JSON reports to the export folder. Files in the default folder are Git-ignored. Anyone who can reach this server can read the shared structures, so use a trusted LAN and do not expose it publicly. The app never uploads device-local structures to the Mac or to RCSB.

For routine use after development, stop the development server and serve a built version on the same port:

```sh
BIOMOL_LIBRARY="/absolute/path/to/outputs" npm run serve
```

This rebuilds the app and starts its standalone server with the Mac-library API on port 5173. Keep the Mac awake. Folder changes are visible through Refresh/Reload without restarting the server. Changing the folder configuration requires a restart.

## Opening and managing structures

**Open** offers the native device file picker, the Mac library, and an RCSB PDB ID field (for example `4HHB`; extended `pdb_00004hhb` IDs also work). RCSB files are fetched directly from `https://files.rcsb.org/download/…cif`, so that option needs internet access. The bundled scenario gallery covers protein monomers, ligands, homo/heteromers, protein–RNA, and protein–DNA without external network access. The ubiquitin comparison pair is a quick alignment demo; see [example provenance](docs/examples.md).

Each open adds a structure. **Files** toggles the scene panel, where you can show/hide entire structures, individual protein chains, or species groups, fit a structure, reload Mac-library files, and remove entries. Removal affects only the browser scene; it never deletes a Mac file. Files initially retain their original coordinates. Use **Align** to superpose them; **Duplicate** creates another instance for comparing chains within one file. Unrelated structures can overlap; hide the ones you are not inspecting. Scene state is not persisted across a page refresh.

## Coloring and close-up inspection

The Files panel offers Vivid, Pastel, and Colorblind-friendly chain palettes. Colors are assigned to protein chains, independently of water/ligand chain records. Complexes with more than eight protein chains use distinct generated colors within the chosen palette family; colorblind distinguishability of arbitrarily large palettes is not guaranteed.

Protein uses colored cartoons. DNA/RNA and ligands use element-colored ball-and-stick representations with contrasting carbon colors, glycans use carbohydrate symbols, ions use spheres, and water starts hidden. The panel explains this visual key.

For side-chain inspection:

1. Tap a residue, then **Nearby atoms · 5 Å** to show whole residues around it as sticks and zoom in.
2. Or choose **Files → Representation → Cartoon + sticks / All atoms**.
3. Choose **Tap selects → Atom**, close the panel, tap a visible atom, then **Focus**. Atom mode requires atom geometry; a ribbon alone does not identify an atom.
4. Pinch to inspect more closely. **Reset view** fits the scene again; **Clear selection** clears marks and hides the temporary nearby-atoms view.

Nearby atoms is a geometric proximity view, not a hydrogen-bond or interaction classifier. Switching to atom picking preserves an existing nearby-atoms view. The first coordinate model is loaded; biological assemblies and trajectories are not expanded.

## Superposition and RMSD

Open two structures, then choose **Align**. Pick a fixed Reference chain and a Mobile chain, **Preview fit** for numbers or **Hold to preview overlap** for a temporary translucent overlay, inspect the RMSD and residue pairs, then **Apply alignment**. The entire mobile file moves; **Undo last alignment** restores its previous pose.

Whole-chain sequence correspondence is the default. Restrict either or both counterparts using author residue ranges, or enable **Tap to add/remove residues**, pick on the canvas, and capture each side with **Use current selection**. Captured regions persist while the panel is closed. Protein fits use Cα; nucleic-acid fits use C4′. Explicit sequence-order pairing supports custom equal-sized counterparts. See [alignment methods and limitations](docs/alignment.md).

For sequence-independent matching, choose **Coordinates only**. It supports unequal lengths and gaps using a bounded geometric search. **Quick align two files** automatically chooses the best-scoring compatible chain pair and immediately applies the fit; it is enabled only with exactly two open entries. First file stays fixed, second file moves. Review coverage and pair correspondences, especially for repetitive structures.

**Files → Purge all structures** clears the browser scene, selection, captured regions, and alignment history. Mac source files and saved exports remain on disk. Pinch zoom now uses lower gain with damping for finer control.

## Export to the Mac

Choose **Export → Save PNG to Mac**. Transparency is on by default. Images and matching JSON reports are written to `scene-exports/`; the Export panel on either device lists them. Set `BIOMOL_EXPORTS` to change the destination. JSON records camera, file labels, visibility, transforms, and the latest alignment report; it is not a reloadable scene package. See [export workflow](docs/export.md).

## Test

```sh
npm test
npm run typecheck
npm run lint
npm run test:runtime  # after building; uses only Node.js
```

## E2E

```sh
npx playwright install chromium webkit
npm run test:e2e
```

Browser tests use real molecular rendering and canvas taps. RCSB regression tests use a downloaded 4HHB fixture for determinism. The live RCSB browser path was also checked separately. Library E2E tests temporarily write uniquely named files in the default shared folder; run E2E without a custom BIOMOL_LIBRARY setting.

## Build

```sh
npm run build
```

## Preview

```sh
npm run preview
```

Preview uses its default port 4173. `npm run serve` builds and serves on port 5173 for regular iPad use.

## Architecture and deployment

See [architecture](docs/architecture.md) and [iPad checklist](docs/ipad-testing.md). `src/viewer/` contains the Mol* boundary, and selections exposed to React use semantic identifiers plus a scene ID and optional atom name. `server/library.ts` and `server/exports.ts` are the isolated Mac filesystem adapters.

The browser app builds to static `dist/`. It can be deployed to a static host for device file loading and RCSB access. The Mac-library and Mac-export features require the Node server (`npm start`) or the Vite development/preview server. A static host can serve the browser assets but cannot expose Mac folders. The bundled `dist/server.mjs` is server code and is never served to browsers. PWA/offline installation, cloud storage, and annotations remain deferred.

## Example provenance

Bundled crambin: https://files.rcsb.org/download/1CRN.cif. Multichain/ligand regression fixture: https://files.rcsb.org/download/4HHB.cif. Official RCSB download documentation: https://www.rcsb.org/docs/programmatic-access/file-download-services.

New: scenario examples, chain/region superposition with RMSD and undo, and transparent PNG exports saved on the Mac. See [alignment](docs/alignment.md) and [export](docs/export.md).

Configuration uses `BIOMOL_LIBRARY` and `BIOMOL_EXPORTS`. Legacy `PROTEIN_LIBRARY` / `PROTEIN_EXPORTS` still work; the new names take precedence. Existing saved language preferences are migrated on first use.

Nearby atoms searches all visible files and checked chains in their current aligned coordinates. Whole nearby residues are shown, with file-specific carbon colors and atom/file counts. The empty-screen **Examples by scenario** shortcut opens the gallery; **+ Open** keeps all file sources available.
