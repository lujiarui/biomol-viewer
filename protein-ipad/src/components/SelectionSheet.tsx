import type { SelectionState } from '../viewer/types';
interface Props { selection: SelectionState; disabled: boolean; onClear: () => void; onFocus: () => void; onDetail: () => void; }
export function SelectionSheet({ selection, disabled, onClear, onFocus, onDetail }: Props) {
  const residue = selection.residues[0];
  if (!residue) return null;
  const number = `${residue.authResidueNumber ?? residue.residueNumber}${residue.insertionCode ?? ''}`;
  const selectedChains = new Set(selection.residues.map(r=>r.authChainId || r.chainId));
  const chain = residue.authChainId || residue.chainId || '—';
  return <section className="selection-sheet" aria-label="Residue selection" aria-live="polite">
    <div><p className="eyebrow">{selection.residues.length > 1 ? `${selection.residues.length} SELECTED RESIDUES` : 'SELECTED RESIDUE'}</p><h2>{selection.residues.length > 1 ? selection.residues.map(r=>`${r.authResidueNumber ?? r.residueNumber}${r.insertionCode || ''}`).slice(0,12).join(', ') + (selection.residues.length>12 ? '…' : '') : `${residue.residueName} ${number}`}{selection.atomName ? ` · ${selection.atomName}` : ''} <span>· {selectedChains.size > 1 ? `${selectedChains.size} chains` : `Chain ${chain}`}</span></h2>
      <p className="selection-detail">{selection.fileName} · {chain}{number}{residue.chainId !== chain ? ` · Label chain ${residue.chainId}` : ''}</p>
    </div>
    <div className="selection-actions"><button disabled={disabled} onClick={onFocus}>Focus</button><button disabled={disabled} onClick={onDetail}>Nearby atoms · 5 Å</button><button disabled={disabled} className="quiet-button" onClick={onClear}>Clear selection</button></div>
  </section>;
}
