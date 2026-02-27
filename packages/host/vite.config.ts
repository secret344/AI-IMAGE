import path from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.config';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: path.resolve(__dirname, '../../'),
    css: {
      postcss: {
        plugins: [
          tailwindcss({ config: path.resolve(__dirname, '../../tailwind.config.cjs') }),
          autoprefixer()
        ]
      }
    },
    build: {
      outDir: 'dist/host',
      rollupOptions: {
        input: path.resolve(__dirname, './index.html')
      }
    }
  })
);
