import cliProgress from 'cli-progress';

import { formatPhaseLabel, getPhaseTheme } from './theme.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createPayload(phase, unit, payload = {}) {
  return {
    detail: payload.detail ?? '',
    label: formatPhaseLabel(phase),
    unit,
  };
}

export function createPhaseProgress(phase, {
  total = 100,
  unit = '',
  clearOnComplete = false,
  hideCursor = true,
  noTTYOutput = false,
  notTTYSchedule = 2000,
  stream = process.stderr,
} = {}) {
  const theme = getPhaseTheme(phase);
  let started = false;

  const progress = new cliProgress.SingleBar(
    {
      barCompleteChar: '=',
      barIncompleteChar: '-',
      clearOnComplete,
      format: '{label} |' + theme.color('{bar}') + '| {percentage}% | {value}/{total} {unit} {detail}',
      hideCursor,
      noTTYOutput,
      notTTYSchedule,
      stream,
    },
    cliProgress.Presets.shades_classic,
  );

  return {
    start(initialValue = 0, payload = {}) {
      if (!started) {
        started = true;
        progress.start(total, clamp(initialValue, 0, total), createPayload(phase, unit, payload));
      }

      return this;
    },
    update(value, payload = {}) {
      if (!started) {
        this.start(0, payload);
      }

      progress.update(clamp(value, 0, total), createPayload(phase, unit, payload));
      return this;
    },
    complete(payload = {}) {
      this.update(total, payload);
      this.stop();
      return this;
    },
    stop() {
      if (started) {
        progress.stop();
        started = false;
      }

      return this;
    },
    raw: progress,
  };
}

export function createPingProgress(options = {}) {
  return createPhaseProgress('ping', {
    total: 10,
    unit: 'requests',
    ...options,
  });
}

export function createDownloadProgress(options = {}) {
  return createPhaseProgress('download', {
    total: 100,
    unit: 'MB',
    ...options,
  });
}

export function createUploadProgress(options = {}) {
  return createPhaseProgress('upload', {
    total: 100,
    unit: 'MB',
    ...options,
  });
}
