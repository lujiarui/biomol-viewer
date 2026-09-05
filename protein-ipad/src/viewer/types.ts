export type StructureFormat = 'pdb' | 'mmcif';
export interface ChainSummary { chainId: string; authChainId: string; residueCount: number; }
export interface StructureMetadata { fileName: string; format: StructureFormat; chains: ChainSummary[]; residueCount: number; atomCount: number; }
export interface ProteinViewer {
  loadFile(file: File): Promise<StructureMetadata>;
  loadExample(): Promise<StructureMetadata>;
  resetCamera(): void;
  dispose(): void;
}
