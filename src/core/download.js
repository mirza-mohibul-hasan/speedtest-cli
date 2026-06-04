import axios from 'axios';
import { performance } from 'node:perf_hooks';

const DEFAULT_ENDPOINT = 'https://speed.cloudflare.com/__down';
const DEFAULT_WORKERS = 4;
const DEFAULT_CHUNK_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_DURATION_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const BITS_PER_BYTE = 8;
const BITS_PER_MEGABIT = 1_000_000;

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
}

function assertValidEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.trim().length === 0) {
    throw new TypeError('endpoint must be a non-empty URL string.');
  }

  try {
    new URL(endpoint);
  } catch {
    throw new TypeError('endpoint must be a valid URL.');
  }
}

function roundSpeed(value) {
  return Number(value.toFixed(2));
}

function bytesToMbps(bytes, durationMs) {
  if (durationMs <= 0) {
    return 0;
  }

  return (bytes * BITS_PER_BYTE) / (durationMs / 1000) / BITS_PER_MEGABIT;
}

function buildChunkUrl(endpoint, chunkSizeBytes, workerId) {
  const url = new URL(endpoint);

  url.searchParams.set('bytes', String(chunkSizeBytes));
  url.searchParams.set('worker', String(workerId));
  url.searchParams.set('cacheBust', `${Date.now()}-${Math.random()}`);

  return url.href;
}

function isAbortError(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
}

function streamResponse(response, signal, onBytes) {
  return new Promise((resolve, reject) => {
    const stream = response.data;

    if (signal.aborted) {
      stream.destroy();
      resolve();
      return;
    }

    function cleanup() {
      signal.removeEventListener('abort', abortStream);
    }

    function abortStream() {
      stream.destroy();
      cleanup();
      resolve();
    }

    stream.on('data', (chunk) => {
      if (signal.aborted) {
        return;
      }

      try {
        onBytes(chunk.length);
      } catch (error) {
        cleanup();
        stream.destroy(error);
        reject(error);
      }
    });

    stream.once('end', () => {
      cleanup();
      resolve();
    });

    stream.once('error', (error) => {
      cleanup();

      if (signal.aborted) {
        resolve();
        return;
      }

      reject(error);
    });

    signal.addEventListener('abort', abortStream, { once: true });
  });
}

async function downloadChunk({ endpoint, chunkSizeBytes, workerId, signal, timeoutMs, onBytes }) {
  try {
    const response = await axios.get(buildChunkUrl(endpoint, chunkSizeBytes, workerId), {
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        'user-agent': 'speedtest-cli/0.1.0',
      },
      maxBodyLength: Number.POSITIVE_INFINITY,
      responseType: 'stream',
      signal,
      timeout: timeoutMs,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    await streamResponse(response, signal, onBytes);
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      return;
    }

    throw new Error(`Unable to download test chunk: ${error.message}`, {
      cause: error,
    });
  }
}

async function runDownloadWorker({
  workerId,
  endpoint,
  chunkSizeBytes,
  deadline,
  signal,
  timeoutMs,
  onBytes,
}) {
  while (!signal.aborted && performance.now() < deadline) {
    await downloadChunk({
      endpoint,
      chunkSizeBytes,
      workerId,
      signal,
      timeoutMs,
      onBytes,
    });
  }
}

export async function runDownloadTest(onProgress = () => {}, {
  endpoint = DEFAULT_ENDPOINT,
  workers = DEFAULT_WORKERS,
  chunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES,
  durationMs = DEFAULT_DURATION_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  assertValidEndpoint(endpoint);
  assertPositiveInteger(workers, 'workers');
  assertPositiveInteger(chunkSizeBytes, 'chunkSizeBytes');
  assertPositiveInteger(durationMs, 'durationMs');
  assertPositiveInteger(timeoutMs, 'timeoutMs');

  if (typeof onProgress !== 'function') {
    throw new TypeError('onProgress must be a function.');
  }

  const controller = new AbortController();
  const startedAt = performance.now();
  const deadline = startedAt + durationMs;
  let totalBytes = 0;

  const progress = (bytesReceived) => {
    totalBytes += bytesReceived;

    const elapsedMs = Math.min(performance.now() - startedAt, durationMs);

    onProgress({
      bytes: totalBytes,
      elapsedMs,
      speed: roundSpeed(bytesToMbps(totalBytes, elapsedMs)),
      unit: 'Mbps',
    });
  };

  const abortTimer = setTimeout(() => controller.abort(), durationMs);

  try {
    const workerJobs = Array.from({ length: workers }, (_, workerIndex) =>
      runDownloadWorker({
        workerId: workerIndex + 1,
        endpoint,
        chunkSizeBytes,
        deadline,
        signal: controller.signal,
        timeoutMs,
        onBytes: progress,
      }),
    );

    await Promise.all(workerJobs);
  } finally {
    clearTimeout(abortTimer);

    if (!controller.signal.aborted) {
      controller.abort();
    }
  }

  const elapsedMs = Math.min(performance.now() - startedAt, durationMs);

  return {
    speed: roundSpeed(bytesToMbps(totalBytes, elapsedMs)),
    unit: 'Mbps',
  };
}
