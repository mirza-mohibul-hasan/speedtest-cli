import { registerConfigCommand } from './config.js';
import { registerHistoryCommand } from './history.js';
import { registerTestCommand } from './test.js';

export function registerCommands(program) {
  registerTestCommand(program);
  registerHistoryCommand(program);
  registerConfigCommand(program);
}
