import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
export type Point = [number,number,number];
/** A deterministic sampled projection heuristic; smaller collision score means less overlap. */
export function bestView(points:Point[],aspect:number,currentDirection:Vec3,currentUp:Vec3,bounds?:{min:Vec3;max:Vec3}){
 if(!points.length)throw new Error('No visible atoms to orient.');
 const center=Vec3();for(const p of points)Vec3.add(center,center,Vec3.create(...p));Vec3.scale(center,center,1/points.length);if(bounds)Vec3.scale(center,Vec3.add(center,bounds.min,bounds.max),.5);
 const centered=points.map(p=>Vec3.sub(Vec3(),Vec3.create(...p),center));
 const stride=Math.max(1,Math.ceil(points.length/400)),sample=centered.filter((_,i)=>i%stride===0);
 const radius=bounds?Math.max(1,Vec3.distance(bounds.min,bounds.max)/2):Math.max(1,...centered.map(p=>Vec3.magnitude(p)));aspect=Math.max(.25,Math.min(4,aspect));
 function candidate(direction:Vec3,up:Vec3){
  const z=Vec3.normalize(Vec3(),direction),x=Vec3.normalize(Vec3(),Vec3.cross(Vec3(),up,z)),y=Vec3.normalize(Vec3(),Vec3.cross(Vec3(),z,x));
  if(Vec3.magnitude(x)<.5)return undefined;
  const halfHeight=Math.max(radius,radius/aspect,1),scale=1/halfHeight;
  const projected=sample.map(p=>[Vec3.dot(p,x)*scale,Vec3.dot(p,y)*scale]);let collisions=0;
  for(let i=0;i<projected.length;i++)for(let j=0;j<i;j++){const dx=projected[i][0]-projected[j][0],dy=projected[i][1]-projected[j][1];const d2=dx*dx+dy*dy;if(d2<.0064)collisions+=1-d2/.0064;}
  return {direction:z,up:y,halfHeight,score:collisions};
 }
 const initial=candidate(currentDirection,currentUp);let best=initial;
 for(let i=0;i<40;i++){
  const z=1-2*(i+.5)/40,phi=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-z*z),direction=Vec3.create(r*Math.cos(phi),r*Math.sin(phi),z);
  const basis=Vec3.normalize(Vec3(),Vec3.cross(Vec3(),direction,Math.abs(z)>.9?Vec3.create(0,1,0):Vec3.create(0,0,1)));
  const other=Vec3.cross(Vec3(),direction,basis);
  for(let roll=0;roll<4;roll++){const angle=roll*Math.PI/4,up=Vec3.add(Vec3(),Vec3.scale(Vec3(),basis,Math.cos(angle)),Vec3.scale(Vec3(),other,Math.sin(angle)));const c=candidate(direction,up);if(c && (!best||c.score<best.score-1e-8))best=c;}
 }
 if(!best)throw new Error('Could not determine a view.');
 return {...best,center,radius,beforeScore:initial?.score??best.score,sampled:sample.length};
}
