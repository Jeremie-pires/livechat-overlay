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
      settle(code !== 0 ? null : onOutput(stdout));
    });

    proc.on('error', () => {
      clearTimeout(timer);
      settle(null);
    });
  });
}
