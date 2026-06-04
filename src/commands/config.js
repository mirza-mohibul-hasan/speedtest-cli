import chalk from 'chalk';

export function registerConfigCommand(program) {
  program
    .command('config')
    .description('View or update speedtest-cli settings.')
    .action(() => {
      console.log(chalk.yellow('The config command will be implemented in a later commit.'));
    });
}
