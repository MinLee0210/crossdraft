import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } }, // same "@/..." imports as the app
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60000 }
});
