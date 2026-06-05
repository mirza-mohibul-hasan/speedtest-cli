import chalk from 'chalk';

import { runNetworkDiagnostics } from '../core/index.js';
import { createPhaseSpinner, renderBanner, showDiagnostics } from '../ui/index.js';

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }

  return parsed;
}

function printJson(data) {
  console.log(JSON.stringify(data));
}

export function registerDiagnoseCommand(program) {
  program
    .command('diagnose [target]')
    .description('Run DNS, TCP, TLS, HTTP, and latency diagnostics.')
    .option('--json', 'print raw JSON without UI decorations')
    .option('--samples <n>', 'number of reachability samples to collect', '6')
    .option('--timeout <ms>', 'timeout per network check in milliseconds', '5000')
    .action(async (target, options) => {
      let samples;
      let timeoutMs;

      try {
        samples = parsePositiveInteger(options.samples, '--samples');
        timeoutMs = parsePositiveInteger(options.timeout, '--timeout');
      } catch (error) {
        console.error(chalk.red(error.message));
        process.exitCode = 1;
        return;
      }

      const quiet = options.json;

      if (!quiet) {
        console.log(renderBanner());
        console.log();
      }

      const spinner = quiet
        ? null
        : createPhaseSpinner('diagnose', 'Running network diagnostics').start();

      try {
        const result = await runNetworkDiagnostics({
          onProgress: ({ completed, failed, latestMs, samples: totalSamples }) => {
            if (!spinner) {
              return;
            }

            const latest = latestMs === null ? 'failed' : `${latestMs} ms`;

            spinner.update(
              `Sampling reachability ${completed}/${totalSamples} (${latest}, ${failed} failed)`,
            );
          },
          samples,
          target,
          timeoutMs,
        });

        if (spinner) {
          spinner.succeed(`${result.verdict.status} (${result.verdict.score}/100)`);
        }

        if (quiet) {
          printJson(result);
          return;
        }

        console.log();
        showDiagnostics(result);
      } catch (error) {
        if (spinner) {
          spinner.fail(error.message);
        } else {
          console.error(chalk.red(error.message));
        }

        process.exitCode = 1;
      }
    });
}
