# Contributing to Local Dev Manager

Thanks for helping improve the project. Please discuss significant behavior changes in an issue before investing in a large patch. For a bug, include the operating system, app version, package manager, reproduction steps, expected behavior, and a sanitized log excerpt. Do not post credentials, private paths, or full logs containing secrets.

## Local development

The verified development and packaging environment for v1.0.0 is Windows x64. Install Node.js and npm, then run:

```powershell
npm ci
npm test
npm start
```

Run `npm run dist` when changing packaging or update behavior. Keep code changes focused and add a test when a behavior can regress. Please include the commands you ran and their results in a pull request.

The repository excludes `node_modules/`, `dist/`, local `projects.json`, environment files, keys, certificates, and temporary artwork. Do not force-add them. The MIT license applies to contributions submitted to this repository.

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for participation guidelines.
