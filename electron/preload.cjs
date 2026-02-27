const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hostKernel', {
  platform: process.platform,
  runtime: 'electron',
  openSubAppWindow: (entryPath) => ipcRenderer.invoke('host:open-subapp-window', entryPath)
});

contextBridge.exposeInMainWorld('hostMarket', {
  fetchSnapshot: () => ipcRenderer.invoke('market:fetch-snapshot'),
  fetchKline: (symbol, period, startDate, endDate) =>
    ipcRenderer.invoke('market:fetch-kline', symbol, period, startDate, endDate),
  fetchStockKline: (symbol, period, startDate, endDate, adjust) =>
    ipcRenderer.invoke('market:fetch-stock-kline', symbol, period, startDate, endDate, adjust ?? 'qfq'),
  fetchIntraday: (symbol, period, adjust) =>
    ipcRenderer.invoke('market:fetch-intraday', symbol, period ?? '1', adjust ?? ''),
});

ipcRenderer.on('host:dev-log', (_event, payload) => {
  const text = typeof payload?.text === 'string' ? payload.text : '';
  if (!text) {
    return;
  }
  const normalizedText = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (!normalizedText) {
    return;
  }
  const prefix = payload?.stream === 'stderr' ? '[main:stderr]' : '[main:stdout]';
  console.log(prefix, normalizedText);
});
