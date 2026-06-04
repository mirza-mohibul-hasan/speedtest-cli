import chalk from 'chalk';

export function registerTestCommand(program) {
  program
    .command('test')
    .description('Run a full ping, download, and upload speed test.')
    .action(() => {
      console.log(chalk.yellow('The test command will be implemented in a later commit.'));
    });
}
