import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/index.css';
import '@/i18n';
import { Layout } from '@image-studio/components/Layout';
import { ThemeProvider } from '@image-studio/components/providers/ThemeProvider';
import { ImageStudioApp } from '@image-studio/ImageStudioApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Layout>
        <ImageStudioApp />
      </Layout>
    </ThemeProvider>
  </React.StrictMode>
);
