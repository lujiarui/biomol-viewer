import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { MinimizeRmsd } from 'molstar/lib/mol-math/linear-algebra/3d/minimize-rmsd';
import { Model, Structure, StructureElement, StructureProperties as P, Unit } from 'molstar/lib/mol-model/structure';
import { SecondaryStructureType } from 'molstar/lib/mol-model/structure/model/types';
import { ModelSecondaryStructure } from 'molstar/lib/mol-model-formats/structure/property/secondary-structure';
import { SecondaryStructureProvider } from 'molstar/lib/mol-model-props/computed/secondary-structure';
import { QualityAssessmentProvider } from 'molstar/lib/extensions/model-archive/quality-assessment/prop';
import { MmcifFormat } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { extractAlignmentChains, residueKey } from './alignment';
import type { MeasurementResult, ResidueRef, SequenceResidue, StructureAnnotation } from './types';

const toVec = (point: [number, number, number]) => Vec3.create(...point);

export function measurePoints(kind: MeasurementResult['kind'], points: [number, number, number][]): MeasurementResult {
  const need = kind === 'distance' ? 2 : kind === 'angle' ? 3 : kind === 'dihedral' ? 4 : kind === 'rmsd' ? 6 : 2;
  if (points.length < need) throw new Error(`${kind === 'radius' ? 'Radius' : kind[0].toUpperCase() + kind.slice(1)} needs at least ${need} selected residues.`);
  let value: number, unit: MeasurementResult['unit'] = 'Å', detail = `${points.length} Cα/C4′ residue anchors`;
  if (kind === 'distance') value = Vec3.distance(toVec(points[0]), toVec(points[1]));
  else if (kind === 'angle') {
    const a=Vec3.sub(Vec3(),toVec(points[0]),toVec(points[1])), b=Vec3.sub(Vec3(),toVec(points[2]),toVec(points[1]));
    value = Math.acos(Math.max(-1,Math.min(1,Vec3.dot(a,b)/(Vec3.magnitude(a)*Vec3.magnitude(b))))) * 180 / Math.PI; unit='°';
  } else if (kind === 'dihedral') {
    const p=points.map(toVec), b0=Vec3.sub(Vec3(),p[0],p[1]), b1=Vec3.sub(Vec3(),p[2],p[1]), b2=Vec3.sub(Vec3(),p[3],p[2]);Vec3.normalize(b1,b1);
    const v=Vec3.sub(Vec3(),b0,Vec3.scale(Vec3(),b1,Vec3.dot(b0,b1))), w=Vec3.sub(Vec3(),b2,Vec3.scale(Vec3(),b1,Vec3.dot(b2,b1)));
    value=Math.atan2(Vec3.dot(Vec3.cross(Vec3(),b1,v),w),Vec3.dot(v,w))*180/Math.PI;unit='°';
  } else if (kind === 'radius') {
    const center=points.reduce((sum,p)=>Vec3.add(sum,sum,toVec(p)),Vec3());Vec3.scale(center,center,1/points.length);
    value=Math.max(...points.map(p=>Vec3.distance(center,toVec(p)))); detail=`Bounding radius of ${points.length} selected anchors`;
  } else if (kind === 'rmsd') {
    if (points.length % 2) throw new Error('RMSD needs an even number of residues; the first half is fitted to the second half.');
    const half=points.length/2;if(half<3)throw new Error('RMSD needs at least three residue pairs.');
    const positions=(set:[number,number,number][])=>({x:set.map(p=>p[0]),y:set.map(p=>p[1]),z:set.map(p=>p[2])});
    const a=points.slice(0,half),b=points.slice(half),fit=MinimizeRmsd.compute({a:positions(a),b:positions(b)});
    value=Math.sqrt(a.reduce((sum,p,i)=>sum+Vec3.squaredDistance(toVec(p),Vec3.transformMat4(Vec3(),toVec(b[i]),fit.bTransform)),0)/half);detail=`Rigid fit of ${half} ordered residue pairs`;
  } else throw new Error('Use the chain controls for interface area.');
  if(!Number.isFinite(value))throw new Error('The selected geometry cannot determine this measurement.');
  return {kind,value,unit,detail};
}

export function selectedAnchorPoints(structure: Structure, residues: ResidueRef[]) {
  const anchors=new Map(extractAlignmentChains(structure).flatMap(chain=>chain.anchors.filter(a=>a.position).map(a=>[residueKey(a.residue),a.position!] as const)));
  return residues.map(residue=>anchors.get(residueKey(residue))).filter((point):point is [number,number,number]=>!!point);
}

