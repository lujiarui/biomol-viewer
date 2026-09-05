# Superposition and RMSD

## iPad workflow

1. Open two structures, or use **Open → Load ubiquitin comparison pair**.
2. Tap **Align**. The first structure/chain defaults to Reference; the second defaults to Mobile.
3. Choose polymer chains from the two slots. Leave Region blank for chain-to-chain fitting.
4. Tap **Preview fit** for numbers, or press and hold **Hold to preview overlap** for a temporary translucent overlay. Release restores the original pose, opacity, and camera without changing undo history. Review RMSD, the number of fitted anchors, identity, warnings, and the expandable residue-pair table.
5. Tap **Apply alignment**. The entire mobile structure moves rigidly, including its other chains and ligands. The reference stays fixed.
6. **Undo last alignment** restores the previous mobile transform. Up to 20 fits can be undone in this browser session.

Different structure instances begin at different positions in the chain palette so typical monomer overlays are distinguishable. Colors are display aids, not correspondence evidence. All numerical results are derived from explicit residue pairs.

To compare two chains from the same file, use **Files → Duplicate**, then choose one chain in each instance. Duplicate reads the original file coordinates. This avoids the invalid operation of moving a reference and a mobile chain together in the same rigid object. The original file on disk is never altered.

## Custom regions on either or both sides

There are two equivalent ways to define a region:

- Enter author residue ranges such as `10-25, 40, 42A` in either slot. A single number matches that exact insertion code (blank by default); an inclusive range includes insertion-coded residues within its numeric bounds. Blank means the full observed chain.
- Enable **Tap to add/remove residues**, choose **Pick residues on canvas**, and tap several residues. Reopen Align and press **Use current selection** in the desired slot. The panel preserves captured regions while it is closed. Capture the other slot independently. Files visibility controls can isolate one structure while selecting it.

A captured region must belong to one polymer chain. Selection cannot combine residues from different structures. Selecting in a new structure starts a new live selection; previously captured slot regions remain unchanged. **Whole chain** removes the region restriction from that slot. Captured regions are semantic residue IDs, not transient Mol* loci.

## Correspondence and fitting

Default correspondence is sequence-based (the following steps describe Sequence mode):

1. Extract the complete *observed* sequence of each chosen chain. The loaded first model is used; absent residues with no atom records are not reconstructed.
2. Align observed protein sequences using Mol*'s affine-gap sequence aligner with BLOSUM62 (gap open −11, extension −1). Nucleic acids use its default identity scoring with gap open −5 and extension −1. Identical observed sequences are paired directly.
3. Restrict the resulting chain correspondences to the reference region, mobile region, or both. Discontinuous selections are **not concatenated and re-aligned**, which would change their original correspondence.
4. Fit one Cα atom per paired protein residue, or one C4′ atom per paired nucleic-acid residue (C4* is accepted for legacy atom naming). For alternate conformers use the highest-occupancy anchor, breaking ties deterministically by alternate-location ID. MSE is mapped to methionine; unrecognized residue codes and missing anchors are excluded.
5. Compute an unweighted least-squares proper rigid-body transform with Mol* MinimizeRmsd. There is no scaling, reflection, or outlier rejection in Sequence mode. Mismatched but aligned residues contribute to the fit.
6. Recompute post-fit distances explicitly for the pair table and RMSD: square root of the mean squared Euclidean distance, in ångströms. Before-fit RMSD uses those exact same pairs. Identity is calculated over the fitted pairs.

**Pair regions by sequence order** is an explicit alternative for manually defined counterparts. It requires equal residue counts before missing-anchor filtering and pairs residues in chain sequence order, never tap order. This is an assumption chosen by the user, not inferred homology. Inspect the pair table before applying it.

## Safeguards and limits

At least three corresponding, finite, non-collinear anchors are required on both sides. Protein and nucleic-acid anchors cannot be mixed. Low identity and low coverage are flagged. Missing anchors are reported; unknown residues are excluded. A low RMSD alone does not establish biological similarity or validate correspondence.

Sequence alignment is limited to two million sequence-length products to bound memory and latency on iPad; identical sequences use a linear fast path. For larger nonidentical chains, use deliberately equal-sized regions with ordered pairing. Custom regions normally still use full-chain sequence mapping, so merely typing a smaller range does not bypass that bound.

