import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages: app nằm ở /seeds/timekeeping/
  base: '/seeds/timekeeping/',
  server: { port: 5173 },
});
