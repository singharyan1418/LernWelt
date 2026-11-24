import cp from 'node:child_process';
import process from 'node:process';

/**
 * Full-Stack Cloud Run Entry Point
 *
 * When started by Cloud Run's production runner ("node server.ts"),
 * this trampoline automatically ensures the tsx module loader is loaded
 * so all TypeScript imports across the full-stack app are resolved seamlessly.
 */
const isTsxActive =
  process.execArgv.some((arg) => arg.includes('tsx')) || process.env.TSX_LOADED === '1';

if (!isTsxActive) {
  process.env.TSX_LOADED = '1';
  const child = cp.spawn(process.execPath, ['--import', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_LOADED: '1' }
  });

  const forwardSignal = (sig: NodeJS.Signals) => {
    if (child && !child.killed) {
      try {
        child.kill(sig);
      } catch {}
    }
  };

  process.on('SIGTERM', () => forwardSignal('SIGTERM'));
  process.on('SIGINT', () => forwardSignal('SIGINT'));

  child.on('error', (err) => {
    console.error('[Server Trampoline] Failed to launch server process:', err);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    }
    process.exit(code ?? 0);
  });
} else {
  // TSX loader is active; load the full application server
  await import('./src/server/server.ts');
}
