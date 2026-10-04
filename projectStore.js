const fs = require('node:fs');
const crypto = require('node:crypto');

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
    const backupPath = `${file}.corrupt-${Date.now()}-${crypto.randomUUID()}`;
    try {
      fileSystem.copyFileSync(file, backupPath, fs.constants.COPYFILE_EXCL);
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

module.exports = { readProjectData, writeProjectData, applyProjectChange };
