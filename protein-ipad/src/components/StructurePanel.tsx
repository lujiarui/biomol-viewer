import type { Palette, RepresentationMode, SceneStructure } from '../viewer/types';
interface Props {
  scene: SceneStructure[]; busy: boolean; palette: Palette; mode: RepresentationMode; picking: 'residue' | 'atom';
  onClose: () => void; onVisibility: (id: string, visible: boolean, partId?: string) => void;
  onReload: (id: string) => void; onRemove: (id: string) => void; onFocus: (id: string) => void;
  onStyle: (palette: Palette, mode: RepresentationMode) => void; onPicking: (mode: 'residue' | 'atom') => void;
}
export function StructurePanel(p: Props) {
  return <aside className="structure-panel" aria-label="Structures">
    <header><h2>Structures <span className="muted">{p.scene.length}</span></h2><button onClick={p.onClose} aria-label="Close structures panel">×</button></header>
    <div className="style-controls">
      <label>Chain palette<select value={p.palette} disabled={p.busy} onChange={e => p.onStyle(e.target.value as Palette, p.mode)}><option value="vivid">Vivid</option><option value="pastel">Pastel</option><option value="accessible">Colorblind-friendly</option></select></label>
      <label>Representation<select value={p.mode} disabled={p.busy} onChange={e => p.onStyle(p.palette, e.target.value as RepresentationMode)}><option value="cartoon">Cartoon</option><option value="cartoon-sticks">Cartoon + sticks</option><option value="atoms">All atoms</option></select></label>
      <label>Tap selects<select value={p.picking} disabled={p.busy} onChange={e => p.onPicking(e.target.value as 'residue' | 'atom')}><option value="residue">Residue</option><option value="atom">Atom</option></select></label>
    </div>
    {!p.scene.length && <p className="muted">Open structures to manage them here.</p>}
    {p.scene.map(entry => <article key={entry.id} className="scene-entry">
      <label className="check-row"><input type="checkbox" checked={entry.visible} disabled={p.busy} onChange={e => p.onVisibility(entry.id, e.target.checked)} /><strong>{entry.metadata.fileName}</strong></label>
      <div className="entry-actions">{entry.macFile && <button disabled={p.busy} onClick={() => p.onReload(entry.id)}>Reload</button>}<button disabled={p.busy || !entry.visible} onClick={() => p.onFocus(entry.id)}>Fit</button><button disabled={p.busy} onClick={() => p.onRemove(entry.id)}>Remove</button></div>
      {entry.parts.map(part => <label key={part.id} className="check-row part-row"><input type="checkbox" checked={part.visible} disabled={p.busy || !entry.visible} onChange={e => p.onVisibility(entry.id, e.target.checked, part.id)} />{part.color && <span className="swatch" style={{ background: part.color }} />}<span>{part.label}</span></label>)}
    </article>)}
    <p className="muted panel-note">Protein: chain-colored ribbons. DNA/RNA and ligands: element-colored atoms. Glycans: symbols. Ions: spheres. Water starts hidden.</p>
    <p className="muted panel-note">Files retain their original coordinates; loading several files does not align them.</p>
  </aside>;
}
