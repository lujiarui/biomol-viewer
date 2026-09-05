import { localize, useI18n } from '../i18n';
import { useEffect, useRef } from 'react';
import { ViewerController } from '../viewer/ViewerController';
import type { BiomolViewer } from '../viewer/types';
interface Props { onReady: (viewer: BiomolViewer) => void; onError: (error: unknown) => void; }
export function ViewerCanvas({ onReady, onError }: Props) {
  const { language } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    let viewer: BiomolViewer | undefined;
    void ViewerController.create(host.current!, abort.signal).then(created => {
      if (abort.signal.aborted) { created.dispose(); return; }
      viewer = created;
      onReady(created);
    }).catch(error => { if (!abort.signal.aborted) onError(error); });
    return () => { abort.abort(); viewer?.dispose(); };
  }, [onReady, onError]);
  return localize(<div ref={host} className="viewer-canvas" aria-label="Interactive protein structure" />, language);
}
