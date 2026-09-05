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
