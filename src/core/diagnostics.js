import { promises as dns } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import tls from 'node:tls';

const DEFAULT_TARGET = 'https://speed.cloudflare.com/__down?bytes=1';
const DEFAULT_SAMPLES = 6;
const DEFAULT_TIMEOUT_MS = 5000;
const HTTP_STATUS_REACHABLE_LIMIT = 500;

function roundMilliseconds(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value.toFixed(2));
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateJitter(samples) {
  if (samples.length < 2) {
    return 0;
  }

  const deltas = samples.slice(1).map((sample, index) => Math.abs(sample - samples[index]));
  return average(deltas);
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
}

function normalizeTarget(target = DEFAULT_TARGET) {
  const rawTarget = String(target || DEFAULT_TARGET).trim();
  const targetWithProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(rawTarget)
    ? rawTarget
    : `https://${rawTarget}`;

  let url;

  try {
    url = new URL(targetWithProtocol);
  } catch {
    throw new TypeError('target must be a valid HTTP or HTTPS URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new TypeError('target must be a valid HTTP or HTTPS URL.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));

  return {
    host,
    href: url.href,
    port,
    protocol: url.protocol.replace(':', ''),
    url,
  };
}

function toErrorMessage(error) {
  return error?.message ?? String(error);
}

async function measureDnsLookup(host) {
  const startedAt = performance.now();

  try {
    const addresses = await dns.lookup(host, {
      all: true,
    });

    return {
      addresses: addresses.map((address) => ({
        address: address.address,
        family: address.family,
      })),
      durationMs: roundMilliseconds(performance.now() - startedAt),
      ok: addresses.length > 0,
    };
  } catch (error) {
    return {
      addresses: [],
      durationMs: roundMilliseconds(performance.now() - startedAt),
      error: toErrorMessage(error),
      ok: false,
    };
  }
}

function measureTcpConnect({ host, port, timeoutMs }) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const socket = net.createConnection({
      host,
      port,
    });
    let settled = false;

    function settle(result) {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      settle({
        durationMs: roundMilliseconds(performance.now() - startedAt),
        ok: true,
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
      });
    });

    socket.once('timeout', () => {
      settle({
        durationMs: roundMilliseconds(performance.now() - startedAt),
        error: `TCP connection timed out after ${timeoutMs} ms.`,
        ok: false,
      });
    });

    socket.once('error', (error) => {
      settle({
        durationMs: roundMilliseconds(performance.now() - startedAt),
        error: toErrorMessage(error),
        ok: false,
      });
    });
  });
}

function measureTlsHandshake({ host, port, protocol, timeoutMs }) {
  if (protocol !== 'https') {
    return Promise.resolve({
      ok: true,
      skipped: true,
    });
  }

  return new Promise((resolve) => {
    const startedAt = performance.now();
    const socket = tls.connect({
      host,
      port,
      servername: host,
    });
    let settled = false;

    function settle(result) {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(timeoutMs);

    socket.once('secureConnect', () => {
      settle({
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ?? null,
        cipher: socket.getCipher()?.name ?? null,
        durationMs: roundMilliseconds(performance.now() - startedAt),
        ok: socket.authorized,
        protocol: socket.getProtocol(),
      });
    });

    socket.once('timeout', () => {
      settle({
        durationMs: roundMilliseconds(performance.now() - startedAt),
        error: `TLS handshake timed out after ${timeoutMs} ms.`,
        ok: false,
      });
    });

    socket.once('error', (error) => {
      settle({
        durationMs: roundMilliseconds(performance.now() - startedAt),
        error: toErrorMessage(error),
        ok: false,
      });
    });
  });
}

function calculateHttpTimings(timings) {
  const lookupStartedAt = timings.socket;
  const connectStartedAt = timings.lookup ?? timings.socket;
  const secureConnectStartedAt = timings.connect;

  return {
    dnsMs: roundMilliseconds(
      timings.lookup && lookupStartedAt ? timings.lookup - lookupStartedAt : null,
    ),
    tcpMs: roundMilliseconds(
      timings.connect && connectStartedAt ? timings.connect - connectStartedAt : null,
    ),
    tlsMs: roundMilliseconds(
      timings.secureConnect && secureConnectStartedAt
        ? timings.secureConnect - secureConnectStartedAt
        : null,
    ),
    ttfbMs: roundMilliseconds(timings.response ? timings.response - timings.start : null),
  };
}

function measureHttpRequest({ url, timeoutMs }) {
  return new Promise((resolve) => {
    const timings = {
      start: performance.now(),
    };
    const transport = url.protocol === 'https:' ? https : http;
    let bytes = 0;
    let settled = false;

    function settle(result) {
      if (settled) {
        return;
      }

      settled = true;
      resolve({
        ...result,
        durationMs: roundMilliseconds(performance.now() - timings.start),
        ...calculateHttpTimings(timings),
      });
    }

    const request = transport.request(
      url,
      {
        agent: false,
        headers: {
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          'user-agent': 'speedtest-cli/1.0.0',
        },
        method: 'HEAD',
        timeout: timeoutMs,
      },
      (response) => {
        timings.response = performance.now();

        response.on('data', (chunk) => {
          bytes += chunk.length;
        });

        response.once('end', () => {
          settle({
            bytes,
            ok: response.statusCode < HTTP_STATUS_REACHABLE_LIMIT,
            statusCode: response.statusCode,
          });
        });

        response.resume();
      },
    );

    request.once('socket', (socket) => {
      timings.socket = performance.now();
      socket.once('lookup', () => {
        timings.lookup = performance.now();
      });
      socket.once('connect', () => {
        timings.connect = performance.now();
      });
      socket.once('secureConnect', () => {
        timings.secureConnect = performance.now();
      });
    });

    request.once('timeout', () => {
      request.destroy(new Error(`HTTP request timed out after ${timeoutMs} ms.`));
    });

    request.once('error', (error) => {
      settle({
        bytes,
        error: toErrorMessage(error),
        ok: false,
        statusCode: null,
      });
    });

    request.end();
  });
}

async function measureReachability({ url, samples, timeoutMs, onProgress }) {
  const latencies = [];
  const sampleResults = [];
  let failed = 0;

  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
    const result = await measureHttpRequest({
      timeoutMs,
      url,
    });
    const latency = result.ttfbMs ?? result.durationMs;
    const ok = result.ok && Number.isFinite(latency);

    if (ok) {
      latencies.push(latency);
    } else {
      failed += 1;
    }

    sampleResults.push({
      durationMs: result.durationMs,
      error: result.error,
      latencyMs: ok ? latency : null,
      ok,
      statusCode: result.statusCode,
    });

    onProgress({
      completed: sampleIndex + 1,
      failed,
      latestMs: ok ? latency : null,
      samples,
      successful: latencies.length,
    });
  }

  return {
    avg: roundMilliseconds(average(latencies)),
    failed,
    jitter: roundMilliseconds(calculateJitter(latencies)),
    lossPercent: roundMilliseconds((failed / samples) * 100),
    max: roundMilliseconds(latencies.length > 0 ? Math.max(...latencies) : 0),
    min: roundMilliseconds(latencies.length > 0 ? Math.min(...latencies) : 0),
    ok: latencies.length > 0,
    samples,
    sampleResults,
    successful: latencies.length,
  };
}

