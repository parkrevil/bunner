#!/usr/bin/env bun

import { DiCommand } from './di';
import type { Command } from './interfaces';

export class BunnerCLI {
  private commands: Map<string, Command> = new Map();

  constructor() {
    this.registerCommands();
  }

  /**
   * Register the available commands.
   */
  private registerCommands(): void {
    this.commands.set('di', new DiCommand());
  }

  /**
   * Run the CLI.
   * Parse the command line arguments and execute the corresponding command.
   */
  public async run(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      return this.showHelp();
    }

    const commandName = args[0];
    const commandArgs = args.slice(1);

    if (!commandName) {
      return this.showHelp();
    }

    const command = this.commands.get(commandName);

    if (!command) {
      console.error(`❌ Unknown command: ${commandName}. Use the --help option to see the available commands.`);

      process.exit(1);
    }

    await command.execute(commandArgs);
  }

  /**
   * Show the help for the CLI.
   */
  private showHelp(): void {
    console.log(`
🚀 Bunner CLI

Usage:
  bunner <command> [options]

Commands:
  di        Display the dependency injection information

Help:
  bunner <command> --help    Show the help for a specific command
        `);
  }
}
