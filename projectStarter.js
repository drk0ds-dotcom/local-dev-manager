async function startProjectWithChecks({
  id,
  project,
  npmAvailable,
  status,
  win,
  isPortInUse,
  startProject,
  sendLog,
  npmUnavailableMessage,
  portBusyMessage
}) {
  if (!npmAvailable) {
    sendLog(id, 'error', npmUnavailableMessage);
    return 'npm-unavailable';
  }

  if (status !== 'stopped') {
    startProject(id, project, win);
    return 'already-running';
  }

  if (await isPortInUse(project.port)) {
    sendLog(id, 'error', portBusyMessage(project.port));
    return 'port-busy';
  }

  startProject(id, project, win);
  return 'started';
}

module.exports = { startProjectWithChecks };
