const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = process.env.HOST_DEV_URL || 'http://localhost:5173';

let teardownDevLogMirror = null;

// ─── AKShare Python Query ─────────────────────────────────────────────────────

/**
 * Locate python3 executable. Override via env MARKET_PYTHON.
 * Defaults to the miniconda ollama-project env where akshare is installed.
 */
function findPython() {
  return (
    process.env.MARKET_PYTHON ||
    '/Users/zhao/miniconda3/envs/ollama-project/bin/python3'
  );
}

/**
 * Spawn a Python child process with a hard wall-clock timeout.
 * Returns { stdout, stderr } or throws on non-zero exit / timeout.
 */
function spawnPython(args, wallClockMs = 120000) {
  return new Promise((resolve, reject) => {
    const python = findPython();
    let stdout = '';
    let stderr = '';
    const env = { ...process.env, TQDM_DISABLE: '1', AKSHARE_PROGRESS: '0' };

    const child = spawn(python, args, { env });

    // Hard wall-clock kill — spawn({timeout}) is an idle timeout, not total time
    const killer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Python process timed out after ${wallClockMs}ms`));
    }, wallClockMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(killer);
      if (code === null) {
        reject(new Error('Python process was killed'));
        return;
      }
      if (code !== 0) {
        // Include both stderr (traceback) and stdout (JSON error payload) so
        // the caller can surface the real Python exception message.
        const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join(' | ');
        reject(new Error(`Python exited ${code}: ${detail.slice(0, 500)}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.on('error', (err) => {
      clearTimeout(killer);
      reject(new Error(`Failed to start python: ${err.message}`));
    });
  });
}

/**
 * Run akshare_query.py in snapshot mode.
 */
function runAKShareQuery() {
  return new Promise((resolve, reject) => {
    const scriptPath = isDev
      ? path.join(__dirname, 'akshare_query.py')
      : path.join(process.resourcesPath, 'akshare_query.py');

    spawnPython([scriptPath], 120000)
      .then(({ stdout }) => {
        const result = JSON.parse(stdout.trim());
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      })
      .catch(reject);
  });
}

/**
 * Run akshare_query.py in kline mode (index K-line).
 */
function runAKShareKline(symbol, period, startDate, endDate) {
  return new Promise((resolve, reject) => {
    const scriptPath = isDev
      ? path.join(__dirname, 'akshare_query.py')
      : path.join(process.resourcesPath, 'akshare_query.py');

    const args = [
      scriptPath,
      '--mode', 'kline',
      '--symbol', symbol,
      '--period', period,
    ];
    if (startDate) args.push('--start', startDate);
    if (endDate)   args.push('--end',   endDate);

    spawnPython(args, 120000)
      .then(({ stdout }) => {
        const result = JSON.parse(stdout.trim());
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      })
      .catch(reject);
  });
}

/**
 * Run akshare_query.py in stock_kline mode (individual A-share stock K-line, daily/weekly/monthly).
 */
function runAKShareStockKline(symbol, period, startDate, endDate, adjust) {
  return new Promise((resolve, reject) => {
    const scriptPath = isDev
      ? path.join(__dirname, 'akshare_query.py')
      : path.join(process.resourcesPath, 'akshare_query.py');

    const MINUTE_PERIODS = new Set(['5', '15', '30', '60']);
    const mode = MINUTE_PERIODS.has(String(period)) ? 'stock_kline_min' : 'stock_kline';

    const args = [
      scriptPath,
      '--mode', mode,
      '--symbol', symbol,
      '--period', String(period),
      '--adjust', adjust || 'qfq',
    ];
    if (startDate) args.push('--start', startDate);
    if (endDate)   args.push('--end',   endDate);

    spawnPython(args, 120000)
      .then(({ stdout }) => {
        const result = JSON.parse(stdout.trim());
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      })
      .catch(reject);
  });
}

/**
 * Run akshare_query.py in intraday mode (stock_zh_a_minute, Sina Finance).
 * Returns minute-level bars for the latest trading day only.
 */
