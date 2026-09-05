import { StructureElement } from 'molstar/lib/mol-model/structure';
import type { Structure } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
export function visibleSubset(structure:Structure,parts:{visible:boolean;structure?:Structure}[]){
 let loci=StructureElement.Loci.none(structure);
 for(const part of parts)if(part.visible&&part.structure)loci=StructureElement.Loci.union(loci,StructureElement.Loci.remap(StructureElement.Loci.all(part.structure),structure));
 return StructureElement.Loci.toStructure(loci);
}
export function neighborhoodExpression(selection:StructureElement.Loci,visible:Structure){
 return MS.struct.modifier.intersectBy({0:MS.struct.modifier.includeSurroundings({0:StructureElement.Loci.toExpression(selection),radius:5,'as-whole-residues':true}),by:StructureElement.Loci.toExpression(StructureElement.Loci.all(visible))});
}
