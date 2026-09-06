import type { AlignmentRequest, AlignmentReport, PolymerKind } from './alignment';
export type StructureFormat = 'pdb' | 'mmcif';
export type Palette = 'vivid' | 'pastel' | 'accessible' | 'ocean' | 'sunset' | 'forest' | 'berry';
export type RepresentationMode = 'cartoon' | 'cartoon-sticks' | 'backbone' | 'lines' | 'atoms' | 'spacefill' | 'surface';
export type VisualPreset = 'default' | 'studio' | 'publication';
export type ColorMapping = 'chain' | 'element' | 'aa-type' | 'secondary' | 'hydrophobicity' | 'charge' | 'confidence' | 'custom';
export type AnnotationKind = 'pocket' | 'epitope' | 'paratope' | 'active-site' | 'custom';
export interface StructureAnnotation { id: string; kind: AnnotationKind; name: string; color: string; residues: ResidueRef[]; }
export interface SequenceResidue extends ResidueRef { code: string; secondary: 'helix' | 'sheet' | 'coil'; confidence?: number; annotations: { id: string; name: string; color: string }[]; }
export interface SequenceChain { structureId: string; fileName: string; chainId: string; authChainId: string; residues: SequenceResidue[]; }
export interface MeasurementResult { kind: 'distance' | 'angle' | 'dihedral' | 'rmsd' | 'radius' | 'interface-area'; value: number; unit: 'Å' | '°' | 'Å²'; detail: string; }
export type AutoAnnotationMode = 'source-sites' | 'pocket-geometry' | 'interface-pair';
export interface SavedFile { name:string; url:string; metadataUrl?:string; }
export interface VideoOptions { mode:'rotation'|'flipbook'; axis:'x'|'y'|'z'; seconds:number; }
export interface GalleryOptions { fixedStructureId?:string; fixedPartId?:string; candidateIds:string[]; columns:number; transparent:boolean; }
export interface ViewerStyleState { palette:Palette;mode:RepresentationMode;preset:VisualPreset;colorMapping:ColorMapping;labels:boolean; }
export interface ChainSummary { chainId: string; authChainId: string; residueCount: number; }
export interface StructureMetadata { fileName: string; format: StructureFormat; chains: ChainSummary[]; residueCount: number; atomCount: number; }
export interface ScenePart { id: string; label: string; visible: boolean; color?: string; }
export interface SceneStructure { id: string; metadata: StructureMetadata; visible: boolean; parts: ScenePart[]; annotations: StructureAnnotation[]; macFile?: string; alignmentChains: { chainId: string; authChainId: string; kind: PolymerKind; count: number }[]; }
export interface BiomolViewer {
  loadFile(file: File): Promise<StructureMetadata>;
  loadExample(id?: string): Promise<StructureMetadata>;
  loadRcsb(id: string): Promise<StructureMetadata>;
  reloadMacStructure(id: string): Promise<StructureMetadata>;
  loadMacFile(name: string): Promise<StructureMetadata>;
  duplicateStructure(id: string): Promise<StructureMetadata>;
  setSelectionMode(add: boolean): void;
  setRangeSelectionMode(enabled: boolean): void;
  previewAlignment(request: AlignmentRequest): AlignmentReport;
  applyAlignment(request: AlignmentRequest): Promise<AlignmentReport>;
  beginAlignmentPreview(request: AlignmentRequest): Promise<AlignmentReport>;
  endAlignmentPreview(): Promise<void>;
  quickAlign(): Promise<{request: AlignmentRequest; report: AlignmentReport; candidates: number}>;
  purge(): Promise<void>;
  undoAlignment(): Promise<void>;
  exportImage(transparent: boolean): Promise<SavedFile>;
  createSharedSession(): Promise<{id:string;url:string}>;
  loadSharedSession(id:string): Promise<ViewerStyleState>;
  recordVideo(options:VideoOptions):Promise<SavedFile>;
  exportGallery(options:GalleryOptions):Promise<SavedFile>;
  getScene(): SceneStructure[];
  setVisibility(id: string, visible: boolean, partId?: string): void;
  removeStructure(id: string): Promise<void>;
  focusStructure(id: string): void;
  setStyle(palette: Palette, mode: RepresentationMode): Promise<void>;
  setVisualPreset(preset: VisualPreset): Promise<void>;
  setChainLabels(visible: boolean): void;
  setColorMapping(mapping: ColorMapping, customScalar?: string): Promise<void>;
  addAnnotation(kind: AnnotationKind, name: string, color: string): Promise<StructureAnnotation>;
  autoAnnotate(mode:AutoAnnotationMode,structureId:string,chainA?:string,chainB?:string):Promise<StructureAnnotation[]>;
  removeAnnotation(structureId: string, annotationId: string): Promise<void>;
  getSequence(structureId: string, chainId: string): SequenceChain;
  selectSequenceResidue(structureId: string, residue: ResidueRef, additive?: boolean): void;
  measureSelection(kind: 'distance' | 'angle' | 'dihedral' | 'rmsd' | 'radius'): MeasurementResult;
  measureInterface(structureId: string, chainA: string, chainB: string): MeasurementResult;
  setPicking(mode: 'residue' | 'atom'): void;
  focusSelection(): void;
  showNeighborhood(): Promise<void>;
  autoView(): Promise<void>;
  undoView(): void;
  resetCamera(): void;
  clearSelection(): void;
  getSelection(): SelectionState;
  subscribeSelection(callback: (selection: SelectionState) => void): () => void;
  dispose(): void;
}
export interface ResidueRef { modelId?: string; chainId: string; authChainId?: string; residueNumber: number; authResidueNumber?: number; insertionCode?: string; residueName: string; }
export interface SelectionState { neighborhood?: { atomCount:number; fileCount:number }; residues: ResidueRef[]; structureId?: string; fileName?: string; atomName?: string; }
