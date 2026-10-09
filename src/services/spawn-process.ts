import { spawn } from 'node:child_process';

export function runProcess<T>(
  command: string,
  args: string[],
  timeoutMs: number,
  onOutput: (stdout: string) => T | null,
): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (val: T | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      settle(null);
      return;
    }

    let stdout = '';
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      settle(null);
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        settle(onOutput(stdout));
      } else {
        // Non-zero exit: still try to parse stdout — yt-dlp exits 1 when it
        // cannot write back the cookie jar (read-only mount) even after a
        // successful extraction. If onOutput returns a valid result we keep it.
        const result = stdout.length > 0 ? onOutput(stdout) : null;
        settle(result);
      }
    });

    proc.on('error', () => {
      clearTimeout(timer);
      settle(null);
    });
  });
}
