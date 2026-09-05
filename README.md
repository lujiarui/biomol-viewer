# Protein 1.4

An iPad-first molecular viewer hosted on your Mac. The iPad renders independently; this is not screen mirroring.

```sh
cd protein-ipad
npm install
npm run dev
```

Open the printed Network URL in iPad Safari on the same Wi-Fi. Save structures in `protein-ipad/shared-structures`, then choose **Open → Mac library** on iPad. Or choose your existing output directory:

```sh
PROTEIN_LIBRARY="/absolute/path/to/structures" npm run dev
```

See the [application README](protein-ipad/README.md) for usage, testing, and serving a production build. `v1.0.0` preserves the first version successfully tested on iPad; the current working version is 1.4.0.

Includes scenario examples, chain/region superposition with RMSD and undo, and transparent PNG exports saved on the Mac. See [alignment](protein-ipad/docs/alignment.md), [examples](protein-ipad/docs/examples.md), and [export](protein-ipad/docs/export.md).

Version 1.3 adds temporary translucent overlap previews, coordinate-only matching, automatic two-file chain matching, gentler pinch zoom, and scene purge.

Version 1.4 adds English/Simplified Chinese UI, optional automatic orientation with camera undo, and visibility-aware nearby atoms.
