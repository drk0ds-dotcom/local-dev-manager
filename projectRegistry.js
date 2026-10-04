const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { readProjectData, writeProjectData, applyProjectChange } = require('./projectStore');

function createProjectRegistry({ userDataDir, appDir, createId = () => crypto.randomUUID(), fileSystem = fs }) {
  let projects = {};
  let writable = true;
  let issue = null;
  let projectsPath = path.join(userDataDir, 'projects.json');

  function load() {
    const currentPath = path.join(userDataDir, 'projects.json');
    const legacyPath = path.join(appDir, 'projects.json');
    projectsPath = currentPath;
    let legacyReadOnly = false;
    let copyError = null;

    if (!fileSystem.existsSync(currentPath) && fileSystem.existsSync(legacyPath)) {
      try {
        fileSystem.copyFileSync(legacyPath, currentPath);
      } catch (error) {
        projectsPath = legacyPath;
        legacyReadOnly = true;
        copyError = error;
      }
    }

    try {
      const result = readProjectData(projectsPath, fileSystem);
      writable = result.writable && !legacyReadOnly;
      issue = result.error || legacyReadOnly ? { ...result, error: result.error || copyError } : null;
      const loaded = {};
      let migrated = false;
      let index = 0;

      for (const [key, value] of Object.entries(result.projects)) {
        if (!value || !value.path) continue;
        const customCommand =
          typeof value.customCommand === 'string' && value.customCommand.trim() ? value.customCommand.trim() : null;
        if (Object.hasOwn(value, 'customCommand') && (!customCommand || customCommand.length > 2048)) {
          throw new Error(`Invalid custom command in project ${key}`);
        }
        const customPort = Number.isInteger(value.port) && value.port >= 1 && value.port <= 65535 ? value.port : null;
        const id = (typeof value.id === 'string' && value.id) || createId();
        if (!value.id) migrated = true;
        loaded[id] = {
          id,
          name: typeof value.name === 'string' && value.name ? value.name : key,
          path: value.path,
          port: customCommand ? customPort : Number.isInteger(value.port) ? value.port : 3000,
          autoStart: !!value.autoStart,
          autoRestart: !!value.autoRestart,
          group: typeof value.group === 'string' ? value.group : '',
          order: Number.isInteger(value.order) ? value.order : index,
          script: value.script === 'start' ? 'start' : 'dev',
          ...(customCommand ? { customCommand } : {})
        };
        index++;
      }
      projects = loaded;
      if (migrated && writable) {
        try {
          writeProjectData(projectsPath, projects, fileSystem);
        } catch (error) {
          issue = { error, backupPath: null };
        }
      }
    } catch (error) {
      projects = {};
      writable = false;
      issue = { error, backupPath: null };
    }
    return snapshot();
  }

  function snapshot() {
    return structuredClone(projects);
  }

  function get(id) {
    return projects[id] ? structuredClone(projects[id]) : undefined;
  }

  function apply(mutate) {
    if (!writable) return false;
    projects = applyProjectChange(projects, mutate, (next) => writeProjectData(projectsPath, next, fileSystem));
    return true;
  }

  return {
    load,
    snapshot,
    get,
    apply,
    isWritable: () => writable,
    loadIssue: () => issue,
    path: () => projectsPath
  };
}

module.exports = { createProjectRegistry };
