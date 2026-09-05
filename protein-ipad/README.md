# Protein

A minimal, iPad-first protein structure viewer built with React, TypeScript, Vite, and Mol*. This first implementation covers M0–M5: a custom full-screen canvas, bundled example, local PDB/mmCIF loading, touch-friendly layout, and single-residue selection. Later V0 milestones (multi-selection, selection actions, representation switcher, PWA) are intentionally deferred.

## Requirements

Node.js >=22 and npm. A browser with WebGL (iPad Safari, desktop Safari or Chrome).

## Install

```sh
npm install
```

## Develop

```sh
npm run dev
```

Open the printed local URL. For iPad testing, use the printed network URL from an iPad on the same network. Local structure files are parsed in the browser and never uploaded. The bundled example is crambin, PDB entry 1CRN, downloaded from https://files.rcsb.org/download/1CRN.cif. No runtime RCSB access is needed.

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

## Build

```sh
npm run build
```

## Preview

```sh
npm run preview
```

## Integration boundary

`src/viewer/ViewerController.ts` owns the Mol* PluginContext, molecular state, camera, selection subscriptions, and disposal. React uses the application-facing `ProteinViewer` interface. There are no standard Mol* React panels or stylesheet imports. Mol* retains its native camera gestures.

Selections exposed to React contain semantic residue identifiers only, never Mol* loci. See [architecture](docs/architecture.md) and the [iPad release checklist](docs/ipad-testing.md).

## Static deployment

Run the build and publish `dist/` on any static host. For Vercel or Cloudflare Pages use `protein-ipad` as the project root, `npm run build` as the build command, and `dist` as the output directory. No backend or environment secrets are required. For a subpath host, set Vite's `base` accordingly before building. PWA installation/offline caching will be added at M12; this milestone is a browser app.