const radii:Record<string,number>={H:1.2,C:1.7,N:1.55,O:1.52,S:1.8,P:1.8,F:1.47,CL:1.75,BR:1.85,I:1.98};
interface Atom { id:number; p:Vec3; r:number; }
function chainAtoms(structure:Structure, chainId:string){const atoms:Atom[]=[];const l=StructureElement.Location.create(structure);for(const unit of structure.units){if(!Unit.isAtomic(unit))continue;l.unit=unit;for(let i=0;i<unit.elements.length;i++){l.element=unit.elements[i];if(P.chain.label_asym_id(l)!==chainId)continue;const symbol=String(P.atom.type_symbol(l)).toUpperCase();if(symbol==='H')continue;atoms.push({id:atoms.length,p:unit.conformation.position(l.element,Vec3()),r:radii[symbol]||1.7});}}return atoms;}
const sphere=Array.from({length:64},(_,i)=>{const y=1-(i/(63))*2,r=Math.sqrt(1-y*y),phi=i*Math.PI*(3-Math.sqrt(5));return Vec3.create(Math.cos(phi)*r,y,Math.sin(phi)*r);});
function sasa(target:Atom[],environment:Atom[]){const probe=1.4,cell=4,grid=new Map<string,Atom[]>(),cellKey=(p:Vec3,x=0,y=0,z=0)=>`${Math.floor(p[0]/cell)+x},${Math.floor(p[1]/cell)+y},${Math.floor(p[2]/cell)+z}`;for(const atom of environment){const k=cellKey(atom.p);const bin=grid.get(k)||[];bin.push(atom);grid.set(k,bin);}let area=0;for(const atom of target){const radius=atom.r+probe;let exposed=0;for(const direction of sphere){const point=Vec3.scaleAndAdd(Vec3(),atom.p,direction,radius);let blocked=false;for(let x=-1;x<=1&&!blocked;x++)for(let y=-1;y<=1&&!blocked;y++)for(let z=-1;z<=1&&!blocked;z++)for(const other of grid.get(cellKey(point,x,y,z))||[]){if(other===atom)continue;const rr=other.r+probe;if(Vec3.squaredDistance(point,other.p)<rr*rr){blocked=true;break;}}if(!blocked)exposed++;}area+=4*Math.PI*radius*radius*exposed/sphere.length;}return area;}
export function interfaceArea(structure:Structure,chainA:string,chainB:string):MeasurementResult{if(chainA===chainB)throw new Error('Choose two different chains.');const a=chainAtoms(structure,chainA),b=chainAtoms(structure,chainB);if(!a.length||!b.length)throw new Error('Both chains need atomic coordinates.');if(a.length+b.length>12000)throw new Error('Interface area is limited to 12,000 non-hydrogen atoms on this device.');const combined=[...a,...b],value=Math.max(0,(sasa(a,a)+sasa(b,b)-sasa(combined,combined))/2);return{kind:'interface-area',value,unit:'Å²',detail:'Approximate buried SASA · 1.4 Å probe · 64-point sampling'};}

export function sequenceResidues(structure:Structure, annotations:StructureAnnotation[], chainId:string):SequenceResidue[]{
  const chain=extractAlignmentChains(structure).find(c=>c.chainId===chainId);if(!chain)throw new Error('Choose an available polymer chain.');
  const extra=new Map<string,{secondary:SequenceResidue['secondary'];confidence?:number}>(),l=StructureElement.Location.create(structure),computed=SecondaryStructureProvider.get(structure).value;
  for(const unit of structure.units){if(!Unit.isAtomic(unit))continue;l.unit=unit;const ss=ModelSecondaryStructure.Provider.get(unit.model)||computed?.get(unit.invariantId);const qa=QualityAssessmentProvider.get(unit.model).value;for(let i=0;i<unit.elements.length;i++){l.element=unit.elements[i];if(P.chain.label_asym_id(l)!==chainId)continue;const insertion=P.residue.pdbx_PDB_ins_code(l);const residue:ResidueRef={modelId:String(unit.model.modelNum),chainId,authChainId:P.chain.auth_asym_id(l),residueNumber:P.residue.label_seq_id(l)||P.residue.auth_seq_id(l),authResidueNumber:P.residue.auth_seq_id(l),residueName:P.residue.label_comp_id(l),...(insertion&&insertion!=='.'&&insertion!=='?'?{insertionCode:insertion}:{})};const k=residueKey(residue);if(extra.has(k))continue;const ri=unit.residueIndex[l.element],type=ss?.type[ss.getIndex(ri)];const secondary=type&&SecondaryStructureType.is(type,SecondaryStructureType.Flag.Helix)?'helix':type&&SecondaryStructureType.is(type,SecondaryStructureType.Flag.Beta)?'sheet':'coil';const metric=qa?.pLDDT?.get(ri);const confidence=typeof metric==='number'?metric:!Model.isExperimental(unit.model)&&unit.model.atomicConformation.B_iso_or_equiv.isDefined?unit.model.atomicConformation.B_iso_or_equiv.value(l.element):undefined;extra.set(k,{secondary,confidence});}}
  return chain.anchors.map(anchor=>{const k=residueKey(anchor.residue),info=extra.get(k)||{secondary:'coil' as const};return{...anchor.residue,code:anchor.code,...info,annotations:annotations.filter(a=>a.residues.some(r=>residueKey(r)===k)).map(a=>({id:a.id,name:a.name,color:a.color}))};});
}

