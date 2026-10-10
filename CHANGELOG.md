# Changelog

## 1.0.1 — pending publication

- Keep the project in `Stopping` until its process actually closes. If termination fails, show `Stop failed` with the PID, permit Stop to be retried, and keep app shutdown bounded without claiming a live process was stopped.
- Confirm a listening port before showing `Running`; detect `Server started on PORT` output and explain when a live process has not opened its configured port.
- Protect the complete project list when one saved entry has an invalid command or missing path: preserve the original file, create a `.corrupt-*` copy, and name the affected project. Show an error dialog when Add Project is unavailable in read-only mode.
- Run the eight previously conditional Go, Python, pnpm, Yarn, and Bun integration tests on Windows with temporary isolated tools. Local source verification: 156 tests passed, none failed or skipped; lint and formatting checks passed. An earlier 1.0.1 installer preserved the saved project during a Sandbox upgrade and displayed the read-only Add Project dialog; the newly rebuilt installer requires its own repeat upgrade check.
- Split Windows CI into fast checks and a full integration job that provisions Go, Python, pnpm, Yarn, and Bun and fails if any test is skipped. The updated GitHub Actions jobs must still run successfully before publication is complete.

## 1.0.0 — revised Windows installer (2026-10-04)

- Add trusted custom commands for local projects without requiring `package.json` or a Node.js package manager. A port is optional for background workers; a configured server port is verified before showing Running.
- Add an English/Arabic configuration dialog, command editor, no-port state, and local-execution warning.
- Verify a Python 3.14 worker, Flask and Uvicorn servers, and a local HTTP server; verify a real Go HTTP server using an official portable Go runtime without system installation.
- The version number remains `1.0.0`: existing installations require a manual download and reinstall because the in-app updater does not treat another build with the same version as an update. The original `v1.0.0` tag and GitHub-generated source archives remain at the first release; the revised source is on `main`.

## 1.0.0 — original release (2026-09-28)

Initial public Windows x64 release of Local Dev Manager. It manages local Node.js project processes, ports, output and saved logs, optional autostart and crash restart, an English/Arabic desktop UI, a system tray, and packaged-app update checks. See the [release notes](docs/releases/v1.0.0.md) for downloads and installation details.
