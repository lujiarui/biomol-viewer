import { useEffect, useRef, useState } from 'react';
interface ExportFile { name: string; url: string; metadataUrl: string; }
interface Props { busy:boolean; canSave:boolean; onClose:()=>void; onExport:(transparent:boolean)=>Promise<ExportFile|undefined>; }
export function ExportDialog(p:Props) {
  const ref=useRef<HTMLDialogElement>(null); const [transparent,setTransparent]=useState(true);
  const [files,setFiles]=useState<ExportFile[]>([]); const [result,setResult]=useState<ExportFile>(); const [error,setError]=useState('');
  async function refresh(){try{const r=await fetch('/api/exports');if(!r.ok)throw new Error();setFiles((await r.json()).files);}catch{setError('Exports need the Mac-hosted server.');}}
  useEffect(()=>{ref.current?.showModal();void refresh();},[]);
  return <dialog ref={ref} className="open-dialog export-dialog" onCancel={e=>{e.preventDefault();if(!p.busy)p.onClose();}}>
    <header><h2>Export scene</h2><button disabled={p.busy} onClick={p.onClose} aria-label="Close export">×</button></header>
    <p className="muted">Save a PNG of the molecular canvas to the Mac’s export folder (scene-exports by default). A JSON sidecar records the camera, visibility, transforms, and last alignment.</p>
    <label className="check-row"><input type="checkbox" checked={transparent} onChange={e=>setTransparent(e.target.checked)} disabled={p.busy}/>Transparent background</label>
    <button className="primary-button" disabled={p.busy || !p.canSave} onClick={async()=>{setError('');const file=await p.onExport(transparent);if(file){setResult(file);await refresh();}else setError('Export failed. Check the Mac server and output folder.');}}>{p.busy?'Saving…':'Save PNG to Mac'}</button>
    {error && <p role="alert">{error}</p>}
    {result && <section><p role="status">Saved on Mac: {result.name}</p><a href={result.url} target="_blank" rel="noreferrer"><img className="export-preview" src={result.url} alt="Exported molecular scene"/></a></section>}
    <div className="library-heading"><h3>Saved exports</h3><button disabled={p.busy} onClick={()=>void refresh()}>Refresh exports</button></div>
    <p className="muted">Open this same panel on your Mac to view or download the images.</p>
    <ul className="export-list">{files.map(file=><li key={file.name}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a><a href={file.metadataUrl} target="_blank" rel="noreferrer">Scene metadata</a></li>)}</ul>
  </dialog>;
}
