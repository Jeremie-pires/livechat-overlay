import 'dotenv/config';
//@ts-ignore
// eslint-disable-next-line import/no-unresolved
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.string().default('development'),
    APP_ENV: z.enum(['production', 'staging', 'development']).default('development'),
    LOG: z.enum(['info', 'debug', 'error', 'silent', 'warning']).default('info'),
    PORT: z
      .string()
      .default('3000')
      .transform((s) => parseInt(s)),

    I18N: z.string().default('fr'),

    API_URL: z.string().url(),

    DISCORD_TOKEN: z.string(),
    DISCORD_CLIENT_ID: z.string(),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_OWNER_ID: z.string().min(1),

    DATABASE_URL: z.string().url(),

    TZ: z.string().optional(),
    HIDE_COMMANDS_DISABLED: z.string().default('false'),
    DEFAULT_DURATION: z
      .string()
      .default('5')
      .transform((s) => parseInt(s)),
  },
  runtimeEnv: process.env,
});

export const validateEnvCoherence = (): void => {
  const appEnv = env.APP_ENV;
  const dbUrl = env.DATABASE_URL;
  const maskedClientId = `${env.DISCORD_CLIENT_ID.slice(0, 6)}…`;

  const safeDsn = dbUrl.includes('@') ? dbUrl.replace(/:\/\/([^@]+)@/, '://[masked]@') : dbUrl;
  // eslint-disable-next-line no-console
  console.info(`[ENV] APP_ENV=${appEnv} | DB=${safeDsn} | DISCORD_CLIENT_ID=${maskedClientId}`);

  if (appEnv === 'production' && dbUrl.includes('sqlite-dev')) {
    throw new Error(
      `[ENV] FATAL: APP_ENV=production but DATABASE_URL references a dev database ("${dbUrl}"). Boot aborted to prevent environment cross-contamination.`,
    );
  }

  if (appEnv === 'staging' && !dbUrl.includes('dev')) {
    throw new Error(
      `[ENV] FATAL: APP_ENV=staging but DATABASE_URL does not reference a dev database ("${dbUrl}"). Boot aborted to prevent environment cross-contamination.`,
    );
  }
};

export enum Environment {
  TEST = 'test',
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PREPRODUCTION = 'preproduction',
  PRODUCTION = 'production',
}

export const currentEnv = () => env.NODE_ENV.toLowerCase().trim();
export const isProductionEnv = () => currentEnv() === Environment.PRODUCTION;
export const isPreProductionEnv = () => currentEnv() === Environment.PREPRODUCTION;
export const isStagingEnv = () => currentEnv() === Environment.STAGING;
export const isDevelopmentEnv = () => currentEnv() === Environment.DEVELOPMENT;
export const isTestEnv = () => currentEnv() === Environment.TEST;
export const isDeployedEnv = () =>
  Object.values(Environment)
    .filter((v) => v !== Environment.TEST && v !== Environment.DEVELOPMENT)
    .indexOf(currentEnv() as Environment) !== -1;
