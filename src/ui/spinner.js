import ora from 'ora';

import { getPhaseTheme, icons } from './theme.js';

function formatMessage(phase, message) {
  const theme = getPhaseTheme(phase);
  return `${theme.color(theme.label)} ${message}`;
}

export function createPhaseSpinner(phase, message, options = {}) {
  const theme = getPhaseTheme(phase);
  const spinner = ora({
    color: theme.oraColor,
    isEnabled: options.isEnabled,
    spinner: theme.spinner,
    text: formatMessage(phase, message),
  });

  return {
    start(nextMessage = message) {
      spinner.text = formatMessage(phase, nextMessage);
      spinner.start();
      return this;
    },
    update(nextMessage) {
      spinner.text = formatMessage(phase, nextMessage);
      return this;
    },
    succeed(nextMessage = 'Complete') {
      spinner.succeed(formatMessage(phase, `${icons.success} ${nextMessage}`));
      return this;
    },
    fail(nextMessage = 'Failed') {
      spinner.fail(formatMessage(phase, `${icons.error} ${nextMessage}`));
      return this;
    },
    warn(nextMessage = 'Warning') {
      spinner.warn(formatMessage(phase, `${icons.warning} ${nextMessage}`));
      return this;
    },
    stop() {
      spinner.stop();
      return this;
    },
    raw: spinner,
  };
}

export async function withPhaseSpinner(phase, message, task, options = {}) {
  const spinner = createPhaseSpinner(phase, message, options).start();

  try {
    const result = await task(spinner);
    spinner.succeed(options.successMessage ?? 'Complete');
    return result;
  } catch (error) {
    spinner.fail(error.message);
    throw error;
  }
}
