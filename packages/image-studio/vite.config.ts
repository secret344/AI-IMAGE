import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

function manualVendorChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (
    id.includes('/react/') ||
    id.includes('react-dom') ||
    id.includes('scheduler') ||
    id.includes('jsx-runtime')
  ) {
    return 'vendor-react';
  }

  if (id.includes('react-router') || id.includes('react-router-dom')) {
    return 'vendor-router';
  }

  if (id.includes('i18next') || id.includes('react-i18next')) {
    return 'vendor-i18n';
  }

  if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('micromark')) {
    return 'vendor-markdown';
  }

  if (
    id.includes('@radix-ui') ||
    id.includes('react-hook-form') ||
    id.includes('lucide-react') ||
    id.includes('class-variance-authority') ||
    id.includes('tailwind-merge') ||
    id.includes('/clsx/')
  ) {
    return 'vendor-ui';
  }

  if (id.includes('/chart.js/') || id.includes('react-chartjs-2')) {
    return 'vendor-chart';
  }

  if (id.includes('/jszip/')) {
    return 'vendor-jszip';
  }

  if (id.includes('/dexie/')) {
    return 'vendor-dexie';
  }

  if (id.includes('/zod/')) {
    return 'vendor-zod';
  }

  if (id.includes('exifreader') || id.includes('browser-image-compression')) {
    return 'vendor-image';
  }

  return undefined;
}

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@image-studio': path.resolve(__dirname, './src'),
      '@ui': path.resolve(__dirname, '../ui/src'),
      '@': path.resolve(__dirname, './src')
    }
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(__dirname, './tailwind.config.cjs') }),
        autoprefixer()
      ]
    }
  },
  build: {
    outDir: path.resolve(__dirname, './dist'),
    rollupOptions: {
      input: path.resolve(__dirname, './index.html'),
      output: {
        manualChunks: manualVendorChunks
      }
    }
  }
});
