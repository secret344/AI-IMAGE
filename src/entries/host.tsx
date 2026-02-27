import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/index.css';
import '@/i18n';
import { HostApp } from '@host/HostApp';
import { ThemeProvider } from '@image-studio/components/providers/ThemeProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <HostApp />
    </ThemeProvider>
  </React.StrictMode>
);
