import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são lidas via import.meta.env
// (somente variáveis com prefixo VITE_ vão para o navegador; nunca coloque chaves secretas nelas).
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
