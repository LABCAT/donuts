// @ts-check
import { defineConfig } from 'astro/config';
import inject from '@rollup/plugin-inject';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: 'https://donuts.labcat.nz',
  devToolbar: { enabled: false },
  base: '/',
  vite: {
    plugins: [
      inject({
        p5: ['p5', 'default'],
        include: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
      }),
    ],
    resolve: {
      alias: {
        '@sketches': path.resolve(__dirname, 'src/sketches'),
        '@layouts': path.resolve(__dirname, 'src/layouts'),
        '@styles': path.resolve(__dirname, 'src/styles'),
        '@lib': path.resolve(__dirname, 'src/lib'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@': path.resolve(__dirname, 'src'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['import', 'global-builtin'],
        },
      },
    },
  },
});
