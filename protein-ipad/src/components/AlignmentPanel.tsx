import { useEffect, useState } from 'react';
import type { SceneStructure, SelectionState } from '../viewer/types';
import type { AlignmentEndpoint, AlignmentReport, AlignmentRequest } from '../viewer/alignment';
interface Props { open:boolean; scene: SceneStructure[]; selection: SelectionState; busy: boolean; additive: boolean; onAdditive: (value: boolean) => void; onClose: () => void; onPreview: (request: AlignmentRequest) => AlignmentReport; onApply: (request: AlignmentRequest) => Promise<AlignmentReport | undefined>; onUndo: () => Promise<unknown>; }
const blank: AlignmentEndpoint = { structureId: '', chainId: '' };
export function AlignmentPanel(p: Props) {
  const [reference,setReference]=useState<AlignmentEndpoint>(blank), [mobile,setMobile]=useState<AlignmentEndpoint>(blank);
  const [pairing,setPairing]=useState<AlignmentRequest['pairing']>('sequence');
  const [report,setReport]=useState<AlignmentReport>(); const [error,setError]=useState(''); const [applied,setApplied]=useState(false);
  useEffect(()=>{
    const valid = (current: AlignmentEndpoint, index:number) => p.scene.some(s=>s.id===current.structureId && s.alignmentChains.some(c=>c.chainId===current.chainId)) ? current : { structureId:p.scene[index]?.id || '', chainId:p.scene[index]?.alignmentChains[0]?.chainId || '' };
    setReference(r=>valid(r,0)); setMobile(m=>valid(m,1)); 
  },[p.scene]);
  const reset = ()=>{setReport(undefined);setError('');setApplied(false);};
  function capture(set:(value:AlignmentEndpoint)=>void) {
    const selection=p.selection;
    if (!selection.structureId || !selection.residues.length || new Set(selection.residues.map(r=>r.chainId)).size!==1) {setError('Select residues from exactly one polymer chain, then capture them.');return;}
    const chainId=selection.residues[0].chainId;
    if (!p.scene.find(s=>s.id===selection.structureId)?.alignmentChains.some(c=>c.chainId===chainId)) {setError('The selection is not a protein or nucleic-acid chain.');return;}
    reset(); set({structureId:selection.structureId,chainId,residues:structuredClone(selection.residues)});
  }
  function slot(label:string, value:AlignmentEndpoint, set:(value:AlignmentEndpoint)=>void) {
    const entry=p.scene.find(s=>s.id===value.structureId);
    return <fieldset disabled={p.busy}><legend>{label}</legend>
      <label>Structure<select aria-label={`${label} structure`} value={value.structureId} onChange={e=>{reset();const item=p.scene.find(s=>s.id===e.target.value);set({structureId:e.target.value,chainId:item?.alignmentChains[0]?.chainId || ''});}}><option value="">Choose structure</option>{p.scene.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.metadata.fileName}</option>)}</select></label>
      <label>Chain<select aria-label={`${label} chain`} value={value.chainId} onChange={e=>{reset();set({structureId:value.structureId,chainId:e.target.value});}}><option value="">Choose chain</option>{entry?.alignmentChains.map(c=><option key={c.chainId} value={c.chainId}>{c.authChainId || c.chainId}{c.authChainId!==c.chainId ? ` [${c.chainId}]` : ''} · {c.kind} · {c.count} residues</option>)}</select></label>
      <label>Region <small>(blank = whole chain)</small><input aria-label={`${label} region`} value={value.range || ''} disabled={!!value.residues} placeholder="10-25, 40, 42A" onChange={e=>{reset();set({...value,range:e.target.value});}} /></label>
      {value.residues && <p className="muted">Captured {value.residues.length} residues</p>}
      <div className="entry-actions"><button onClick={()=>capture(set)}>Use current selection</button><button onClick={()=>{reset();set({structureId:value.structureId,chainId:value.chainId});}}>Whole chain</button></div>
    </fieldset>;
  }
  const request:AlignmentRequest={reference,mobile,pairing};
  return <aside hidden={!p.open} className="alignment-panel" aria-label="Superposition">
    <header><h2>Superpose</h2><button onClick={p.onClose} aria-label="Close superposition">×</button></header>
    <p className="muted">Keep the reference fixed; move the entire mobile structure. For two chains in one file, duplicate it in Files first.</p>
    <label className="check-row"><input type="checkbox" checked={p.additive} disabled={p.busy} onChange={e=>p.onAdditive(e.target.checked)} />Tap to add/remove residues</label>
    <button onClick={p.onClose}>Pick residues on canvas</button>
    <p className="muted">{p.selection.residues.length} residues currently selected. Capture each side independently.</p>
    {slot('Reference',reference,setReference)}{slot('Mobile',mobile,setMobile)}
    <label>Correspondence<select value={pairing} disabled={p.busy} onChange={e=>{reset();setPairing(e.target.value as AlignmentRequest['pairing']);}}><option value="sequence">Sequence alignment (recommended)</option><option value="order">Pair regions by sequence order</option></select></label>
    <p className="muted">Protein Cα / nucleic-acid C4′. Sequence mapping uses the full observed chains, then restricts either region. No outlier rejection.</p>
    <button disabled={p.busy} onClick={()=>{try {setReport(p.onPreview(request));setError('');setApplied(false);} catch(e){setError(e instanceof Error?e.message:String(e));setReport(undefined);}}}>Preview fit</button>
    {error && <p role="alert">{error}</p>}
    {report && <section className="alignment-result" aria-label="Alignment result">
      <h3>{report.rmsd.toFixed(3)} Å RMSD</h3><p>{report.matched} {report.anchor} pairs · {(report.identity*100).toFixed(1)}% identity</p><p className="muted">Before fit: {report.beforeRmsd.toFixed(3)} Å · Regions: {report.referenceCount} / {report.mobileCount} residues</p>
      {report.warnings.map(w=><p className="fit-warning" key={w}>{w}</p>)}
      <details><summary>Inspect all {report.matched} residue pairs</summary><div className="pair-table"><table><thead><tr><th>Reference</th><th>Mobile</th><th>After fit (Å)</th></tr></thead><tbody>{report.pairs.map((pair,i)=><tr key={i}><td>{pair.reference.residueName} {pair.reference.authResidueNumber}{pair.reference.insertionCode}</td><td>{pair.mobile.residueName} {pair.mobile.authResidueNumber}{pair.mobile.insertionCode}</td><td>{pair.distance.toFixed(3)}</td></tr>)}</tbody></table></div></details>
      <button className="primary-button" disabled={p.busy || applied} onClick={async()=>{const result=await p.onApply(request);if(result){setReport(result);setApplied(true);}}}>{applied?'Alignment applied':'Apply alignment'}</button>
    </section>}
    <button disabled={p.busy} onClick={async()=>{await p.onUndo();reset();}}>Undo last alignment</button>
  </aside>;
}
