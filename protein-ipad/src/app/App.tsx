import { localize, useI18n } from '../i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ViewerCanvas } from '../components/ViewerCanvas';
import { SelectionSheet } from '../components/SelectionSheet';
import { TopBar } from '../components/TopBar';
import { EmptyState } from '../components/EmptyState';
import { AlignmentPanel } from '../components/AlignmentPanel';
import { ExportDialog } from '../components/ExportDialog';
import { OpenDialog } from '../components/OpenDialog';
import { StructurePanel } from '../components/StructurePanel';
import type { ProteinViewer, SceneStructure, Palette, RepresentationMode } from '../viewer/types';
import { errorMessage, initialState } from '../state/viewerState';
import './app.css';
export function App() {
  const { language } = useI18n();
  const viewer = useRef<ProteinViewer | null>(null);
  const unsubscribeSelection = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => unsubscribeSelection.current?.(), []);
  const picker = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(initialState);
  const [scene, setScene] = useState<SceneStructure[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [panel, setPanel] = useState(false);
  const [alignmentOpen,setAlignmentOpen]=useState(false), [exportOpen,setExportOpen]=useState(false);
  const [canUndoView,setCanUndoView]=useState(false);
  const [holding,setHolding]=useState(false);
  const [additive,setAdditive]=useState(false);
  const [palette, setPalette] = useState<Palette>('vivid');
  const [mode, setMode] = useState<RepresentationMode>('cartoon');
  const [picking, setPicking] = useState<'residue' | 'atom'>('residue');
  const onError = useCallback((error: unknown) => setState(s => ({ ...s, error: errorMessage(error) })), []);
  const onReady = useCallback((created: ProteinViewer) => {
    unsubscribeSelection.current?.(); viewer.current = created;
    unsubscribeSelection.current = created.subscribeSelection(selection => setState(s => ({ ...s, selection })));
    setReady(true);
  }, []);
  function refreshScene() { const next = viewer.current?.getScene() || []; setScene(next); setState(s => ({ ...s, structure: next.at(-1)?.metadata })); }
  async function action<T,>(work: (v: ProteinViewer) => Promise<T>, closeOpen = false): Promise<T | undefined> {
    if (!viewer.current || state.loading) return;
    setState(s => ({ ...s, loading: true, error: undefined }));
    try { const result=await work(viewer.current); if (closeOpen) setOpenDialog(false); return result; }
    catch (error) { onError(error); }
    finally { refreshScene(); setState(s => ({ ...s, loading: false })); }
  }
  const disabled = !ready || state.loading || holding;
  const open = () => { setState(s => ({ ...s, error: undefined })); setOpenDialog(true); };
  return localize(<main className={`app${holding?' preview-held':''}`} aria-label="Protein viewer" data-ready={ready} data-loaded={scene.length > 0} aria-busy={state.loading}>
    <ViewerCanvas onReady={onReady} onError={onError} />
    <TopBar structure={state.structure} disabled={disabled} onOpen={open} onReset={() => viewer.current?.resetCamera()} onPanel={() => {setPanel(v => !v);setAlignmentOpen(false);}} count={scene.length} onAlign={()=>{setAlignmentOpen(v=>!v);setPanel(false);}} onExport={()=>setExportOpen(true)} />
    <input ref={picker} className="file-input" aria-label="Open structure file" type="file" accept=".pdb,.cif,.mmcif" disabled={disabled} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void action(v => v.loadFile(file), true); }} />
    {!scene.length && !state.loading && <EmptyState disabled={disabled} onOpen={open} onExample={() => void action(v => v.loadExample())} />}
    {(state.loading || (!ready && !state.error)) && !openDialog && <div className="loading-status" role="status"><span className="spinner" />{state.loading ? 'Updating scene…' : 'Preparing viewer…'}</div>}
    {state.error && !openDialog && <div className="error-message" role="alert"><p>{state.error}</p><button aria-label="Dismiss error" onClick={() => setState(s => ({ ...s, error: undefined }))}>×</button></div>}
    {state.selection.residues.length > 0 && <SelectionSheet selection={state.selection} disabled={disabled} onClear={() => viewer.current?.clearSelection()} onFocus={() => viewer.current?.focusSelection()} onDetail={() => void action(v => v.showNeighborhood())} />}
    {scene.length > 0 && !state.selection.residues.length && <footer className="gesture-hint">Drag to rotate <span>·</span> Pinch to zoom <span>·</span> {additive ? 'Tap to add/remove residues' : `Tap a ${picking}`} </footer>}
    {panel && <StructurePanel canUndoView={canUndoView} onAutoView={()=>void action(async v=>{await v.autoView();setCanUndoView(true);})} onUndoView={()=>{viewer.current?.undoView();setCanUndoView(false);}} onPurge={()=>void action(async v=>{await v.purge();setCanUndoView(false);setAdditive(false);})} scene={scene} busy={disabled} palette={palette} mode={mode} picking={picking} onClose={() => setPanel(false)} onFocus={id => viewer.current?.focusStructure(id)} onDuplicate={id=>void action(v=>v.duplicateStructure(id))} onReload={id => void action(v => v.reloadMacStructure(id))} onRemove={id => void action(v => v.removeStructure(id))} onVisibility={(id, visible, partId) => { viewer.current?.setVisibility(id, visible, partId); refreshScene(); }} onPicking={p => { viewer.current?.setPicking(p); viewer.current?.setSelectionMode(false);setAdditive(false); setPicking(p); }} onStyle={(p, m) => void action(async v => { await v.setStyle(p, m); setPalette(p); setMode(m); })} />}
    {<AlignmentPanel open={alignmentOpen} scene={scene} selection={state.selection} busy={!ready || state.loading} onHolding={setHolding} onHold={request=>viewer.current!.beginAlignmentPreview(request)} onRelease={()=>viewer.current!.endAlignmentPreview()} onQuick={()=>action(v=>v.quickAlign())} additive={additive} onAdditive={value=>{viewer.current?.setSelectionMode(value);setAdditive(value);if(value)setPicking('residue');}} onClose={()=>setAlignmentOpen(false)} onPreview={request=>viewer.current!.previewAlignment(request)} onApply={request=>action(v=>v.applyAlignment(request))} onUndo={()=>action(v=>v.undoAlignment())} />}
    {exportOpen && <ExportDialog busy={disabled} canSave={scene.length>0} onClose={()=>setExportOpen(false)} onExport={transparent=>action(v=>v.exportImage(transparent))}/>}
    {openDialog && <OpenDialog busy={disabled} error={state.error} onClose={() => setOpenDialog(false)} onDevice={() => picker.current?.click()} onMac={name => void action(v => v.loadMacFile(name), true)} onExample={id=>void action(v=>v.loadExample(id),true)} onPair={()=>void action(async v=>{await v.loadExample('1UBQ');await v.loadExample('1UBI');setAlignmentOpen(true);setPanel(false);},true)} onRcsb={id => void action(v => v.loadRcsb(id), true)} />}
  </main>, language);
}
