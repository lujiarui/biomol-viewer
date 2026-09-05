# Scene image export to the Mac

Choose **Export → Save PNG to Mac** on iPad. The default is a transparent background. Export uses Mol*'s image renderer at the viewport image resolution and includes molecular geometry, not the toolbar or other React panels. Turn transparency off to retain the viewer background.

Each save creates two new files:

- `scene-<timestamp>-<uuid>.png`: rendered image with an alpha channel.
- Matching `.json`: scene metadata, file names, visibility flags, world transforms, camera, transparency, and the latest applied alignment request, paired residues, distances, and RMSD.

The default directory is `scene-exports/`. Use `BIOMOL_EXPORTS="/absolute/path/to/exports" npm run dev` (or npm start) to choose another directory. This is separate from the read-only Mac structure library. Restart the server after changing the environment variable.

The Mac can read the files directly in Finder. Alternatively, open the app on the Mac and choose **Export** to view the shared saved-image list; no structure needs to be loaded in that browser. PNG and JSON links can be opened/downloaded. The list shows the 100 most recent generated PNG filenames. Files remain on disk after page refresh or server restart; normal filesystem tools manage them.

The JSON is a provenance record, **not a reloadable 3D scene package**: source coordinates are not embedded, and no session importer is provided. Source filenames alone are not a guarantee that a subsequently modified disk file is the same input. Keep the original input files with an exported result when reproducibility matters.

The standalone Node server, development server, and production preview server support export. A plain static host cannot save files on the Mac. No cloud storage is involved.

Writes require a same-origin JSON request with the app's explicit export header. The server generates unique filenames and accepts only PNG-signature image payloads with bounded dimensions (up to 8192 per side), image size (20 MiB), and metadata (2 MiB). Arbitrary paths, overwriting existing exports, cross-origin writes, and non-image uploads are not supported. The shared server remains intended for a trusted local network; anyone able to reach it can read shared exports.

Tests verify actual alpha-zero background pixels, nonempty molecular pixels, byte-for-byte persistence on the Mac, visibility in another browser session, and rejection of malformed/cross-origin writes and traversal paths.
