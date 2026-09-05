# Actual iPad release gate

Status: **User reported the v1.0.0 workflow working on physical iPad (2026-09-05).** Individual gesture results were not itemized. The 1.1 features below still need an actual-device pass. Desktop WebKit automation is useful compatibility coverage, but cannot verify iPad Safari, Apple GPU behavior, Files integration, or gesture comfort. Do not claim V0 acceptance until the actual-device checks pass.

Record device/model, iPadOS version, browser, date, and commit with each test pass.

## M0–M5

- [ ] App opens correctly
- [ ] Example structure loads
- [ ] Local Files picker works
- [ ] PDB loads
- [ ] mmCIF and .mmcif load
- [ ] One-finger rotation feels correct
- [ ] Pinch zoom feels correct
- [ ] Two-finger pan feels correct
- [ ] Tap selection works
- [ ] Selection does not accidentally rotate excessively
- [ ] Selected residue stays highlighted after moving the finger away
- [ ] A second tap replaces the selected residue
- [ ] Selection sheet is readable
- [ ] Buttons are comfortable to tap (44 CSS px minimum)
- [ ] Landscape layout works
- [ ] Portrait is usable
- [ ] Split-screen and Stage Manager resize correctly
- [ ] Malformed file shows an error and another file can be opened
- [ ] Replacing the structure clears old selection

## Later V0 milestones

- [ ] Multi-residue selection and selection actions work
- [ ] Representation switching works
- [ ] Add to Home Screen works
- [ ] Installed PWA opens standalone
- [ ] App shell and bundled example work offline

## 1.1 Mac-library and complex inspection

- [ ] Open a generated Mac file from Open → Mac library
- [ ] Refresh finds new outputs and nested folders
- [ ] Regenerate an open filename on Mac; Reload updates it without adding another entry
- [ ] Fetch 4HHB from RCSB using the iPad internet connection
- [ ] All four protein chains have distinct colors in each preset
- [ ] Heme ligands, ions, and water visibility are distinguishable
- [ ] Show/hide structures, chains, and species groups
- [ ] Nearby atoms · 5 Å makes side-chain inspection comfortable
- [ ] Atom picking and Focus work on visible sticks/spheres
- [ ] Scene panel, Open dialog, and selection actions remain usable in portrait/split view

## Version 1.2 physical iPad checks

The following are covered by automated Chromium/WebKit tests with real molecular rendering and touch input; repeat them on the physical iPad (the earlier physical-device success applies to v1.0.0).

- Open each scenario example and inspect its chains and non-protein species.
- Load the ubiquitin comparison pair, preview the 76 Cα-pair fit, apply it, inspect the overlay, and undo.
- Enter a reference-only region, then both regions. Check the pair table before applying.
- Enable additive residue picking, close Align, tap several residues, reopen and capture Reference. Repeat for Mobile; confirm the Reference capture persists.
- Duplicate a file when comparing two chains from that same source.
- Export with transparency enabled. On the Mac, open the PNG from scene-exports or the Export panel, and inspect its accompanying JSON report.
- Repeat portrait, landscape, Split View, and several align/undo cycles; confirm page refresh intentionally clears the browser scene while saved exports remain.

## Version 1.3 physical iPad checks

- Hold the overlap-preview button, then release. Repeat a short tap, dragging away, and switching apps during the hold. Original pose/opacity/camera must return; preview must not add undo entries.
- Choose Coordinates only for two generated backbones with unrelated sequences, then compare a truncated or internally deleted counterpart. Inspect coverage and pairs.
- Quick align with two files, verify chosen chains, then Undo. With one or three files it must be disabled.
- Use small two-finger pinches at whole-structure and atom-level zoom. Check controllability and motion settling on the physical iPad; desktop/WebKit automation cannot validate the feel of a physical touch screen.
- Purge all structures, verify the empty scene, then reopen a file. Check that source files and existing Mac exports remain available.

## Version 1.4 physical iPad checks

- Switch 中文 / EN while structures and alignment results are open; confirm the scene remains loaded and the setting persists after refresh.
- Check portrait/Split View labels, translated dialogs, and the on-screen keyboard for region/PDB inputs.
- Try Files → Auto view · Beta on monomers and complexes; compare readability and use Undo view.
- Uncheck water, ligand, or another chain, then choose Nearby atoms. Confirm the hidden components stay absent. Repeat after enabling a component.
