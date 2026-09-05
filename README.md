# Protein 1.1

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

See the [application README](protein-ipad/README.md) for usage, testing, and serving a production build. `v1.0.0` preserves the first version successfully tested on iPad; the current working version is 1.1.0.
