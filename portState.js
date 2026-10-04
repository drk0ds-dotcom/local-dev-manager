const isValidPort = (port) => Number.isInteger(port) && port >= 1 && port <= 65535;

async function resolveOpenPort(activePort, isPortInUse) {
  return isValidPort(activePort) && (await isPortInUse(activePort)) ? activePort : null;
}

module.exports = { resolveOpenPort };
