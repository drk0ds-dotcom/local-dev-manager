const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

function backupProjectData(file, fileSystem = fs) {
  const original = fileSystem.readFileSync(file);
  const directory = path.dirname(file);
  const prefix = `${path.basename(file)}.corrupt-`;
  for (const name of fileSystem.readdirSync(directory)) {
    if (!name.startsWith(prefix)) continue;
    const existingPath = path.join(directory, name);
    try {
      if (original.equals(fileSystem.readFileSync(existingPath))) return existingPath;
    } catch {
      // An unreadable old copy cannot prove this content is already backed up.
    }
  }
  const backupPath = `${file}.corrupt-${Date.now()}-${crypto.randomUUID()}`;
  fileSystem.copyFileSync(file, backupPath, fs.constants.COPYFILE_EXCL);
  return backupPath;
}

function readProjectData(file, fileSystem = fs) {
  if (!fileSystem.existsSync(file)) {
    return { projects: {}, writable: true, backupPath: null, error: null };
  }

  try {
    const projects = JSON.parse(fileSystem.readFileSync(file, 'utf8'));
    if (!projects || typeof projects !== 'object' || Array.isArray(projects)) {
      throw new Error('Project list must be an object');
    }
    return { projects, writable: true, backupPath: null, error: null };
  } catch (error) {
    try {
      const backupPath = backupProjectData(file, fileSystem);
      return { projects: {}, writable: false, backupPath, error };
    } catch (backupError) {
      return { projects: {}, writable: false, backupPath: null, error, backupError };
    }
  }
}

function writeProjectData(file, projects, fileSystem = fs) {
  const temporaryPath = `${file}.tmp-${crypto.randomUUID()}`;
  try {
    fileSystem.writeFileSync(temporaryPath, JSON.stringify(projects, null, 2), { flag: 'wx' });
    fileSystem.renameSync(temporaryPath, file);
  } catch (error) {
    try {
      fileSystem.unlinkSync(temporaryPath);
    } catch {
      // Keep the original write error if temporary-file cleanup fails.
    }
    throw error;
  }
}

function applyProjectChange(current, mutate, persist) {
  const next = structuredClone(current);
  mutate(next);
  persist(next);
  return next;
}

module.exports = { readProjectData, writeProjectData, applyProjectChange, backupProjectData };
