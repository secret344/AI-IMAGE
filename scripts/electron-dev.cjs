const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function runElectron(hostDevUrl) {
  const electronProcess = spawn('npx', ['electron', 'electron/main.cjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST_DEV_URL: hostDevUrl
    },
    stdio: 'inherit'
  });

  return electronProcess;
}

function start() {
  const watchFiles = [
    path.resolve(process.cwd(), 'electron/main.cjs'),
    path.resolve(process.cwd(), 'electron/preload.cjs')
  ];

  const hostProcess = spawn('npm', ['run', 'dev:host:pkg'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const watchers = [];
  let electronProcess = null;
  let hostDevUrl = null;
  let launched = false;
  let isShuttingDown = false;
  let shouldRestartElectron = false;
  let restartTimer = null;
  let lastRestartAt = 0;

  const stopAll = (exitCode) => {
    isShuttingDown = true;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }

    for (const watcher of watchers) {
      watcher.close();
    }

    if (electronProcess) {
      electronProcess.kill('SIGTERM');
      electronProcess = null;
    }

    hostProcess.kill('SIGTERM');
    process.exit(exitCode);
  };

  const launchElectron = () => {
    if (!hostDevUrl) {
      return;
    }

    process.stdout.write(`\n[electron:dev] Launching Electron with HOST_DEV_URL=${hostDevUrl}\n`);
    electronProcess = runElectron(hostDevUrl);
    electronProcess.on('exit', (code) => {
      if (isShuttingDown) {
        return;
      }

      if (shouldRestartElectron) {
        shouldRestartElectron = false;
        launchElectron();
        return;
      }

      stopAll(code ?? 0);
    });
  };

  const scheduleElectronRestart = (reason) => {
    if (!electronProcess || isShuttingDown) {
      return;
    }

    const now = Date.now();
    if (now - lastRestartAt < 800) {
      return;
    }

    if (restartTimer) {
      clearTimeout(restartTimer);
    }

    restartTimer = setTimeout(() => {
      lastRestartAt = Date.now();
      process.stdout.write(`\n[electron:dev] Detected ${reason}, restarting Electron...\n`);
      shouldRestartElectron = true;
      electronProcess?.kill('SIGTERM');
      restartTimer = null;
    }, 120);
  };

  for (const watchFile of watchFiles) {
    const watcher = fs.watch(watchFile, { persistent: true }, () => {
      scheduleElectronRestart(path.basename(watchFile));
    });
    watchers.push(watcher);
  }

  const onHostOutput = (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);

    if (launched) {
      return;
    }

    const matched = text.match(/Local:\s+(http:\/\/[^\s]+)/);
    if (!matched?.[1]) {
      return;
    }

    hostDevUrl = matched[1].replace(/\/$/, '');
    launched = true;
    launchElectron();
  };

  hostProcess.stdout.on('data', onHostOutput);
  hostProcess.stderr.on('data', (chunk) => process.stderr.write(chunk.toString()));

  hostProcess.on('exit', (code) => {
    if (isShuttingDown) {
      return;
    }

    if (!launched) {
      stopAll(code ?? 1);
    }
  });

  process.on('SIGINT', () => {
    stopAll(130);
  });

  process.on('SIGTERM', () => {
    stopAll(143);
  });
}

start();
