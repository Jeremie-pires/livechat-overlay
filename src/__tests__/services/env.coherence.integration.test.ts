import { describe, it, expect } from 'vitest';

type AppEnv = 'production' | 'staging';

function checkCoherence(appEnv: AppEnv, dbUrl: string): 'ok' | 'prod-with-dev-db' | 'staging-without-dev-db' {
  if (appEnv === 'production' && dbUrl.includes('sqlite-dev')) return 'prod-with-dev-db';
  if (appEnv === 'staging' && !dbUrl.includes('dev')) return 'staging-without-dev-db';
  return 'ok';
}

describe('APP_ENV / DATABASE_URL coherence — edge cases (string heuristic)', () => {
  it('PASS: production + sqlite.db', () => {
    expect(checkCoherence('production', 'file:./data/sqlite.db')).toBe('ok');
  });

  it('FAIL: production + sqlite-dev.db (expected cross-contamination)', () => {
    expect(checkCoherence('production', 'file:./data/sqlite-dev.db')).toBe('prod-with-dev-db');
  });

  it('PASS: staging + sqlite-dev.db', () => {
    expect(checkCoherence('staging', 'file:./data/sqlite-dev.db')).toBe('ok');
  });

  it('FAIL: staging + sqlite.db (expected cross-contamination)', () => {
    expect(checkCoherence('staging', 'file:./data/sqlite.db')).toBe('staging-without-dev-db');
  });

  it('FRAGILE: staging + sqlite-development.db passes because it contains "dev"', () => {
    expect(checkCoherence('staging', 'file:./sqlite-development.db')).toBe('ok');
  });

  it('FRAGILE: staging + sqlite-review.db fails because no "dev"', () => {
    expect(checkCoherence('staging', 'file:./sqlite-review.db')).toBe('staging-without-dev-db');
  });
});