function buildVerdict(checks) {
  let score = 100;
  const issues = [];
  const recommendations = [];

  if (!checks.dns.ok) {
    score -= 30;
    issues.push('DNS lookup failed.');
    recommendations.push('Check the hostname or try a different DNS resolver.');
  } else if (checks.dns.durationMs > 250) {
    score -= 10;
    issues.push(`DNS lookup is slow at ${checks.dns.durationMs} ms.`);
    recommendations.push('Compare with another resolver if slow DNS is frequent.');
  }

  if (!checks.tcp.ok) {
    score -= 35;
    issues.push('TCP connection failed.');
    recommendations.push('Check firewall, routing, captive portal, or target availability.');
  } else if (checks.tcp.durationMs > 500) {
    score -= 10;
    issues.push(`TCP connect time is high at ${checks.tcp.durationMs} ms.`);
  }

  if (!checks.tls.skipped && !checks.tls.ok) {
    score -= 20;
    issues.push('TLS handshake failed or the certificate was not trusted.');
    recommendations.push('Check certificate validity, system time, proxy, or TLS interception.');
  }

  if (!checks.http.ok) {
    score -= 25;
    issues.push('HTTP reachability check failed.');
    recommendations.push(
      'Try another target URL to separate local network issues from server issues.',
    );
  } else if (checks.http.ttfbMs > 1000) {
    score -= 10;
    issues.push(`HTTP time to first byte is high at ${checks.http.ttfbMs} ms.`);
  }

  if (checks.reachability.lossPercent > 0) {
    score -= Math.min(30, checks.reachability.lossPercent);
    issues.push(`${checks.reachability.lossPercent}% request loss during sampling.`);
    recommendations.push(
      'Run diagnose again during the problem window and compare against another target.',
    );
  }

  if (checks.reachability.avg > 150) {
    score -= 10;
    issues.push(`Average application latency is high at ${checks.reachability.avg} ms.`);
  }

  if (checks.reachability.jitter > 50) {
    score -= 10;
    issues.push(`Jitter is high at ${checks.reachability.jitter} ms.`);
    recommendations.push('Check Wi-Fi signal quality or background uploads/downloads.');
  }

  const boundedScore = Math.max(0, Math.round(score));
  const status = boundedScore >= 80 ? 'good' : boundedScore >= 50 ? 'degraded' : 'poor';

  return {
    issues,
    recommendations: [...new Set(recommendations)],
    score: boundedScore,
    status,
    summary:
      issues.length === 0
        ? 'Network path looks healthy for this target.'
        : 'Diagnostics found one or more network path issues.',
  };
}

export async function runNetworkDiagnostics({
  onProgress = () => {},
  samples = DEFAULT_SAMPLES,
  target = DEFAULT_TARGET,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  assertPositiveInteger(samples, 'samples');
  assertPositiveInteger(timeoutMs, 'timeoutMs');

  if (typeof onProgress !== 'function') {
    throw new TypeError('onProgress must be a function.');
  }

  const normalizedTarget = normalizeTarget(target);
  const dnsResult = await measureDnsLookup(normalizedTarget.host);
  const tcpResult = await measureTcpConnect({
    host: normalizedTarget.host,
    port: normalizedTarget.port,
    timeoutMs,
  });
  const tlsResult = await measureTlsHandshake({
    host: normalizedTarget.host,
    port: normalizedTarget.port,
    protocol: normalizedTarget.protocol,
    timeoutMs,
  });
  const httpResult = await measureHttpRequest({
    timeoutMs,
    url: normalizedTarget.url,
  });
  const reachabilityResult = await measureReachability({
    onProgress,
    samples,
    timeoutMs,
    url: normalizedTarget.url,
  });
  const checks = {
    dns: dnsResult,
    http: httpResult,
    reachability: reachabilityResult,
    tcp: tcpResult,
    tls: tlsResult,
  };

  return {
    checks,
    target: {
      host: normalizedTarget.host,
      href: normalizedTarget.href,
      port: normalizedTarget.port,
      protocol: normalizedTarget.protocol,
    },
    timestamp: new Date().toISOString(),
    verdict: buildVerdict(checks),
  };
}
