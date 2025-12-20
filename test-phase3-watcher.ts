import { ProjectWatcher } from './packages/cli/src/watcher/project-watcher';

async function testPhase3Watcher() {
  await Promise.resolve();
  console.log('🧪 Starting Phase 3 Tests (Watcher)...\n');

  // Watch current directory for test
  const cwd = process.cwd();
  const watcher = new ProjectWatcher(cwd);

  watcher.start(event => {
    console.log(`[Watcher Event] ${event.eventType}: ${event.filename}`);
  });

  console.log('--- Triggering file change ---');
  // Create a dummy file to trigger watch
  const dummyFile = 'temp_watch_test.ts';
  await Bun.write(dummyFile, '// test content');

  // Wait a bit for the watcher to pick it up
  await new Promise(resolve => setTimeout(resolve, 500));

  // Clean up
  // await Bun.file(dummyFile).delete(); // delete() might not be available on BunFile directly in older versions, usually unlink
  // Using unlinkSync for cleanup simplicity or Bun.write empty
  await Bun.write(dummyFile, '');

  console.log('--- Stop Watcher ---');
  watcher.close();
}

testPhase3Watcher().catch(console.error);
