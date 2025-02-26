import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['mqtt'], // ✅ Vite will pre-bundle MQTT correctly
  },
});
