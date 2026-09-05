import { useCallback, useRef, useState } from 'react';
import { ViewerCanvas } from '../components/ViewerCanvas';
import { TopBar } from '../components/TopBar';
import { EmptyState } from '../components/EmptyState';
import type { ProteinViewer } from '../viewer/types';
import { errorMessage, initialState } from '../state/viewerState';
import './app.css';
export function App() {
  const viewer = useRef<ProteinViewer | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(initialState);
  const onError = useCallback((error: unknown) => setState(s => ({ ...s, error: errorMessage(error) })), []);
  const onReady = useCallback((created: ProteinViewer) => { viewer.current = created; setReady(true); }, []);
  async function load(file?: File) {
    if (!viewer.current || state.loading) return;
    setState(s => ({ ...s, loading: true, error: undefined }));
    try {
      const structure = await (file ? viewer.current.loadFile(file) : viewer.current.loadExample());
      setState(s => ({ ...s, structure }));
    } catch (error) { onError(error); }
    finally { setState(s => ({ ...s, loading: false })); }
  }
  const disabled = !ready || state.loading;
  const open = () => picker.current?.click();
  return <main className="app" aria-label="Protein viewer" data-ready={ready} data-loaded={!!state.structure} aria-busy={state.loading}>
    <ViewerCanvas onReady={onReady} onError={onError} />
    <TopBar structure={state.structure} disabled={disabled} onOpen={open} onReset={() => viewer.current?.resetCamera()} />
    <input ref={picker} className="file-input" aria-label="Open structure file" type="file" accept=".pdb,.cif,.mmcif" disabled={disabled} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void load(file); }} />
    {!state.structure && !state.loading && <EmptyState disabled={disabled} onOpen={open} onExample={() => void load()} />}
    {(state.loading || (!ready && !state.error)) && <div className="loading-status" role="status"><span className="spinner" />{state.loading ? 'Opening structure…' : 'Preparing viewer…'}</div>}
    {state.error && <div className="error-message" role="alert"><p>{state.error}</p><button aria-label="Dismiss error" onClick={() => setState(s => ({ ...s, error: undefined }))}>×</button></div>}
    {state.structure && <footer className="gesture-hint">Drag to rotate <span>·</span> Pinch to zoom <span>·</span> Two fingers to pan</footer>}
  </main>;
}
