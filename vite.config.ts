import { defineConfig } from 'vitest/config';
import { sceneExports } from './server/exports';
import { macLibrary } from './server/library';
import { sharedSessions } from './server/sessions';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react(), macLibrary(), sceneExports(), sharedSessions()], test: { include: ['tests/viewer/**/*.test.ts'] } });
