import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 务必确保这里的名字和你仓库名一模一样
  base: '/Beautiful-Christmas-Tree/', 
  
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
});