function runAKShareIntraday(symbol, period, adjust) {
  return new Promise((resolve, reject) => {
    const scriptPath = isDev
      ? path.join(__dirname, 'akshare_query.py')
      : path.join(process.resourcesPath, 'akshare_query.py');

    const args = [
      scriptPath,
      '--mode', 'intraday',
      '--symbol', symbol,
      '--period', String(period || '1'),
      '--adjust', adjust || '',
    ];

    spawnPython(args, 60000)
      .then(({ stdout }) => {
        const result = JSON.parse(stdout.trim());
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      })
      .catch(reject);
  });
}

function resolveEntryPath(entryPath = '/packages/host/index.html') {
  if (!entryPath.startsWith('/')) {
    return `/${entryPath}`;
  }
  return entryPath;
}

function createWindow(entryPath = '/packages/host/index.html') {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(`${DEV_SERVER_URL}${resolveEntryPath(entryPath)}`);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  win.loadFile(path.join(__dirname, '../dist', resolveEntryPath(entryPath).replace(/^\//, '')));
}

function mirrorMainProcessLogsToRenderer() {
  if (!isDev) {
    return () => {};
  }

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  const broadcast = (stream, chunk, encoding) => {
    const text = typeof chunk === 'string' ? chunk : chunk.toString(encoding || 'utf8');
    if (!text) {
      return;
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('host:dev-log', { stream, text });
      }
    }
  };

  process.stdout.write = (chunk, encoding, callback) => {
    broadcast('stdout', chunk, encoding);
    return originalStdoutWrite(chunk, encoding, callback);
  };

  process.stderr.write = (chunk, encoding, callback) => {
    broadcast('stderr', chunk, encoding);
    return originalStderrWrite(chunk, encoding, callback);
  };

  return () => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  };
}

app.whenReady().then(() => {
  teardownDevLogMirror = mirrorMainProcessLogsToRenderer();
  createWindow('/packages/host/index.html');

  ipcMain.handle('host:open-subapp-window', (_event, entryPath) => {
    try {
      createWindow(resolveEntryPath(entryPath));
      return true;
    } catch (error) {
      console.error('Failed to open sub-app window:', error);
      return false;
    }
  });

  // ─── AKShare Market IPC Handler ────────────────────────────────────────────

  ipcMain.handle('market:fetch-snapshot', async () => {
    console.info('[market] Fetching A-share snapshot via AKShare Python...');
    const snapshot = await runAKShareQuery();
    console.info(`[market] Got ${snapshot.indices?.length ?? 0} indices`);
    return snapshot;
  });

  ipcMain.handle('market:fetch-kline', async (_event, symbol, period, startDate, endDate) => {
    console.info(`[market] Fetching index kline ${symbol} ${period} ${startDate}~${endDate}`);
    const result = await runAKShareKline(symbol, period, startDate, endDate);
    console.info(`[market] Got ${result.bars?.length ?? 0} bars`);
    return result;
  });

  ipcMain.handle('market:fetch-stock-kline', async (_event, symbol, period, startDate, endDate, adjust) => {
    console.info(`[market] Fetching stock kline ${symbol} ${period} ${adjust} ${startDate}~${endDate}`);
    const result = await runAKShareStockKline(symbol, period, startDate, endDate, adjust);
    console.info(`[market] Got ${result.bars?.length ?? 0} bars`);
    return result;
  });

  ipcMain.handle('market:fetch-intraday', async (_event, symbol, period, adjust) => {
    console.info(`[market] Fetching intraday ${symbol} period=${period ?? 1} adjust=${adjust ?? ''}`);
    try {
      const result = await runAKShareIntraday(symbol, period, adjust);
      console.info(`[market] Got ${result.bars?.length ?? 0} intraday bars (tradingDate: ${result.tradingDate})`);
      return result;
    } catch (err) {
      console.error(`[market:fetch-intraday] Python error for ${symbol}:`, err?.message ?? err);
      throw err;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow('/packages/host/index.html');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  teardownDevLogMirror?.();
  teardownDevLogMirror = null;
});
