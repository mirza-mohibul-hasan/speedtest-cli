import Table from 'cli-table3';
import chalk from 'chalk';

import { loadHistory } from '../utils/index.js';

function formatServer(server) {
  if (!server) {
    return 'Auto';
  }

  return [server.name, server.region].filter(Boolean).join(' - ');
}

function formatSpeed(metric) {
  return `${metric.speed} ${metric.unit}`;
}

function renderHistoryTable(results) {
  const table = new Table({
    head: ['Timestamp', 'Ping', 'Download', 'Upload', 'Server'],
    style: {
      head: ['cyan'],
    },
  });

  for (const result of results) {
    table.push([
      result.timestamp,
      `${result.ping.avg} ms`,
      formatSpeed(result.download),
      formatSpeed(result.upload),
      formatServer(result.server),
    ]);
  }

  return table.toString();
}

export function registerHistoryCommand(program) {
  program
    .command('history')
    .description('Show saved speed test results.')
    .option('--last <n>', 'number of recent results to show', '10')
    .action((options) => {
      const results = loadHistory({ limit: options.last });

      if (results.length === 0) {
        console.log(chalk.yellow('No speed test history yet.'));
        return;
      }

      console.log(renderHistoryTable(results));
    });
}
