export type StructureFormat = 'pdb' | 'mmcif';
export interface ChainSummary { chainId: string; authChainId: string; residueCount: number; }
export interface StructureMetadata { fileName: string; format: StructureFormat; chains: ChainSummary[]; residueCount: number; atomCount: number; }
export interface ProteinViewer {
  loadFile(file: File): Promise<StructureMetadata>;
  loadExample(): Promise<StructureMetadata>;
  resetCamera(): void;
  clearSelection(): void;
  getSelection(): SelectionState;
  subscribeSelection(callback: (selection: SelectionState) => void): () => void;
  dispose(): void;
}
export interface ResidueRef {
  modelId?: string;
  chainId: string;
  authChainId?: string;
  residueNumber: number;
  authResidueNumber?: number;
  insertionCode?: string;
  residueName: string;
}
export interface SelectionState { residues: ResidueRef[]; }
