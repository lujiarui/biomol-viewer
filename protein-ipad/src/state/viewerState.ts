import type { StructureMetadata } from '../viewer/types';
export interface AppState { structure?: StructureMetadata; loading: boolean; error?: string; }
export const initialState: AppState = { loading: false };
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Unable to open the structure. Please try another file.'; }
