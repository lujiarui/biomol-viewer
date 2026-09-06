import { localize, useI18n } from '../i18n';
import type { Palette, RepresentationMode, SceneStructure, VisualPreset } from '../viewer/types';
import { colorHex, paletteOptions } from '../viewer/palettes';
import { visualPresetOptions } from '../viewer/visualPresets';
interface Props {
  scene: SceneStructure[]; busy: boolean; palette: Palette; mode: RepresentationMode; visualPreset: VisualPreset; labelsVisible: boolean; picking: 'residue' | 'atom';
  onAutoView:()=>void; onUndoView:()=>void; canUndoView:boolean; onPurge: () => void; onClose: () => void; onVisibility: (id: string, visible: boolean, partId?: string) => void;
  onDuplicate: (id: string) => void; onReload: (id: string) => void; onRemove: (id: string) => void; onFocus: (id: string) => void;
  onStyle: (palette: Palette, mode: RepresentationMode) => void; onPicking: (mode: 'residue' | 'atom') => void;
  onVisualPreset: (preset: VisualPreset) => void; onLabels: (visible: boolean) => void;
}
export function StructurePanel(p: Props) {
  const { language } = useI18n();
  return localize(<aside className="structure-panel" aria-label="Structures">
    <header><h2>Structures <span className="muted">{p.scene.length}</span></h2><button onClick={p.onClose} aria-label="Close structures panel">×</button></header>
    <div className="style-controls">
      <fieldset className="palette-field"><legend>Chain palette</legend><div className="palette-options">{paletteOptions.map(option => <button type="button" key={option.id} className="palette-choice" aria-pressed={p.palette === option.id} disabled={p.busy} onClick={() => p.onStyle(option.id, p.mode)}><span>{option.label}</span><span className="palette-strip" aria-hidden="true">{option.colors.slice(0, 6).map((color, index) => <i key={index} style={{ backgroundColor: colorHex(color) }} />)}</span></button>)}</div></fieldset>
      <label>Scene preset<select aria-label="Scene preset" value={p.visualPreset} disabled={p.busy} onChange={e => p.onVisualPreset(e.target.value as VisualPreset)}>{visualPresetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><small className="muted">{visualPresetOptions.find(option => option.id === p.visualPreset)?.description}</small></label>
      <label>Representation<select aria-label="Representation" value={p.mode} disabled={p.busy} onChange={e => p.onStyle(p.palette, e.target.value as RepresentationMode)}><option value="cartoon">Cartoon</option><option value="cartoon-sticks">Cartoon + sticks</option><option value="backbone">Backbone</option><option value="lines">Lines</option><option value="atoms">Ball + stick</option><option value="spacefill">Space filling</option><option value="surface">Molecular surface</option></select><small className="muted">Protein style; other molecule types stay distinct.</small></label>
      <label>Tap selects<select value={p.picking} disabled={p.busy} onChange={e => p.onPicking(e.target.value as 'residue' | 'atom')}><option value="residue">Residue</option><option value="atom">Atom</option></select></label>
      <label className="check-row compact-check"><input type="checkbox" checked={p.labelsVisible} disabled={p.busy} onChange={e => p.onLabels(e.target.checked)} /><span>Show file and chain labels</span></label>
    </div>
    <div className="entry-actions"><button disabled={p.busy || !p.scene.length} onClick={p.onAutoView} aria-label="Automatically orient visible structures">Auto view · Beta</button><button disabled={p.busy || !p.canUndoView} onClick={p.onUndoView}>Undo view</button></div>
    <p className="muted">Find a view with less projected overlap. Visible components only.</p>
    <button disabled={p.busy || !p.scene.length} onClick={p.onPurge}>Purge all structures</button>
    {!p.scene.length && <p className="muted">Open structures to manage them here.</p>}
    {p.scene.map(entry => <article key={entry.id} className="scene-entry">
      <label className="check-row"><input type="checkbox" checked={entry.visible} disabled={p.busy} onChange={e => p.onVisibility(entry.id, e.target.checked)} /><strong>{entry.metadata.fileName}</strong></label>
      <div className="entry-actions"><button disabled={p.busy} onClick={()=>p.onDuplicate(entry.id)}>Duplicate</button>{entry.macFile && <button disabled={p.busy} onClick={() => p.onReload(entry.id)}>Reload</button>}<button disabled={p.busy || !entry.visible} onClick={() => p.onFocus(entry.id)}>Fit</button><button disabled={p.busy} onClick={() => p.onRemove(entry.id)}>Remove</button></div>
      {entry.parts.map(part => <label key={part.id} className="check-row part-row"><input type="checkbox" checked={part.visible} disabled={p.busy || !entry.visible} onChange={e => p.onVisibility(entry.id, e.target.checked, part.id)} />{part.color && <span className="swatch" style={{ background: part.color }} />}<span>{part.label}</span></label>)}
    </article>)}
    <p className="muted panel-note">Protein: chain-colored ribbons. DNA/RNA and ligands: element-colored atoms. Glycans: symbols. Ions: spheres. Water starts hidden.</p>
    <p className="muted panel-note">Files retain their original coordinates; loading several files does not align them.</p>
  </aside>, language);
}
