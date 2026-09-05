# Language and view controls (1.4)

## English / 简体中文

Use **中文 / EN** in the top toolbar to switch immediately. The browser remembers this choice in local storage. Without a saved choice, a Chinese browser language selects Simplified Chinese; other browser languages select English. If storage is unavailable, switching still works for the current session.

Labels, dialogs, example descriptions, application errors, alignment warnings, and accessibility labels are translated. Structure filenames, PDB IDs, residue/atom identifiers, numeric results, and exported machine-readable metadata retain their original values. Language changes do not reload the molecular scene. The document language is updated for assistive technology.

## Auto view · Beta

Choose **Files → Auto view · Beta** (中文：**文件 → 自动视角 · 测试版**). The app rotates the camera and fits checked, visible components. **Undo view** restores the camera from immediately before the most recent automatic view. Coordinates and structural alignment transforms remain unchanged.

This is an optional heuristic for a readable projection, not a guarantee of the scientifically most informative viewpoint. It uniformly samples up to about 4,000 finite atom coordinates from checked components, then uses at most 400 samples to score projected near-overlap. It compares the current direction with 40 approximately distributed viewing directions and four roll angles per direction. Lower weighted counts of close projected pairs are preferred. The current view remains a candidate, so the sampled score cannot worsen.

The score uses an orthographic approximation and a fixed screen-space proximity threshold, not atomic radii or a full occlusion calculation. Atoms belonging to checked components are considered even when their representation is cartoon. Dense or symmetric complexes can have several equally good views. A single rigid camera cannot separate genuinely overlapping aligned structures.

Zoom conservatively fits the full bounding box of all visible component atoms, including coordinates omitted from the scoring sample. The search is deterministic and bounded for iPad use. Selecting all files/components as hidden produces an explanatory error rather than moving the camera to unrelated geometry. Purge clears the automatic-view undo snapshot.

## Nearby atoms respects Files visibility

The 5 Å neighborhood includes whole residues from **all opened, visible files and checked components** near the current selection. Distances use transformed world coordinates, so aligned files contribute side chains to the same neighborhood. Unchecked chains, waters, ligands, and other components remain excluded. Carbon colors distinguish files; the selection panel reports the atom and contributing-file counts.

Changing any visibility setting hides the existing neighborhood. Request Nearby atoms again to rebuild against the new choices; if the selected file changed, select a residue again first. The command never turns on hidden components.

Validation includes a real hemoglobin neighborhood with nearby waters, translation and accessibility checks, projection scoring, persisted language preferences, and browser verification of automatic camera motion/undo without structure-coordinate changes. Physical iPad review is still needed for layout and viewing preference.
