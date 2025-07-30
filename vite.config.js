import { defineConfig } from 'vite';
import inject from '@rollup/plugin-inject';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  base: '/number-1/',
  build: {
    outDir: 'dist/number-1',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@audio': path.resolve(__dirname, 'src/audio'),
      '@demos': path.resolve(__dirname, 'src/demos'),
      '@lib': path.resolve(__dirname, 'src/lib'),
    },
  },
  plugins: [
    inject({ p5: 'p5' }),
    viteStaticCopy({
      targets: [
        { src: 'public/CNAME', dest: '../' } // put CNAME at dist root
      ]
    })
  ]
});
