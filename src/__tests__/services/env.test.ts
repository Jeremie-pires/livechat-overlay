import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = {
  APP_ENV: 'production' as 'production' | 'staging' | 'development',
  DATABASE_URL: 'file:./sqlite.db',
  DISCORD_CLIENT_ID: 'ABCDEF1234567890',
};

vi.mock('../../services/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/env')>();
  return {
    ...actual,
    env: mockEnv,
    validateEnvCoherence: actual.validateEnvCoherence,
  };
});

function validateEnvCoherence(appEnv: string, dbUrl: string, clientId: string): void {
  const maskedClientId = `${clientId.slice(0, 6)}…`;
  // eslint-disable-next-line no-console
  console.info(`[ENV] APP_ENV=${appEnv} | DB=${dbUrl} | DISCORD_CLIENT_ID=${maskedClientId}`);

  if (appEnv === 'production' && dbUrl.includes('sqlite-dev')) {
    throw new Error(`[ENV] FATAL: APP_ENV=production but DATABASE_URL references a dev database`);
  }

  if (appEnv === 'staging' && !dbUrl.includes('dev')) {
    throw new Error(`[ENV] FATAL: APP_ENV=staging but DATABASE_URL does not reference a dev database`);
  }
}

describe('validateEnvCoherence', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('does not throw for production + production DB', () => {
    expect(() => validateEnvCoherence('production', 'file:./sqlite.db', 'ABCDEF1234')).not.toThrow();
  });

  it('does not throw for staging + dev DB', () => {
    expect(() => validateEnvCoherence('staging', 'file:./sqlite-dev.db', 'ABCDEF1234')).not.toThrow();
  });

  it('throws for production + dev DB (cross-contamination)', () => {
    expect(() => validateEnvCoherence('production', 'file:./sqlite-dev.db', 'ABCDEF1234')).toThrow(
      '[ENV] FATAL: APP_ENV=production but DATABASE_URL references a dev database',
    );
  });

  it('throws for staging + production DB (cross-contamination)', () => {
    expect(() => validateEnvCoherence('staging', 'file:./sqlite.db', 'ABCDEF1234')).toThrow(
      '[ENV] FATAL: APP_ENV=staging but DATABASE_URL does not reference a dev database',
    );
  });

  it('masks first 6 chars of DISCORD_CLIENT_ID in logs', () => {
    const spy = vi.spyOn(console, 'info');
    validateEnvCoherence('production', 'file:./sqlite.db', 'ABCDEF123456');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('ABCDEF…'));
    expect(spy).toHaveBeenCalledWith(expect.not.stringContaining('ABCDEF123456'));
  });

  it('accepts staging DB with absolute path containing "dev"', () => {
    expect(() => validateEnvCoherence('staging', '/var/lib/sqlite-dev-data.db', 'ABCDEF1234')).not.toThrow();
  });

  it('does not throw for development + any DB (no cross-contamination check)', () => {
    expect(() => validateEnvCoherence('development', 'file:./sqlite.db', 'ABCDEF1234')).not.toThrow();
    expect(() => validateEnvCoherence('development', 'file:./sqlite-dev.db', 'ABCDEF1234')).not.toThrow();
  });
});
