import Conf from 'conf';

const DEFAULT_CONFIG = {
  historyLimit: 50,
  theme: 'default',
  unit: 'Mbps',
};

let store;

function getStore() {
  if (!store) {
    store = new Conf({
      defaults: {
        config: DEFAULT_CONFIG,
        history: [],
      },
      projectName: 'speedtest-cli',
    });
  }

  return store;
}

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
    ...getStore().get('config', {}),
  };
}

export function saveConfig(config) {
  getStore().set('config', {
    ...getConfig(),
    ...config,
  });
}

export function resetConfig() {
  getStore().set('config', DEFAULT_CONFIG);
}

export function loadHistory({ limit } = {}) {
  const history = getStore().get('history', []);

  if (!limit) {
    return history;
  }

  return history.slice(0, normalizeLimit(limit));
}

export function saveResult(result) {
  const config = getConfig();
  const history = getStore().get('history', []);
  const nextHistory = [result, ...history].slice(0, config.historyLimit);

  getStore().set('history', nextHistory);
  return result;
}

export function clearHistory() {
  getStore().set('history', []);
}
