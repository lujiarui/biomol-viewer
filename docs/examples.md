# Bundled examples

All examples are bundled as mmCIF files under public/examples, so choosing one does not contact RCSB. They use deposited coordinates from the first model, not automatically generated biological assemblies.

| Scenario | Example | What to inspect |
|---|---|---|
| Protein monomer | [1UBQ — ubiquitin](https://www.rcsb.org/structure/1UBQ) | Compact fold; residue selection |
| Protein–ligand | [1STP — streptavidin/biotin](https://www.rcsb.org/structure/1STP) | Biotin pocket; deposited single-chain view rather than the complete biological tetramer |
| Protein homomer | [1TIM — triosephosphate isomerase](https://www.rcsb.org/structure/1TIM) | Two enzyme subunits and their interface |
| Protein heteromer | [4HHB — deoxyhemoglobin](https://www.rcsb.org/structure/4HHB) | Alpha/beta chains and heme groups |
| Protein–RNA | [1URN — U1A mutant/RNA complex](https://www.rcsb.org/structure/1URN) | RNA hairpin recognition |
| Protein–DNA | [1TUP — p53/DNA](https://www.rcsb.org/structure/1TUP) | DNA binding by the p53 core domain |
| Alignment partner | [1UBI — synthetic ubiquitin](https://www.rcsb.org/structure/1UBI) | Compare with 1UBQ, chain A to chain A |

**Load ubiquitin comparison pair** loads 1UBQ and 1UBI and opens the alignment panel. These entries already have similar coordinate frames; fitting reveals relatively small structural differences rather than a dramatic relocation. The older crambin Try Example shortcut remains available.

Downloaded from the official https://files.rcsb.org/download/ID.cif service on 2026-09-05. Automated tests check the actual polymer content of the homomer, heteromer, RNA, and DNA examples and render every gallery entry in Chromium and WebKit.
