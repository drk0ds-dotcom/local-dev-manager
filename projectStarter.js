async function startProjectWithChecks({
  id,
  project,
  packageManager,
  isPackageManagerAvailable,
  status,
  win,
  isPortInUse,
  startProject,
  sendLog,
  packageManagerUnavailableMessage,
  portBusyMessage
}) {
  if (!project.customCommand && !(await isPackageManagerAvailable(packageManager))) {
    sendLog(id, 'error', packageManagerUnavailableMessage(packageManager));
    return 'package-manager-unavailable';
  }

  if (status !== 'stopped') {
    startProject(id, project, win);
    return 'already-running';
  }

  if (project.port != null && (await isPortInUse(project.port))) {
    sendLog(id, 'error', portBusyMessage(project.port));
    return 'port-busy';
  }

  startProject(id, project, win);
  return 'started';
}

module.exports = { startProjectWithChecks };
