# Protein 1.1

A touch-first protein and molecular structure viewer. React owns the interface; Mol* 5.11.0 owns parsing, molecular representations, picking, and the camera. The original iPad-tested release is tagged `v1.0.0`.

## Requirements

Node.js >=22, npm, and WebGL-capable Safari or Chrome. Mac and iPad should be on the same Wi-Fi for the Mac library.

## Install

```sh
npm install
```

## Develop

```sh
npm run dev
```

Open the printed **Network URL** in iPad Safari. The Mac serves files; the iPad performs its own rendering and camera interaction. There is no mirrored display or camera synchronization.

## Mac → iPad workflow

1. Save/copy generated `.pdb`, `.cif`, or `.mmcif` files into `shared-structures/` in this application directory. Subfolders are supported.
2. On iPad, choose **Open → Mac library → Refresh**, then tap a file.
3. Continue generating structures on the Mac. For an already-open filename, use **Files → Reload** on iPad. Reload reads the latest disk contents and replaces that scene entry, preserving structure/part visibility. If parsing fails, the previous structure stays usable.

To use an existing output folder without copying, stop the server and restart with:

```sh
PROTEIN_LIBRARY="/Users/yourname/path/to/outputs" npm run dev
```

Use the absolute path to the folder you want to share. The API is read-only, skips hidden files and symlinks, and serves only PDB/mmCIF files within that folder. There are no write/delete endpoints. Files in the default folder are Git-ignored. Anyone who can reach this server can read the shared structures, so use a trusted LAN and do not expose it publicly. The app never uploads device-local structures to the Mac or to RCSB.

For routine use after development, stop the development server and serve a built version on the same port:

```sh
PROTEIN_LIBRARY="/absolute/path/to/outputs" npm run serve
```

This builds the app and starts the production preview with the same Mac-library API on port 5173. Keep the Mac awake. Folder changes are visible through Refresh/Reload without restarting the server. Changing the folder configuration requires a restart.

## Opening and managing structures

**Open** offers the native device file picker, the Mac library, and an RCSB PDB ID field (for example `4HHB`; extended `pdb_00004hhb` IDs also work). RCSB files are fetched directly from `https://files.rcsb.org/download/…cif`, so that option needs internet access. The bundled crambin example needs no external network.

Each open adds a structure. **Files** toggles the scene panel, where you can show/hide entire structures, individual protein chains, or species groups, fit a structure, reload Mac-library files, and remove entries. Removal affects only the browser scene; it never deletes a Mac file. Files retain their original coordinates and are not aligned. Unrelated structures can overlap; hide the ones you are not inspecting. Scene state is not persisted across a page refresh.

## Coloring and close-up inspection

The Files panel offers Vivid, Pastel, and Colorblind-friendly chain palettes. Colors are assigned to protein chains, independently of water/ligand chain records. Complexes with more than eight protein chains use distinct generated colors within the chosen palette family; colorblind distinguishability of arbitrarily large palettes is not guaranteed.

Protein uses colored cartoons. DNA/RNA and ligands use element-colored ball-and-stick representations with contrasting carbon colors, glycans use carbohydrate symbols, ions use spheres, and water starts hidden. The panel explains this visual key.

For side-chain inspection:

1. Tap a residue, then **Nearby atoms · 5 Å** to show whole residues around it as sticks and zoom in.
2. Or choose **Files → Representation → Cartoon + sticks / All atoms**.
3. Choose **Tap selects → Atom**, close the panel, tap a visible atom, then **Focus**. Atom mode requires atom geometry; a ribbon alone does not identify an atom.
4. Pinch to inspect more closely. **Reset view** fits the scene again; **Clear selection** clears marks and hides the temporary nearby-atoms view.

Nearby atoms is a geometric proximity view, not a hydrogen-bond or interaction classifier. Switching to atom picking preserves an existing nearby-atoms view. The first coordinate model is loaded; biological assemblies and trajectories are not expanded.

## Test

```sh
npm test
npm run typecheck
npm run lint
```

## E2E

```sh
npx playwright install chromium webkit
npm run test:e2e
```

Browser tests use real molecular rendering and canvas taps. RCSB regression tests use a downloaded 4HHB fixture for determinism. The live RCSB browser path was also checked separately. Library E2E tests temporarily write uniquely named files in the default shared folder; run E2E without a custom PROTEIN_LIBRARY setting.

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

See [architecture](docs/architecture.md) and [iPad checklist](docs/ipad-testing.md). `src/viewer/` contains the Mol* boundary, and selections exposed to React use semantic identifiers plus a scene ID and optional atom name. `server/library.ts` is the isolated Mac filesystem adapter.

The browser app builds to static `dist/`. It can be deployed to a static host for device file loading and RCSB access. The Mac-library feature requires the Mac-hosted Vite development or preview server; uploading `dist/` alone cannot expose the Mac folder. PWA/offline installation, cloud storage, analysis, and annotations remain deferred.

## Example provenance

Bundled crambin: https://files.rcsb.org/download/1CRN.cif. Multichain/ligand regression fixture: https://files.rcsb.org/download/4HHB.cif. Official RCSB download documentation: https://www.rcsb.org/docs/programmatic-access/file-download-services.
