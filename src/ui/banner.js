import chalk from 'chalk';
import gradient from 'gradient-string';

const banner = String.raw`
                    _ _            _              _ _
 ___ _ __   ___  __| | |_ ___  ___| |_        ___| (_)
/ __| '_ \ / _ \/ _  | __/ _ \/ __| __|_____ / __| | |
\__ \ |_) |  __/ (_| | ||  __/\__ \ ||_____| (__| | |
|___/ .__/ \___|\__,_|\__\___||___/\__|     \___|_|_|
    |_|
`;

export function renderBanner() {
  return [
    gradient(['cyan', 'magenta']).multiline(banner),
    chalk.dim('Measure latency, download, and upload from your terminal.'),
  ].join('\n');
}
