const fs = require('node:fs');
const path = require('node:path');

const { createLogPersistence } = require('./logPersistence');

function createLogService({ directory, cap, isKnownId, send, onError = () => {} }) {
  const history = {};
  const persistence = createLogPersistence({ directory, cap, onError });

  function load() {
    try {
      if (!fs.existsSync(directory)) return snapshot();
      for (const file of fs.readdirSync(directory)) {
        if (!file.endsWith('.log')) continue;
        const id = file.slice(0, -4);
        const entries = fs
          .readFileSync(path.join(directory, file), 'utf8')
          .split('\n')
          .filter(Boolean)
          .slice(-cap)
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter((entry) => entry && typeof entry.type === 'string' && typeof entry.message === 'string');
        history[id] = entries;
        persistence.setLineCount(id, entries.length);
      }
    } catch (error) {
      onError(error);
    }
    return snapshot();
  }

  function snapshot() {
    return structuredClone(history);
  }

  function append(id, type, message) {
    if (id !== '__system__' && !isKnownId(id)) return;
    if (id !== '__system__') {
      if (!history[id]) history[id] = [];
      const entry = { type, message };
      history[id].push(entry);
      if (history[id].length > cap) history[id].shift();
      persistence.append(id, entry, history[id]);
    }
    send('project-log', { id, type, message });
  }

  function remove(id) {
    delete history[id];
    return persistence.remove(id);
  }

  function clear(id) {
    history[id] = [];
    return persistence.clear(id);
  }

  return { load, snapshot, append, remove, clear, close: () => persistence.close() };
}

module.exports = { createLogService };
