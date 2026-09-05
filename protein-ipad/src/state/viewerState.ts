import type { StructureMetadata, SelectionState } from '../viewer/types';
export interface AppState { structure?: StructureMetadata; selection: SelectionState; loading: boolean; error?: string; }
export const initialState: AppState = { loading: false, selection: { residues: [] } };
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Unable to open the structure. Please try another file.'; }
