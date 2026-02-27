import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

function contextualAtAlias() {
  return {
    name: 'contextual-at-alias',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      if (!source.startsWith('@/')) {
        return null;
      }

      const subPath = source.slice(2);
      const normalizedImporter = importer?.split(path.sep).join('/') ?? '';

      if (normalizedImporter.includes('/packages/image-studio/')) {
        return path.resolve(__dirname, './packages/image-studio/src', subPath);
      }

      if (normalizedImporter.includes('/packages/investment/')) {
        return path.resolve(__dirname, './packages/investment/src', subPath);
      }

      if (normalizedImporter.includes('/packages/host/')) {
        return path.resolve(__dirname, './packages/host/src', subPath);
      }

      return path.resolve(__dirname, './src', subPath);
    }
  };
}

export default defineConfig({
  plugins: [contextualAtAlias(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
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

          if (
            id.includes('react-markdown') ||
            id.includes('remark-gfm') ||
            id.includes('micromark')
          ) {
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
      }
    }
  },
  resolve: {
    alias: [
      {
        find: /^@ai-image\/contracts$/,
        replacement: path.resolve(__dirname, './packages/contracts/src/index.ts')
      },
      {
        find: /^@ai-image\/contracts\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/contracts/src/$1')
      },
      {
        find: /^@ui\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/ui/src/$1')
      },
      {
        find: /^@host\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/host/src/$1')
      },
      {
        find: /^@investment\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/investment/src/$1')
      },
      {
        find: /^@image-studio\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/$1')
      },
      {
        find: /^@\/components\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/components/$1')
      },
      {
        find: /^@\/config\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/config/$1')
      },
      {
        find: /^@\/hooks\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/hooks/$1')
      },
      {
        find: /^@\/lib\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/lib/$1')
      },
      {
        find: /^@\/modules\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/modules/$1')
      },
      {
        find: /^@\/state\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/state/$1')
      },
      {
        find: /^@\/types\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/types/$1')
      },
      {
        find: /^@\/utils\/(.*)$/,
        replacement: path.resolve(__dirname, './packages/image-studio/src/utils/$1')
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, './src')
      }
    ]
  }
});
