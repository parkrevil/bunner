import { runMcpServer } from './server';

const runMcp = async (): Promise<void> => {
  await runMcpServer();
};

export { runMcp };
