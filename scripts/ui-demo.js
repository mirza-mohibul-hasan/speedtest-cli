import { setTimeout as delay } from 'node:timers/promises';

import {
  createDownloadProgress,
  createPhaseSpinner,
  createPingProgress,
  createUploadProgress,
  phaseOrder,
  renderBanner,
} from '../src/ui/index.js';

const progressFactories = {
  ping: createPingProgress,
  download: createDownloadProgress,
  upload: createUploadProgress,
};

const demoSteps = {
  ping: {
    step: 1,
    total: 10,
  },
  download: {
    step: 10,
    total: 100,
  },
  upload: {
    step: 10,
    total: 100,
  },
};

console.log(renderBanner());
console.log();

for (const phase of phaseOrder) {
  const spinner = createPhaseSpinner(phase, 'Preparing UI demo', { isEnabled: true }).start();

  await delay(300);
  spinner.update('Rendering progress component');
  await delay(300);
  spinner.succeed('Spinner ready');

  const progress = progressFactories[phase]({
    clearOnComplete: false,
    noTTYOutput: true,
    notTTYSchedule: 100,
    stream: process.stdout,
  }).start(0, { detail: 'starting' });

  const demo = demoSteps[phase];

  for (let value = demo.step; value <= demo.total; value += demo.step) {
    progress.update(value, { detail: 'demo' });
    await delay(80);
  }

  progress.complete({ detail: 'complete' });
}
