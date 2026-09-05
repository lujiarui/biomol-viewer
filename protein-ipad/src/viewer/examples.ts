export const examples = [
  { id: '1UBQ', title: 'Ubiquitin', scenario: 'Protein monomer', note: 'A compact 76-residue protein. Start here for folding and selection.' },
  { id: '1STP', title: 'Streptavidin + biotin', scenario: 'Protein–ligand', note: 'Inspect biotin in its binding pocket. Deposited chain view, not the full tetramer.' },
  { id: '1TIM', title: 'Triosephosphate isomerase', scenario: 'Protein homodimer', note: 'Two matching enzyme subunits and their interface.' },
  { id: '4HHB', title: 'Deoxyhemoglobin', scenario: 'Protein heteromer', note: 'Alpha and beta chains, with heme groups.' },
  { id: '1URN', title: 'U1A + RNA hairpin', scenario: 'Protein–RNA', note: 'RNA recognition by a U1A mutant RNA-binding domain.' },
  { id: '1TUP', title: 'p53 + DNA', scenario: 'Protein–DNA', note: 'A classic DNA-binding domain complex.' },
  { id: '1UBI', title: 'Synthetic ubiquitin', scenario: 'Superposition partner', note: 'Load alongside 1UBQ and align chain A to chain A.' },
] as const;
export function examplePath(id: string) {
  if (!examples.some(e => e.id === id)) throw new Error('Unknown bundled example.');
  return `${import.meta.env.BASE_URL}examples/${id}.cif`;
}
