import axios from 'axios';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Readable } from 'node:stream';

const DEFAULT_ENDPOINT = 'https://speed.cloudflare.com/__up';
const DEFAULT_WORKERS = 4;
const DEFAULT_CHUNK_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_STREAM_CHUNK_BYTES = 64 * 1024;
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

function buildUploadUrl(endpoint, chunkSizeBytes, workerId) {
  const url = new URL(endpoint);

  url.searchParams.set('bytes', String(chunkSizeBytes));
  url.searchParams.set('worker', String(workerId));
  url.searchParams.set('cacheBust', `${Date.now()}-${Math.random()}`);

  return url.href;
}

function isAbortError(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
}

function createUploadStream({ totalBytes, streamChunkBytes, signal, onBytes }) {
  let bytesRemaining = totalBytes;

  const stream = new Readable({
    read() {
      if (signal.aborted) {
        this.push(null);
        return;
      }

      if (bytesRemaining <= 0) {
        this.push(null);
        return;
      }

      const nextChunkSize = Math.min(streamChunkBytes, bytesRemaining);
      let chunk;

      try {
        chunk = randomBytes(nextChunkSize);
        onBytes(nextChunkSize);
      } catch (error) {
        this.destroy(error);
        return;
      }

      bytesRemaining -= nextChunkSize;

      this.push(chunk);
    },
  });

  if (signal.aborted) {
    stream.destroy();
    return stream;
  }

  function abortStream() {
    stream.destroy();
  }

  function cleanup() {
    signal.removeEventListener('abort', abortStream);
  }

  signal.addEventListener('abort', abortStream, { once: true });
  stream.once('close', cleanup);

  return stream;
}

async function uploadChunk({
  endpoint,
  chunkSizeBytes,
  streamChunkBytes,
  workerId,
  signal,
  timeoutMs,
  onBytes,
}) {
  const body = createUploadStream({
    totalBytes: chunkSizeBytes,
    streamChunkBytes,
    signal,
    onBytes,
  });

  try {
    await axios.post(buildUploadUrl(endpoint, chunkSizeBytes, workerId), body, {
      headers: {
        'cache-control': 'no-cache',
        'content-length': String(chunkSizeBytes),
        'content-type': 'application/octet-stream',
        pragma: 'no-cache',
        'user-agent': 'speedtest-cli/0.1.0',
      },
      maxBodyLength: Number.POSITIVE_INFINITY,
      maxContentLength: Number.POSITIVE_INFINITY,
      signal,
      timeout: timeoutMs,
      validateStatus: (status) => status >= 200 && status < 300,
    });
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      return;
    }

    throw new Error(`Unable to upload test chunk: ${error.message}`, {
      cause: error,
    });
  }
}

async function runUploadWorker({
  workerId,
  endpoint,
  chunkSizeBytes,
  streamChunkBytes,
  deadline,
  signal,
  timeoutMs,
  onBytes,
}) {
  while (!signal.aborted && performance.now() < deadline) {
    await uploadChunk({
      endpoint,
      chunkSizeBytes,
      streamChunkBytes,
      workerId,
      signal,
      timeoutMs,
      onBytes,
    });
  }
}

export async function runUploadTest(onProgress = () => {}, {
  endpoint = DEFAULT_ENDPOINT,
  workers = DEFAULT_WORKERS,
  chunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES,
  streamChunkBytes = DEFAULT_STREAM_CHUNK_BYTES,
  durationMs = DEFAULT_DURATION_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  assertValidEndpoint(endpoint);
  assertPositiveInteger(workers, 'workers');
  assertPositiveInteger(chunkSizeBytes, 'chunkSizeBytes');
  assertPositiveInteger(streamChunkBytes, 'streamChunkBytes');
  assertPositiveInteger(durationMs, 'durationMs');
  assertPositiveInteger(timeoutMs, 'timeoutMs');

  if (typeof onProgress !== 'function') {
    throw new TypeError('onProgress must be a function.');
  }

  const controller = new AbortController();
  const startedAt = performance.now();
  const deadline = startedAt + durationMs;
  let totalBytes = 0;

  const progress = (bytesSent) => {
    totalBytes += bytesSent;

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
      runUploadWorker({
        workerId: workerIndex + 1,
        endpoint,
        chunkSizeBytes,
        streamChunkBytes,
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
