import { Mat4, Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import type { AlignmentChain, AlignmentReport, Anchor } from './alignment';
type Fit = (a: AlignmentChain, b: AlignmentChain) => AlignmentReport;
/** Geometry-only, order-preserving local correspondence with gaps. Scores are not TM-scores. */
export function coordinateFit(reference: AlignmentChain, mobile: AlignmentChain, fit: Fit): AlignmentReport {
  const a=reference.anchors.filter(x=>x.position?.every(Number.isFinite)).map(x=>({...x,code:'A'}));
  const b=mobile.anchors.filter(x=>x.position?.every(Number.isFinite)).map(x=>({...x,code:'A'}));
  if(a.length<3||b.length<3)throw new Error('Coordinate alignment needs at least 3 backbone anchors on each side.');
  if(a.length*b.length>500_000)throw new Error('Coordinate search is limited to 500,000 residue pairs on this device. Select smaller regions.');
  const fitPairs=(pairs:[number,number][])=>fit({...reference,anchors:pairs.map(([i])=>a[i])},{...mobile,anchors:pairs.map(([,j])=>b[j])});
  const score=(r:AlignmentReport)=>r.pairs.reduce((s,p)=>s+1/(1+p.distance*p.distance/9),0)/Math.sqrt(a.length*b.length);
  let best:AlignmentReport|undefined, bestScore=-1;
  const seeds:[number,number][][]=[];
  const n=Math.min(a.length,b.length);
  seeds.push(Array.from({length:n},(_,i)=>[i,i]));
  seeds.push(Array.from({length:n},(_,i)=>[a.length-n+i,b.length-n+i]));
  const width=Math.max(3,Math.min(8,Math.floor(n/2)));
  const starts=(length:number)=>[...new Set([0,Math.floor((length-width)/2),length-width])];
  for(const i of starts(a.length))for(const j of starts(b.length))seeds.push(Array.from({length:width},(_,k)=>[i+k,j+k]));
  // Similar local distance patterns provide rigid-motion-invariant seeds for internal deletions.
  const windows:{i:number;j:number;error:number}[]=[];
  const distance=(x:Anchor,y:Anchor)=>Math.hypot(...x.position!.map((v,k)=>v-y.position![k]));
  for(let i=0;i<=a.length-width;i+=Math.max(1,Math.floor(a.length/35)))for(let j=0;j<=b.length-width;j+=Math.max(1,Math.floor(b.length/35))){
    let error=0;for(let k=1;k<width;k++)error+=Math.abs(distance(a[i],a[i+k])-distance(b[j],b[j+k]));windows.push({i,j,error});
  }
  for(const {i,j} of windows.sort((x,y)=>x.error-y.error).slice(0,4))seeds.push(Array.from({length:width},(_,k)=>[i+k,j+k]));
  for(const seed of seeds){
    let pairs=seed;
    for(let iteration=0;iteration<5;iteration++){
      let r:AlignmentReport;try{r=fitPairs(pairs);}catch{break;}
      const quality=score(r);if(quality>bestScore+1e-10){best=r;bestScore=quality;}
      const next=geometryPairs(a,b,r.matrix);
      if(next.length<3||JSON.stringify(next)===JSON.stringify(pairs))break;
      pairs=next;
    }
  }
  if(!best)throw new Error('No non-collinear coordinate correspondence could be fitted.');
  const missing=reference.anchors.length+mobile.anchors.length-a.length-b.length;
  return {...best,identity:0,coordinateScore:bestScore,referenceCount:reference.anchors.length,mobileCount:mobile.anchors.length,missingAnchors:missing,warnings:[
    'Geometry-only heuristic: sequence identities are ignored. Inspect coverage and residue pairs; repetitive shapes can be ambiguous.',
    ...(bestScore<0.3?['Low geometry score: this match covers little of the pair or has large residual distances.']:[]),
    ...(best.matched/Math.min(a.length,b.length)<0.5?['Less than half of the smaller region contributes to this fit.']:[]),
    ...(missing?[`${missing} residues without finite backbone anchors were excluded.`]:[]),
  ]};
}
function geometryPairs(a:Anchor[],b:Anchor[],matrix:number[]):[number,number][]{
  const transform=Mat4.fromArray(Mat4(),matrix,0);
  const moved=b.map(x=>Vec3.transformMat4(Vec3(),Vec3.create(...x.position!),transform));
  const columns=b.length+1,trace=new Uint8Array((a.length+1)*columns);
  let previous=new Float64Array(columns),best=0,bi=0,bj=0;
  for(let i=1;i<=a.length;i++){
    const row=new Float64Array(columns),point=Vec3.create(...a[i-1].position!);
    for(let j=1;j<=b.length;j++){
      const d2=Vec3.squaredDistance(point,moved[j-1]);
      const diagonal=previous[j-1]+2/(1+d2/9)-0.5,up=previous[j]-0.25,left=row[j-1]-0.25;
      const value=Math.max(0,diagonal,up,left);row[j]=value;
      trace[i*columns+j]=value===0?0:value===diagonal?1:value===up?2:3;
      if(value>best){best=value;bi=i;bj=j;}
    }
    previous=row;
  }
  const pairs:[number,number][]=[];
  while(bi>0&&bj>0){const direction=trace[bi*columns+bj];if(!direction)break;if(direction===1){pairs.push([bi-1,bj-1]);bi--;bj--;}else if(direction===2)bi--;else bj--;}
  return pairs.reverse();
}
