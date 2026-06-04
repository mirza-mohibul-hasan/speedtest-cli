import chalk from 'chalk';

import { getConfig, resetConfig, saveConfig } from '../utils/index.js';

const SUPPORTED_KEYS = new Set(['historyLimit', 'theme', 'unit']);
const SUPPORTED_UNITS = new Set(['Mbps', 'MBps']);
const SUPPORTED_THEMES = new Set(['default', 'minimal']);

function assertSupportedKey(key) {
  if (!SUPPORTED_KEYS.has(key)) {
    throw new TypeError(`Unsupported config key: ${key}`);
  }
}

function parseConfigValue(key, value) {
  assertSupportedKey(key);

  if (key === 'historyLimit') {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new TypeError('historyLimit must be a positive integer.');
    }

    return parsed;
  }

  if (key === 'unit') {
    if (!SUPPORTED_UNITS.has(value)) {
      throw new TypeError('unit must be one of: Mbps, MBps.');
    }

    return value;
  }

  if (key === 'theme') {
    if (!SUPPORTED_THEMES.has(value)) {
      throw new TypeError('theme must be one of: default, minimal.');
    }

    return value;
  }

  return value;
}

function runSafely(action) {
  try {
    action();
  } catch (error) {
    console.error(chalk.red(error.message));
    process.exitCode = 1;
  }
}

export function registerConfigCommand(program) {
  const config = program
    .command('config')
    .description('View or update speedtest-cli settings.')
    .action(() => {
      console.log(JSON.stringify(getConfig(), null, 2));
    });

  config
    .command('set <key> <value>')
    .description('Set a config value.')
    .action((key, value) => {
      runSafely(() => {
        const parsedValue = parseConfigValue(key, value);

        saveConfig({ [key]: parsedValue });
        console.log(chalk.green(`${key}=${parsedValue}`));
      });
    });

  config
    .command('get <key>')
    .description('Get a config value.')
    .action((key) => {
      runSafely(() => {
        assertSupportedKey(key);
        console.log(getConfig()[key]);
      });
    });

  config
    .command('reset')
    .description('Reset config values to defaults.')
    .action(() => {
      resetConfig();
      console.log(chalk.green('Config reset to defaults.'));
    });
}
