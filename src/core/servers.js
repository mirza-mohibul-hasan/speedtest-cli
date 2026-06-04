import { runPingTest } from './ping.js';

const CLOUDFLARE_ENDPOINTS = {
  download: 'https://speed.cloudflare.com/__down',
  ping: 'https://speed.cloudflare.com/__down?bytes=1',
  upload: 'https://speed.cloudflare.com/__up',
};

export const servers = [
  {
    aliases: ['global', 'cloudflare', 'default'],
    endpoints: CLOUDFLARE_ENDPOINTS,
    id: 'cloudflare-global',
    name: 'Cloudflare',
    provider: 'Cloudflare',
    region: 'Global',
  },
  {
    aliases: ['north-america', 'na', 'us'],
    endpoints: CLOUDFLARE_ENDPOINTS,
    id: 'cloudflare-na',
    name: 'Cloudflare',
    provider: 'Cloudflare',
    region: 'North America',
  },
  {
    aliases: ['europe', 'eu'],
    endpoints: CLOUDFLARE_ENDPOINTS,
    id: 'cloudflare-eu',
    name: 'Cloudflare',
    provider: 'Cloudflare',
    region: 'Europe',
  },
  {
    aliases: ['asia', 'apac'],
    endpoints: CLOUDFLARE_ENDPOINTS,
    id: 'cloudflare-apac',
    name: 'Cloudflare',
    provider: 'Cloudflare',
    region: 'Asia Pacific',
  },
];

export function listServers() {
  return servers.map((server) => ({ ...server }));
}

export function getServer(region) {
  const normalized = region.toLowerCase();
  const server = servers.find(
    (candidate) =>
      candidate.id === normalized ||
      candidate.region.toLowerCase() === normalized ||
      candidate.aliases.includes(normalized),
  );

  if (!server) {
    throw new TypeError(`Unknown server region: ${region}`);
  }

  return { ...server };
}

export async function selectFastestServer({ requests = 2, candidates = servers } = {}) {
  const results = await Promise.all(
    candidates.map(async (server) => {
      const ping = await runPingTest({
        endpoint: server.endpoints.ping,
        requests,
      });

      return {
        ping,
        server,
      };
    }),
  );

  const fastest = results.reduce((best, result) =>
    result.ping.avg < best.ping.avg ? result : best,
  );

  return {
    ...fastest.server,
    latency: fastest.ping.avg,
  };
}
