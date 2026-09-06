# Coloring, annotations, sequence linkage, and measurements

Open **Analyze** after loading a structure. This workspace uses the same residue identities and transformed coordinates as the 3D scene, alignment tools, and exported JSON metadata.

## Property coloring

The built-in mappings are chain, element, amino-acid type, secondary structure, hydrophobicity, residue charge, and confidence/pLDDT. Mol* supplies the scientific color themes. Hydrophobicity uses its Wimley–White scales; secondary structure uses deposited assignments when present and Mol*'s computed secondary-structure provider otherwise. Confidence uses ModelArchive pLDDT data when present and the model's confidence-like B-factor field for predicted models.

Custom scalar input accepts either residue or atom values:

```text
# chain,residue,value
A,42,0.35
# chain,residue,atom,value
A,43,CA,0.91
```

Values are normalized over the supplied range and colored blue–cream–red. Missing values are gray. Author chain and residue numbering are used in the input. The mapping changes display only; coordinates and source files are unchanged.

## Residue annotations

Enable multi-residue picking, select residues on the canvas or linked sequence, choose a category, and press **Annotate selection**. Potential pocket, epitope, paratope, active-site, and custom are semantic labels; the app does not claim that a manual label is experimentally validated.

**Suggest ligand contacts** creates a reviewable potential-pocket annotation from visible protein residues with any atom within 4 Å of a visible ligand. This is a contact-shell convenience, not cavity detection or druggability scoring. Fpocket instead detects and clusters Voronoi alpha spheres and scores geometric and physicochemical pocket descriptors: https://pmc.ncbi.nlm.nih.gov/articles/PMC2700099/.

Epitope and paratope definitions vary by dataset and method. IEDB represents discontinuous epitopes as explicit residue sets and requires experimental immune-recognition evidence for curated epitopes: https://tools.iedb.org/conservancy/help/ and https://discuss.iedb.org/t/epitopes/160. SAbDab identifies antibody–antigen candidates using CDR proximity and retains standardized CDR definitions: https://academic.oup.com/nar/article/42/D1/D1140/1044118. Biomol therefore keeps these categories manual and provenance-neutral instead of inferring them from distance alone.

Annotations add a colored 3D ball-and-stick overlay, appear on the sequence track, and are recorded as residue lists in export JSON. Removing an annotation removes only that overlay and metadata.

## Sequence ↔ structure

Choose a file and polymer chain. Every observed residue shows its one-letter code and author residue number. A lower glyph marks helix, sheet, or coil; the button fill shows confidence when available; a colored top edge marks an annotation. Tap a residue to select and highlight it in 3D. Shift-tap or enable multi-residue picking to build a region.

The sequence panel shows observed coordinate-bearing residues rather than filling unresolved sequence gaps. This keeps selection, annotation, and measurement identities exact.

## Measurements

Distance, angle, dihedral, radius, and selection RMSD use protein Cα or nucleic-acid C4′ anchors in selection order. Distance uses two residues, angle three, dihedral four, and radius two or more. RMSD splits an even selection into two ordered halves, performs a rigid least-squares fit, and reports the post-fit RMSD; at least three pairs are required.

Interface area selects two polymer chains in one structure and estimates buried solvent-accessible surface area:

```text
interface area = (SASA chain A + SASA chain B − SASA complex) / 2
```

The browser calculation uses a 1.4 Å probe, van der Waals radii, 64-point sphere sampling, and no hydrogens. PDBePISA uses the same buried-area relationship but a more precise finite-element accessible-surface calculation: https://www.ebi.ac.uk/pdbe/prot_int/pi_tips.html. Biomol labels its result approximate and limits the calculation to 12,000 non-hydrogen atoms for iPad responsiveness.
