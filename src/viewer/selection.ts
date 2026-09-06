import { Bond, StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import type { Loci } from 'molstar/lib/mol-model/loci';
import type { ResidueRef } from './types';

const residueIdentity = (residue: ResidueRef) => `${residue.modelId ?? ''}:${residue.chainId}:${residue.residueNumber}:${residue.insertionCode ?? ''}`;

/** Return the inclusive sequence-order span between two picked residues. */
export function residueRange<T extends ResidueRef>(sequence: T[], first: ResidueRef, last: ResidueRef): T[] {
  if (first.chainId !== last.chainId || first.modelId !== last.modelId) return [];
  const a = sequence.findIndex(residue => residueIdentity(residue) === residueIdentity(first));
  const b = sequence.findIndex(residue => residueIdentity(residue) === residueIdentity(last));
  if (a < 0 || b < 0) return [];
  return sequence.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** Reduce a pick to one whole atomic residue, including bond picks. */
export function residueFromLoci(picked: Loci) {
  const loci = Bond.isLoci(picked) ? Bond.toFirstStructureElementLoci(picked) : picked;
  if (!StructureElement.Loci.is(loci)) return;
  const element = loci.elements.find(e => Unit.isAtomic(e.unit) && OrderedSet.size(e.indices) > 0);
  if (!element) return;
  const single = StructureElement.Loci(loci.structure, [{ unit: element.unit, indices: OrderedSet.ofSingleton(OrderedSet.getAt(element.indices, 0)) }]);
  const location = StructureElement.Loci.getFirstLocation(single)!;
  const insertion = StructureProperties.residue.pdbx_PDB_ins_code(location);
  const labelNumber = StructureProperties.residue.label_seq_id(location);
  const authNumber = StructureProperties.residue.auth_seq_id(location);
  const residue: ResidueRef = {
    modelId: String(location.unit.model.modelNum),
    chainId: StructureProperties.chain.label_asym_id(location),
    authChainId: StructureProperties.chain.auth_asym_id(location),
    // Non-polymers can have no label_seq_id; retain their author numbering.
    residueNumber: labelNumber || authNumber,
    authResidueNumber: authNumber,
    ...(insertion && insertion !== '?' && insertion !== '.' ? { insertionCode: insertion } : {}),
    residueName: StructureProperties.residue.label_comp_id(location),
  };
  return { residue, loci: StructureElement.Loci.extendToWholeResidues(single) };
}
