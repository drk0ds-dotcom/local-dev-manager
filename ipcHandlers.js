const path = require('node:path');
const { resolveOpenPort } = require('./portState');

const isValidPort = (port) => Number.isInteger(port) && port >= 1 && port <= 65535;

function registerIpcHandlers({
  ipcMain,
  getWindow,
  registry,
  logs,
  manager,
  tray,
  ports,
  shell,
  dialog,
  fs,
  createId,
  findFreePort,
  startManagedProject,
  isPackageManagerAvailable,
  detectPackageManager,
  openInCode,
  isPortInUse,
  msg,
  setLanguage,
  logCap
}) {
  const listeners = [];
  const handled = [];
  let selectionRevision = 0;
  let pendingSelection = null;
  const known = (id) => typeof id === 'string' && !!registry.get(id);
  const snapshot = () => registry.snapshot();
  const sendLog = (id, type, message) => logs.append(id, type, message);
  const sendProjects = () => getWindow()?.webContents.send('projects-data', snapshot());

  function on(channel, handler) {
    ipcMain.on(channel, handler);
    listeners.push([channel, handler]);
  }

  function handle(channel, handler) {
    ipcMain.handle(channel, handler);
    handled.push(channel);
  }

  function commit(mutate) {
    if (!registry.isWritable()) {
      sendLog('__system__', 'error', msg('projectsReadOnly'));
      return false;
    }
    try {
      return registry.apply(mutate);
    } catch (error) {
      dialog.showErrorBox(msg('projectsSaveTitle'), msg('projectsSaveFailed', error.message));
      return false;
    }
  }

  on('get-log-cap', (event) => {
    event.returnValue = logCap;
  });
  on('app-close', () => getWindow()?.close());
  on('app-minimize', () => getWindow()?.minimize());
  on('app-maximize', () => {
    const win = getWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });

  const addError = (key, ...args) => getWindow()?.webContents.send('add-project-error', msg(key, ...args));
  const sameFolder = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
  const duplicateFolder = (folderPath) =>
    Object.values(snapshot()).some((project) => sameFolder(project.path, folderPath));
  const readNodeScript = (folderPath) => {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(folderPath, 'package.json'), 'utf8'));
      if (typeof packageJson.scripts?.dev === 'string' && packageJson.scripts.dev.trim()) return 'dev';
      if (typeof packageJson.scripts?.start === 'string' && packageJson.scripts.start.trim()) return 'start';
    } catch {
      // A custom project does not require package.json.
    }
    return null;
  };

  on('add-project', async () => {
    const revision = ++selectionRevision;
    pendingSelection = null;
    if (!registry.isWritable()) {
      addError('projectsReadOnly');
      return;
    }
    const result = await dialog.showOpenDialog(getWindow(), {
      properties: ['openDirectory'],
      title: msg('chooseFolder')
    });
    if (revision !== selectionRevision || result.canceled || !result.filePaths?.[0]) return;
    const folderPath = path.resolve(result.filePaths[0]);
    const projectName = path.basename(folderPath);
    if (duplicateFolder(folderPath)) {
      addError('alreadyExists', projectName);
      return;
    }
    const script = readNodeScript(folderPath);
    const reservedPorts = Object.values(snapshot())
      .map((project) => project.port)
      .filter(isValidPort);
    const suggestedPort = script ? await findFreePort(3000, reservedPorts) : null;
    if (revision !== selectionRevision) return;
    pendingSelection = { folderPath, projectName };
    getWindow()?.webContents.send('add-project-selection', {
      name: projectName,
      path: folderPath,
      hasNodeScript: !!script,
      script,
      suggestedPort
    });
  });

  on('cancel-add-project', () => {
    ++selectionRevision;
    pendingSelection = null;
  });

  on('create-project', (event, config) => {
    if (!registry.isWritable()) return addError('projectsReadOnly');
    if (!pendingSelection || !config || typeof config !== 'object' || Array.isArray(config))
      return addError('invalidProjectConfig');
    if (Object.keys(config).some((key) => !['mode', 'customCommand', 'port'].includes(key)))
      return addError('invalidProjectConfig');
    const { folderPath, projectName } = pendingSelection;
    try {
      if (!fs.statSync(folderPath).isDirectory()) return addError('invalidProjectFolder');
    } catch {
      return addError('invalidProjectFolder');
    }
    if (duplicateFolder(folderPath)) return addError('alreadyExists', projectName);
    if (config.mode !== 'node' && config.mode !== 'custom') return addError('invalidProjectConfig');
    let script = 'dev';
    let customCommand;
    let port = config.port;
    if (config.mode === 'node') {
      script = readNodeScript(folderPath);
      if (!script) return addError('noDevStart', projectName);
      if (!isValidPort(port)) return addError('invalidProjectPort');
    } else {
      customCommand = typeof config.customCommand === 'string' ? config.customCommand.trim() : '';
      if (!customCommand || customCommand.length > 2048) return addError('invalidCustomCommand');
      if (port === undefined) port = null;
      if (port !== null && !isValidPort(port)) return addError('invalidProjectPort');
    }
    if (port !== null && Object.values(snapshot()).some((project) => project.port === port))
      return addError('projectPortClash', port);
    const id = createId();
    const added = {
      id,
      name: projectName,
      path: folderPath,
      port,
      autoStart: false,
      autoRestart: false,
      group: '',
      order: Object.keys(snapshot()).length,
      script,
      ...(customCommand ? { customCommand } : {})
    };
    if (
      !commit((next) => {
        next[id] = added;
      })
    )
      return addError('projectsSaveFailed');
    pendingSelection = null;
    sendProjects();
    sendLog(id, 'log', msg('addedProject', projectName, customCommand || script, port ?? '—'));
  });

  on('remove-project', (event, id) => {
    if (!known(id)) return;
    const project = registry.get(id);
    if (
      !commit((next) => {
        delete next[id];
      })
    )
      return;
    manager.forgetProject(id, project, getWindow());
    ports.delete(id);
    logs.remove(id).catch((error) => console.error('Failed to remove project log:', error.message));
    sendProjects();
  });

  on('update-port', (event, payload) => {
    if (!known(payload?.id)) return;
    const id = payload.id;
    const project = registry.get(id);
    if (!(isValidPort(payload.port) || (payload.port === null && !!project.customCommand))) {
      getWindow()?.webContents.send('project-settings-error', msg('invalidProjectPort'));
      return;
    }
    const clash = Object.values(snapshot()).find((project) => project.id !== id && project.port === payload.port);
    if (clash) {
      sendLog(id, 'warn', msg('portClash', payload.port, clash.name));
      sendProjects();
      return;
    }
    if (
      !commit((next) => {
        next[id].port = payload.port;
      })
    )
      return;
    if (payload.port === null || manager.getStatus(id) !== 'running') ports.delete(id);
    sendProjects();
    sendLog(id, 'system', payload.port === null ? msg('portRemoved') : msg('portChanged', payload.port));
  });

  on('update-custom-command', (event, payload) => {
    if (!known(payload?.id) || !registry.get(payload.id).customCommand) return;
    const command = typeof payload.command === 'string' ? payload.command.trim() : '';
    if (!command || command.length > 2048) {
      getWindow()?.webContents.send('project-settings-error', msg('invalidCustomCommand'));
      return;
    }
    if (
      !commit((next) => {
        next[payload.id].customCommand = command;
      })
    )
      return;
    sendProjects();
    sendLog(payload.id, 'system', msg('customCommandChanged'));
  });

  on('toggle-autostart', (event, id) => {
    if (!known(id)) return;
    if (
      commit((next) => {
        next[id].autoStart = !next[id].autoStart;
      })
    )
      sendProjects();
  });
  on('toggle-autorestart', (event, id) => {
    if (!known(id)) return;
    if (
      commit((next) => {
        next[id].autoRestart = !next[id].autoRestart;
      })
    )
      sendProjects();
  });
  on('update-group', (event, payload) => {
    if (!known(payload?.id)) return;
    const group = typeof payload.group === 'string' ? payload.group.trim().slice(0, 40) : '';
    if (
      commit((next) => {
        next[payload.id].group = group;
      })
    )
      sendProjects();
  });
  on('reorder-projects', (event, orderedIds) => {
    if (!Array.isArray(orderedIds)) return;
    const ids = new Set(Object.keys(snapshot()));
    if (
      commit((next) => {
        orderedIds
          .filter((id) => ids.has(id))
          .forEach((id, index) => {
            next[id].order = index;
          });
      })
    )
      sendProjects();
  });

  on('send-input', (event, payload) => {
    if (!known(payload?.id) || typeof payload.text !== 'string') return;
    if (!manager.writeStdin(payload.id, payload.text.slice(0, 2000))) {
      sendLog(payload.id, 'warn', msg('stdinNotRunning'));
    }
  });
  on('start', async (event, id) => {
    await startManagedProject(id);
  });
  on('stop', (event, id) => {
    if (!known(id)) return;
    ports.delete(id);
    manager.stopProject(id, registry.get(id), getWindow());
  });
  on('restart', async (event, id) => {
    if (!known(id)) return;
    const project = registry.get(id);
    const packageManager = project.customCommand ? null : detectPackageManager(project.path);
    if (packageManager && !(await isPackageManagerAvailable(packageManager))) {
      sendLog(id, 'error', msg('packageManagerUnavailable', packageManager));
      return;
    }
    ports.delete(id);
    manager.restartProject(id, project, getWindow());
  });
  on('open', async (event, payload) => {
    if (!known(payload?.id)) return;
    const id = payload.id;
    if (manager.getStatus(id) !== 'running') return;
    if (registry.get(id).port === null) return;
    const port = await resolveOpenPort(ports.get(id), isPortInUse);
    if (!port || manager.getStatus(id) !== 'running') return;
    shell.openExternal(`http://localhost:${port}`);
  });
  on('open-folder', (event, id) => {
    if (known(id)) shell.openPath(registry.get(id).path);
  });
  on('open-in-code', (event, id) => {
    if (known(id)) openInCode(registry.get(id).path, () => sendLog(id, 'warn', msg('openInCodeFailed')));
  });
  on('export-logs', async (event, payload) => {
    if (!known(payload?.id) || typeof payload.content !== 'string' || payload.content.length > 5_000_000) return;
    const id = payload.id;
    const result = await dialog.showSaveDialog(getWindow(), {
      title: msg('exportLogsTitle'),
      defaultPath: `${registry.get(id).name}-logs.txt`,
      filters: [{ name: 'Text', extensions: ['txt'] }]
    });
    if (result.canceled || !result.filePath) return;
    try {
      fs.writeFileSync(result.filePath, payload.content, 'utf8');
      sendLog(id, 'system', msg('logsExported', result.filePath));
    } catch (error) {
      sendLog(id, 'error', msg('logsExportFailed', error.message));
    }
  });
  on('set-language', (event, language) => {
    if (language !== 'en' && language !== 'ar') return;
    setLanguage(language);
    tray.refreshLanguage();
  });
  handle('check-port', async (event, port) => (isValidPort(port) ? isPortInUse(port) : true));
  on('clear-logs', (event, id) => {
    if (!known(id)) return;
    logs.clear(id).catch((error) => console.error('Failed to clear project log:', error.message));
  });

  return () => {
    for (const [channel, listener] of listeners) ipcMain.removeListener(channel, listener);
    for (const channel of handled) ipcMain.removeHandler(channel);
  };
}

module.exports = { registerIpcHandlers };
