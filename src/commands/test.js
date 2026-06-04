import {
  runDownloadTest,
  runPingTest,
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

const DEFAULT_SERVER = {
  name: 'Cloudflare',
  region: 'Global',
};

function bytesToMegabytes(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

async function runPingPhase() {
  const spinner = createPhaseSpinner('ping', 'Measuring latency').start();
  const progress = createPingProgress({ noTTYOutput: true, notTTYSchedule: 500 }).start(0, {
    detail: 'starting',
  });

  try {
    const result = await runPingTest({
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

async function runDownloadPhase() {
  const spinner = createPhaseSpinner('download', 'Measuring download speed').start();
  const progress = createDownloadProgress({ noTTYOutput: true, notTTYSchedule: 500 }).start(0, {
    detail: 'starting',
  });

  try {
    const result = await runDownloadTest(({ bytes, speed, unit }) => {
      progress.update(bytesToMegabytes(bytes), { detail: `${speed} ${unit}` });
    });

    progress.complete({ detail: `${result.speed} ${result.unit}` });
    spinner.succeed(`${result.speed} ${result.unit}`);
    return result;
  } catch (error) {
    progress.stop();
    spinner.fail(error.message);
    throw error;
  }
}

async function runUploadPhase() {
  const spinner = createPhaseSpinner('upload', 'Measuring upload speed').start();
  const progress = createUploadProgress({ noTTYOutput: true, notTTYSchedule: 500 }).start(0, {
    detail: 'starting',
  });

  try {
    const result = await runUploadTest(({ bytes, speed, unit }) => {
      progress.update(bytesToMegabytes(bytes), { detail: `${speed} ${unit}` });
    });

    progress.complete({ detail: `${result.speed} ${result.unit}` });
    spinner.succeed(`${result.speed} ${result.unit}`);
    return result;
  } catch (error) {
    progress.stop();
    spinner.fail(error.message);
    throw error;
  }
}

export async function runSpeedTest() {
  const timestamp = new Date().toISOString();
  const ping = await runPingPhase();
  const download = await runDownloadPhase();
  const upload = await runUploadPhase();

  return {
    download,
    ping,
    server: DEFAULT_SERVER,
    timestamp,
    upload,
  };
}

export function registerTestCommand(program) {
  program
    .command('test')
    .description('Run a full ping, download, and upload speed test.')
    .action(async () => {
      console.log(renderBanner());
      console.log();

      let result;

      try {
        result = await runSpeedTest();
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }

      console.log();
      showResults(result);
    });
}
