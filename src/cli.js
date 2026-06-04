import { readFileSync } from 'node:fs';

import { Command } from 'commander';

import { registerCommands } from './commands/index.js';
import { renderBanner } from './ui/index.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

export function createProgram() {
  const program = new Command();

  program
    .name('speedtest')
    .description('Run internet speed tests from the command line.')
    .version(packageJson.version, '-v, --version', 'display the CLI version')
    .showHelpAfterError()
    .addHelpText('beforeAll', () => `${renderBanner()}\n`);

  registerCommands(program);

  return program;
}

export async function runCli(argv = process.argv) {
  const program = createProgram();

  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(argv);
}
