import axios from 'axios';
import { performance } from 'node:perf_hooks';

const DEFAULT_ENDPOINT = 'https://speed.cloudflare.com/__down?bytes=1';
const DEFAULT_REQUEST_COUNT = 10;
const DEFAULT_TIMEOUT_MS = 5000;

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

function roundMilliseconds(value) {
  return Number(value.toFixed(2));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateJitter(samples) {
  if (samples.length < 2) {
    return 0;
  }

  const deltas = samples.slice(1).map((sample, index) => Math.abs(sample - samples[index]));
  return average(deltas);
}

async function measureHeadRequest(endpoint, timeoutMs) {
  const startedAt = performance.now();

  try {
    await axios.head(endpoint, {
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        'user-agent': 'speedtest-cli/0.1.0',
      },
      timeout: timeoutMs,
      validateStatus: () => true,
    });
  } catch (error) {
    throw new Error(`Unable to measure ping against ${endpoint}: ${error.message}`, {
      cause: error,
    });
  }

  return performance.now() - startedAt;
}

export async function runPingTest({
  endpoint = DEFAULT_ENDPOINT,
  onProgress = () => {},
  requests = DEFAULT_REQUEST_COUNT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  assertValidEndpoint(endpoint);
  assertPositiveInteger(requests, 'requests');
  assertPositiveInteger(timeoutMs, 'timeoutMs');

  if (typeof onProgress !== 'function') {
    throw new TypeError('onProgress must be a function.');
  }

  const samples = [];

  for (let requestIndex = 0; requestIndex < requests; requestIndex += 1) {
    const latency = await measureHeadRequest(endpoint, timeoutMs);

    samples.push(latency);
    onProgress({
      completed: requestIndex + 1,
      latency: roundMilliseconds(latency),
      total: requests,
    });
  }

  return {
    avg: roundMilliseconds(average(samples)),
    min: roundMilliseconds(Math.min(...samples)),
    max: roundMilliseconds(Math.max(...samples)),
    jitter: roundMilliseconds(calculateJitter(samples)),
  };
}
