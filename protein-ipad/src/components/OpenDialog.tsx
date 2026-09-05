import { examples } from '../viewer/examples';
import { useEffect, useRef, useState } from 'react';
interface LibraryFile { name: string; size: number; modified: number; }
interface Props { busy: boolean; error?: string; onClose: () => void; onDevice: () => void; onRcsb: (id: string) => void; onMac: (name: string) => void; onExample: (id: string) => void; onPair: () => void; }
export function OpenDialog({ busy, error, onClose, onDevice, onRcsb, onMac, onExample, onPair }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [id, setId] = useState('');
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [libraryError, setLibraryError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true); setLibraryError('');
    try { const response = await fetch('/api/library'); if (!response.ok) throw new Error(); const result = await response.json(); setFiles(result.files); }
    catch { setLibraryError('Mac library unavailable. Start the app on your Mac with a shared structure folder.'); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { dialog.current?.showModal(); void refresh(); }, []);
  return <dialog ref={dialog} className="open-dialog" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header><h2>Open structure</h2><button disabled={busy} onClick={onClose} aria-label="Close open dialog">×</button></header>
    <button disabled={busy} onClick={onDevice}>From this device…</button>
    <form onSubmit={e => { e.preventDefault(); onRcsb(id); }}>
      <label htmlFor="pdb-id">From RCSB PDB</label><div className="input-row"><input id="pdb-id" value={id} onChange={e => setId(e.target.value)} placeholder="PDB ID, e.g. 4HHB" autoCapitalize="characters" autoCorrect="off" spellCheck={false} /><button className="primary-button" disabled={busy || !id.trim()}>Fetch</button></div>
    </form>
    <section aria-label="Example gallery"><h3>Examples by scenario</h3><div className="example-grid">{examples.map(example=><button key={example.id} disabled={busy} onClick={()=>onExample(example.id)}><small>{example.scenario}</small><strong>{example.title} · {example.id}</strong><span>{example.note}</span></button>)}</div><button disabled={busy} onClick={onPair}>Load ubiquitin comparison pair</button></section>
    <section aria-label="Mac library"><div className="library-heading"><h3>Mac library</h3><button disabled={refreshing || busy} onClick={() => void refresh()}>Refresh</button></div>
      <p className="muted">Files saved in your Mac’s shared structure folder.</p>
      {libraryError && <p role="status">{libraryError}</p>}
      {!libraryError && !files.length && <p className="muted">{refreshing ? 'Reading folder…' : 'No structures yet. Save .pdb or .cif files in shared-structures on your Mac, then refresh.'}</p>}
      <ul className="library-list">{files.map(file => <li key={file.name}><button disabled={busy} onClick={() => onMac(file.name)}><span>{file.name}</span><small>{Math.max(1, Math.round(file.size / 1024))} KB · {new Date(file.modified).toLocaleString()}</small></button></li>)}</ul>
    </section>
    {busy && <p role="status">Opening structure…</p>}
    {error && <p role="alert">{error}</p>}
  </dialog>;
}