function residueRef(location:StructureElement.Location):ResidueRef{const insertion=P.residue.pdbx_PDB_ins_code(location),label=P.residue.label_seq_id(location),auth=P.residue.auth_seq_id(location);return{modelId:String(location.unit.model.modelNum),chainId:P.chain.label_asym_id(location),authChainId:P.chain.auth_asym_id(location),residueNumber:label||auth,authResidueNumber:auth,residueName:P.residue.label_comp_id(location),...(insertion&&insertion!=='.'&&insertion!=='?'?{insertionCode:insertion}:{})};}
export function sourceDefinedSites(structure:Structure){
 const source=structure.models[0]?.sourceData;if(!MmcifFormat.is(source))return[];const table=source.data.db.struct_site_gen,groups=new Map<string,ResidueRef[]>();
 for(let i=0;i<table._rowCount;i++){const chain=table.label_asym_id.value(i),seq=table.label_seq_id.value(i);if(!chain||!seq)continue;const id=table.site_id.value(i)||'Site';const list=groups.get(id)||[];const ref:ResidueRef={chainId:chain,authChainId:table.auth_asym_id.value(i)||chain,residueNumber:seq,authResidueNumber:table.auth_seq_id.value(i)||seq,residueName:table.label_comp_id.value(i)||table.auth_comp_id.value(i)||'UNK'};if(!list.some(r=>residueKey(r)===residueKey(ref)))list.push(ref);groups.set(id,list);}
 return [...groups].filter(([,residues])=>residues.length).map(([name,residues])=>({name,residues}));
}

interface ResiduePoint{ref:ResidueRef;point:Vec3;atoms:Vec3[];}
function residuePoints(structure:Structure,chainId?:string){const map=new Map<string,ResiduePoint>(),l=StructureElement.Location.create(structure);for(const unit of structure.units){if(!Unit.isAtomic(unit))continue;l.unit=unit;for(let i=0;i<unit.elements.length;i++){l.element=unit.elements[i];if(chainId&&P.chain.label_asym_id(l)!==chainId||String(P.atom.type_symbol(l)).toUpperCase()==='H')continue;const ref=residueRef(l),key=residueKey(ref),point=unit.conformation.position(l.element,Vec3()),item=map.get(key)||{ref,point:Vec3(),atoms:[]};item.atoms.push(Vec3.clone(point));Vec3.add(item.point,item.point,point);map.set(key,item);}}for(const item of map.values())Vec3.scale(item.point,item.point,1/item.atoms.length);return [...map.values()];}
export function interfaceResidues(structure:Structure,chainA:string,chainB:string,cutoff=5){if(chainA===chainB)throw new Error('Choose two different chains.');const a=residuePoints(structure,chainA),b=residuePoints(structure,chainB);if(!a.length||!b.length)throw new Error('Both chains need atomic coordinates.');if(a.reduce((n,r)=>n+r.atoms.length,0)*b.reduce((n,r)=>n+r.atoms.length,0)>20_000_000)throw new Error('This interface is too large for automatic contact detection on this device.');const limit=cutoff*cutoff,aa=new Set<string>(),bb=new Set<string>();for(const ra of a)for(const rb of b){let hit=false;for(const x of ra.atoms){for(const y of rb.atoms)if(Vec3.squaredDistance(x,y)<=limit){hit=true;break;}if(hit)break;}if(hit){aa.add(residueKey(ra.ref));bb.add(residueKey(rb.ref));}}return{a:a.filter(r=>aa.has(residueKey(r.ref))).map(r=>r.ref),b:b.filter(r=>bb.has(residueKey(r.ref))).map(r=>r.ref)};}
export function geometryPocketResidues(structure:Structure){
 const amino=new Set('ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL MSE SEC PYL'.split(' ')),residues=residuePoints(structure).filter(r=>amino.has(r.ref.residueName.toUpperCase()));if(residues.length<8)throw new Error('At least eight protein residues are needed for geometry pocket detection.');const center=residues.reduce((s,r)=>Vec3.add(s,s,r.point),Vec3());Vec3.scale(center,center,1/residues.length);const radial=residues.map(r=>Vec3.distance(r.point,center)).sort((a,b)=>a-b),median=radial[Math.floor(radial.length/2)];
 const scored=residues.map(r=>{let neighbors=0,mask=0;for(const q of residues){if(q===r)continue;const d=Vec3.sub(Vec3(),q.point,r.point),distance=Vec3.magnitude(d);if(distance>3&&distance<11){neighbors++;mask|=1<<((d[0]>0?1:0)|(d[1]>0?2:0)|(d[2]>0?4:0));}}let octants=0;for(let i=0;i<8;i++)if(mask&(1<<i))octants++;return{r,score:neighbors+octants*2,octants,radial:Vec3.distance(r.point,center)};}).filter(x=>x.octants>=4&&x.radial>median*.65).sort((a,b)=>b.score-a.score);
 const seed=scored[0];if(!seed)throw new Error('No bounded concavity candidate was found.');return scored.filter(x=>Vec3.distance(x.r.point,seed.r.point)<12).slice(0,24).map(x=>x.r.ref);
}
