import { setTimeout as delay } from 'node:timers/promises';

import {
  runDownloadTest,
  getServer,
  runPingTest,
  selectFastestServer,
  runUploadTest,
} from '../core/index.js';
import {
  createDownloadProgress,
  createPhaseSpinner,
  createPingProgress,
  createUploadProgress,
  renderBanner,
  showResults,
} from '../ui/index.js';
import { saveResult } from '../utils/index.js';

function bytesToMegabytes(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

function toResultServer(server) {
  return {
    id: server.id,
    latency: server.latency,
    name: server.name,
    provider: server.provider,
    region: server.region,
  };
}

async function resolveServer(serverRegion) {
  if (serverRegion) {
    return getServer(serverRegion);
  }

  return selectFastestServer();
}

async function runPingPhase(server) {
  const spinner = createPhaseSpinner('ping', 'Measuring latency').start();
  const progress = createPingProgress({ noTTYOutput: true, notTTYSchedule: 500 }).start(0, {
    detail: 'starting',
  });

  try {
    const result = await runPingTest({
      endpoint: server.endpoints.ping,
      onProgress: ({ completed, latency }) => {
        progress.update(completed, { detail: `${latency} ms` });
      },
    });

    progress.complete({ detail: `${result.avg} ms avg` });
    spinner.succeed(`${result.avg} ms average`);
    return result;
  } catch (error) {
    progress.stop();
    spinner.fail(error.message);
    throw error;
  }
}

async function runDownloadPhase(server) {
  const spinner = createPhaseSpinner('download', 'Measuring download speed').start();
  const progress = createDownloadProgress({ noTTYOutput: true, notTTYSchedule: 500 }).start(0, {
    detail: 'starting',
  });

  try {
    const result = await runDownloadTest(
      ({ bytes, speed, unit }) => {
        progress.update(bytesToMegabytes(bytes), { detail: `${speed} ${unit}` });
      },
      { endpoint: server.endpoints.download },
    );

    progress.complete({ detail: `${result.speed} ${result.unit}` });
    spinner.succeed(`${result.speed} ${result.unit}`);
    return result;
  } catch (error) {
    progress.stop();
    spinner.fail(error.message);
    throw error;
  }
}

async function runUploadPhase(server) {
  const spinner = createPhaseSpinner('upload', 'Measuring upload speed').start();
  const progress = createUploadProgress({ noTTYOutput: true, notTTYSchedule: 500 }).start(0, {
    detail: 'starting',
  });

  try {
    const result = await runUploadTest(
      ({ bytes, speed, unit }) => {
        progress.update(bytesToMegabytes(bytes), { detail: `${speed} ${unit}` });
      },
      { endpoint: server.endpoints.upload },
    );

    progress.complete({ detail: `${result.speed} ${result.unit}` });
    spinner.succeed(`${result.speed} ${result.unit}`);
    return result;
  } catch (error) {
    progress.stop();
    spinner.fail(error.message);
    throw error;
  }
}

function formatCsvRow(result) {
  return [
    result.timestamp,
    result.server.name,
    result.server.region,
    result.ping.avg,
    result.ping.min,
    result.ping.max,
    result.ping.jitter,
    result.download.speed,
    result.download.unit,
    result.upload.speed,
    result.upload.unit,
  ].join(',');
}

function parseWatchSeconds(value) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError('--watch must be a positive number of seconds.');
  }

  return parsed;
}

function averageMetric(results, selector) {
  if (results.length === 0) {
    return 0;
  }

  return Number(
    (results.reduce((sum, result) => sum + selector(result), 0) / results.length).toFixed(2),
  );
}

function getRunningAverage(results) {
  return {
    download: {
      speed: averageMetric(results, (result) => result.download.speed),
      unit: 'Mbps',
    },
    ping: {
      avg: averageMetric(results, (result) => result.ping.avg),
      jitter: averageMetric(results, (result) => result.ping.jitter),
    },
    runs: results.length,
    upload: {
      speed: averageMetric(results, (result) => result.upload.speed),
      unit: 'Mbps',
    },
  };
}

function printRunningAverage(average) {
  console.log(
    `Running average (${average.runs} runs): ping ${average.ping.avg} ms, download ${average.download.speed} Mbps, upload ${average.upload.speed} Mbps`,
  );
}

export async function runSpeedTest({ quiet = false, serverRegion } = {}) {
  const timestamp = new Date().toISOString();
  const server = await resolveServer(serverRegion);
  const ping = quiet
    ? await runPingTest({ endpoint: server.endpoints.ping })
    : await runPingPhase(server);
  const download = quiet
    ? await runDownloadTest(() => {}, { endpoint: server.endpoints.download })
    : await runDownloadPhase(server);
  const upload = quiet
    ? await runUploadTest(() => {}, { endpoint: server.endpoints.upload })
    : await runUploadPhase(server);

  return {
    download,
    ping,
    server: toResultServer(server),
    timestamp,
    upload,
  };
}

export async function runWatchMode({
  csv = false,
  intervalSeconds,
  json = false,
  maxRuns = Number.POSITIVE_INFINITY,
  serverRegion,
} = {}) {
  const results = [];
  let shouldStop = false;

  function stop() {
    shouldStop = true;
  }

  process.once('SIGINT', stop);

  try {
    while (!shouldStop && results.length < maxRuns) {
      const quiet = json || csv;
      const result = await runSpeedTest({ quiet, serverRegion });

      saveResult(result);
      results.push(result);

      const average = getRunningAverage(results);

      if (json) {
        console.log(JSON.stringify({ average, result, run: results.length }));
      } else if (csv) {
        console.log(formatCsvRow(result));
      } else {
        console.log();
        showResults(result);
        printRunningAverage(average);
      }

      if (shouldStop || results.length >= maxRuns) {
        break;
      }

      await delay(intervalSeconds * 1000);
    }
  } finally {
    process.removeListener('SIGINT', stop);
  }

  if (results.length > 0 && !json && !csv) {
    console.log();
    console.log('Final summary');
    printRunningAverage(getRunningAverage(results));
  }

  return {
    average: getRunningAverage(results),
    runs: results.length,
  };
}

export function registerTestCommand(program) {
  program
    .command('test')
    .description('Run a full ping, download, and upload speed test.')
    .option('--json', 'print raw JSON without UI decorations')
    .option('--csv', 'print a single CSV row without UI decorations')
    .option('--server <region>', 'server region or alias to use instead of auto-selection')
    .option('--watch <seconds>', 're-run the full test every N seconds until Ctrl+C')
    .action(async (options) => {
      if (options.json && options.csv) {
        console.error('Choose either --json or --csv, not both.');
        process.exitCode = 1;
        return;
      }

      const quiet = options.json || options.csv;
      let watchSeconds;

      try {
        watchSeconds = parseWatchSeconds(options.watch);
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }

      if (!quiet) {
        console.log(renderBanner());
        console.log();
      }

      if (watchSeconds) {
        await runWatchMode({
          csv: options.csv,
          intervalSeconds: watchSeconds,
          json: options.json,
          serverRegion: options.server,
        });
        return;
      }

      let result;

      try {
        result = await runSpeedTest({ quiet, serverRegion: options.server });
        saveResult(result);
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(result));
        return;
      }

      if (options.csv) {
        console.log(formatCsvRow(result));
        return;
      }

      console.log();
      showResults(result);
    });
}
