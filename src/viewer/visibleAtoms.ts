import { StructureElement, Unit } from 'molstar/lib/mol-model/structure';
import type { Structure } from 'molstar/lib/mol-model/structure';
import { OrderedSet, SortedArray } from 'molstar/lib/mol-data/int';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
export function visibleSubset(structure:Structure,parts:{visible:boolean;structure?:Structure}[]){
 let loci=StructureElement.Loci.none(structure);
 for(const part of parts)if(part.visible&&part.structure)loci=StructureElement.Loci.union(loci,StructureElement.Loci.remap(StructureElement.Loci.all(part.structure),structure));
 return StructureElement.Loci.toStructure(loci);
}
/** World-coordinate search: file-local chain/residue IDs never establish proximity across files. */
export function neighborhoodSearch(selection:StructureElement.Loci,radius=5){
 const grid=new Map<string,Vec3[]>(),cell=(p:Vec3)=>p.map(value=>Math.floor(value/radius));
 for(const {unit,indices} of selection.elements)for(let i=0;i<OrderedSet.size(indices);i++){
  const p=unit.conformation.position(unit.elements[OrderedSet.getAt(indices,i)],Vec3());if(!p.every(Number.isFinite))continue;
  const key=cell(p).join(',');const bucket=grid.get(key)||[];bucket.push(p);grid.set(key,bucket);
 }
 const near=(p:Vec3)=>{const [x,y,z]=cell(p);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const point of grid.get(`${x+dx},${y+dy},${z+dz}`)||[])if(Vec3.squaredDistance(p,point)<=radius*radius)return true;return false;};
 return (visible:Structure,full:Structure=visible)=>{
  const elements:StructureElement.Loci['elements'][number][]=[];
  for(const unit of visible.units){if(!Unit.isAtomic(unit))continue;const residues=new Set<number>();
   for(let j=0;j<unit.elements.length;j++){const element=unit.elements[j];if(near(unit.conformation.position(element,Vec3())))residues.add(unit.residueIndex[element]);}
   const indices:number[]=[];for(let i=0;i<unit.elements.length;i++)if(residues.has(unit.residueIndex[unit.elements[i]]))indices.push(i);
   if(indices.length)elements.push({unit,indices:OrderedSet.ofSortedArray(SortedArray.ofSortedArray(indices))});
  }
  return StructureElement.Loci.remap(StructureElement.Loci(visible,elements),full);
 };
}
