import chalk from 'chalk';
import gradient from 'gradient-string';

export const phaseOrder = ['ping', 'download', 'upload'];

export const icons = {
  error: '[x]',
  info: '[i]',
  success: '[OK]',
  warning: '[!]',
};

export const phases = {
  diagnose: {
    label: 'Diagnose',
    color: chalk.green,
    gradient: gradient(['green', 'cyan']),
    oraColor: 'green',
    spinner: 'dots',
  },
  ping: {
    label: 'Ping',
    color: chalk.cyan,
    gradient: gradient(['cyan', 'white']),
    oraColor: 'cyan',
    spinner: 'dots',
  },
  download: {
    label: 'Download',
    color: chalk.blue,
    gradient: gradient(['blue', 'cyan']),
    oraColor: 'blue',
    spinner: 'line',
  },
  upload: {
    label: 'Upload',
    color: chalk.magenta,
    gradient: gradient(['magenta', 'cyan']),
    oraColor: 'magenta',
    spinner: 'dots12',
  },
};

export const thresholds = {
  ping: {
    fast: 40,
    ok: 100,
  },
  download: {
    fast: 100,
    ok: 25,
  },
  upload: {
    fast: 40,
    ok: 10,
  },
};

export function getPhaseTheme(phase) {
  const theme = phases[phase];

  if (!theme) {
    throw new TypeError(`Unknown phase: ${phase}`);
  }

  return theme;
}

export function colorLatency(value) {
  if (value <= thresholds.ping.fast) {
    return chalk.green(value);
  }

  if (value <= thresholds.ping.ok) {
    return chalk.yellow(value);
  }

  return chalk.red(value);
}

export function colorSpeed(phase, value) {
  const threshold = thresholds[phase];

  if (!threshold) {
    throw new TypeError(`Unknown speed threshold phase: ${phase}`);
  }

  if (value >= threshold.fast) {
    return chalk.green(value);
  }

  if (value >= threshold.ok) {
    return chalk.yellow(value);
  }

  return chalk.red(value);
}

export function formatPhaseLabel(phase) {
  const theme = getPhaseTheme(phase);
  return theme.color(theme.label.padEnd(8));
}
