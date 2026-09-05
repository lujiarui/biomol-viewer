import { useCallback, useRef, useState } from 'react';
import { ViewerCanvas } from '../components/ViewerCanvas';
import type { ProteinViewer, StructureMetadata } from '../viewer/types';
export function App() {
  const viewer = useRef<ProteinViewer | null>(null);
  const [ready, setReady] = useState(false);
  const [structure, setStructure] = useState<StructureMetadata>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const onError = useCallback((error: unknown) => setError(error instanceof Error ? error.message : 'Unable to open the structure.'), []);
  const onReady = useCallback((created: ProteinViewer) => { viewer.current = created; setReady(true); }, []);
  async function load(file?: File) {
    if (!viewer.current || loading) return;
    setLoading(true); setError('');
    try { setStructure(await (file ? viewer.current.loadFile(file) : viewer.current.loadExample())); }
    catch (error) { onError(error); }
    finally { setLoading(false); }
  }
  return <main aria-label="Protein viewer" data-ready={ready} data-loaded={!!structure}>
    <ViewerCanvas onReady={onReady} onError={onError} />
    <div style={{ position: 'absolute', top: 16, left: 16 }}>
      <input aria-label="Open structure file" type="file" accept=".pdb,.cif,.mmcif" disabled={!ready || loading} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void load(file); }} />
      <button disabled={!ready || loading} onClick={() => void load()}>Try Example</button>
      {structure && <p>{structure.fileName} · {structure.residueCount} residues · {structure.atomCount} atoms</p>}
      {loading && <p role="status">Loading structure…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </main>;
}
