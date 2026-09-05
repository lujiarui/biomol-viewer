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

The 5 Å neighborhood still includes whole residues around the current selection, within that selection's structure file. Before rendering, it is intersected with the atom set from **checked components of that visible file**. Water, ligands, nucleic acids, or protein chains that are unchecked are excluded even if they lie within 5 Å. Checked non-protein components remain eligible.

Changing visibility for the selected file clears its selection and hides the existing neighborhood. Select a residue and request Nearby atoms again to rebuild against the new choices. The command never turns on a hidden chain or water component.

Validation includes a real hemoglobin neighborhood with nearby waters, translation and accessibility checks, projection scoring, persisted language preferences, and browser verification of automatic camera motion/undo without structure-coordinate changes. Physical iPad review is still needed for layout and viewing preference.
