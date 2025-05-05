import type { Config } from '../types/Config.ts'

// .env values may be on disk, or already set in the environment (such as by docker run --env-file)
try {
  process.loadEnvFile('.env');
} catch (e) {
  console.error(e);
}

// help out tsc by parsing environment variables in a way that only returns string (or errors)
const safeLoadEnvValue = (envKey: string) => {
  if (process.env[envKey]) return process.env[envKey];
  throw new Error(envKey);
};

export const config: Config = {
  port: parseInt(safeLoadEnvValue('PORT')),
  authorization_server: {
    base_url: new URL(safeLoadEnvValue('AUTHORIZATION_SERVER_BASE_URL')),
    getCleanBaseURL: () => config.authorization_server.base_url.toString().replace(/\/$/, ''), // remove trailing slash if present
  },
  resource_server: {
    base_url: new URL(safeLoadEnvValue('RESOURCE_SERVER_BASE_URL')),
    getCleanBaseURL: () => config.authorization_server.base_url.toString().replace(/\/$/, ''), // remove trailing slash if present
  },
  client: {
    base_url: new URL(safeLoadEnvValue('CLIENT_BASE_URL')),
    getCleanBaseURL: () => config.client.base_url.toString().replace(/\/$/, ''), // remove trailing slash if present
  },
  signal_service: {
    base_url: new URL(safeLoadEnvValue('SIGNAL_SERVICE_BASE_URL')),
  },
  from_number: safeLoadEnvValue('FROM_NUMBER'),
  device_name: safeLoadEnvValue('DEVICE_NAME'),
  challenge_code_length: 6,
};
