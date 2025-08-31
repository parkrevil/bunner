export interface Command {
  /**
   * Executes the command.
   * @param args 
   */
  execute(args: string[]): Promise<void>;

  /**
   * Shows the help for the command.
   */
  showHelp(): void;
}
