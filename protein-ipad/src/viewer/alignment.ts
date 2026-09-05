import { coordinateFit } from './coordinateAlignment';
import { align } from 'molstar/lib/mol-model/sequence/alignment/alignment';
import { MinimizeRmsd } from 'molstar/lib/mol-math/linear-algebra/3d/minimize-rmsd';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { Structure, StructureElement, StructureProperties as P, Unit } from 'molstar/lib/mol-model/structure';
import type { ResidueRef } from './types';
export type PolymerKind = 'protein' | 'nucleic';
export interface Anchor { residue: ResidueRef; code: string; position?: [number, number, number]; }
export interface AlignmentChain { chainId: string; authChainId: string; kind: PolymerKind; anchors: Anchor[]; }
export interface AlignmentEndpoint { structureId: string; chainId: string; residues?: ResidueRef[]; range?: string; }
export interface AlignmentRequest { reference: AlignmentEndpoint; mobile: AlignmentEndpoint; pairing: 'sequence' | 'order' | 'coordinates'; }
export interface AlignmentReport {
  rmsd: number; beforeRmsd: number; matched: number; identity: number; referenceCount: number; mobileCount: number;
  coordinateScore?: number; missingAnchors: number; anchor: 'Cα' | 'C4′'; matrix: number[]; warnings: string[];
  pairs: { reference: ResidueRef; mobile: ResidueRef; distance: number }[];
}
const amino: Record<string, string> = { ALA:'A', ARG:'R', ASN:'N', ASP:'D', CYS:'C', GLN:'Q', GLU:'E', GLY:'G', HIS:'H', ILE:'I', LEU:'L', LYS:'K', MET:'M', PHE:'F', PRO:'P', SER:'S', THR:'T', TRP:'W', TYR:'Y', VAL:'V', MSE:'M', SEC:'U', PYL:'O' };
const nucleic: Record<string, string> = { A:'A', C:'C', G:'G', U:'U', T:'T', DA:'A', DC:'C', DG:'G', DT:'T', DU:'U' };
export function residueKey(r: ResidueRef) { return JSON.stringify([r.modelId || '1', r.chainId, r.residueNumber, r.authResidueNumber ?? r.residueNumber, r.insertionCode || '']); }
export function extractAlignmentChains(structure: Structure): AlignmentChain[] {
  const chains = new Map<string, AlignmentChain>();
  const records = new Map<string, Anchor & { occupancy: number; alt: string }>();
  const location = StructureElement.Location.create(structure);
  for (const unit of structure.units) {
    if (!Unit.isAtomic(unit)) continue;
    location.unit = unit;
    for (let i = 0; i < unit.elements.length; i++) {
      location.element = unit.elements[i];
      const subtype = P.entity.subtype(location).toLowerCase();
      const kind = subtype.includes('polypeptide') ? 'protein' : subtype.includes('ribonucleotide') ? 'nucleic' : undefined;
      if (!kind) continue;
      const chainId = P.chain.label_asym_id(location);
      const authChainId = P.chain.auth_asym_id(location);
      const insertion = P.residue.pdbx_PDB_ins_code(location);
      const residue: ResidueRef = { modelId: String(unit.model.modelNum), chainId, authChainId, residueNumber: P.residue.label_seq_id(location) || P.residue.auth_seq_id(location), authResidueNumber: P.residue.auth_seq_id(location), insertionCode: insertion && insertion !== '?' && insertion !== '.' ? insertion : undefined, residueName: P.residue.label_comp_id(location) };
      const key = residueKey(residue);
      let record = records.get(key);
      if (!record) {
        record = { residue, code: (kind === 'protein' ? amino : nucleic)[residue.residueName] || 'X', occupancy: -1, alt: '' };
        records.set(key, record);
        const chain = chains.get(chainId) || { chainId, authChainId, kind, anchors: [] };
        chain.anchors.push(record); chains.set(chainId, chain);
      }
      const atom = P.atom.label_atom_id(location);
      if (kind === 'protein' ? atom !== 'CA' : atom !== "C4'" && atom !== 'C4*') continue;
      const occupancy = P.atom.occupancy(location); const alt = P.atom.label_alt_id(location);
      if (occupancy < record.occupancy || (occupancy === record.occupancy && record.alt <= alt)) continue;
      const point = unit.conformation.position(location.element, Vec3());
      if (point.every(Number.isFinite)) { record.position = [point[0], point[1], point[2]]; record.occupancy = occupancy; record.alt = alt; }
    }
  }
  for (const chain of chains.values()) chain.anchors.sort((a,b) => a.residue.residueNumber - b.residue.residueNumber || (a.residue.insertionCode || '').localeCompare(b.residue.insertionCode || ''));
  return [...chains.values()];
}
export function regionAnchors(chain: AlignmentChain, endpoint: Pick<AlignmentEndpoint, 'residues' | 'range'>): Anchor[] {
  if (endpoint.residues) {
    const keys = new Set(endpoint.residues.map(residueKey));
    const result = chain.anchors.filter(a => keys.has(residueKey(a.residue)));
    if (result.length !== keys.size) throw new Error('The captured region contains residues outside this polymer chain. Capture one chain again.');
    return result;
  }
  if (!endpoint.range?.trim()) return chain.anchors;
  const chosen = new Set<Anchor>();
  for (const token of endpoint.range.split(',').map(s => s.trim())) {
    const match = /^(-?\d+)([A-Za-z]?)(?:\s*[-–]\s*(-?\d+))?$/.exec(token);
    if (!match) throw new Error('Use author residue numbers, for example 10-25, 40, 42A.');
    const start = Number(match[1]), end = match[3] === undefined ? start : Number(match[3]);
    if (end < start || (match[2] && match[3])) throw new Error('Invalid residue range.');
    const matches = chain.anchors.filter(a => {
      const n = a.residue.authResidueNumber ?? a.residue.residueNumber;
      return n >= start && n <= end && (match[3] !== undefined || (a.residue.insertionCode || '') === match[2]);
    });
    if (!matches.length) throw new Error(`No observed polymer residues match ${token}.`);
    matches.forEach(a => chosen.add(a));
  }
  return chain.anchors.filter(a => chosen.has(a));
}
const vec = (p: [number, number, number]) => Vec3.create(p[0], p[1], p[2]);
function nonCollinear(points: Anchor[]) {
  const origin = points[0].position!;
  const furthest = points.reduce((best, p) => Vec3.squaredDistance(vec(p.position!), vec(origin)) > Vec3.squaredDistance(vec(best.position!), vec(origin)) ? p : best);
  const axis = Vec3.sub(Vec3(), vec(furthest.position!), vec(origin));
  const length = Vec3.squaredMagnitude(axis);
  return length > 1e-8 && points.some(p => Vec3.squaredMagnitude(Vec3.cross(Vec3(), axis, Vec3.sub(Vec3(), vec(p.position!), vec(origin)))) / length > 1e-6);
}
/** Correspondences are computed on complete observed chains, then restricted by either region. */
export function fitChains(reference: AlignmentChain, mobile: AlignmentChain, request: AlignmentRequest): AlignmentReport {
  if (reference.kind !== mobile.kind) throw new Error('Protein and nucleic-acid anchors cannot be paired. Choose the same polymer type.');
  const selectedA = regionAnchors(reference, request.reference), selectedB = regionAnchors(mobile, request.mobile);
  if (request.pairing === 'coordinates') return coordinateFit({...reference,anchors:selectedA}, {...mobile,anchors:selectedB}, (a,b)=>fitChains(a,b,{reference:{...request.reference,residues:undefined,range:undefined},mobile:{...request.mobile,residues:undefined,range:undefined},pairing:'order'}));
  const allowedA = new Set(selectedA), allowedB = new Set(selectedB);
  let pairs: [Anchor, Anchor][] = [];
  if (request.pairing === 'order') {
    if (selectedA.length !== selectedB.length) throw new Error('Ordered pairing requires equal residue counts on both sides.');
    pairs = selectedA.map((a, i) => [a, selectedB[i]]);
  } else {
    const a = reference.anchors, b = mobile.anchors;
    const seqA = a.map(x => x.code), seqB = b.map(x => x.code);
    if (seqA.join('') === seqB.join('')) pairs = a.map((x,i) => [x,b[i]]);
    else {
      if (a.length * b.length > 2_000_000) throw new Error('These chains are too large for interactive sequence alignment. Use equal-sized regions with explicit ordered pairing.');
      const result = align(seqA, seqB, reference.kind === 'protein' ? { substMatrix: 'blosum62' } : { gapPenalty: -5, gapExtensionPenalty: -1 });
      let i = 0, j = 0;
      for (let k = 0; k < result.aliA.length; k++) {
        if (result.aliA[k] !== '-' && result.aliB[k] !== '-') pairs.push([a[i], b[j]]);
        if (result.aliA[k] !== '-') i++; if (result.aliB[k] !== '-') j++;
      }
    }
    pairs = pairs.filter(([a,b]) => allowedA.has(a) && allowedB.has(b));
  }
  const missingAnchors = pairs.filter(([a,b]) => !a.position || !b.position).length;
  pairs = pairs.filter(([a,b]) => a.position && b.position && a.code !== 'X' && b.code !== 'X');
  if (pairs.some(pair => pair.some(a => !a.position!.every(Number.isFinite)))) throw new Error('Non-finite anchor coordinates.');
  if (pairs.length < 3) throw new Error('At least 3 corresponding residues with backbone atoms are required. Expand the regions or check the chain pairing.');
  if (!nonCollinear(pairs.map(p => p[0])) || !nonCollinear(pairs.map(p => p[1]))) throw new Error('The selected anchors are collinear or coincident; they cannot determine a unique 3D fit.');
  const positions = (index: 0 | 1) => ({ x: pairs.map(p => p[index].position![0]), y: pairs.map(p => p[index].position![1]), z: pairs.map(p => p[index].position![2]) });
  const result = MinimizeRmsd.compute({ a: positions(0), b: positions(1) });
  const identity = pairs.filter(([a,b]) => a.code === b.code).length / pairs.length;
  const distances = pairs.map(([a,b]) => Vec3.distance(vec(a.position!), Vec3.transformMat4(Vec3(), vec(b.position!), result.bTransform)));
  const rmsd = Math.sqrt(distances.reduce((sum,d) => sum + d*d, 0) / pairs.length);
  if (!Number.isFinite(rmsd) || !Array.from(result.bTransform).every(Number.isFinite)) throw new Error('The fit is not numerically valid.');
  const beforeRmsd = Math.sqrt(pairs.reduce((sum,[a,b]) => sum + Vec3.squaredDistance(vec(a.position!),vec(b.position!)),0) / pairs.length);
  const warnings: string[] = [];
  if (identity < 0.3) warnings.push('Low sequence identity: inspect the residue pairing carefully.');
  if (pairs.length / Math.min(selectedA.length, selectedB.length) < 0.5) warnings.push('Less than half of the smaller region contributes to the fit.');
  if (missingAnchors) warnings.push(`${missingAnchors} paired residues lack a backbone anchor and were excluded.`);
  if (request.pairing === 'order') warnings.push('Ordered pairing uses sequence order, not sequence homology or tap order.');
  return { rmsd, beforeRmsd, matched: pairs.length, identity, referenceCount: selectedA.length, mobileCount: selectedB.length, missingAnchors, anchor: reference.kind === 'protein' ? 'Cα' : 'C4′', matrix: Array.from(result.bTransform), warnings, pairs: pairs.map(([a,b], i) => ({ reference: a.residue, mobile: b.residue, distance: distances[i] })) };
}
