import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/index.css';
import '@/i18n';
import { Layout } from '@image-studio/components/Layout';
import { ThemeProvider } from '@image-studio/components/providers/ThemeProvider';
import { InvestmentApp } from '@investment/InvestmentApp';
import { KernelProvider } from '@host/kernel/KernelProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Layout>
        <KernelProvider activeAppId="investment" permissions={['storage', 'network', 'notify']}>
          <div className="h-full min-w-0 overflow-hidden">
            <InvestmentApp />
          </div>
        </KernelProvider>
      </Layout>
    </ThemeProvider>
  </React.StrictMode>
);
