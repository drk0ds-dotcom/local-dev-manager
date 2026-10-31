const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Remove keeps the selected project and logs until a projects-data deletion is confirmed', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  const removeStart = source.indexOf('function removeProject(');
  const removeEnd = source.indexOf('\n}', removeStart) + 2;
  const dataStart = source.indexOf('window.api.onProjectsData(');
  const dataEnd = source.indexOf('\n});', dataStart) + 4;
  assert.ok(removeStart >= 0 && removeEnd > removeStart && dataStart >= 0 && dataEnd > dataStart);

  let projectsData;
  const removed = [];
  const elements = {
    'project-view': { style: { display: 'flex' } },
    'empty-state': { style: { display: 'none' } }
  };
  const context = {
    window: {
      api: {
        remove: (id) => removed.push(id),
        onProjectsData: (callback) => {
          projectsData = callback;
        }
      }
    },
    document: { getElementById: (id) => elements[id] },
    confirm: () => true,
    t: () => 'Remove?',
    projectName: () => 'One',
    projects: { one: { id: 'one', name: 'One' } },
    currentProject: 'one',
    projectLogs: { one: [{ type: 'log', message: 'before stop' }] },
    projectPorts: { one: 3000 },
    projectResourceStatus: { one: { available: true } },
    projectStatus: { one: 'running' },
    projectBadgeText: { one: { en: 'Running' } },
    runningSince: { one: 123 },
    addDialog: { open: false },
    addSelection: null,
    renderSidebar: () => {},
    selectProject: () => {},
    updateMeta: () => {},
    syncPortInput: () => {},
    syncCustomCommand: () => {},
    syncGroupInput: () => {},
    updateAutoStartBtn: () => {},
    updateAutoRestartBtn: () => {},
    refreshPortStatus: () => {}
  };
  vm.createContext(context);
  vm.runInContext(source.slice(removeStart, removeEnd), context);
  vm.runInContext(source.slice(dataStart, dataEnd), context);

  vm.runInContext("removeProject({ stopPropagation() {} }, 'one')", context);
  assert.deepEqual(removed, ['one']);
  assert.equal(context.currentProject, 'one');
  assert.equal(context.projectLogs.one[0].message, 'before stop');
  assert.equal(elements['project-view'].style.display, 'flex');

  // On failed Stop there is no deletion snapshot; the user can still retry.
  projectsData({ one: { id: 'one', name: 'One' } });
  assert.equal(context.currentProject, 'one');
  assert.equal(context.projectLogs.one[0].message, 'before stop');

  projectsData({});
  assert.equal(context.currentProject, null);
  assert.equal(context.projectLogs.one, undefined);
  assert.equal(context.projectPorts.one, undefined);
  assert.equal(context.projectResourceStatus.one, undefined);
  assert.equal(context.projectStatus.one, undefined);
  assert.equal(context.projectBadgeText.one, undefined);
  assert.equal(context.runningSince.one, undefined);
  assert.equal(elements['project-view'].style.display, 'none');
});
