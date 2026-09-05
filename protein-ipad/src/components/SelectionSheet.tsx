import type { SelectionState } from '../viewer/types';
interface Props { selection: SelectionState; disabled: boolean; onClear: () => void; onFocus: () => void; onDetail: () => void; }
export function SelectionSheet({ selection, disabled, onClear, onFocus, onDetail }: Props) {
  const residue = selection.residues[0];
  if (!residue) return null;
  const number = `${residue.authResidueNumber ?? residue.residueNumber}${residue.insertionCode ?? ''}`;
  const chain = residue.authChainId || residue.chainId || '—';
  return <section className="selection-sheet" aria-label="Residue selection" aria-live="polite">
    <div><p className="eyebrow">SELECTED RESIDUE</p><h2>{residue.residueName} {number}{selection.atomName ? ` · ${selection.atomName}` : ''} <span>· Chain {chain}</span></h2>
      <p className="selection-detail">{selection.fileName} · {chain}{number}{residue.chainId !== chain ? ` · Label chain ${residue.chainId}` : ''}</p>
    </div>
    <div className="selection-actions"><button disabled={disabled} onClick={onFocus}>Focus</button><button disabled={disabled} onClick={onDetail}>Nearby atoms · 5 Å</button><button disabled={disabled} className="quiet-button" onClick={onClear}>Clear selection</button></div>
  </section>;
}