The mobile transform is composed with its existing scene transform. A repeated fit uses current world coordinates; it does not accidentally overwrite a prior fit with a relative matrix. Reloading a Mac file restores original coordinates. Removing/reloading structures invalidates relevant undo entries and the latest alignment export record. Regions referring to removed scene instances need to be captured again.

## Validation

Numerical tests recover known rotations/translations, reject reflections as exact fits, retain outliers, handle insertion gaps/missing anchors, validate one-sided and two-sided/discontinuous regions, and reject degenerate coordinates. A real 1UBQ/1UBI comparison uses 76 Cα pairs. Browser tests additionally rotate and translate a real input file, apply the fit, recompute RMSD on the transformed scene, and undo it. This tests the rendering-state transformation boundary independently of the numerical solver.

Sources: [Mol* superposition documentation](https://molstar.org/docs/plugin/superposition/), installed Mol* 5.11.0 sequence alignment, MinimizeRmsd, and TransformStructureConformation implementations. Sequence mode is sequence-guided; the separate coordinate mode below uses a bounded geometric search. Neither mode is a general fold-recognition system.

## Coordinate-only matching (1.3)

Choose **Correspondence → Coordinates only** when residue identities are randomized or otherwise uninformative. This mode uses only Cα/C4′ coordinates and their order along each selected chain/region; unknown residue identities are allowed. Finite backbone anchors are required. Unlike sequence mode, independently selected regions are the inputs to the geometric search. Unequal lengths and internal gaps are supported.

The implementation is a bounded heuristic, not TM-align or a claim of globally optimal structural correspondence:

1. Seed fits from beginning/end index pairing, sampled contiguous fragments, and fragments with similar internal distance patterns.
2. For each seed, transform the mobile coordinates and use local dynamic programming to choose an order-preserving correspondence. Pair contribution is `2 / (1 + distance² / 9) − 0.5`; skipping a residue costs 0.25. Local alignment allows unmatched ends and internal gaps.
3. Refit those pairs with the same proper rigid least-squares solver, then repeat up to five fits per seed. No residue identity enters the search.
4. Retain the candidate maximizing `sum(1 / (1 + distance² / 9)) / sqrt(referenceAnchorCount * mobileAnchorCount)`. This custom geometry score favors coverage as well as closeness; it is **not a TM-score**. The fixed distance scale is 3 Å.
5. Report RMSD over the final fitted pairs, both region coverage percentages, the geometry score, and the complete pair table. RMSD alone must not be used to rank different-sized correspondences. Skipped residues do not contribute to reported RMSD; this differs from Sequence mode's fixed correspondence.

The search is limited to 500,000 anchor-length products per pair. For larger inputs select smaller regions. It preserves chain direction and does not handle arbitrary residue permutations, circular permutations, flexible/domain-wise fits, or globally optimal complex matching. Repeated helices and similar small fragments can be ambiguous. Unknown codes are retained in coordinate mode but remain excluded from sequence/order modes.

## Quick mode

**Align → Quick align two files** is enabled only with exactly two scene entries. It holds the first file fixed, tests compatible protein–protein or nucleic–nucleic chain pairs with coordinate matching, selects the highest custom geometry score, and immediately applies the fit to the entire second file. No chain or region selection is required. The chosen chains, number of candidate pairs, RMSD, coverage, and pair table are shown. **Undo last alignment** restores the second file.

Quick mode considers all compatible chain pairs (at least three residues each), up to 32 pairs and the per-pair coordinate size limit. Exceeding those bounds requests manual chain/region selection instead of silently skipping candidate chains. Degenerate chains are excluded. Near-tied scores produce an ambiguity warning; exact ties retain the first pair. This chooses a single anchor chain pair, not a whole-complex multichain assignment.

## Temporary preview

The hold button works with touch, mouse, or holding Space/Enter while focused. The reference and mobile representations use 45% of their normal opacity. The mobile matrix is changed only temporarily; release, pointer cancellation, loss of pointer capture, focus loss, or switching away restores state. Other scene actions are disabled while holding. The preview focuses the reference structure and restores the previous camera on release. Apply remains a separate persistent action. Source files and saved exports are unaffected.
