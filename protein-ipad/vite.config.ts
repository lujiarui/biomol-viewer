import { defineConfig } from 'vitest/config';
import { macLibrary } from './server/library';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react(), macLibrary()], test: { include: ['tests/viewer/**/*.test.ts'] } });
