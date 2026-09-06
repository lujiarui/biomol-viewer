# Sharing, video, and image export

Open **Export** on iPad for four workflows. All saved files remain visible from the same panel on the Mac.

## Restorable session URL

**Create session link** sends a snapshot to the Mac and returns a short `?session=<uuid>` URL using a local-network address. Opening it from another device on the same Wi-Fi loads the original PDB/mmCIF text, representation and color settings, visibility, rigid transforms, annotations, chain labels, and camera. The link is a saved snapshot rather than live collaborative editing; later changes require a new link.

Snapshots are stored in `shared-sessions/`, or `BIOMOL_SESSIONS`, and contain source coordinates. IDs are random but there is no account or authentication layer, so share links only on the trusted local network for which the server is intended.

## Video

**360° scene overview** rotates the current camera through exactly one loop around X, Y, or Z over the selected duration. **Structure flipbook** keeps the camera fixed and cycles through all loaded structure instances twice, which is suitable for aligned predictions or trajectory-like candidates. Both modes restore the original camera and visibility afterward.

The app captures the Mol* WebGL canvas with `canvas.captureStream()` and records with `MediaRecorder`. It feature-detects MP4/H.264 first and WebM codecs second, because Safari and Chromium expose different encoders. The encoded file is written to `scene-exports/`. Browser support follows the MediaStream Recording API: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API and https://webkit.org/blog/11353/mediarecorder-api/.

## Candidate gallery

Gallery tiles all use the current camera. Choose an optional fixed structure and, optionally, one of its chain/components. Then check up to 12 moving candidate structures and choose one to four columns. Each tile renders the fixed component plus one candidate; choosing no fixed structure renders candidates alone. The result is one labeled PNG plus a JSON manifest recording camera, options, and scene state.

Use aligned structures and set the desired receptor view before exporting. The gallery intentionally does not refit individual candidates, because per-tile fitting would remove the controlled camera variable.

## Scene PNG

**Save PNG to Mac** uses Mol*'s image renderer at viewport resolution. Transparent background is enabled by default. Every save creates `scene-<timestamp>-<uuid>.png` and a matching `.json` provenance report with camera, visibility, transforms, style, annotations, and the latest alignment. This JSON report is separate from the restorable session format and does not embed source coordinates.

Set the output directory with:

```sh
BIOMOL_EXPORTS="/absolute/path/to/exports" npm start
```

The standalone server, Vite development server, and preview server support these APIs. A static host cannot save sessions or files on the Mac. Writes require same-origin requests and explicit Biomol headers. Payload size, filename, image signatures, dimensions, and paths are validated; clients cannot choose filesystem paths or overwrite existing output.
