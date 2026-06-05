import { registerConfigCommand } from './config.js';
import { registerDiagnoseCommand } from './diagnose.js';
import { registerHistoryCommand } from './history.js';
import { registerTestCommand } from './test.js';

export function registerCommands(program) {
  registerTestCommand(program);
  registerDiagnoseCommand(program);
  registerHistoryCommand(program);
  registerConfigCommand(program);
}
