import Table from 'cli-table3';
import chalk from 'chalk';

import { colorLatency, colorSpeed, icons } from './theme.js';

function formatTimestamp(timestamp = new Date()) {
  return new Date(timestamp).toISOString();
}

function formatServer(server) {
  if (!server) {
    return 'Auto';
  }

  if (typeof server === 'string') {
    return server;
  }

  return [server.name, server.region].filter(Boolean).join(' - ');
}

function formatMetric(value, unit) {
  return `${value} ${unit}`;
}

export function formatResultsTable(data) {
  const table = new Table({
    chars: {
      bottom: '-',
      'bottom-left': '+',
      'bottom-mid': '+',
      'bottom-right': '+',
      left: '|',
      'left-mid': '+',
      mid: '-',
      'mid-mid': '+',
      middle: '|',
      right: '|',
      'right-mid': '+',
      top: '-',
      'top-left': '+',
      'top-mid': '+',
      'top-right': '+',
    },
    head: [chalk.bold('Metric'), chalk.bold('Value')],
    style: {
      border: ['gray'],
      head: [],
    },
  });

  table.push(
    [chalk.cyan('Ping'), `${colorLatency(data.ping.avg)} ms`],
    [chalk.cyan('Jitter'), `${colorLatency(data.ping.jitter)} ms`],
    [
      chalk.blue('Download'),
      formatMetric(colorSpeed('download', data.download.speed), data.download.unit),
    ],
    [
      chalk.magenta('Upload'),
      formatMetric(colorSpeed('upload', data.upload.speed), data.upload.unit),
    ],
    [chalk.gray('Server'), formatServer(data.server)],
    [chalk.gray('Timestamp'), formatTimestamp(data.timestamp)],
  );

  return [chalk.bold(`${icons.success} Speed Test Results`), table.toString()].join('\n');
}

export function showResults(data) {
  console.log(formatResultsTable(data));
}
