<div align="center">

**English** · [العربية](README.ar.md) · [简体中文](README.zh-CN.md)

# Local Dev Manager

Run and monitor local Node.js projects and trusted custom commands from one Windows desktop app.

[Download for Windows](https://github.com/drk0ds-dotcom/local-dev-manager/releases/latest) · [Report a bug](https://github.com/drk0ds-dotcom/local-dev-manager/issues/new?template=bug_report.yml) · [Contribute](CONTRIBUTING.md)

</div>

![A running local project in Local Dev Manager](docs/images/project-running.png)

Local Dev Manager is useful when you work on several local projects and want one place to start them, see their output, manage ports, and open their development servers. It runs each Node.js project's own `dev` or `start` script, or a custom command you enter for another local project. It is not a hosting service or a replacement for a project's runtime or package manager.

**Revised v1.0.0 installer:** The download now includes trusted custom commands as well as Node.js projects. If you installed the earlier v1.0.0 build, download and run the revised installer manually: the in-app updater does not recognize a different build with the same version number as a new update. The v1.0.0 tag and GitHub-generated source archives still refer to the original release; the revised source is on the `main` branch.

## Quick start

1. Download **Local-Dev-Manager-Setup-1.0.0.exe** from the [v1.0.0 release](https://github.com/drk0ds-dotcom/local-dev-manager/releases/tag/v1.0.0). This binary release is for **Windows x64**.
2. For Node.js projects, install [Node.js](https://nodejs.org/) with `npm` available in `PATH`. Install another package manager or runtime separately if your project needs it.
3. Run the installer, open Local Dev Manager, and choose **Add Project**.
4. For a Node.js project, select a folder containing a valid `package.json` with a `dev` or `start` script. For another local project, select **Custom command** and enter a trusted command. Confirm the settings, then press **Start**.

The app chooses an available port from 3000 when a project is added. It installs dependencies automatically with the detected package manager if `node_modules` is missing. Installation can run project-defined scripts, so add only projects you trust.

## What it does

| Area                           | Available behavior                                                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project lifecycle              | Add and remove local folders; start, stop, and restart each project; optionally start it when the app opens or restart it after a crash.                                                                                                        |
| Custom commands                | Select any local folder, choose **Custom command**, and enter a trusted command such as `python worker.py` or `go run .`. A port is optional; command changes take effect on the next start. The required runtime must be installed separately. |
| Package and framework handling | Detect npm, pnpm, yarn, or bun from `packageManager` or lockfiles; run `dev` when present, otherwise `start`; pass the selected port to recognized Vite, Next.js, and Angular scripts and provide `PORT`/`VITE_PORT` environment variables.     |
| Ports                          | Assign a free port, let you change it, show whether it is free or serving your project, and prevent a stopped project from starting on an occupied port.                                                                                        |
| Output                         | Stream output per project, retain recent logs locally, search, clear, or export logs, and send a line to the running project's standard input.                                                                                                  |
| Workspace                      | Search projects, arrange them by drag and drop or group name, and open the local URL, project folder, or VS Code.                                                                                                                               |
| Desktop                        | English and Arabic UI with RTL layout; system tray with show, stop all, and quit; CPU and memory polling for running process trees; packaged-app update checks through GitHub Releases.                                                         |

## Screenshots

These screenshots show manual use of the application, not automated test results. The running-project view is shown above; select any image below to open it at full size.

| Empty workspace                                                                                  | Stopped project                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| [![Empty Local Dev Manager workspace](docs/images/empty-state.png)](docs/images/empty-state.png) | [![Stopped local project in Local Dev Manager](docs/images/project-stopped.png)](docs/images/project-stopped.png) |

| Two running projects                                                                                                 | Arabic interface                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [![Two running projects in Local Dev Manager](docs/images/multiple-projects.png)](docs/images/multiple-projects.png) | [![Arabic Local Dev Manager interface](docs/images/arabic-interface.png)](docs/images/arabic-interface.png) |

## Typical workflow

```text
Choose a Node.js project folder
  → validate package.json and select dev/start
  → assign an available port
  → press Start (install dependencies if missing)
  → follow output and open localhost
  → stop or restart when needed
```

Removing a project removes it from the app's list and deletes its saved app log. It does **not** delete the project folder. Port changes take effect on the next start.

### Custom-command workflow

Choose **Add Project** and select a local folder. Choose **Custom command**, enter the exact command to run from that folder, and either leave the port empty for a background worker or enter the port your server will listen on. The command is executed through the Windows shell with your account's permissions: use only commands and project folders you trust. The app does not install dependencies for custom projects. Install Python, Go, or another required runtime yourself and ensure the command can locate it (or use the executable's full path). For a portless worker, **Running** means its process spawned and remains alive; it does not imply an HTTP service. **Open** is disabled without a configured port. With a port, **Running** requires an actual socket connection to that port. Output and standard input use the same project log and input controls as Node.js projects. These settings and command text remain in local `userData`.

## Windows SmartScreen and installer verification

Windows SmartScreen may warn about this release because the installer does not have an established trusted code-signing reputation. A warning alone does not establish that a file is malicious, but do not bypass one for a file from an unknown source. Download only from this repository's [official GitHub Releases](https://github.com/drk0ds-dotcom/local-dev-manager/releases) and, if you want to verify the download, compare its SHA-256 hash against `SHA256SUMS.txt` attached to the same release:

```powershell
Get-FileHash -Algorithm SHA256 '.\Local-Dev-Manager-Setup-1.0.0.exe'
```

The installer is not claimed to be Microsoft certified or code signed.

## Data and privacy

Project settings are saved as `projects.json` in Electron's local `userData` directory. Logs are stored in its `logs` subdirectory, with the latest 500 entries retained per project in app memory and periodic disk compaction. The app runs commands against the local folders you select. The packaged app checks GitHub Releases for updates, but asks before downloading and again before installing; the project does not include an account or cloud sync service. Tajawal and IBM Plex Mono fonts are bundled locally, so opening the interface does not request them from Google Fonts. Logs may contain output from your own development tools, so review them before sharing an exported file.

## How it works

```text
index.html + renderer.js  ↔  preload.js  ↔  main.js  ↔  processManager.js
                                              ├─ projectStarter.js / restartPolicy.js
                                              ├─ projects.json and logs in userData
                                              └─ npm/pnpm/yarn/bun scripts or trusted custom commands
```

Electron's main process owns local data, dialogs, process control, and the system tray. The renderer owns the interface and receives a narrow IPC API through `preload.js`; Node integration is disabled and context isolation is enabled. `processManager.js` launches and watches development processes, while `projectStarter.js` checks the environment and port before starting and `restartPolicy.js` bounds crash retries. The current source uses Electron 44, JavaScript, `cross-spawn`, `pidusage`, `electron-updater`, and electron-builder/NSIS.

## Develop from source

You need Node.js, npm, and a supported Windows development environment. The exact dependency versions are locked in `package-lock.json`.

```powershell
npm ci
npm test
npm start
```

`LocalDevManager.bat` and `LocalDevManager.vbs` are optional Windows launchers for a source checkout after `npm ci`; they run `npm start` (the `.vbs` variant hides the command window). They are not the installer. For a normal installation, use the release `.exe` above.

To build the Windows installer locally:

```powershell
npm run dist
```

The Windows CI workflow runs dependency installation, tests, ESLint linting, and formatting checks. It does not publish releases automatically. For source orientation, start with [`main.js`](main.js), [`preload.js`](preload.js), [`processManager.js`](processManager.js), [`renderer.js`](renderer.js), and [`projectStarter.js`](projectStarter.js).

## Known limitations

- The published installer and automated verification target Windows x64. macOS and Linux builds are not verified for v1.0.0.
- The app UI is English/Arabic. Simplified Chinese is available for this README only.
- The revised v1.0.0 installer includes custom commands. Python 3.14 worker, Flask, Uvicorn, and HTTP-server flows, plus a Go HTTP server, were tested locally; Go used a temporary portable runtime rather than a system installation. Earlier v1.0.0 installations require a manual reinstall to receive this revision.
- Port forwarding depends on the framework or script honoring `--port`, `PORT`, or `VITE_PORT`; a custom script may ignore them.
- Automatic dependency installation and project scripts run local code from the selected project. Review a project's scripts and dependencies before starting it.

## Community and license

Read [Contributing](CONTRIBUTING.md), [Security](SECURITY.md), and the [Code of Conduct](CODE_OF_CONDUCT.md). Changes are recorded in [CHANGELOG.md](CHANGELOG.md). Local Dev Manager is released under the [MIT License](LICENSE), Copyright (c) 2026 Burayk.
