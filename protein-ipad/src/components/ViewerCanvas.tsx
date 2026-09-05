import { useEffect, useRef, useState } from 'react';
import { ViewerController } from '../viewer/ViewerController';
export function ViewerCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let viewer: ViewerController | undefined;
    void (async () => {
      const created = await ViewerController.create(host.current!, abort.signal);
      if (abort.signal.aborted) { created.dispose(); return; }
      viewer = created;
      await viewer.loadExample();
      if (!abort.signal.aborted) setReady(true);
    })().catch(e => { if (!abort.signal.aborted) setError(String(e)); });
    return () => { abort.abort(); viewer?.dispose(); };
  }, []);
  return <main style={{ position: 'relative', height: '100%', width: '100%' }} aria-label="Protein viewer" data-ready={ready}>
    <div ref={host} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
    {error && <p role="alert">{error}</p>}
  </main>;
}
