import type { AlignmentRequest, AlignmentReport, PolymerKind } from './alignment';
export type StructureFormat = 'pdb' | 'mmcif';
export type Palette = 'vivid' | 'pastel' | 'accessible';
export type RepresentationMode = 'cartoon' | 'cartoon-sticks' | 'backbone' | 'lines' | 'atoms' | 'spacefill' | 'surface';
export interface ChainSummary { chainId: string; authChainId: string; residueCount: number; }
export interface StructureMetadata { fileName: string; format: StructureFormat; chains: ChainSummary[]; residueCount: number; atomCount: number; }
export interface ScenePart { id: string; label: string; visible: boolean; color?: string; }
export interface SceneStructure { id: string; metadata: StructureMetadata; visible: boolean; parts: ScenePart[]; macFile?: string; alignmentChains: { chainId: string; authChainId: string; kind: PolymerKind; count: number }[]; }
export interface BiomolViewer {
  loadFile(file: File): Promise<StructureMetadata>;
  loadExample(id?: string): Promise<StructureMetadata>;
  loadRcsb(id: string): Promise<StructureMetadata>;
  reloadMacStructure(id: string): Promise<StructureMetadata>;
  loadMacFile(name: string): Promise<StructureMetadata>;
  duplicateStructure(id: string): Promise<StructureMetadata>;
  setSelectionMode(add: boolean): void;
  previewAlignment(request: AlignmentRequest): AlignmentReport;
  applyAlignment(request: AlignmentRequest): Promise<AlignmentReport>;
  beginAlignmentPreview(request: AlignmentRequest): Promise<AlignmentReport>;
  endAlignmentPreview(): Promise<void>;
  quickAlign(): Promise<{request: AlignmentRequest; report: AlignmentReport; candidates: number}>;
  purge(): Promise<void>;
  undoAlignment(): Promise<void>;
  exportImage(transparent: boolean): Promise<{ name: string; url: string; metadataUrl: string }>;
  getScene(): SceneStructure[];
  setVisibility(id: string, visible: boolean, partId?: string): void;
  removeStructure(id: string): Promise<void>;
  focusStructure(id: string): void;
  setStyle(palette: Palette, mode: RepresentationMode): Promise<void>;
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
