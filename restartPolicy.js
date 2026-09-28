function createRestartPolicy({ maxAttempts = 5, baseDelayMs = 1000, maxDelayMs = 10000 } = {}) {
  const attempts = new Map();

  function reset(id) {
    attempts.delete(id);
  }

  function next(id) {
    const completedAttempts = attempts.get(id) || 0;
    if (completedAttempts >= maxAttempts) {
      reset(id);
      return null;
    }

    const attempt = completedAttempts + 1;
    attempts.set(id, attempt);

    return {
      attempt,
      delayMs: Math.min(baseDelayMs * Math.pow(2, completedAttempts), maxDelayMs)
    };
  }

  return { next, reset };
}

module.exports = { createRestartPolicy };
