import chalk from 'chalk';
import Table from 'cli-table3';

import { icons } from './theme.js';

function colorStatus(status) {
  if (status === 'good') {
    return chalk.green(status);
  }

  if (status === 'degraded') {
    return chalk.yellow(status);
  }

  return chalk.red(status);
}

function formatMilliseconds(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  return `${value} ms`;
}

function formatCheck(result, successText) {
  if (result.skipped) {
    return chalk.gray('Skipped');
  }

  if (!result.ok) {
    return chalk.red(result.error ?? 'Failed');
  }

  return successText;
}

function formatAddresses(addresses) {
  if (!addresses || addresses.length === 0) {
    return 'No addresses';
  }

  return addresses.map((address) => `${address.address} IPv${address.family}`).join(', ');
}

function formatList(title, values) {
  if (!values || values.length === 0) {
    return '';
  }

  return [chalk.bold(title), ...values.map((value) => `${chalk.gray('-')} ${value}`)].join('\n');
}

function getStatusIcon(status) {
  if (status === 'good') {
    return icons.success;
  }

  if (status === 'degraded') {
    return icons.warning;
  }

  return icons.error;
}

export function formatDiagnosticsReport(data) {
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
    head: [chalk.bold('Check'), chalk.bold('Result')],
    style: {
      border: ['gray'],
      head: [],
    },
  });

  table.push(
    [
      chalk.cyan('Verdict'),
      `${colorStatus(data.verdict.status)} (${data.verdict.score}/100) - ${data.verdict.summary}`,
    ],
    [chalk.gray('Target'), `${data.target.href}`],
    [
      chalk.cyan('DNS'),
      formatCheck(
        data.checks.dns,
        `${formatMilliseconds(data.checks.dns.durationMs)} - ${formatAddresses(
          data.checks.dns.addresses,
        )}`,
      ),
    ],
    [
      chalk.cyan('TCP'),
      formatCheck(
        data.checks.tcp,
        `${formatMilliseconds(data.checks.tcp.durationMs)} to ${data.target.host}:${
          data.target.port
        }`,
      ),
    ],
    [
      chalk.cyan('TLS'),
      formatCheck(
        data.checks.tls,
        `${formatMilliseconds(data.checks.tls.durationMs)} (${data.checks.tls.protocol}, ${
          data.checks.tls.cipher
        })`,
      ),
    ],
    [
      chalk.cyan('HTTP'),
      formatCheck(
        data.checks.http,
        `status ${data.checks.http.statusCode}, total ${formatMilliseconds(
          data.checks.http.durationMs,
        )}, TTFB ${formatMilliseconds(data.checks.http.ttfbMs)}`,
      ),
    ],
    [
      chalk.cyan('Reachability'),
      `${data.checks.reachability.successful}/${data.checks.reachability.samples} ok, ${data.checks.reachability.lossPercent}% loss`,
    ],
    [
      chalk.cyan('Latency'),
      `avg ${formatMilliseconds(data.checks.reachability.avg)}, min ${formatMilliseconds(
        data.checks.reachability.min,
      )}, max ${formatMilliseconds(data.checks.reachability.max)}, jitter ${formatMilliseconds(
        data.checks.reachability.jitter,
      )}`,
    ],
    [chalk.gray('Timestamp'), data.timestamp],
  );

  return [
    chalk.bold(`${getStatusIcon(data.verdict.status)} Network Diagnostics`),
    table.toString(),
    formatList('Issues', data.verdict.issues),
    formatList('Recommendations', data.verdict.recommendations),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function showDiagnostics(data) {
  console.log(formatDiagnosticsReport(data));
}
