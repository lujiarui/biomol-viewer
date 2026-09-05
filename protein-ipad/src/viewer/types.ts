export type StructureFormat = 'pdb' | 'mmcif';
export type Palette = 'vivid' | 'pastel' | 'accessible';
export type RepresentationMode = 'cartoon' | 'cartoon-sticks' | 'atoms';
export interface ChainSummary { chainId: string; authChainId: string; residueCount: number; }
export interface StructureMetadata { fileName: string; format: StructureFormat; chains: ChainSummary[]; residueCount: number; atomCount: number; }
export interface ScenePart { id: string; label: string; visible: boolean; color?: string; }
export interface SceneStructure { id: string; metadata: StructureMetadata; visible: boolean; parts: ScenePart[]; macFile?: string; }
export interface ProteinViewer {
  loadFile(file: File): Promise<StructureMetadata>;
  loadExample(): Promise<StructureMetadata>;
  loadRcsb(id: string): Promise<StructureMetadata>;
  reloadMacStructure(id: string): Promise<StructureMetadata>;
  loadMacFile(name: string): Promise<StructureMetadata>;
  getScene(): SceneStructure[];
  setVisibility(id: string, visible: boolean, partId?: string): void;
  removeStructure(id: string): Promise<void>;
  focusStructure(id: string): void;
  setStyle(palette: Palette, mode: RepresentationMode): Promise<void>;
  setPicking(mode: 'residue' | 'atom'): void;
  focusSelection(): void;
  showNeighborhood(): Promise<void>;
  resetCamera(): void;
  clearSelection(): void;
  getSelection(): SelectionState;
  subscribeSelection(callback: (selection: SelectionState) => void): () => void;
  dispose(): void;
}
export interface ResidueRef { modelId?: string; chainId: string; authChainId?: string; residueNumber: number; authResidueNumber?: number; insertionCode?: string; residueName: string; }
export interface SelectionState { residues: ResidueRef[]; structureId?: string; fileName?: string; atomName?: string; }
