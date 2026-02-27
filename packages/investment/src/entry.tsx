import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles/index.css';
import './i18n';
import { InvestmentApp } from '@investment/InvestmentApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <div className="min-h-screen bg-background p-4 text-foreground">
        <InvestmentApp />
      </div>
    </HashRouter>
  </React.StrictMode>
);
