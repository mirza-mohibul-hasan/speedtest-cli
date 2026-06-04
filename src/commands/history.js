import chalk from 'chalk';

export function registerHistoryCommand(program) {
  program
    .command('history')
    .description('Show saved speed test results.')
    .action(() => {
      console.log(chalk.yellow('The history command will be implemented in a later commit.'));
    });
}
