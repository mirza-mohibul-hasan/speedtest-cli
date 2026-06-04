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

export async function runSpeedTest({ quiet = false, serverRegion } = {}) {
  const timestamp = new Date().toISOString();
  const server = await resolveServer(serverRegion);
  const ping = quiet ? await runPingTest({ endpoint: server.endpoints.ping }) : await runPingPhase(server);
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

export function registerTestCommand(program) {
  program
    .command('test')
    .description('Run a full ping, download, and upload speed test.')
    .option('--json', 'print raw JSON without UI decorations')
    .option('--csv', 'print a single CSV row without UI decorations')
    .option('--server <region>', 'server region or alias to use instead of auto-selection')
    .action(async (options) => {
      if (options.json && options.csv) {
        console.error('Choose either --json or --csv, not both.');
        process.exitCode = 1;
        return;
      }

      const quiet = options.json || options.csv;

      if (!quiet) {
        console.log(renderBanner());
        console.log();
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
