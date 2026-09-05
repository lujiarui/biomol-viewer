# Actual iPad release gate

Status: **not yet tested on physical iPad**. Desktop WebKit automation is useful compatibility coverage, but cannot verify iPad Safari, Apple GPU behavior, Files integration, or gesture comfort. Do not claim V0 acceptance until the actual-device checks pass.

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
