import type { Command } from '../interfaces';

/**
 * Dependency Injection command.
 */
export class DiCommand implements Command {
  /**
   * Execute the di command.
   * @param args Command line arguments.
   * @returns 
   */
  public async execute(args: string[]): Promise<void> {
    if (args.includes('--help') || args.includes('-h')) {
      return this.showHelp();
    }

    try {

    } catch (e) {
      console.error('❌ Dependency injection information analysis failed:', e);

      process.exit(1);
    }
  }

  /**
   * Show the help for the di command.
   */
  public showHelp() {}
}
