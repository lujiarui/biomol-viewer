import type { StructureMetadata } from '../viewer/types';
interface Props { structure?: StructureMetadata; disabled: boolean; onOpen: () => void; onReset: () => void; onPanel: () => void; count: number; }
export function TopBar({ structure, disabled, onOpen, onReset, onPanel, count }: Props) {
  return <header className="top-bar">
    <div className="structure-title">
      <span className="app-mark" aria-hidden="true">P</span>
      <div><h1 title={structure?.fileName}>{structure?.fileName ?? 'Protein'}</h1>
        <p>{structure ? `${structure.residueCount.toLocaleString()} residues · ${structure.atomCount.toLocaleString()} atoms` : 'Structure viewer'}</p>
      </div>
    </div>
    <nav aria-label="Viewer controls">
      <button onClick={onPanel} aria-label="Manage structures">Files <span>{count}</span></button>
      <button className="quiet-button" disabled={disabled || !structure} onClick={onReset} aria-label="Reset camera"><span aria-hidden="true">↺</span><span className="reset-label">Reset view</span></button>
      <button className="primary-button" disabled={disabled} onClick={onOpen}><span aria-hidden="true">＋</span> Open</button>
    </nav>
  </header>;
}
