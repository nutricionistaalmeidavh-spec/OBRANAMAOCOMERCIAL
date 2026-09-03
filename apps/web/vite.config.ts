import { defineConfig } from 'vite';
export default defineConfig({
  base:'./',
  build:{rollupOptions:{input:['index.html','sistema.html','gestao.html','obra.html','universidade.html'],maxParallelFileOps:128}}
});
