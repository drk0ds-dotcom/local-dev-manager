const fs = require('node:fs');
const path = require('node:path');

function createLogPersistence({ directory, cap, fileSystem = fs, onError = () => {} }) {
  const pending = new Map();
  const lineCounts = new Map();
  let directoryReady = null;
  let queue = Promise.resolve();
  let timer = null;
  let closed = false;

  function ensureDirectory() {
    if (!directoryReady) directoryReady = fileSystem.promises.mkdir(directory, { recursive: true });
    return directoryReady;
  }

  function enqueue(operation) {
    const work = queue.then(operation);
    queue = work.catch(onError);
    return work;
  }

  function append(id, entry, retainedEntries) {
    if (closed) return;
    const batch = pending.get(id) || { entries: [], retainedEntries: [] };
    batch.entries.push(entry);
    batch.retainedEntries = retainedEntries;
    pending.set(id, batch);
    if (!timer)
      timer = setTimeout(() => {
        flush().catch(onError);
      }, 100);
  }

  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending.size) return queue;
    const batch = [...pending];
    pending.clear();
    return enqueue(async () => {
      await ensureDirectory();
      for (const [id, { entries, retainedEntries }] of batch) {
        const file = path.join(directory, `${id}.log`);
        const nextCount = (lineCounts.get(id) || 0) + entries.length;
        if (nextCount >= cap * 2) {
          const kept = retainedEntries.slice(-cap);
          await fileSystem.promises.writeFile(
            file,
            kept.map((item) => JSON.stringify(item)).join('\n') + (kept.length ? '\n' : ''),
            'utf8'
          );
          lineCounts.set(id, kept.length);
        } else {
          await fileSystem.promises.appendFile(
            file,
            entries.map((item) => JSON.stringify(item)).join('\n') + '\n',
            'utf8'
          );
          lineCounts.set(id, nextCount);
        }
      }
    });
  }

  function clear(id) {
    pending.delete(id);
    return enqueue(async () => {
      await ensureDirectory();
      await fileSystem.promises.writeFile(path.join(directory, `${id}.log`), '', 'utf8');
      lineCounts.set(id, 0);
    });
  }

  function remove(id) {
    pending.delete(id);
    return enqueue(async () => {
      try {
        await fileSystem.promises.unlink(path.join(directory, `${id}.log`));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      lineCounts.delete(id);
    });
  }

  async function close() {
    if (closed) return queue;
    do {
      await flush();
    } while (pending.size);
    closed = true;
    return queue;
  }

  return {
    append,
    flush,
    clear,
    remove,
    close,
    setLineCount: (id, count) => lineCounts.set(id, count)
  };
}

module.exports = { createLogPersistence };
