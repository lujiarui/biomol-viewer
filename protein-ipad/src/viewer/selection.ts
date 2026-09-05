import { Bond, StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import type { Loci } from 'molstar/lib/mol-model/loci';
import type { ResidueRef } from './types';

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
