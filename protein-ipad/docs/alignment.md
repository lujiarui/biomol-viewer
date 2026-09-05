# Superposition and RMSD

## iPad workflow

1. Open two structures, or use **Open → Load ubiquitin comparison pair**.
2. Tap **Align**. The first structure/chain defaults to Reference; the second defaults to Mobile.
3. Choose polymer chains from the two slots. Leave Region blank for chain-to-chain fitting.
4. Tap **Preview fit**. Review RMSD, the number of fitted anchors, identity, warnings, and the expandable residue-pair table.
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

Default correspondence is sequence-based:

1. Extract the complete *observed* sequence of each chosen chain. The loaded first model is used; absent residues with no atom records are not reconstructed.
2. Align observed protein sequences using Mol*'s affine-gap sequence aligner with BLOSUM62 (gap open −11, extension −1). Nucleic acids use its default identity scoring with gap open −5 and extension −1. Identical observed sequences are paired directly.
3. Restrict the resulting chain correspondences to the reference region, mobile region, or both. Discontinuous selections are **not concatenated and re-aligned**, which would change their original correspondence.
4. Fit one Cα atom per paired protein residue, or one C4′ atom per paired nucleic-acid residue (C4* is accepted for legacy atom naming). For alternate conformers use the highest-occupancy anchor, breaking ties deterministically by alternate-location ID. MSE is mapped to methionine; unrecognized residue codes and missing anchors are excluded.
5. Compute an unweighted least-squares proper rigid-body transform with Mol* MinimizeRmsd. There is no scaling, reflection, outlier rejection, or automatic structural/TM alignment. Mismatched but aligned residues contribute to the fit.
6. Recompute post-fit distances explicitly for the pair table and RMSD: square root of the mean squared Euclidean distance, in ångströms. Before-fit RMSD uses those exact same pairs. Identity is calculated over the fitted pairs.

**Pair regions by sequence order** is an explicit alternative for manually defined counterparts. It requires equal residue counts before missing-anchor filtering and pairs residues in chain sequence order, never tap order. This is an assumption chosen by the user, not inferred homology. Inspect the pair table before applying it.

## Safeguards and limits

At least three corresponding, finite, non-collinear anchors are required on both sides. Protein and nucleic-acid anchors cannot be mixed. Low identity and low coverage are flagged. Missing anchors are reported; unknown residues are excluded. A low RMSD alone does not establish biological similarity or validate correspondence.

Sequence alignment is limited to two million sequence-length products to bound memory and latency on iPad; identical sequences use a linear fast path. For larger nonidentical chains, use deliberately equal-sized regions with ordered pairing. Custom regions normally still use full-chain sequence mapping, so merely typing a smaller range does not bypass that bound.

The mobile transform is composed with its existing scene transform. A repeated fit uses current world coordinates; it does not accidentally overwrite a prior fit with a relative matrix. Reloading a Mac file restores original coordinates. Removing/reloading structures invalidates relevant undo entries and the latest alignment export record. Regions referring to removed scene instances need to be captured again.

## Validation

Numerical tests recover known rotations/translations, reject reflections as exact fits, retain outliers, handle insertion gaps/missing anchors, validate one-sided and two-sided/discontinuous regions, and reject degenerate coordinates. A real 1UBQ/1UBI comparison uses 76 Cα pairs. Browser tests additionally rotate and translate a real input file, apply the fit, recompute RMSD on the transformed scene, and undo it. This tests the rendering-state transformation boundary independently of the numerical solver.

Sources: [Mol* superposition documentation](https://molstar.org/docs/plugin/superposition/), installed Mol* 5.11.0 sequence alignment, MinimizeRmsd, and TransformStructureConformation implementations. This feature is a sequence-guided superposition tool, not a general fold-recognition system.
