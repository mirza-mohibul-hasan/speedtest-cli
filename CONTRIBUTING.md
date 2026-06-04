# Contributing

Thanks for helping improve speedtest-cli.

## Setup

```powershell
git clone https://github.com/mirza-mohibul-hasan/speedtest-cli.git
cd speedtest-cli
npm install
npm run lint
npm run smoke
```

## Pull Requests

1. Keep changes focused and production-ready.
2. Add or update verification commands when behavior changes.
3. Run `npm run lint` before opening a pull request.
4. Include screenshots or terminal output for UI changes.

## Code Style

The project uses ESM modules, ESLint, and Prettier.

```powershell
npm run format
npm run lint
```

Prefer small functional modules, clear error messages, and no hidden network work during help or version output.
