import Conf from 'conf';

const DEFAULT_CONFIG = {
  historyLimit: 50,
  theme: 'default',
  unit: 'Mbps',
};

const store = new Conf({
  defaults: {
    config: DEFAULT_CONFIG,
    history: [],
  },
  projectName: 'speedtest-cli',
});

function normalizeLimit(limit) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError('History limit must be a positive integer.');
  }

  return parsed;
}

export function getConfig() {
  return {
    ...DEFAULT_CONFIG,
    ...store.get('config', {}),
  };
}

export function saveConfig(config) {
  store.set('config', {
    ...getConfig(),
    ...config,
  });
}

export function resetConfig() {
  store.set('config', DEFAULT_CONFIG);
}

export function loadHistory({ limit } = {}) {
  const history = store.get('history', []);

  if (!limit) {
    return history;
  }

  return history.slice(0, normalizeLimit(limit));
}

export function saveResult(result) {
  const config = getConfig();
  const history = store.get('history', []);
  const nextHistory = [result, ...history].slice(0, config.historyLimit);

  store.set('history', nextHistory);
  return result;
}

export function clearHistory() {
  store.set('history', []);
}
